/* =========================================================
Nombre completo: mallas-conciliacion.test.js
Ruta o ubicación: /Curriculo/scripts/mallas-conciliacion.test.js
Funciones:
- Verificar la conciliación entre materias de Firebase y una malla importada.
- Confirmar diferencias seguras por tildes, signos y números romanos.
- Separar coincidencias dudosas y materias realmente nuevas.
========================================================= */
"use strict";

const assert = require("assert");
const Parser = require("../mallas/mallas.parser.js");
const Conciliador = require("../mallas/mallas.conciliador.js");

function materia(nivelNumero, nombreOficial, materiaFirebaseId = "") {
  return { nivelNumero, nombreOficial, materiaFirebaseId };
}

assert.strictEqual(Parser.normalizar("Metrología."), "metrologia");
assert.strictEqual(Parser.normalizar("Sistemas CAD – CAM."), "sistemas cad cam");
assert.strictEqual(Parser.normalizar("Mecánica de motos II."), "mecanica de motos 2");
assert.strictEqual(Parser.limpiarLinea("Electricidad automotriz."), "Electricidad automotriz");

assert.strictEqual(
  Conciliador.sonIgualesSeguras(
    materia(4, "Mecanica de Motos Ii", "motos_2"),
    materia(4, "Mecánica de motos II.")
  ),
  true,
  "Los números romanos deben conciliarse"
);

assert.strictEqual(
  Conciliador.sonIgualesSeguras(
    materia(2, "Sistemas Cad Cam"),
    materia(2, "Sistemas CAD – CAM.")
  ),
  true,
  "Los guiones, signos y mayúsculas no deben crear duplicados"
);

const firebase = [
  materia(1, "Calculo", "f01"),
  materia(1, "Comunicacion Oral y Escrita", "f02"),
  materia(1, "Fisica", "f03"),
  materia(1, "Metrologia", "f04"),
  materia(2, "Electronica Digital", "f05"),
  materia(2, "Mecanica de Motos 1", "f06"),
  materia(2, "Neumatica e Hidraulica", "f07"),
  materia(2, "Sistemas Cad Cam", "f08"),
  materia(3, "Climatizacion y Aire Acondicionado", "f09"),
  materia(3, "Electricidad Automotriz", "f10"),
  materia(3, "Estructura y Acabados Automotrices", "f11"),
  materia(3, "Logistica y Mantenimiento de Repuestos", "f12"),
  materia(3, "Mecanica de Motores A Gasolina y A Diesel", "f13"),
  materia(4, "Computadoras Automotrices", "f14"),
  materia(4, "Vehiculos Electricos e Hibridos", "f15"),
  materia(4, "Mantenimiento Mecanico Automotriz", "f16"),
  materia(4, "Mecanica de Motos Ii", "f17")
];

const importadas = [
  materia(1, "Física automotriz."),
  materia(1, "Ofimática."),
  materia(1, "Comunicación oral y escrita."),
  materia(1, "Metrología."),
  materia(1, "Cálculo diferencial e integral."),
  materia(2, "Ciencia de materiales."),
  materia(2, "Neumática e hidráulica."),
  materia(2, "Electrónica análoga y digital."),
  materia(2, "Sistemas CAD – CAM."),
  materia(2, "Metodología de la investigación."),
  materia(2, "Mecánica de motos I."),
  materia(3, "Logística y mantenimiento de repuestos."),
  materia(3, "Electricidad automotriz."),
  materia(3, "Estructura y acabados automotrices."),
  materia(3, "Mecánica de motores a gasolina y diesel."),
  materia(3, "Climatización y aire acondicionado."),
  materia(4, "Vehículos eléctricos e híbridos."),
  materia(4, "Mantenimiento mecánico automotriz."),
  materia(4, "Computadoras automotrices."),
  materia(4, "Mecánica de motos II."),
  materia(4, "Entrepreneurship.")
];

const resultado = Conciliador.analizar(firebase, importadas);
assert.strictEqual(resultado.exactas.length, 14, "Deben vincularse automáticamente 14 materias");
assert.strictEqual(resultado.posibles.length, 3, "Deben solicitar confirmación 3 materias dudosas");
assert.strictEqual(resultado.nuevas.length, 4, "Solo 4 materias deben considerarse realmente nuevas");

const nombresPosibles = resultado.posibles.map((item) => item.importada.nombreOficial);
assert.ok(nombresPosibles.includes("Física automotriz."));
assert.ok(nombresPosibles.includes("Cálculo diferencial e integral."));
assert.ok(nombresPosibles.includes("Electrónica análoga y digital."));

console.log("✓ Mallas: 14 coincidencias automáticas, 3 por confirmar y 4 materias nuevas");
