"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

const listeners = {};
const document = {
  getElementById() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener(tipo, handler) {
    listeners[tipo] = handler;
  },
  createElement() {
    return {
      className: "",
      textContent: "",
      type: "button",
      setAttribute() {},
      classList: { add() {} }
    };
  }
};

let pintarEjecutado = false;
let limpiarEjecutado = false;

const context = {
  window: {
    SubirCCC: {
      Preview: {
        pintarPaquete() {
          pintarEjecutado = true;
          return "pintado";
        },
        limpiarPreview() {
          limpiarEjecutado = true;
          return "limpio";
        }
      }
    },
    setTimeout(handler) {
      handler();
    }
  },
  document,
  console
};

vm.createContext(context);
vm.runInContext(leer("subir/subir.advertencias-ui.js"), context, {
  filename: "subir.advertencias-ui.js"
});

const UI = context.window.SubirCCC.AdvertenciasUI;
assert.ok(UI, "Debe exponerse SubirCCC.AdvertenciasUI.");
assert.strictEqual(UI.VERSION, "3.0.0");
assert.strictEqual(context.window.SubirCCC.Preview.__advertenciasUI, true);
assert.strictEqual(typeof listeners.click, "function");
assert.strictEqual(typeof listeners.input, "function");

const validacion = {
  tipo: "contenido_base_incompleto",
  severidad: "advertencia",
  bloqueaImportacion: false,
  mensaje: "No se identificó el objetivo de la asignatura.",
  diagnosticoUsuario: {
    titulo: "PEA Base con información incompleta",
    problema: "No se identificó el objetivo de la asignatura.",
    solucion: "Completa el objetivo de la asignatura y vuelve a escanear.",
    accionRecomendada: "Corregir el PEA Base.",
    impacto: "No bloquea la importación, pero conviene corregirla.",
    severidad: "advertencia",
    bloqueaImportacion: false,
    puedeImportar: true,
    archivo: {
      nombre: "PEA Base Costos.xlsx",
      ruta: "MATRIZ CCC/Contabilidad/Nivel 2/Costos/PEA Base Costos.xlsx",
      tipo: "pea_base",
      motivo: "Falta el objetivo."
    }
  }
};

const html = UI.renderValidacion(validacion, 0);
assert.match(html, /PEA Base con información incompleta/);
assert.match(html, /Qué ocurrió/);
assert.match(html, /Cómo corregirlo/);
assert.match(html, /Acción recomendada/);
assert.match(html, /PEA Base Costos\.xlsx/);
assert.match(html, /Se puede importar con observaciones/);

const diagnostico = UI.diagnosticoDe(validacion);
assert.strictEqual(diagnostico.archivo.nombre, "PEA Base Costos.xlsx");
assert.strictEqual(diagnostico.bloquea, false);
assert.strictEqual(diagnostico.puedeImportar, true);

const resultadoPintar = context.window.SubirCCC.Preview.pintarPaquete({
  materias: [],
  carreras: [],
  niveles: [],
  validacionesSubida: []
});
assert.strictEqual(resultadoPintar, "pintado");
assert.strictEqual(pintarEjecutado, true);

const resultadoLimpiar = context.window.SubirCCC.Preview.limpiarPreview();
assert.strictEqual(resultadoLimpiar, "limpio");
assert.strictEqual(limpiarEjecutado, true);

console.log("Subir ZIP: interfaz de advertencias superada.");
