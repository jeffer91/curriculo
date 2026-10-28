"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const jsFiles = [
  "configuracion/ia.motor.js",
  "configuracion/configuracion.js",
  "firebase/firebase.fichas.js",
  "fichas/fichas.js"
];

jsFiles.forEach((relativePath) => {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.doesNotThrow(() => new Function(source), `Sintaxis inválida en ${relativePath}`);
});

const fichasHtml = fs.readFileSync(path.join(root, "fichas/fichas.html"), "utf8");
const configHtml = fs.readFileSync(path.join(root, "configuracion/configuracion.html"), "utf8");
const menu = fs.readFileSync(path.join(root, "menu-superior/menu-superior.js"), "utf8");
const fichasJs = fs.readFileSync(path.join(root, "fichas/fichas.js"), "utf8");

assert.ok(fichasHtml.includes('id="carreraSelect"'));
assert.ok(fichasHtml.includes('id="nivelSelect"'));
assert.ok(fichasHtml.includes('id="periodoInput"'));
assert.ok(fichasHtml.includes('id="btnGenerar"'));
assert.ok(configHtml.includes("ia.motor.js"));
assert.ok(menu.includes('id: "fichas"'));
assert.ok(menu.includes('id: "configuracion"'));
assert.ok(fichasJs.includes("No inventes cifras"));
assert.ok(fichasJs.includes("no modificar") || fichasJs.includes("No modifiques"));
assert.ok(fichasJs.includes("TIPOS_INPUT"));

console.log("Fichas e IA: estructura y sintaxis verificadas.");
