const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const window = {};
const contexto = {
  window,
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  JSON,
  Blob,
  TextEncoder,
  unescape,
  encodeURIComponent
};

[
  "firebase/firebase.inteligencia.js",
  "firebase/firebase.inteligencia-v2.js",
  "firebase/firebase.transversales.js"
].forEach((archivo) => {
  vm.runInNewContext(fs.readFileSync(archivo, "utf8"), contexto, { filename: archivo });
});

const paquete = {
  carreras: [{
    id: "c1",
    nombre: "Educación Básica"
  }],
  niveles: [{
    id: "nivel_transversal",
    carreraId: "c1",
    numero: 0,
    nombre: "Transversal",
    esTransversal: true,
    perteneceMalla: false
  }],
  materias: [{
    id: "m1",
    carreraId: "c1",
    nivelId: "nivel_transversal",
    numeroNivel: 0,
    nivelNumero: 0,
    nivel: "Transversal",
    nombre: "Gestión Curricular y Evaluación en el Aula Inicial del Siglo XXI",
    nombreOriginal: "N GESTIÓN CURRICULAR Y EVALUACIÓN EN EL AULA INICIAL DEL SIGLO XXI",
    tipoMateria: "transversal",
    esTransversal: true,
    perteneceMalla: false,
    origenMateria: "institucional",
    estadoValidacion: "completo"
  }],
  archivos: []
};

let resultado;
assert.doesNotThrow(() => {
  resultado = window.CurriculoFirebase.Inteligencia.prepararPaquete(paquete, "carga_1");
}, "Una materia transversal no debe fallar por carecer de nivel académico");

assert.strictEqual(resultado.materias.length, 1);
const item = resultado.materias[0];

assert.strictEqual(item.materia.tipoMateria, "transversal");
assert.strictEqual(item.materia.esTransversal, true);
assert.strictEqual(item.materia.perteneceMalla, false);
assert.strictEqual(item.materia.origenMateria, "institucional");
assert.strictEqual(item.materia.nivelNumero, 0);
assert.strictEqual(item.materia.nivelNombre, "Transversal");
assert.strictEqual(item.materia.nivelAcademico, null);
assert.ok(item.materia.id.includes("_n00_"));
assert.ok(!item.materia.id.includes("_n999_"));
assert.ok(item.materia.nombreOriginalImportado.startsWith("N "));
assert.ok(item.materia.hashContenido);
assert.ok(item.materia.hashSecciones.materia);
assert.strictEqual(item.snapshot.materia.esTransversal, true);
assert.strictEqual(item.snapshot.materia.perteneceMalla, false);
assert.strictEqual(resultado.carreras[0].totalMateriasTransversales, 1);
assert.strictEqual(resultado.carreras[0].totalNiveles, 0);
assert.deepStrictEqual(Array.from(resultado.carreras[0].niveles), []);
assert.strictEqual(resultado.carreras[0].totalMaterias, 1);

console.log("OK: Firebase importa materias transversales sin nivel académico");
