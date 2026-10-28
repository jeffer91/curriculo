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

function fakeDOM() {
  const all = {};
  function get(id) {
    if (!all[id]) {
      const callbacks = {};
      all[id] = {
        value: "", files: [], disabled: false, textContent: "",
        innerHTML: "", children: [], callbacks,
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(type, fn) { callbacks[type] = fn; },
        setAttribute() {}, appendChild(child) { this.children.push(child); }
      };
    }
    return all[id];
  }
  return { get, document: {
    getElementById: get,
    createElement() { return { textContent: "", value: "" }; }
  } };
}
async function pruebaIndividual() {
  const ui = fakeDOM();
  let importaciones = 0, refrescos = 0;
  const ctx = { carrera: { id: "carrera_redes", nombre: "Redes y Telecomunicaciones" },
    nivelNumero: 1, periodo: "Octubre 2025 - Septiembre 2026",
    token: 3, materiasEstado: [] };
  const win = {
    XLSX: {},
    CurriculoFirebase: {
      obtenerMateriasPorCarrera: async () => [],
      importarMateriaDesdeFichas: async (pkg, options) => {
        assert.strictEqual(pkg.materias.length, 1);
        assert.strictEqual(pkg.archivos.length, 3);
        assert.deepStrictEqual(pkg.archivos.map(a => a.tipo),
          ["pea_base","pea_unidades","pea_actividades"]);
        assert.strictEqual(pkg.materias[0].nombre, "Office Essentials");
        assert.strictEqual(options.materiaFirebaseId, "");
        importaciones++;
        return { tipo: "creada", version: 1 };
      }
    },
    SubirCCC: {
      Excel: { enriquecerPaqueteConExcel: async pkg => {
        pkg.archivos.forEach(a => { a.excelLeido = true; a.datosProcesados = { ejemplo: true }; });
        return pkg;
      }},
      Validador: { validarPaquete: pkg => Object.assign(pkg, {
        evaluacionesMaterias: [{ estado: "completo" }],
        resumenValidacion: { bloqueaImportacion: false }
      })}
    }
  };
  new Function("window","document",excel)(win, ui.document);
  win.CurriculoFichasCargaExcel.instalar({
    getContexto: () => ctx,
    onGuardado: async () => { refrescos++; }
  });
  await win.CurriculoFichasCargaExcel.abrir({
    esperada: { nombreOficial: "Office Essentials", nivelNumero: 1 }, actual: null
  });
  ["materiaExcelBase","materiaExcelUnidades","materiaExcelActividades"].forEach(id => {
    ui.get(id).files = [{ name: id + ".xlsx", size: 50,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }];
  });
  await ui.get("btnGuardarMateriaExcel").callbacks.click();
  assert.strictEqual(importaciones, 1);
  assert.strictEqual(refrescos, 1);
}
pruebaIndividual().then(() => console.log("Fichas: importación individual verificada con servicios simulados."))
  .catch(err => { console.error(err); process.exitCode = 1; });

