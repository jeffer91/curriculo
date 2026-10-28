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
assert.strictEqual(catalogo.listarCarreras().length, 13);
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
const estetica = catalogo.obtenerPorCarrera({ nombreInstitucional: "Estética Integral" });
assert.ok(estetica);
assert.strictEqual(estetica.malla.carreraNombre, "Estética Integral");
assert.strictEqual(estetica.malla.version, null);
assert.strictEqual(estetica.malla.vigenciaInicio, null);
assert.strictEqual(estetica.malla.vigenciaFin, null);
assert.strictEqual(estetica.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => estetica.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 6]);
const esperadasEstetica = [
  "Comunicación oral y escrita",
  "Tratamiento y manejo de desechos",
  "Terapias alternativas",
  "Química cosmética",
  "Cuidado de la piel",
  "Administración en estéticas integrales",
  "Masajes y terapia corporal",
  "Aparatología en estética integral",
  "Valoración estética",
  "Cosmiatría",
  "Contabilidad básica y tributación",
  "Terapias faciales",
  "Manicure y pedicure",
  "Tricología y peluquería",
  "Dermocosmética",
  "Gestión de centros de estética integral",
  "Terapias estéticas integrales",
  "Terapeútica en estética",
  "Asesoría de imagen",
  "Visagismo y maquillaje profesional",
  "Unidad de integración curricular"
];
assert.deepStrictEqual(Array.from(estetica.materias.map(m => m.nombreOficial)), esperadasEstetica);
assert.strictEqual(estetica.materias[20].tipo, "integracion_curricular");
assert.strictEqual(estetica.materias[17].nombreOficial, "Terapeútica en estética");
assert.strictEqual(catalogo.obtenerPorCarrera("Estetica Integral").materias.length, 21);
assert.strictEqual(new Set(estetica.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 21);
const gastronomia = catalogo.obtenerPorCarrera({ nombreInstitucional: "Gastronomía" });
assert.ok(gastronomia);
assert.strictEqual(gastronomia.malla.carreraNombre, "Gastronomía");
assert.strictEqual(gastronomia.malla.version, null);
assert.strictEqual(gastronomia.malla.vigenciaInicio, null);
assert.strictEqual(gastronomia.malla.vigenciaFin, null);
assert.strictEqual(gastronomia.materias.length, 19);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => gastronomia.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 4]);
const esperadasGastronomia = [
  "Fundamentos de Gastronomía",
  "Elaboración de menús",
  "Office Essentials",
  "Procesos, higiene e inocuidad alimentaria",
  "Química general de los alimentos",
  "Costos y Presupuestos Gastronómicos",
  "Cocina Ecuatoriana",
  "Técnicas de Carnicería y Chacutería",
  "Panadería",
  "Riesgos y Seguridad en la Industria Culinaria",
  "Cocina Internacional I (Europea)",
  "Pastelería y chocolatería",
  "Conservación y Técnicas de Almacenaje",
  "Enología, Bebidas y Maridaje",
  "Administración y Marketing Digital de Establecimientos Gastronómicos",
  "Cocina de Autor y Tendencias Creativas",
  "Cocina Internacional II (Asiática y Americana)",
  "Diseño, Equipamiento y Software gastronómico",
  "Organización de Eventos y Catering"
];
assert.deepStrictEqual(Array.from(gastronomia.materias.map(m => m.nombreOficial)), esperadasGastronomia);
assert.strictEqual(gastronomia.materias.some(m => m.tipo === "integracion_curricular"), false);
assert.strictEqual(gastronomia.materias[7].nombreOficial, "Técnicas de Carnicería y Chacutería");
assert.strictEqual(catalogo.obtenerPorCarrera("Gastronomia").materias.length, 19);
assert.strictEqual(new Set(gastronomia.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 19);
const talento = catalogo.obtenerPorCarrera({ nombreInstitucional: "Gestión del Talento Humano" });
assert.ok(talento);
assert.strictEqual(talento.malla.carreraNombre, "Gestión del Talento Humano");
assert.strictEqual(talento.malla.version, null);
assert.strictEqual(talento.malla.vigenciaInicio, null);
assert.strictEqual(talento.malla.vigenciaFin, null);
assert.strictEqual(talento.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => talento.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 6]);
const esperadasTalento = [
  "Administración de la Compensación en Talento Humano",
  "Computación Aplicada",
  "Comunicación Oral y Escrita",
  "Fundamentos de Gestión de Talento Humano",
  "Legislación Laboral y Seguridad Social",
  "Reclutamiento y Selección de Personal",
  "Comportamiento Organizacional",
  "Capacitación y Desarrollo de Personal",
  "Gestión de Desempeño",
  "Seguridad y Salud Ocupacional",
  "Remuneración y Compensación",
  "Gestión y Desarrollo de Competencias",
  "Valoración de Cargos",
  "Gestión Presupuestaria y de Talento Humano",
  "Desarrollo Organizacional",
  "Estadística Aplicada",
  "Análisis de Gestión de Riesgos",
  "Entrepreneurship",
  "Liderazgo y Gestión de Conflictos",
  "Gestión de Nómina y Prestaciones Sociales",
  "Unidad de Integración Curricular"
];
assert.deepStrictEqual(Array.from(talento.materias.map(m => m.nombreOficial)), esperadasTalento);
assert.strictEqual(talento.materias[20].tipo, "integracion_curricular");
assert.strictEqual(catalogo.obtenerPorCarrera("Gestion del Talento Humano").materias.length, 21);
assert.strictEqual(new Set(talento.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 21);
assert.strictEqual(catalogo.obtenerPorCarrera("Marketing Digital y Comercio Electrónico").materias.length, 21);
const automotriz = catalogo.obtenerPorCarrera("Mecánica Automotriz");
assert.ok(automotriz);
assert.strictEqual(automotriz.materias.length, 21);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => automotriz.materias.filter(m => m.nivelNumero === n).length), [5, 6, 5, 5]);
assert.strictEqual(automotriz.materias[8].nombreOficial, "Sistemas CAD – CAM");
assert.strictEqual(automotriz.materias[13].nombreOficial, "Mecánica de motores a gasolina y diesel");
assert.strictEqual(automotriz.materias[20].nombreOficial, "Mecánica de motos II");
assert.strictEqual(automotriz.materias.some(m => m.tipo === "integracion_curricular"), false);
assert.strictEqual(catalogo.obtenerPorCarrera("Mecanica Automotriz").materias.length, 21);
const motos = catalogo.obtenerPorCarrera("Mecánica de Motos");
assert.ok(motos);
assert.strictEqual(motos.materias.length, 19);
assert.deepStrictEqual(Array.from([1, 2, 3, 4], n => motos.materias.filter(m => m.nivelNumero === n).length), [5, 5, 5, 4]);
assert.strictEqual(motos.materias[0].nombreOficial, "Física Básica");
assert.strictEqual(motos.materias[7].nombreOficial, "Electricidad y electrónica de motos");
assert.strictEqual(motos.materias[12].nombreOficial, "Mecánica de Motores a Gasolina y ensamblaje");
assert.strictEqual(motos.materias[18].nombreOficial, "Entrepreneurship");
assert.strictEqual(motos.materias.some(m => m.tipo === "integracion_curricular"), false);
assert.strictEqual(catalogo.obtenerPorCarrera("Mecanica de Motos").materias.length, 19);
assert.strictEqual(new Set(motos.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 19);
assert.strictEqual(new Set(automotriz.materias.map(m => m.nivelNumero + "|" + m.nombreOficial)).size, 21);



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

console.log("Mallas codificadas verificadas: trece carreras y 266 asignaturas.");
