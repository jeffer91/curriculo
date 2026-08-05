"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "comunicados", "comunicados.html"), "utf8");
const todas = fs.readFileSync(path.join(raiz, "comunicados", "comunicados.todas-carreras.js"), "utf8");
const preload = fs.readFileSync(path.join(raiz, "electron", "preload.js"), "utf8");

assert.match(html, /id="btnGenerarTodasCarreras"/, "Falta el botón para todas las carreras.");
assert.match(html, />Generar carrera</, "El botón de la carrera debe ser claro.");
assert.match(html, /comunicados\.todas-carreras\.js/, "Falta cargar el módulo general.");

assert.match(todas, /obtenerCarreras\(/, "Debe consultar todas las carreras.");
assert.match(todas, /obtenerMateriasPorCarrera\(/, "Debe consultar materias por carrera.");
assert.match(todas, /obtenerDetalleMateriaComunicado\(/, "Debe validar cada materia.");
assert.match(todas, /preReservarBloque\(/, "Debe reservar la numeración del lote.");
assert.match(todas, /registrarNumeroManual\(/, "Debe confirmar cada número después del ZIP.");
assert.match(todas, /cancelarReservasPendientes\(/, "Debe cancelar reservas si el lote falla.");
assert.match(todas, /guardarComunicadosZIPOrganizado\(/, "Debe generar un ZIP organizado.");
assert.match(todas, /carpeta:\s*item\.carreraNombre/, "Cada PDF debe indicar su carpeta de carrera.");
assert.match(todas, /MAXIMO_LOTE\s*=\s*300/, "El lote debe respetar el máximo seguro.");

assert.match(preload, /guardarComunicadosZIPOrganizado/, "El puente debe exponer el ZIP organizado.");
assert.match(preload, /zip\.folder\(carpeta\)\.file/, "El ZIP debe crear una carpeta por carrera.");
assert.match(preload, /subarray\(0, 5\).*%PDF-/, "Cada PDF debe validarse antes de comprimirlo.");
assert.match(preload, /subarray\(0, 2\).*PK/, "El ZIP final debe validarse.");
assert.match(preload, /eliminarTemporal/, "Los PDF temporales deben eliminarse.");

console.log("✓ Comunicados: generación de todas las carreras organizada y protegida");
