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
const contabilidad = catalogo.obtenerPorCarrera({ nombreInstitucional: "Contabilidad" });
assert.ok(contabilidad);
assert.strictEqual(contabilidad.malla.carreraNombre, "Contabilidad");
assert.strictEqual(contabilidad.malla.version, null);
assert.strictEqual(contabilidad.malla.vigenciaInicio, null);
assert.strictEqual(contabilidad.malla.vigenciaFin, null);
assert.strictEqual(contabilidad.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => contabilidad.materias.filter(m => m.nivelNumero === n).length), [6, 4, 5, 6]);
const esperadasContabilidad = [
  "Administración",
  "Ofimática",
  "Comunicación Oral y Escrita",
  "Matemática Financiera",
  "Legislación Mercantil y Tributaria",
  "Contabilidad General",
  "Contabilidad General II",
  "Contabilidad de Costos I",
  "Finanzas",
  "Tributación",
  "Contabilidad Superior I",
  "Contabilidad de Costos II",
  "Análisis Financiero",
  "Presupuesto",
  "Sistema Contable",
  "Métodos Cuantitativos para la Toma de Decisiones",
  "Planificación Estratégica",
  "Entrepreneurship",
  "Contabilidad Superior 2",
  "Auditoría Financiera",
  "Unidad de Integración Curricular"
];
assert.deepStrictEqual(Array.from(contabilidad.materias.map(m => m.nombreOficial)), esperadasContabilidad);
assert.strictEqual(contabilidad.materias[19].nombreOficial, "Auditoría Financiera");
assert.strictEqual(contabilidad.materias[18].nombreOficial, "Contabilidad Superior 2");
assert.strictEqual(contabilidad.materias[20].tipo, "integracion_curricular");

assert.strictEqual(catalogo.obtenerPorCarrera("Desarrollo de Software").materias.length, 21);

const diseno = catalogo.obtenerPorCarrera({ nombreInstitucional: "Diseño Multimedia" });
assert.ok(diseno, "Diseño Multimedia debe existir en código");
assert.strictEqual(diseno.malla.carreraNombre, "Diseño Multimedia");
assert.strictEqual(diseno.malla.version, null);
assert.strictEqual(diseno.malla.vigenciaInicio, null);
assert.strictEqual(diseno.malla.vigenciaFin, null);
assert.strictEqual(diseno.materias.length, 19);
assert.deepStrictEqual(
  Array.from([1, 2, 3, 4], n => diseno.materias.filter(m => m.nivelNumero === n).length),
  [5, 5, 5, 4]
);
const esperadasDiseno = [
  "Branding digital",
  "Semiología de la imagen",
  "Creatividad",
  "Fundamentos de programación",
  "Figura humana y diseño de personaje",
  "Diseño WEB I",
  "Marketing digital",
  "Multimedia",
  "Diseño gráfico",
  "Producción audiovisual",
  "Motion design",
  "Programación de videojuegos",
  "Animación y Diseño 2D y 3D",
  "Producción de sonido",
  "Redacción de contenidos multimedia",
  "Modelación e impresión 3D",
  "UX / UI",
  "Inteligencia artificial orientada al diseño",
  "Entrepreneurship"
];
assert.deepStrictEqual(Array.from(diseno.materias.map(m => m.nombreOficial)), esperadasDiseno);
assert.strictEqual(diseno.materias.some(m => m.tipo === "integracion_curricular"), false);
assert.strictEqual(new Set(diseno.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 19);
assert.strictEqual(catalogo.obtenerPorCarrera("Diseno Multimedia").materias.length, 19);
assert.strictEqual(catalogo.obtenerPorCarrera("Educación Básica"), null);
assert.strictEqual(catalogo.listarCarreras().length, 4);


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

console.log("Mallas codificadas verificadas: cuatro carreras y 82 asignaturas.");
