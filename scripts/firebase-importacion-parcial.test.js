"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

function crearPaquete(total, completas) {
  const materias = Array.from({ length: total }, (_, indice) => {
    const numero = indice + 1;
    const completa = numero <= completas;
    return {
      id: "materia_" + numero,
      carreraId: "carrera_1",
      nivelId: numero <= 8 ? "nivel_1" : "nivel_2",
      codigo: "MAT-" + String(numero).padStart(3, "0"),
      nombre: "Materia " + numero,
      estadoClasificado: completa ? "completa" : "error",
      estadoValidacion: completa ? "completo" : "incompleto",
      bloqueaImportacion: false,
      motivosEstado: completa ? [] : ["Falta PEA Actividades"]
    };
  });

  const archivos = materias.flatMap((materia) => [
    { id: materia.id + "_b", materiaId: materia.id, tipo: "pea_base" },
    { id: materia.id + "_u", materiaId: materia.id, tipo: "pea_unidades" },
    { id: materia.id + "_a", materiaId: materia.id, tipo: "pea_actividades" }
  ]);

  return {
    carreras: [{ id: "carrera_1", nombre: "Carrera" }],
    niveles: [
      { id: "nivel_1", carreraId: "carrera_1", numero: 1 },
      { id: "nivel_2", carreraId: "carrera_1", numero: 2 }
    ],
    materias,
    archivos,
    evaluacionesMaterias: materias.map((materia) => ({
      materiaId: materia.id,
      estado: materia.estadoValidacion
    })),
    estadosMaterias: materias.map((materia) => ({
      materiaId: materia.id,
      estado: materia.estadoClasificado
    })),
    validacionesSubida: materias
      .filter((materia) => materia.estadoClasificado !== "completa")
      .map((materia) => ({
        materiaId: materia.id,
        severidad: "error",
        bloqueaImportacion: false,
        mensaje: "Falta PEA Actividades"
      })),
    resumenValidacion: {
      totalMaterias: total,
      materiasCompletas: completas,
      materiasError: total - completas,
      requiereRevision: completas !== total,
      bloqueaImportacion: false
    }
  };
}

async function probarFiltroPantalla() {
  const context = {
    window: {
      SubirCCC: {
        Validador: {
          validarPaquete(paquete) {
            return paquete;
          }
        }
      }
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(leer("subir/subir.filtro-importacion.js"), context, {
    filename: "subir.filtro-importacion.js"
  });

  const paquete = context.window.SubirCCC.Validador.validarPaquete(
    crearPaquete(16, 14)
  );
  assert.strictEqual(paquete.resumenValidacion.materiasSubibles, 14);
  assert.strictEqual(paquete.resumenValidacion.materiasOmitidas, 2);
  assert.strictEqual(paquete.resumenValidacion.bloqueaImportacion, false);
  assert.strictEqual(
    paquete.materias.filter((materia) => materia.puedeImportar).length,
    14
  );
}

async function probarCaso(total, completas) {
  let recibido = null;
  const context = {
    window: {
      CurriculoFirebase: {
        SDK_VERSION: "12.16.0",
        COLECCIONES: { CARGAS: "cargas" },
        async importarPaquete(paquete) {
          recibido = paquete;
          return {
            ok: true,
            cargaId: "carga_prueba",
            resumen: {
              nuevas: completas,
              actualizadas: 0,
              sinCambios: 0,
              versionesCreadas: 0
            }
          };
        }
      }
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Promise
  };
  vm.createContext(context);
  vm.runInContext(leer("firebase/firebase.importacion-parcial.js"), context, {
    filename: "firebase.importacion-parcial.js"
  });

  const resultado = await context.window.CurriculoFirebase.importarPaquete(
    crearPaquete(total, completas),
    {}
  );

  assert.ok(recibido, "El importador original debe recibir un paquete filtrado.");
  assert.strictEqual(recibido.materias.length, completas);
  assert.strictEqual(recibido.archivos.length, completas * 3);
  assert.ok(recibido.materias.every((materia) => materia.estadoClasificado === "completa"));
  assert.strictEqual(resultado.resumen.totalMateriasDetectadas, total);
  assert.strictEqual(resultado.resumen.totalMateriasSubidas, completas);
  assert.strictEqual(resultado.resumen.materiasOmitidas, total - completas);
  assert.strictEqual(resultado.materiasOmitidas.length, total - completas);
  assert.strictEqual(resultado.importacionParcial, completas !== total);
}

async function probarBloqueoGlobal() {
  const context = {
    window: {
      CurriculoFirebase: {
        async importarPaquete() {
          throw new Error("No debe ejecutarse");
        }
      }
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Promise
  };
  vm.createContext(context);
  vm.runInContext(leer("firebase/firebase.importacion-parcial.js"), context);

  const paquete = crearPaquete(16, 14);
  paquete.validacionesSubida.push({
    materiaId: "",
    severidad: "critico",
    bloqueaImportacion: true,
    mensaje: "No se detectó ninguna carrera"
  });

  await assert.rejects(
    () => context.window.CurriculoFirebase.importarPaquete(paquete, {}),
    /error global/i
  );
}

async function ejecutar() {
  await probarFiltroPantalla();
  await probarCaso(16, 14);
  await probarCaso(16, 2);
  await probarBloqueoGlobal();
  console.log(
    "Firebase: importación parcial segura 14/16 y 2/16 superada."
  );
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
