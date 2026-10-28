"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

const vCode = read("fichas/fichas.validacion.js");
const scope = { window: {} };
new Function("window", vCode)(scope.window);
const V = scope.window.CurriculoFichasValidacion;
assert.ok(V);
const base = [
  { id: "m1", nivelNumero: 1, nombre: "Morfofisiología 1" },
  { id: "m2", nivelNumero: 2, nombre: "Ofimática" }
];
assert.strictEqual(V.buscarMateria({ nivelNumero: 1, nombreOficial: "MORFOFISIOLOGÍA I" }, base).id, "m1");
assert.strictEqual(V.buscarMateria({ nivelNumero: 1, nombreOficial: "Ofimática" }, base), null);
assert.strictEqual(V.buscarMateria({ nivelNumero: 1, nombreOficial: "Morfofisiología I" }, base.concat(base[0])), null);
assert.strictEqual(V.buscarMateria({ nivelNumero: 1, materiaFirebaseId: "m2", nombreOficial: "Ofimática" }, base), null);

const informe = {
  documentoNombre: "informe.pdf", periodoInforme: "Octubre 2026",
  analisisIA: { resumen: "Resultados contrastados con la evidencia institucional revisada." }
};
assert.strictEqual(V.validarInput(informe, "2026-10-27").completo, true);
assert.strictEqual(V.validarInput({ ...informe, vigenciaHasta: "2026-10-26" }, "2026-10-27").completo, false);
assert.strictEqual(V.validarInput({ ...informe, vigenciaDesde: "2026-10-28" }, "2026-10-27").completo, false);
assert.strictEqual(V.validarInput({ ...informe, analisisIA: null }, "2026-10-27").completo, false);
assert.strictEqual(V.validarInput({ ...informe, periodoInforme: "" }, "2026-10-27").completo, false);
assert.strictEqual(V.validarInput({ noAplica: true, justificacionNoAplica: "n/a" }).completo, false);
assert.strictEqual(V.validarInput({ noAplica: true, justificacionNoAplica: "No existen graduados para el período de estudio." }).completo, true);

const materias = [{ materiaId: "m1", nombre: "Morfofisiología I" }, { materiaId: "m2", nombre: "Ofimática" }];
const inputs = { graduados: {}, titulacion: {}, vinculacion: {}, practicas: {} };
const ai = {
  objetivo: "Analizar correlación curricular",
  inputs: { graduados: "Análisis de graduados", titulacion: "Análisis de titulación", vinculacion: "Análisis de vinculación", practicas: "Análisis de prácticas" },
  correlaciones: [
    { materiaId: "m1", materia: "Morfofisiología I", analisis: "Pertinencia verificada", estadoCurricular: "Mantener" },
    { materiaId: "m2", materia: "Ofimática", analisis: "Pertinencia verificada", estadoCurricular: "Mantener" }
  ],
  conclusiones: ["Conclusión basada en datos"], recomendaciones: ["Mantener evidencia"]
};
assert.deepStrictEqual(V.validarGeneracion(ai, materias, inputs), []);
assert.ok(V.validarGeneracion({ ...ai, correlaciones: ai.correlaciones.slice(0, 1) }, materias, inputs).length);
assert.ok(V.validarGeneracion({ ...ai, correlaciones: [ai.correlaciones[0], ai.correlaciones[0]] }, materias, inputs).length);
assert.ok(V.validarGeneracion({ ...ai, inputs: {} }, materias, inputs).length);
assert.deepStrictEqual(V.validarGeneracion({ ...ai, inputs: { ...ai.inputs, graduados: "" } }, materias,
  { ...inputs, graduados: { noAplica: true } }), []);

const ficha = read("fichas/fichas.js");
const periodos = read("fichas/fichas.periodos.js");
const fb = read("firebase/firebase.fichas.js");
const html = read("fichas/fichas.html");
const mallasJs = read("mallas/mallas.main.js");
const mallasHtml = read("mallas/mallas.html");
const docx = read("fichas/fichas.docx.js");
const catalogue = read("mallas/mallas.oficiales.js");
[ficha, periodos, fb, mallasJs, docx].forEach(source => assert.doesNotThrow(() => new Function(source)));
assert.ok(html.indexOf("fichas.validacion.js") < html.indexOf("./fichas.js"));
assert.ok(html.indexOf("fichas.docx.js") < html.indexOf("./fichas.js"));
assert.ok(mallasHtml.indexOf("mallas.oficiales.js") < mallasHtml.indexOf("mallas.main.js"));
assert.ok(mallasJs.includes("Catalogo.obtenerPorCarrera(carrera)"));
assert.ok(mallasJs.includes("Malla oficial protegida"));
assert.ok(ficha.includes("invalidarRevision()"));
assert.ok(ficha.includes("token !== estado.revisionToken"));
assert.ok(ficha.includes("Validacion.validarGeneracion"));
assert.ok(ficha.includes("periodoFicha: estado.periodo"));
assert.ok(ficha.includes("Fichas.guardarRevision"));
assert.ok(ficha.includes("Fichas.obtenerRevision"));
assert.ok(ficha.includes('nombreBaseFicha() + ".docx"'));
assert.ok(fb.includes("periodoFicha"));
assert.ok(fb.includes("COLECCIONES.REVISIONES"));
assert.ok(periodos.includes('input.dispatchEvent(new Event("change"))'));
assert.ok(html.includes('id="btnGuardarRevision"') && html.includes('id="btnRecuperarRevision"'));

const cat = { window: {} };
new Function("window", catalogue)(cat.window);
const carreras = cat.window.CurriculoMallasOficiales.listarCarreras();
assert.strictEqual(carreras.length, 18);
assert.strictEqual(carreras.reduce((sum, carrera) => sum + carrera.totalMaterias, 0), 363);
console.log("Fichas integridad: período, evidencia, IA, DOCX y 18 mallas verificadas.");
