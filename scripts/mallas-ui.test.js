/* =========================================================
Nombre completo: mallas-ui.test.js
Ruta o ubicación: /Curriculo/scripts/mallas-ui.test.js
Funciones:
- Verificar que la pantalla simple de mallas conserve todos los controles requeridos.
- Confirmar que el módulo cargue materias desde Firebase y permita agregar y guardar.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const raiz = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "mallas", "mallas.html"), "utf8");
const js = fs.readFileSync(path.join(raiz, "mallas", "mallas.main.js"), "utf8");

const idsRequeridos = [
  "inputCarrera",
  "panelMaterias",
  "listaMateriasMalla",
  "btnAgregarMateria",
  "btnGuardarMalla",
  "modalAgregarMateria",
  "formAgregarMateria",
  "modalOpciones",
  "modalHistorial",
  "inputVersion",
  "inputEstadoMalla",
  "inputRequisitos"
];

idsRequeridos.forEach((id) => {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Falta el control #${id} en mallas.html`);
  assert.match(js, new RegExp(`\\$\\(["']${id}["']\\)`), `mallas.main.js no utiliza #${id}`);
});

assert.match(js, /Firebase\.obtenerMateriasPorCarrera/, "La malla debe cargar materias existentes desde Firebase.");
assert.match(js, /Firebase\.Mallas\.obtenerMallaVigenteParaCarrera/, "La malla debe abrir la versión vigente cuando exista.");
assert.match(js, /Firebase\.Mallas\.guardarMalla/, "La pantalla debe guardar la malla en Firebase.");
assert.match(js, /function agregarMateriaNueva\(/, "Debe existir el flujo para agregar materias.");
assert.match(js, /function fusionarMaterias\(/, "Debe evitar duplicar materias al combinar Firebase y la malla.");

console.log("✓ Flujo simple de mallas verificado");
