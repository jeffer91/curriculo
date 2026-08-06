"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.resolve(__dirname, "..");
const codigo = fs.readFileSync(
  path.join(raiz, "subir", "subir.excel-inteligente.js"),
  "utf8"
);

const windowMock = {
  SubirCCC: {
    Excel: {
      enriquecerPaqueteConExcel: async function (paquete) {
        return paquete;
      }
    }
  }
};

vm.runInNewContext(codigo, {
  window: windowMock,
  console,
  Date,
  Object,
  Array,
  String,
  Number,
  Math,
  RegExp,
  Promise
});

const inteligente = windowMock.SubirCCC.ExcelInteligente;
assert.ok(inteligente, "Debe exponerse el módulo ExcelInteligente.");

const matriz = [
  ["codigoComponente", " ", "descripcionComponente"],
  ["3", "1", "1.1 Tipos de familia"],
  ["3", "1", "1.1.1 Conceptualización de la familia"],
  ["3", "2", "2.1 Comunicación humana"],
  ["3", "2", "2.1.1 Tipos de comunicación"],
  ["3", "3", "3.1 Mediación familiar"],
  ["3", "3", "3.1.1 Resolución de conflictos"],
  ["3", "4", "4.1 Salud mental"],
  ["3", "4", "4.1.1 Prevención"]
];

const resultado = inteligente.inferirUnidadesDesdeMatriz(matriz, {
  hoja: "Hoja1"
});

assert.strictEqual(resultado.valido, true, "La estructura debe recuperarse.");
assert.strictEqual(resultado.unidades.length, 4, "Deben recuperarse cuatro unidades.");
assert.strictEqual(resultado.totalContenidos, 8, "Deben recuperarse todos los contenidos.");
assert.strictEqual(
  resultado.correcciones[0].encabezadoInferido,
  "ordenComponente",
  "Debe inferirse el encabezado ordenComponente."
);
assert.ok(
  resultado.correcciones[0].confianza >= 0.85,
  "La inferencia debe realizarse solo con alta confianza."
);

const sinConfianza = inteligente.inferirUnidadesDesdeMatriz([
  ["codigoComponente", "", "descripcionComponente"],
  ["3", "A", "Contenido uno"],
  ["3", "B", "Contenido dos"],
  ["3", "C", "Contenido tres"]
]);

assert.strictEqual(
  sinConfianza.valido,
  false,
  "No debe inventar una columna de unidad cuando los datos no son confiables."
);

assert.strictEqual(
  windowMock.SubirCCC.Excel.__encabezadosInteligentes,
  true,
  "La mejora debe quedar instalada sobre el lector principal."
);

console.log(
  "✓ Excel inteligente: recupera PEA Unidades con encabezado vacío sin modificar el archivo"
);
