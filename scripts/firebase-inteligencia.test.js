"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { window: {}, console, Blob };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "firebase", "firebase.inteligencia.js"), "utf8"),
  context,
  { filename: "firebase.inteligencia.js" }
);

const I = context.window.CurriculoFirebase.Inteligencia;
assert.ok(I, "Debe exponerse CurriculoFirebase.Inteligencia.");

function paquete(objetivo, idActividad, procesadoEn) {
  return {
    carreras: [{ id: "carrera_contabilidad", nombre: "Contabilidad" }],
    niveles: [{ id: "nivel_1", carreraId: "carrera_contabilidad", numero: 1, nombre: "1. Nivel" }],
    materias: [{ id: "origen_m1", carreraId: "carrera_contabilidad", nivelId: "nivel_1", codigo: "ABC-101", nombre: "Administración I", estadoValidacion: "completo" }],
    archivos: [
      {
        materiaId: "origen_m1", tipo: "pea_base", nombreArchivo: "PEA Base.xlsx", excelLeido: true,
        datosProcesados: { descripcion: "Descripción", objetivo, unidadesBase: [{ unidadNumero: 1, nombre: "Introducción" }], procesadoEn }
      },
      {
        materiaId: "origen_m1", tipo: "pea_unidades", nombreArchivo: "PEA Unidades.xlsx", excelLeido: true,
        datosProcesados: [{ unidadNumero: 1, contenidos: ["Tema A", "Tema B"], filasOriginales: [{ __filaExcel: 3, contenido: "Tema A" }] }]
      },
      {
        materiaId: "origen_m1", tipo: "pea_actividades", nombreArchivo: "PEA Actividades.xlsx", excelLeido: true,
        datosProcesados: [{ id: idActividad, unidadNumero: 1, tipoActividad: "Taller", descripcion: "Resolver caso", procesadoEn }]
      }
    ],
    resumenValidacion: { totalMaterias: 1, materiasCompletas: 1 },
    validacionesSubida: []
  };
}

const a = I.prepararPaquete(paquete("Objetivo original", "actividad_aleatoria_1", "2026-07-28T01:00:00Z"), "carga_a");
const b = I.prepararPaquete(paquete("Objetivo original", "actividad_aleatoria_99", "2026-07-29T02:00:00Z"), "carga_b");
const c = I.prepararPaquete(paquete("Objetivo modificado", "actividad_otra", "2026-07-30T03:00:00Z"), "carga_c");

assert.strictEqual(a.materias.length, 1);
assert.strictEqual(a.materias[0].materia.id, b.materias[0].materia.id, "El ID debe ser determinista.");
assert.strictEqual(a.materias[0].materia.hashContenido, b.materias[0].materia.hashContenido, "IDs aleatorios y fechas no deben crear una versión falsa.");
assert.notStrictEqual(a.materias[0].materia.hashContenido, c.materias[0].materia.hashContenido, "Un cambio curricular real debe modificar el hash.");

const sinCambios = I.compararSnapshots(a.materias[0].snapshot, b.materias[0].snapshot);
const conCambios = I.compararSnapshots(a.materias[0].snapshot, c.materias[0].snapshot);
assert.strictEqual(sinCambios.cambioReal, false);
assert.strictEqual(conCambios.cambioReal, true);
assert.ok(conCambios.seccionesCambiadas.includes("pea_base"));
assert.ok(/^materia_carrera_contabilidad_abc_101$/.test(a.materias[0].materia.id));
assert.ok(a.materias[0].unidades.every((u) => u.id.startsWith(a.materias[0].materia.id + "__u")));

console.log("Firebase: comparación semántica, IDs y versionado inteligente superados.");
