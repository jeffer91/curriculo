"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const codigo = fs.readFileSync(path.join(__dirname, "..", "subir", "subir.conexion-bdlocal.js"), "utf8");
const meta = new Map();
let importacionesLocales = 0;
let importacionesFirebase = 0;
let fallarFirebase = false;

function hash(valor) {
  const texto = JSON.stringify(valor, Object.keys(valor || {}).sort());
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) h = ((h << 5) - h + texto.charCodeAt(i)) | 0;
  return "h" + Math.abs(h);
}

const Local = {
  Schema: { STORES: { META: "meta" } },
  Core: {
    async get(store, key) { return meta.get(key) || null; },
    async put(store, data) { meta.set(data.key, data); return data.key; }
  },
  async inicializar() { return true; },
  async importarPaqueteCCC(paquete) {
    importacionesLocales += 1;
    return {
      ok: true,
      resumen: {
        totalMaterias: paquete.materias.length,
        materiasCompletas: paquete.materias.length,
        materiasIncompletas: 0
      }
    };
  }
};

const Firebase = {
  CONFIG: { projectId: "curriculo-prueba" },
  async ready() { return true; },
  async probarConexion() { return { ok: true }; },
  Inteligencia: {
    hashContenido: hash,
    prepararPaquete(paquete) {
      return {
        carreras: [{ id: "carrera_prueba" }],
        materias: paquete.materias.map((m) => ({
          materia: {
            id: m.id,
            hashContenido: hash({ id: m.id, contenido: m.contenido })
          }
        }))
      };
    }
  },
  ImportacionParcial: {
    separarPaquete(paquete) {
      return { paquete, omitidas: [] };
    }
  },
  async importarPaquete(paquete) {
    importacionesFirebase += 1;
    if (fallarFirebase) throw new Error("sin internet");
    return {
      ok: true,
      cargaId: "carga_" + importacionesFirebase,
      estado: "actualizado",
      resumen: {
        totalMaterias: paquete.materias.length,
        totalMateriasDetectadas: paquete.materias.length,
        totalMateriasSubidas: paquete.materias.length,
        nuevas: importacionesFirebase === 1 ? paquete.materias.length : 0,
        actualizadas: importacionesFirebase > 1 ? 1 : 0,
        sinCambios: 0,
        retiradas: 0,
        versionesCreadas: importacionesFirebase > 1 ? 1 : 0,
        operacionesFirestore: importacionesFirebase === 1 ? 4 : 2
      },
      mensaje: "Firebase sincronizado"
    };
  }
};

const context = {
  window: {
    SubirCCC: {
      Validador: {
        validarPaquete(paquete) { return paquete; }
      }
    },
    BDLocalCCC: Local,
    CurriculoFirebase: Firebase,
    dispatchEvent() {}
  },
  console,
  CustomEvent: function CustomEvent(nombre, opciones) { this.type = nombre; this.detail = opciones && opciones.detail; },
  ArrayBuffer,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  Promise,
  JSON,
  setTimeout,
  clearTimeout
};

vm.createContext(context);
vm.runInContext(codigo, context, { filename: "subir.conexion-bdlocal.js" });
const API = context.window.SubirCCC.ConexionHibrida;

function paquete(contenido) {
  return {
    carreras: [{ id: "c1", nombre: "Carrera prueba" }],
    niveles: [{ id: "n1", carreraId: "c1", numero: 1, nombre: "1. Nivel" }],
    materias: [{ id: "m1", carreraId: "c1", nivelId: "n1", nombre: "Materia", contenido, estadoValidacion: "completo" }],
    archivos: [],
    validacionesSubida: [],
    resumenValidacion: { bloqueaImportacion: false, requiereRevision: false }
  };
}

async function ejecutar() {
  const primera = await API.importarPaquete(paquete("A"), {});
  assert.strictEqual(primera.ok, true);
  assert.strictEqual(importacionesLocales, 1, "La primera carga debe guardarse localmente.");
  assert.strictEqual(importacionesFirebase, 1, "La primera carga debe sincronizar Firebase.");

  const repetida = await API.importarPaquete(paquete("A"), {});
  assert.strictEqual(importacionesLocales, 2, "Una repetición también actualiza la copia local.");
  assert.strictEqual(importacionesFirebase, 1, "Un paquete idéntico no debe consultar ni escribir Firebase otra vez.");
  assert.strictEqual(repetida.firebaseOmitida, true);
  assert.strictEqual(repetida.firebase.resumen.operacionesFirestore, 0);

  const modificada = await API.importarPaquete(paquete("B"), {});
  assert.strictEqual(importacionesLocales, 3);
  assert.strictEqual(importacionesFirebase, 2, "Un cambio real sí debe llegar a Firebase.");
  assert.strictEqual(modificada.firebaseOmitida, false);

  fallarFirebase = true;
  const offline = await API.importarPaquete(paquete("C"), {});
  assert.strictEqual(importacionesLocales, 4, "Sin internet la copia local debe conservarse.");
  assert.strictEqual(offline.estado, "guardado_local_pendiente_firebase");
  assert.strictEqual(offline.firebase.ok, false);

  console.log("Conexión híbrida: local primero, Firebase diferencial y modo offline superados.");
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});