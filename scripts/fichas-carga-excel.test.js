"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const html = read("fichas/fichas.html");
const fichas = read("fichas/fichas.js");
const backend = read("firebase/firebase.curriculo.js");
const excel = read("fichas/fichas.carga-excel.js");
["materiaExcelModal","materiaExcelBase","materiaExcelUnidades",
"materiaExcelActividades","materiaExcelVincular","btnGuardarMateriaExcel"].forEach(id => {
  assert.ok(html.includes('id="' + id + '"'), "Missing UI " + id);
});
assert.ok(html.indexOf("subir.excel.js") < html.indexOf("fichas.carga-excel.js"));
assert.ok(html.indexOf("subir.validador.js") < html.indexOf("fichas.carga-excel.js"));
assert.ok(html.indexOf("fichas.carga-excel.js") < html.indexOf("./fichas.js"));
assert.ok(fichas.includes("CargaExcel.abrir"));
assert.ok(fichas.includes("data-cargar-materia"));
assert.ok(backend.includes("NS.importarMateriaDesdeFichas = importarMateriaDesdeFichas"));
const indiv = backend.slice(backend.indexOf("async function importarMateriaDesdeFichas("),
  backend.indexOf("async function obtenerCarreraCanonica("));
assert.ok(!indiv.includes("operacionesMateriaRetirada"));
new Function("window","document",excel);
new Function("window","document",fichas);
new Function("window",backend);
console.log("Carga individual de PEA: UI, dependencias, funciones y sintaxis correctas.");
