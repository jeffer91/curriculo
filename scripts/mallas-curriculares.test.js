"use strict";

const assert = require("assert");
const Parser = require("../mallas/mallas.parser.js");
const Comparador = require("../mallas/mallas.comparador.js");

const textoAdministracion = `
MALLA CURRICULAR
ADMINISTRACIÓN

Primer Nivel
Administración I
Ofimática
Comunicación Oral y Escrita
Matemática Financiera
Legislación Laboral y Mercantil
Contabilidad General
Segundo Nivel
Administración II
Contabilidad de Costos
Investigación de Mercados
Gestión del Talento Humano
Tercer Nivel
Gestión de procesos empresariales
Gerencia de ventas y negocios
Análisis financiero
Presupuestos
Logística empresarial
Cuarto Nivel
Métodos Cuantitativos para la Toma de Decisiones
Planificación Estratégica
Entrepreneurship
Sistemas de Gestión de Calidad
Auditoría
Unidad de Integración Curricular
`;

const parseada = Parser.parsearTexto(textoAdministracion);
assert.strictEqual(parseada.carreraSugerida, "ADMINISTRACIÓN");
assert.strictEqual(parseada.totalNiveles, 4);
assert.strictEqual(parseada.materias.length, 21);
assert.strictEqual(parseada.materias[0].nombreOficial, "Administración I");
assert.strictEqual(parseada.materias[20].nombreOficial, "Unidad de Integración Curricular");
assert.strictEqual(Parser.validarMaterias(parseada.materias).ok, true);

const oficiales = parseada.materias.map((materia, index) => ({
  ...materia,
  id: `oficial_${index + 1}`,
  codigo: index === 0 ? "ADM-101" : ""
}));

const detectadas = oficiales.slice(0, 19).map((materia, index) => ({
  id: `detectada_${index + 1}`,
  nombre: materia.nombreOficial,
  nivelNumero: materia.nivelNumero,
  codigo: materia.codigo
}));

detectadas[0].nombre = "Administración General";
const comparacion = Comparador.comparar(detectadas, oficiales, []);
assert.strictEqual(comparacion.resumen.totalOficiales, 21);
assert.strictEqual(comparacion.resumen.totalDetectadas, 19);
assert.strictEqual(comparacion.resumen.vinculadas, 19);
assert.strictEqual(comparacion.resumen.faltantes, 2);
assert.strictEqual(comparacion.resumen.noVinculadas, 0);

const distinta = [{ id: "x", nombre: "Gestión Empresarial Aplicada", nivelNumero: 3, codigo: "" }];
const comparacionDistinta = Comparador.comparar(distinta, oficiales, []);
assert.strictEqual(comparacionDistinta.resumen.noVinculadas, 1);
assert.strictEqual(comparacionDistinta.resumen.faltantes, 21);

const vinculada = Comparador.aplicarVinculo(
  { id: "x", nombre: "Gestión Empresarial Aplicada", nivelNumero: 3 },
  oficiales.find((item) => item.nombreOficial === "Gestión de procesos empresariales"),
  { mallaId: "malla_administracion_v001", mallaVersion: 1, criterio: "arrastre_manual" }
);
assert.strictEqual(vinculada.nombre, "Gestión de procesos empresariales");
assert.strictEqual(vinculada.nombreOriginalDetectado, "Gestión Empresarial Aplicada");
assert.strictEqual(vinculada.mallaVinculada, true);

console.log("✓ Mallas curriculares: parser, validación, comparación y vinculación correctos.");
