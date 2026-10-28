"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const catalogoJs = fs.readFileSync(path.join(root, "mallas/mallas.oficiales.js"), "utf8");
const contexto = { window: {} };
vm.runInNewContext(catalogoJs, contexto);
const catalogo = contexto.window.CurriculoMallasOficiales;
assert.ok(catalogo && typeof catalogo.obtenerPorCarrera === "function");

const malla = catalogo.obtenerPorCarrera({ nombreInstitucional: "Administracion" });
assert.ok(malla);
assert.strictEqual(malla.malla.carreraNombre, "Administración");
assert.strictEqual(malla.malla.version, null);
assert.strictEqual(malla.malla.vigenciaInicio, null);
assert.strictEqual(malla.malla.vigenciaFin, null);
assert.strictEqual(malla.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => malla.materias.filter(m => m.nivelNumero === n).length), [6, 4, 5, 6]);
assert.strictEqual(malla.materias[0].nombreOficial, "Administración I");
assert.strictEqual(malla.materias[malla.materias.length - 1].nombreOficial, "Unidad de Integración Curricular");
assert.strictEqual(malla.materias[malla.materias.length - 1].tipo, "integracion_curricular");
const contabilidad = catalogo.obtenerPorCarrera({ nombreInstitucional: "Contabilidad" });
assert.ok(contabilidad);
assert.strictEqual(contabilidad.malla.carreraNombre, "Contabilidad");
assert.strictEqual(contabilidad.malla.version, null);
assert.strictEqual(contabilidad.malla.vigenciaInicio, null);
assert.strictEqual(contabilidad.malla.vigenciaFin, null);
assert.strictEqual(contabilidad.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => contabilidad.materias.filter(m => m.nivelNumero === n).length), [6, 4, 5, 6]);
const esperadasContabilidad = [
  "Administración",
  "Ofimática",
  "Comunicación Oral y Escrita",
  "Matemática Financiera",
  "Legislación Mercantil y Tributaria",
  "Contabilidad General",
  "Contabilidad General II",
  "Contabilidad de Costos I",
  "Finanzas",
  "Tributación",
  "Contabilidad Superior I",
  "Contabilidad de Costos II",
  "Análisis Financiero",
  "Presupuesto",
  "Sistema Contable",
  "Métodos Cuantitativos para la Toma de Decisiones",
  "Planificación Estratégica",
  "Entrepreneurship",
  "Contabilidad Superior 2",
  "Auditoría Financiera",
  "Unidad de Integración Curricular"
];
assert.deepStrictEqual(Array.from(contabilidad.materias.map(m => m.nombreOficial)), esperadasContabilidad);
assert.strictEqual(contabilidad.materias[19].nombreOficial, "Auditoría Financiera");
assert.strictEqual(contabilidad.materias[18].nombreOficial, "Contabilidad Superior 2");
assert.strictEqual(contabilidad.materias[20].tipo, "integracion_curricular");

assert.strictEqual(catalogo.obtenerPorCarrera("Desarrollo de Software").materias.length, 21);

