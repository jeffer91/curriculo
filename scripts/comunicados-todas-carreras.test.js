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
assert.match(html, /id="comProgresoTodas"/, "Falta la barra de progreso del lote general.");
assert.match(html, /id="comProgresoBarra"/, "Falta el indicador visual de progreso.");
assert.match(html, /id="comReporteTodas"/, "Falta el reporte visible de materias omitidas.");
assert.match(html, /id="comReporteLista"/, "Falta la lista de incidencias.");

assert.match(todas, /obtenerCarreras\(/, "Debe consultar todas las carreras.");
assert.match(todas, /obtenerMateriasPorCarrera\(/, "Debe consultar materias por carrera.");
assert.match(todas, /soloCompletas:\s*false/, "Debe revisar también materias incompletas para informar el motivo.");
assert.match(todas, /obtenerDetalleMateriaComunicado\(/, "Debe validar cada materia.");
assert.match(todas, /reservaDePrueba\(/, "Debe comprobar la plantilla antes de reservar números reales.");
assert.match(todas, /preReservarBloque\(/, "Debe reservar la numeración del lote válido.");
assert.match(todas, /registrarNumeroManual\(/, "Debe confirmar cada número después del ZIP.");
assert.match(todas, /cancelarReservasPendientes\(/, "Debe cancelar las reservas no utilizadas.");
assert.match(todas, /guardarComunicadosZIPOrganizado\(/, "Debe generar un ZIP organizado.");
assert.match(todas, /carpeta:\s*preparado\.item\.carreraNombre/, "Cada PDF debe indicar su carpeta de carrera.");
assert.match(todas, /referencia:\s*preparado\.referencia/, "Cada PDF debe conservar la referencia de la materia.");
assert.match(todas, /resultado\.omitidos/, "Debe incorporar al reporte los PDF que Electron omita.");
assert.match(todas, /mostrarReporte\(incidencias\)/, "Debe mostrar las materias que requieren revisión.");
assert.match(todas, /actualizarProgreso\(/, "Debe actualizar la barra durante el proceso.");
assert.match(todas, /MAXIMO_LOTE\s*=\s*300/, "El lote debe respetar el máximo seguro.");

assert.match(preload, /guardarComunicadosZIPOrganizado/, "El puente debe exponer el ZIP organizado.");
assert.match(preload, /zip\.folder\(carpetaSolicitada\)\.file/, "El ZIP debe crear una carpeta por carrera.");
assert.match(preload, /subarray\(0, 5\).*%PDF-/, "Cada PDF debe validarse antes de comprimirlo.");
assert.match(preload, /subarray\(0, 2\).*PK/, "El ZIP final debe validarse.");
assert.match(preload, /omitidos\.push\(/, "Un PDF con error debe omitirse sin detener todo el lote.");
assert.match(preload, /if \(!archivos\.length\)/, "Solo debe fallar cuando ningún PDF pudo generarse.");
assert.match(preload, /REPORTE DE COMUNICADOS OMITIDOS/, "El ZIP debe incluir un reporte de omisiones.");
assert.match(preload, /referencia:\s*documento\.referencia/, "El resultado debe identificar la materia de cada PDF.");
assert.match(preload, /reportarProgreso\(/, "El puente debe reportar el avance de la generación.");
assert.match(preload, /eliminarTemporal/, "Los PDF temporales deben eliminarse.");

console.log("✓ Comunicados: lote parcial, progreso, reporte y ZIP por carreras protegidos");
