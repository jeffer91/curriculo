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
    CurriculoFirebase: {
      SDK_VERSION: "12.16.0",
      CONFIG: { projectId: "prueba" },
      COLECCIONES: {},
      Inteligencia: {
        prepararPaquete(paquete) {
          return paquete.__preparado;
        },
        limpiarProfundo(valor) {
          return JSON.parse(JSON.stringify(valor || {}));
        }
      }
    }
  },
  console,
  TextEncoder,
  Date,
  Math,
  JSON,
  unescape,
  encodeURIComponent
};

vm.createContext(context);
vm.runInContext(leer("firebase/firebase.inteligencia-v2.js"), context);
vm.runInContext(leer("firebase/firebase.inteligencia-v2-ajustes.js"), context);

const I = context.window.CurriculoFirebase.Inteligencia;
assert.strictEqual(I.VERSION, "2.1.0");

const snapshotA = I.crearSnapshot(
  {
    carreraId: "carrera_1",
    carreraNombre: "Nombre anterior",
    nivelNumero: 1,
    nivelNombre: "Primer nivel",
    codigo: "ABC-101",
    nombre: "Administración I",
    estadoValidacion: "completo",
    activo: true
  },
  { descripcion: "Descripción", objetivo: "Objetivo" },
  [],
  { actividades: [] }
);
const snapshotB = I.crearSnapshot(
  {
    carreraId: "carrera_1",
    carreraNombre: "Nombre visual nuevo",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    codigo: "ABC-101",
    nombre: "Administración I",
    estadoValidacion: "advertencia",
    activo: true
  },
  { descripcion: "Descripción", objetivo: "Objetivo" },
  [],
  { actividades: [] }
);

assert.strictEqual(
  I.compararSnapshots(snapshotA, snapshotB).cambioReal,
  false,
  "Cambios de etiqueta o validación no deben crear una versión curricular."
);

const preparado = I.prepararPaquete({
  carreras: [{ id: "carrera_1", nombre: "Administración" }],
  materias: [{
    id: "origen_1",
    carreraId: "carrera_1",
    nombre: "Administración I"
  }],
  __preparado: {
    carreras: [{ id: "carrera_1", nombre: "Administración" }],
    materias: [{
      materia: {
        id: "temporal",
        carreraId: "carrera_1",
        carreraNombre: "Administración",
        nivelNumero: 1,
        nivelNombre: "1. Nivel",
        codigo: "ABC-101",
        nombre: "Administración I",
        estadoValidacion: "completo",
        activo: true
      },
      peaBase: { descripcion: "Descripción", objetivo: "Objetivo" },
      unidades: [],
      actividades: { actividades: [] }
    }],
    resumenOriginal: {},
    observaciones: []
  }
}, "carga_prueba");

assert.strictEqual(
  preparado.materias[0].materia.codigoNormalizado,
  "ABC-101",
  "El código canónico debe conservar el guion para relacionar materias antiguas."
);

const safeContext = {
  window: {
    CurriculoFirebase: {
      async importarPaquete(paquete, opciones) {
        return opciones;
      },
      Robustez: {}
    }
  }
};
vm.createContext(safeContext);
vm.runInContext(leer("firebase/firebase.robustez-ajustes.js"), safeContext);

safeContext.window.CurriculoFirebase.importarPaquete({}, {
  detectarEliminadas: true,
  cargaCompleta: true
}).then((opciones) => {
  assert.strictEqual(opciones.detectarEliminadas, false);
  assert.strictEqual(opciones.cargaCompleta, false);
  assert.strictEqual(safeContext.window.CurriculoFirebase.retirosAutomaticos, false);
  console.log("Firebase: ajustes de identidad, metadatos y retiros seguros superados.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
