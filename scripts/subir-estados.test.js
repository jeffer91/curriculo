"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

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
vm.runInContext(leer("subir/subir.estados.js"), context, {
  filename: "subir.estados.js"
});

const paquete = context.window.SubirCCC.Validador.validarPaquete({
  materias: [
    {
      id: "materia_completa",
      nombre: "Materia completa",
      estadoValidacion: "completo"
    },
    {
      id: "materia_advertencia",
      nombre: "Materia con advertencia",
      estadoValidacion: "revision"
    },
    {
      id: "materia_error",
      nombre: "Materia con error",
      estadoValidacion: "incompleto"
    }
  ],
  validacionesSubida: [
    {
      tipo: "contenido_base_incompleto",
      materiaId: "materia_advertencia",
      severidad: "advertencia",
      bloqueaImportacion: false,
      titulo: "PEA Base incompleto"
    },
    {
      tipo: "materia_incompleta",
      materiaId: "materia_error",
      severidad: "error",
      bloqueaImportacion: false,
      titulo: "Falta un archivo PEA"
    },
    {
      tipo: "nivel_baja_confianza",
      nivelId: "nivel_1",
      severidad: "advertencia",
      bloqueaImportacion: false,
      titulo: "Nivel con baja confianza"
    }
  ],
  resumenValidacion: {},
  carga: {}
});

const Estados = context.window.SubirCCC.Estados;
assert.ok(Estados, "Debe exponerse SubirCCC.Estados.");
assert.strictEqual(Estados.VERSION, "4.0.0");
assert.strictEqual(context.window.SubirCCC.Validador.__estadosClasificados, true);

const completa = paquete.materias.find((materia) => materia.id === "materia_completa");
const advertencia = paquete.materias.find((materia) => materia.id === "materia_advertencia");
const error = paquete.materias.find((materia) => materia.id === "materia_error");

assert.strictEqual(completa.estadoClasificado, "completa");
assert.strictEqual(completa.etiquetaEstado, "Completa");
assert.strictEqual(completa.requiereRevision, false);

assert.strictEqual(advertencia.estadoClasificado, "advertencia");
assert.strictEqual(advertencia.etiquetaEstado, "Advertencia");
assert.strictEqual(advertencia.totalAdvertenciasMateria, 1);
assert.strictEqual(advertencia.totalErroresMateria, 0);
assert.strictEqual(advertencia.requiereRevision, true);

assert.strictEqual(error.estadoClasificado, "error");
assert.strictEqual(error.etiquetaEstado, "Error");
assert.strictEqual(error.totalErroresMateria, 1);
assert.strictEqual(error.puedeImportar, true);

assert.strictEqual(paquete.resumenValidacion.totalMaterias, 3);
assert.strictEqual(paquete.resumenValidacion.materiasCompletas, 1);
assert.strictEqual(paquete.resumenValidacion.materiasAdvertencia, 1);
assert.strictEqual(paquete.resumenValidacion.materiasError, 1);
assert.strictEqual(paquete.resumenValidacion.materiasRevision, 1);
assert.strictEqual(paquete.resumenValidacion.materiasIncompletas, 1);
assert.strictEqual(paquete.resumenValidacion.alertasGlobales, 1);
assert.strictEqual(paquete.resumenValidacion.advertenciasGlobales, 1);
assert.strictEqual(paquete.resumenValidacion.totalEstadosMaterias, 3);
assert.strictEqual(paquete.resumenValidacion.contadoresConsistentes, true);
assert.strictEqual(paquete.resumenValidacion.requiereRevision, true);
assert.strictEqual(paquete.resumenValidacion.bloqueaImportacion, false);
assert.strictEqual(paquete.resumenValidacion.puedeImportarConObservaciones, true);
assert.strictEqual(paquete.carga.materiasCompletas, 1);
assert.strictEqual(paquete.carga.materiasAdvertencia, 1);
assert.strictEqual(paquete.carga.materiasError, 1);
assert.strictEqual(paquete.carga.estado, "con_observaciones");

const paqueteCritico = context.window.SubirCCC.Validador.validarPaquete({
  materias: [{ id: "materia_critica", estadoValidacion: "revision" }],
  validacionesSubida: [{
    tipo: "lectura_excel_total_fallida",
    materiaId: "materia_critica",
    severidad: "critico",
    bloqueaImportacion: true
  }],
  resumenValidacion: {},
  carga: {}
});

assert.strictEqual(paqueteCritico.materias[0].estadoClasificado, "error");
assert.strictEqual(paqueteCritico.materias[0].bloqueaImportacion, true);
assert.strictEqual(paqueteCritico.resumenValidacion.bloqueaImportacion, true);
assert.strictEqual(paqueteCritico.resumenValidacion.puedeImportarConObservaciones, false);
assert.strictEqual(paqueteCritico.carga.estado, "bloqueado");

console.log("Subir ZIP: clasificación y contadores de estados superados.");
