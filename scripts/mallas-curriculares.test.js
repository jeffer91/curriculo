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
  codigo: index === 0 ? "CODIGO-DIFERENTE" : ""
}));

const comparacion = Comparador.comparar(detectadas, oficiales, []);
assert.strictEqual(comparacion.resumen.totalOficiales, 21);
assert.strictEqual(comparacion.resumen.totalDetectadas, 19);
assert.strictEqual(comparacion.resumen.vinculadas, 19);
assert.strictEqual(comparacion.resumen.faltantes, 2);
assert.strictEqual(comparacion.resumen.noVinculadas, 0);
assert.strictEqual(comparacion.coincidencias[0].criterio, "nombre_y_nivel");

const soloMismoCodigo = [{
  id: "solo_codigo",
  nombre: "Materia completamente distinta",
  nivelNumero: 1,
  codigo: "ADM-101"
}];
const comparacionCodigo = Comparador.comparar(soloMismoCodigo, oficiales, []);
assert.strictEqual(comparacionCodigo.resumen.vinculadas, 0);
assert.strictEqual(comparacionCodigo.resumen.noVinculadas, 1);
assert.strictEqual(comparacionCodigo.resumen.faltantes, 21);

// Si el ZIP no trae nivel, un nombre exacto y único debe tomar el nivel de la
// malla vigente sin obligar al usuario a confirmar una relación inequívoca.
const sinNivelNombreExacto = [{
  id: "sin_nivel_exacto",
  nombre: "Administración II",
  nivelNumero: 0
}];
const comparacionSinNivelExacto = Comparador.comparar(sinNivelNombreExacto, oficiales, []);
assert.strictEqual(comparacionSinNivelExacto.resumen.vinculadas, 1);
assert.strictEqual(comparacionSinNivelExacto.resumen.noVinculadas, 0);
assert.strictEqual(comparacionSinNivelExacto.coincidencias[0].criterio, "nombre_exacto_nivel_inferido");
assert.strictEqual(comparacionSinNivelExacto.coincidencias[0].oficial.nivelNumero, 2);

// Un nivel realmente detectado que contradice la malla continúa requiriendo
// revisión humana: aquí sí existe un conflicto y no un dato ausente.
const nivelRealDiferente = [{
  id: "nivel_real_diferente",
  nombre: "Administración II",
  nivelNumero: 4
}];
const comparacionNivelRealDiferente = Comparador.comparar(nivelRealDiferente, oficiales, []);
assert.strictEqual(comparacionNivelRealDiferente.resumen.vinculadas, 0);
assert.strictEqual(comparacionNivelRealDiferente.resumen.noVinculadas, 1);
assert.strictEqual(comparacionNivelRealDiferente.noVinculadas[0].motivo, "nivel_diferente");

// Sin nivel también se puede buscar una sugerencia aproximada en toda la
// malla, pero una coincidencia no exacta jamás se aprueba automáticamente.
const sinNivelParecida = [{
  id: "sin_nivel_parecida",
  nombre: "Métodos Cuantitativos para Toma de Decisiones",
  nivelNumero: 0
}];
const comparacionSinNivelParecida = Comparador.comparar(sinNivelParecida, oficiales, []);
assert.strictEqual(comparacionSinNivelParecida.resumen.vinculadas, 0);
assert.strictEqual(comparacionSinNivelParecida.resumen.noVinculadas, 1);
assert.ok(comparacionSinNivelParecida.noVinculadas[0].sugerencia);
assert.strictEqual(
  comparacionSinNivelParecida.noVinculadas[0].sugerencia.nombreOficial,
  "Métodos Cuantitativos para la Toma de Decisiones"
);

// Si el mismo nombre oficial existe en más de un nivel y el ZIP no trae nivel,
// no hay base segura para decidir automáticamente entre ambos.
const oficialesAmbiguos = [
  { id: "amb_1", nombreOficial: "Proyecto Integrador", nivelNumero: 2 },
  { id: "amb_2", nombreOficial: "Proyecto Integrador", nivelNumero: 4 }
];
const comparacionAmbigua = Comparador.comparar(
  [{ id: "amb_detectada", nombre: "Proyecto Integrador", nivelNumero: 0 }],
  oficialesAmbiguos,
  []
);
assert.strictEqual(comparacionAmbigua.resumen.vinculadas, 0);
assert.strictEqual(comparacionAmbigua.resumen.noVinculadas, 1);
assert.strictEqual(comparacionAmbigua.resumen.conflictos, 1);

const distinta = [{ id: "x", nombre: "Gestión Empresarial Aplicada", nivelNumero: 3 }];
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

console.log("✓ Mallas curriculares: comparación por nombre y nivel, sin depender de códigos.");
