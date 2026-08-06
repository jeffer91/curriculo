const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash(valor) {
  return JSON.stringify(valor || {}).length.toString(36);
}

const window = {
  CurriculoFirebase: {
    Inteligencia: {
      normalizarTexto: normalizar,
      hashContenido: hash,
      prepararPaquete(paquete) {
        return {
          carreras: [{
            id: "carrera_educacion_basica",
            nombre: "Educación Básica",
            totalMaterias: 1
          }],
          materias: [{
            materia: {
              id: "materia_transversal",
              carreraId: "carrera_educacion_basica",
              carreraNombre: "Educación Básica",
              nombre: "Didáctica en Acción Elaboración de Recursos Tangibles",
              nivelNumero: 0,
              nivelNombre: "Transversal",
              hashSecciones: {}
            },
            peaBase: {
              materiaId: "materia_transversal",
              nivelNumero: 0,
              nivelNombre: "Transversal"
            },
            unidades: [{
              id: "materia_transversal__u001",
              materiaId: "materia_transversal",
              unidadNumero: 1
            }],
            actividades: {
              materiaId: "materia_transversal",
              actividades: [{ unidadNumero: 1, descripcion: "Actividad" }]
            },
            snapshot: {
              materia: {
                nombre: "Didáctica en Acción Elaboración de Recursos Tangibles",
                nivelNumero: 0,
                nivelNombre: "Transversal"
              },
              peaBase: {},
              unidades: [],
              actividades: []
            }
          }]
        };
      }
    }
  }
};

vm.runInNewContext(
  fs.readFileSync("firebase/firebase.transversales.js", "utf8"),
  { window, console, Date, Math, Number, String, Array, Object, RegExp, JSON }
);

const paquete = {
  carreras: [{ id: "c1", nombre: "Educación Básica" }],
  materias: [{
    id: "m1",
    carreraId: "c1",
    nombre: "Didáctica en Acción Elaboración de Recursos Tangibles",
    nombreOriginal: "N DIDÁCTICA EN ACCIÓN-ELABORACIÓN DE RECURSOS TANGIBLES",
    tipoMateria: "transversal",
    esTransversal: true,
    perteneceMalla: false,
    origenMateria: "institucional"
  }]
};

const resultado = window.CurriculoFirebase.Inteligencia.prepararPaquete(paquete, "carga_1");
const item = resultado.materias[0];

assert.strictEqual(item.materia.tipoMateria, "transversal");
assert.strictEqual(item.materia.esTransversal, true);
assert.strictEqual(item.materia.perteneceMalla, false);
assert.strictEqual(item.materia.origenMateria, "institucional");
assert.strictEqual(item.materia.nivelAcademico, null);
assert.strictEqual(item.materia.nivelNumero, 0);
assert.strictEqual(item.materia.nivelNombre, "Transversal");
assert.ok(item.materia.nombreOriginalImportado.startsWith("N "));
assert.ok(item.materia.hashContenido);
assert.ok(item.materia.hashSecciones.materia);

assert.strictEqual(item.peaBase.esTransversal, true);
assert.strictEqual(item.peaBase.perteneceMalla, false);
assert.strictEqual(item.unidades[0].esTransversal, true);
assert.strictEqual(item.unidades[0].perteneceMalla, false);
assert.strictEqual(item.actividades.esTransversal, true);
assert.strictEqual(item.actividades.perteneceMalla, false);
assert.strictEqual(resultado.carreras[0].totalMateriasTransversales, 1);

console.log("OK: Firebase conserva materias transversales");
