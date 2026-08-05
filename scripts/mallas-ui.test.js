/* =========================================================
Nombre completo: mallas-ui.test.js
Ruta o ubicación: /Curriculo/scripts/mallas-ui.test.js
Funciones:
- Verificar la pantalla simple de mallas.
- Confirmar nombres editables, materias sin código y versiones automáticas.
- Confirmar que la conciliación se carga antes del módulo principal.
- Confirmar que las ediciones se sincronicen antes de guardar.
- Evitar que regresen fechas, requisitos o controles manuales de versión.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const raiz = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "mallas", "mallas.html"), "utf8");
const js = fs.readFileSync(path.join(raiz, "mallas", "mallas.main.js"), "utf8");
const parser = fs.readFileSync(path.join(raiz, "mallas", "mallas.parser.js"), "utf8");
const conciliador = fs.readFileSync(path.join(raiz, "mallas", "mallas.conciliador.js"), "utf8");
const conciliacionUI = fs.readFileSync(path.join(raiz, "mallas", "mallas.conciliacion-ui.js"), "utf8");
const edicionUI = fs.readFileSync(path.join(raiz, "mallas", "mallas.edicion-ui.js"), "utf8");
const firebase = fs.readFileSync(path.join(raiz, "firebase", "firebase.mallas.js"), "utf8");
const comparador = fs.readFileSync(path.join(raiz, "mallas", "mallas.comparador.js"), "utf8");

const idsRequeridos = [
  "inputCarrera",
  "inputNombreCarrera",
  "panelMaterias",
  "listaMateriasMalla",
  "btnAgregarMateria",
  "btnGuardarMalla",
  "modalAgregarMateria",
  "formAgregarMateria",
  "modalOpciones",
  "modalHistorial",
  "inputObservaciones"
];

idsRequeridos.forEach((id) => {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Falta el control #${id} en mallas.html`);
  assert.match(js, new RegExp(`["']${id}["']`), `mallas.main.js no utiliza #${id}`);
});

const idsEliminados = [
  "inputNuevaCodigo",
  "inputVersion",
  "inputEstadoMalla",
  "inputPeriodoInicio",
  "inputPeriodoFin",
  "inputRequisitos",
  "checkVigente",
  "btnNuevaVersion"
];

idsEliminados.forEach((id) => {
  assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`), `El control eliminado #${id} volvió a la interfaz`);
  assert.doesNotMatch(js, new RegExp(`["']${id}["']`), `mallas.main.js todavía usa #${id}`);
});

assert.doesNotMatch(html, />Código</i, "La interfaz de mallas no debe solicitar códigos.");
assert.doesNotMatch(html, /Requisitos adicionales/i, "La interfaz no debe mostrar requisitos adicionales.");
assert.match(js, /Firebase\.obtenerMateriasPorCarrera/, "La malla debe cargar materias desde Firebase.");
assert.match(js, /inputNombreCarrera/, "Debe permitir corregir el nombre oficial de la carrera.");
assert.match(js, /data-campo=\\?"nombreOficial/, "Debe permitir corregir nombres de materias.");
assert.match(firebase, /materiaFirebaseId/, "La malla debe conservar el vínculo con la materia original.");
assert.match(firebase, /firmaMalla/, "Firebase debe comparar cambios reales antes de versionar.");
assert.match(firebase, /version\s*=\s*versiones\.reduce/, "La versión debe calcularse automáticamente.");
assert.match(firebase, /sinCambios/, "Guardar sin cambios no debe crear una nueva versión.");
assert.doesNotMatch(firebase, /codigo:\s*texto\(materia\.codigo\)/, "Las nuevas materias de malla no deben guardar códigos.");
assert.doesNotMatch(comparador, /codigo_y_nivel|__codigo|function codigo\(/, "El comparador no debe usar códigos para vincular materias.");
assert.match(comparador, /equivalencia_guardada/, "El comparador debe conservar las equivalencias confirmadas.");
assert.match(comparador, /nombre_y_nivel/, "El comparador debe usar nombre y nivel.");

const posicionConciliador = html.indexOf("mallas.conciliador.js");
const posicionConciliacionUI = html.indexOf("mallas.conciliacion-ui.js");
const posicionPrincipal = html.indexOf("mallas.main.js");
const posicionEdicionUI = html.indexOf("mallas.edicion-ui.js");
assert.ok(posicionConciliador >= 0, "La pantalla debe cargar el conciliador");
assert.ok(posicionConciliacionUI > posicionConciliador, "La conciliación de interfaz debe cargarse después del conciliador");
assert.ok(posicionPrincipal > posicionConciliacionUI, "La conciliación debe activarse antes del módulo principal");
assert.ok(posicionEdicionUI > posicionPrincipal, "La protección de edición debe cargarse después del módulo principal");
assert.match(parser, /ROMANOS/, "El parser debe normalizar números romanos");
assert.match(conciliador, /sonIgualesSeguras/, "Debe reconocer coincidencias seguras");
assert.match(conciliador, /buscarMejorPosible/, "Debe detectar coincidencias dudosas");
assert.match(conciliacionUI, /window\.confirm/, "Las coincidencias dudosas deben solicitar confirmación");
assert.match(edicionUI, /reenviarInput/, "La edición debe reenviar el valor al estado interno");
assert.match(edicionUI, /btnGuardarMalla/, "Las ediciones deben sincronizarse antes de guardar");
assert.match(edicionUI, /removeAttribute\("readonly"\)/, "Los nombres no deben quedar en modo de solo lectura");

console.log("✓ Mallas simples: nombres editables, sincronizados, sin códigos, conciliación y versiones automáticas");
