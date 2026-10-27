"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const catalogoJs = fs.readFileSync(path.join(root, "mallas/mallas.oficiales.js"), "utf8");
const contexto = { window: {} };
vm.runInNewContext(catalogoJs, contexto);
const catalogo = contexto.window.CurriculoMallasOficiales;
assert.ok(catalogo && typeof catalogo.obtenerPorCarrera === "function");

const malla = catalogo.obtenerPorCarrera({ nombreInstitucional: "Administracion" });
assert.ok(malla);
assert.strictEqual(malla.malla.carreraNombre, "Administración");
assert.strictEqual(malla.malla.version, null);
assert.strictEqual(malla.malla.vigenciaInicio, null);
assert.strictEqual(malla.malla.vigenciaFin, null);
assert.strictEqual(malla.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => malla.materias.filter(m => m.nivelNumero === n).length), [6, 4, 5, 6]);
assert.strictEqual(malla.materias[0].nombreOficial, "Administración I");
assert.strictEqual(malla.materias[malla.materias.length - 1].nombreOficial, "Unidad de Integración Curricular");
assert.strictEqual(malla.materias[malla.materias.length - 1].tipo, "integracion_curricular");
assert.strictEqual(catalogo.obtenerPorCarrera("Contabilidad"), null);
assert.strictEqual(catalogo.obtenerPorCarrera("ADMINISTRACIÓN").materias.length, 21);

const nombres = new Set();
malla.materias.forEach(m => {
  const clave = m.nivelNumero + "|" + m.nombreOficial.toLowerCase();
  assert.ok(!nombres.has(clave), "Duplicado: " + clave);
  nombres.add(clave);
});

malla.materias[0].nombreOficial = "Cambiada en vista";
assert.strictEqual(catalogo.obtenerPorCarrera("Administración").materias[0].nombreOficial, "Administración I");

const fichasJs = fs.readFileSync(path.join(root, "fichas/fichas.js"), "utf8");
const fichasHtml = fs.readFileSync(path.join(root, "fichas/fichas.html"), "utf8");
assert.ok(fichasJs.includes("obtenerMallaParaFicha(estado.carrera)"));
assert.ok(fichasJs.includes("Mallas.obtenerMallaVigenteParaCarrera(carrera)"));
assert.ok(fichasHtml.includes("../mallas/mallas.oficiales.js"));
assert.ok(fichasHtml.indexOf("../mallas/mallas.oficiales.js") < fichasHtml.indexOf("./fichas.js"));

console.log("Catálogo oficial: Administración (4 niveles, 21 asignaturas), precedencia y compatibilidad verificados.");
