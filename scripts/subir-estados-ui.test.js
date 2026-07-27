"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

function elementoTexto() {
  return { textContent: "" };
}

const elementos = {
  statCompletas: elementoTexto(),
  statAdvertencias: elementoTexto(),
  statErrores: elementoTexto(),
  resumenEstadosMaterias: {
    title: "",
    atributos: {},
    setAttribute(nombre, valor) {
      this.atributos[nombre] = valor;
    },
    classList: {
      clases: {},
      toggle(nombre, activo) {
        this.clases[nombre] = activo;
      }
    }
  }
};

const listeners = {};
const document = {
  getElementById(id) {
    return elementos[id] || null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener(tipo, handler) {
    listeners[tipo] = handler;
  }
};

let pintarPaqueteEjecutado = false;
let limpiarEjecutado = false;
let estadoGeneral = null;

const context = {
  window: {
    SubirCCC: {
      Preview: {
        pintarPaquete() {
          pintarPaqueteEjecutado = true;
          return "pintado";
        },
        limpiarPreview() {
          limpiarEjecutado = true;
          return "limpio";
        },
        pintarEstado(tipo, titulo, mensaje) {
          estadoGeneral = { tipo, titulo, mensaje };
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
vm.runInContext(leer("subir/subir.estados-ui.js"), context, {
  filename: "subir.estados-ui.js"
});

const UI = context.window.SubirCCC.EstadosUI;
assert.ok(UI, "Debe exponerse SubirCCC.EstadosUI.");
assert.strictEqual(UI.VERSION, "4.0.1");
assert.strictEqual(context.window.SubirCCC.Preview.__estadosUI, true);
assert.strictEqual(typeof listeners.input, "function");

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(UI.normalizarEstado({ estadoClasificado: "completa" }))),
  { codigo: "completa", etiqueta: "Completa", clase: "ok" }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(UI.normalizarEstado({ estadoClasificado: "advertencia" }))),
  { codigo: "advertencia", etiqueta: "Advertencia", clase: "warn" }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(UI.normalizarEstado({ estadoClasificado: "error" }))),
  { codigo: "error", etiqueta: "Error", clase: "error" }
);
assert.match(UI.renderBadgeEstado({ estadoClasificado: "error" }), /data-estado-clasificado="error"/);
assert.match(UI.renderBadgeEstado({ estadoClasificado: "error" }), />Error</);

const resultado = context.window.SubirCCC.Preview.pintarPaquete({
  materias: [
    { id: "m1", estadoClasificado: "completa" },
    { id: "m2", estadoClasificado: "advertencia" },
    { id: "m3", estadoClasificado: "error" }
  ],
  resumenValidacion: {
    totalMaterias: 3,
    materiasCompletas: 1,
    materiasAdvertencia: 1,
    materiasError: 1,
    alertasGlobales: 0,
    bloqueaImportacion: false
  }
});

assert.strictEqual(resultado, "pintado");
assert.strictEqual(pintarPaqueteEjecutado, true);
assert.strictEqual(elementos.statCompletas.textContent, "1");
assert.strictEqual(elementos.statAdvertencias.textContent, "1");
assert.strictEqual(elementos.statErrores.textContent, "1");
assert.strictEqual(elementos.resumenEstadosMaterias.atributos["data-total-estados"], "3");
assert.strictEqual(elementos.resumenEstadosMaterias.atributos["data-total-materias"], "3");
assert.strictEqual(
  elementos.resumenEstadosMaterias.classList.clases["subir-state-summary-error"],
  false
);
assert.strictEqual(estadoGeneral.tipo, "error");
assert.strictEqual(estadoGeneral.titulo, "ZIP con errores");
assert.match(estadoGeneral.mensaje, /1 materia tiene/);

context.window.SubirCCC.Preview.limpiarPreview();
assert.strictEqual(limpiarEjecutado, true);
assert.strictEqual(elementos.statAdvertencias.textContent, "0");
assert.strictEqual(elementos.statErrores.textContent, "0");

console.log("Subir ZIP: interfaz de estados y contadores superada.");