const diseno = catalogo.obtenerPorCarrera({ nombreInstitucional: "Diseño Multimedia" });
assert.ok(diseno, "Diseño Multimedia debe existir en código");
assert.strictEqual(diseno.malla.carreraNombre, "Diseño Multimedia");
assert.strictEqual(diseno.malla.version, null);
assert.strictEqual(diseno.malla.vigenciaInicio, null);
assert.strictEqual(diseno.malla.vigenciaFin, null);
assert.strictEqual(diseno.materias.length, 19);
assert.deepStrictEqual(
  Array.from([1, 2, 3, 4], n => diseno.materias.filter(m => m.nivelNumero === n).length),
  [5, 5, 5, 4]
);
const esperadasDiseno = [
  "Branding digital",
  "Semiología de la imagen",
  "Creatividad",
  "Fundamentos de programación",
  "Figura humana y diseño de personaje",
  "Diseño WEB I",
  "Marketing digital",
  "Multimedia",
  "Diseño gráfico",
  "Producción audiovisual",
  "Motion design",
  "Programación de videojuegos",
  "Animación y Diseño 2D y 3D",
  "Producción de sonido",
  "Redacción de contenidos multimedia",
  "Modelación e impresión 3D",
  "UX / UI",
  "Inteligencia artificial orientada al diseño",
  "Entrepreneurship"
];
assert.deepStrictEqual(Array.from(diseno.materias.map(m => m.nombreOficial)), esperadasDiseno);
assert.strictEqual(diseno.materias.some(m => m.tipo === "integracion_curricular"), false);
assert.strictEqual(new Set(diseno.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 19);
assert.strictEqual(catalogo.obtenerPorCarrera("Diseno Multimedia").materias.length, 19);
const educacion = catalogo.obtenerPorCarrera({ nombreInstitucional: "Educación Básica" });
assert.ok(educacion);
assert.strictEqual(educacion.malla.carreraNombre, "Educación Básica");
assert.strictEqual(educacion.malla.version, null);
assert.strictEqual(educacion.malla.vigenciaInicio, null);
assert.strictEqual(educacion.malla.vigenciaFin, null);
assert.strictEqual(educacion.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => educacion.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 6]);
const esperadasEducacion = [
  "Office Essentials",
  "La familia y el entorno educativo",
  "Aprendizaje y enseñanza de la comunicación humana",
  "Sistemas educativos del aprendizaje humano",
  "Psicología de los ciclos de la vida y aprendizaje humano",
  "Pedagogía, andragogía y corrientes",
  "Didáctica general",
  "Diseño, gestión y evaluación curricular",
  "Neurociencia educativa",
  "Teoría del aprendizaje",
  "Aprendizaje y enseñanza de la lengua y literatura",
  "Aprendizaje y enseñanza del sistema de relaciones y funciones numérico estadístico y probabilidades",
  "Aprendizaje y enseñanza de las ciencias naturales",
  "Aprendizaje y enseñanza inclusiva",
  "Aprendizaje y enseñanza de la cultura física, estética y expresión corporal",
  "Planificación, modelos y procesos de investigación educativa",
  "Gestión de recursos, estrategias y ambientes",
  "Tics en educación y gamificación",
  "Metodología de investigación educativa",
  "Deontología docente",
  "Unidad de integración curricular"
];
assert.deepStrictEqual(Array.from(educacion.materias.map(m => m.nombreOficial)), esperadasEducacion);
assert.strictEqual(educacion.materias[20].tipo, "integracion_curricular");
assert.strictEqual(catalogo.obtenerPorCarrera("Educacion Basica").materias.length, 21);
assert.strictEqual(new Set(educacion.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 21);
const inicial = catalogo.obtenerPorCarrera({ nombreInstitucional: "Educación Inicial" });
assert.ok(inicial);
assert.strictEqual(inicial.malla.carreraNombre, "Educación Inicial");
assert.strictEqual(inicial.malla.version, null);
assert.strictEqual(inicial.malla.vigenciaInicio, null);
assert.strictEqual(inicial.malla.vigenciaFin, null);
assert.strictEqual(inicial.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => inicial.materias.filter(m => m.nivelNumero === n).length), [6, 6, 4, 5]);
const esperadasInicial = [
  "Competencias Digitales para la Educación Inicial",
  "Didáctica Aplicada",
  "Psicomotricidad y Expresión Corporal",
  "Bases Biológicas del Desarrollo",
  "Pedagogía Infantil",
  "Estrategias Metodológicas para el Aprendizaje en Educación Inicial",
  "Las TIC’s en la Educación Inicial",
  "Expresión Plástica y Artística",
  "Psicología Infantil I",
  "Pedagogía Infantil II",
  "Planificación y Diseño Curricular",
  "Estimulación Temprana I",
  "Psicología Infantil II",
  "Pedagogía para Infantes con Discapacidad",
  "Iniciación a las Operaciones Concretas",
  "Estimulación Temprana II",
  "Gerencia Educativa",
  "Evaluación Institucional de Logros en Nivel Inicial y Primero de Básica",
  "Dificultades en el Aprendizaje",
  "Iniciación a la Prelectura y Preescritura",
  "Unidad de Integración Curricular"
];
assert.deepStrictEqual(Array.from(inicial.materias.map(m => m.nombreOficial)), esperadasInicial);
assert.strictEqual(inicial.materias[20].tipo, "integracion_curricular");
assert.strictEqual(inicial.materias[6].nombreOficial, "Las TIC’s en la Educación Inicial");
assert.strictEqual(new Set(inicial.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 21);
assert.strictEqual(catalogo.obtenerPorCarrera("Educacion Inicial").materias.length, 21);
assert.strictEqual(catalogo.listarCarreras().length, 7);
const enfermeria = catalogo.obtenerPorCarrera({ nombreInstitucional: "Enfermería" });
assert.ok(enfermeria);
assert.strictEqual(enfermeria.malla.carreraNombre, "Enfermería");
assert.strictEqual(enfermeria.malla.version, null);
assert.strictEqual(enfermeria.malla.vigenciaInicio, null);
assert.strictEqual(enfermeria.malla.vigenciaFin, null);
assert.strictEqual(enfermeria.materias.length, 20);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => enfermeria.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 5]);
const esperadasEnfermeria = [
  "Bioquímica",
  "Morfofisiología I",
  "Enfermería Técnica",
  "Promoción de la Salud y Salud Intercultural",
  "Redacción y Ofimática Aplicada a la Salud",
  "Salud Sexual y Salud Reproductiva",
  "Morfofisiología II",
  "Nutrición y Dietética",
  "Farmacología Básica",
  "Enfermería en el Cuidado de la Persona con Discapacidad y Adultos Mayores",
  "Enfermería en el Cuidado Esencial y Obstétrico",
  "Microbiología y Parasitología",
  "Farmacología Aplicada",
  "Instrumentación Quirúrgica",
  "Enfermería en el Cuidado del Paciente Quirúrgico y Pos Quirúrgico",
  "Enfermería en Salud Mental",
  "Enfermería Crítica y Clínica",
  "Ética, Deontología Profesional y Derechos del Paciente",
  "Epidemiología e Investigación en Salud",
  "Unidad de Integración Curricular"
];
assert.deepStrictEqual(Array.from(enfermeria.materias.map(m => m.nombreOficial)), esperadasEnfermeria);
assert.strictEqual(enfermeria.materias[19].tipo, "integracion_curricular");
assert.strictEqual(catalogo.obtenerPorCarrera("Enfermeria").materias.length, 20);
assert.strictEqual(new Set(enfermeria.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 20);
assert.strictEqual(catalogo.obtenerPorCarrera("Estética Integral"), null);



assert.strictEqual(catalogo.obtenerPorCarrera("ADMINISTRACIÓN").materias.length, 21);

const nombres = new Set();
malla.materias.forEach(m => {
  const clave = m.nivelNumero + "|" + m.nombreOficial.toLowerCase();
  assert.ok(!nombres.has(clave), "Duplicado: " + clave);
  nombres.add(clave);
});

malla.materias[0].nombreOficial = "Cambiada en vista";
assert.strictEqual(catalogo.obtenerPorCarrera("Administración").materias[0].nombreOficial, "Administración I");

const fichasJs = fs.readFileSync(path.join(root, "fichas/fichas.js"), "utf8");
const fichasHtml = fs.readFileSync(path.join(root, "fichas/fichas.html"), "utf8");
assert.ok(fichasJs.includes("obtenerMallaParaFicha(estado.carrera)"));
assert.ok(fichasJs.includes("Mallas.obtenerMallaVigenteParaCarrera(carrera)"));
assert.ok(fichasHtml.includes("../mallas/mallas.oficiales.js"));
assert.ok(fichasHtml.indexOf("../mallas/mallas.oficiales.js") < fichasHtml.indexOf("./fichas.js"));

console.log("Mallas codificadas verificadas: siete carreras y 144 asignaturas.");
