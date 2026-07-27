"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

let analizarEjecutado = false;
let abrirMateriaId = "";
let inputClick = false;

const inputZip = {
  value: "anterior.zip",
  click() {
    inputClick = true;
  }
};

const document = {
  getElementById(id) {
    if (id === "inputZip") return inputZip;
    return null;
  }
};

const paquete = {
  materias: [
    { id: "materia_ok", estadoClasificado: "completa" },
    { id: "materia_warn", estadoClasificado: "advertencia" },
    { id: "materia_error", estadoClasificado: "error" }
  ],
  validacionesSubida: [
    {
      materiaId: "materia_warn",
      severidad: "advertencia",
      mensaje: "Falta el objetivo."
    },
    {
      materiaId: "materia_error",
      severidad: "error",
      mensaje: "Falta PEA Actividades."
    }
  ],
  resumenValidacion: {
    totalMaterias: 3,
    materiasCompletas: 1,
    materiasAdvertencia: 1,
    materiasError: 1,
    alertasGlobales: 0,
    bloqueaImportacion: false
  }
};

const context = {
  window: {
    SubirCCC: {
      Preview: {
        pintarPaquete(valor) {
          return valor;
        },
        limpiarPreview() {
          return true;
        }
      },
      Main: {
        async analizarZIP() {
          analizarEjecutado = true;
        },
        getEstado() {
          return {
            archivoZip: { name: "curriculo.zip" },
            procesando: false,
            paqueteValidado: paquete
          };
        }
      },
      AdvertenciasUI: {
        abrirMateria(id) {
          abrirMateriaId = id;
          return true;
        }
      }
    }
  },
  document,
  console
};

vm.createContext(context);
vm.runInContext(leer("subir/subir.acciones.js"), context, {
  filename: "subir.acciones.js"
});

async function ejecutar() {
  const Acciones = context.window.SubirCCC.AccionesRevision;

  assert.ok(Acciones, "Debe exponerse SubirCCC.AccionesRevision.");
  assert.strictEqual(Acciones.VERSION, "5.0.0");
  assert.strictEqual(context.window.SubirCCC.Preview.__accionesRevision, true);

  const resumen = Acciones.resumenAcciones(paquete);
  assert.strictEqual(resumen.completas, 1);
  assert.strictEqual(resumen.advertencias, 1);
  assert.strictEqual(resumen.errores, 1);
  assert.strictEqual(resumen.totalProblemas, 2);
  assert.match(resumen.texto, /1 error/);
  assert.match(resumen.texto, /1 advertencia/);

  const primera = Acciones.primeraIncidencia(paquete);
  assert.strictEqual(primera.tipo, "materia");
  assert.strictEqual(primera.materiaId, "materia_error");
  assert.strictEqual(primera.severidad, "error");

  assert.strictEqual(Acciones.abrirPrimeraIncidencia(), false);
  context.window.SubirCCC.Preview.pintarPaquete(paquete);
  assert.strictEqual(Acciones.abrirPrimeraIncidencia(), true);
  assert.strictEqual(abrirMateriaId, "materia_error");

  assert.strictEqual(Acciones.seleccionarZipCorregido(), true);
  assert.strictEqual(inputZip.value, "");
  assert.strictEqual(inputClick, true);

  assert.strictEqual(await Acciones.reanalizar(), true);
  assert.strictEqual(analizarEjecutado, true);

  console.log("Subir ZIP: acciones de revisión y reescaneo superadas.");
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
