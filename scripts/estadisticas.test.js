"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Comparador = require("../mallas/mallas.comparador.js");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

const document = {
  getElementById() { return null; },
  addEventListener() {}
};

const context = {
  window: {
    CurriculoFirebase: {},
    MallasComparador: Comparador
  },
  document,
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
vm.runInContext(leer("estadisticas/estadisticas.js"), context, {
  filename: "estadisticas.js"
});

const API = context.window.CurriculoEstadisticas;
assert.ok(API, "Debe exponerse CurriculoEstadisticas.");

const carrera = { id: "c1", nombre: "Carrera de prueba" };
const malla = {
  malla: { id: "malla_1", vigente: true },
  materias: [
    { id: "of_a", nombreOficial: "Materia A", nivelNumero: 1, nivelNombre: "1. Nivel", tipo: "asignatura" },
    { id: "of_b", nombreOficial: "Materia B Oficial", nivelNumero: 1, nivelNombre: "1. Nivel", tipo: "asignatura" },
    { id: "of_c", nombreOficial: "Materia C", nivelNumero: 2, nivelNombre: "2. Nivel", tipo: "asignatura" },
    { id: "of_n", nombreOficial: "Proyecto Integrador", nivelNumero: 1, nivelNombre: "1. Nivel", tipo: "nucleo" }
  ],
  equivalencias: [
    {
      nombreDetectado: "Materia B Local",
      nombreDetectadoNormalizado: "materia b local",
      nivelDetectado: 1,
      mallaMateriaId: "of_b"
    }
  ]
};

const materias = [
  {
    id: "a",
    nombre: "Materia A",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    estadoValidacion: "completo"
  },
  {
    id: "b",
    nombre: "Materia B Local",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    estadoValidacion: "completo"
  },
  {
    id: "n",
    nombre: "Proyecto Integrador",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    estadoValidacion: "completo"
  },
  {
    id: "t",
    nombre: "Ética Institucional",
    nivelNumero: 0,
    estadoValidacion: "completo",
    esTransversal: true,
    perteneceMalla: false,
    tipoMateria: "transversal"
  }
];

const pendientes = [
  {
    id: "a",
    materiaId: "a",
    carreraId: "c1",
    nombre: "Materia A",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    estadoValidacion: "incompleto",
    esPendienteCurricular: true,
    origenPendiente: "registro_actual",
    pea: {
      base: "completo",
      unidades: "incompleto",
      actividades: "completo"
    }
  }
];

const fusion = API.fusionarMaterias(materias, pendientes);
assert.strictEqual(fusion.filter((item) => item.id === "a").length, 1, "El pendiente actual debe reemplazar la versión completa anterior.");
assert.strictEqual(fusion.find((item) => item.id === "a").esPendienteCurricular, true);

const filas = API.construirFilasCarrera(carrera, materias, malla, pendientes);
const a = filas.find((fila) => fila.materia === "Materia A");
const b = filas.find((fila) => fila.materia === "Materia B Oficial");
const c = filas.find((fila) => fila.materia === "Materia C");
const nucleo = filas.find((fila) => fila.materia === "Proyecto Integrador");
const transversal = filas.find((fila) => fila.materia === "Ética Institucional");

assert.ok(a && b && c && nucleo && transversal, "Deben aparecer niveles, núcleo y transversal.");
assert.strictEqual(a.estado, "incompleto");
assert.strictEqual(a.pea.unidades, "incompleto");
assert.match(a.referencia, /pendiente de corrección/i);
assert.strictEqual(b.estado, "completo");
assert.match(b.referencia, /equivalencia aprobada/i);
assert.strictEqual(c.estado, "faltante");
assert.strictEqual(nucleo.tipo, "nucleo");
assert.strictEqual(nucleo.estado, "completo");
assert.strictEqual(transversal.tipo, "transversal");
assert.strictEqual(transversal.estado, "completo");

console.log("Estadísticas: cobertura, pendientes, equivalencias, núcleos y transversales superados.");
