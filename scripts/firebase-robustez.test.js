"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

const context = {
  window: {
    CurriculoFirebase: {
      SDK_VERSION: "12.16.0",
      CONFIG: { projectId: "prueba" },
      COLECCIONES: {},
      Inteligencia: {
        VERSION: "1.0.0",
        prepararPaquete(paquete) {
          return paquete.__preparado;
        },
        limpiarProfundo(valor) {
          return JSON.parse(JSON.stringify(valor || {}));
        }
      }
    }
  },
  console,
  TextEncoder,
  Date,
  Math,
  JSON,
  unescape,
  encodeURIComponent
};

vm.createContext(context);
vm.runInContext(leer("firebase/firebase.inteligencia-v2.js"), context, {
  filename: "firebase.inteligencia-v2.js"
});
vm.runInContext(leer("firebase/firebase.robustez.js"), context, {
  filename: "firebase.robustez.js"
});

const I = context.window.CurriculoFirebase.Inteligencia;
const R = context.window.CurriculoFirebase.Robustez;

assert.strictEqual(I.VERSION, "2.0.0");
assert.strictEqual(R.VERSION, "2.0.0");

const contenidoA = {
  objetivo: "  Comprender   la administración.\r\n",
  contenidos: ["Tema B", "Tema A", "Tema A"],
  actividades: [
    { orden: 1, descripcion: "Caso práctico" },
    { orden: 2, descripcion: "Foro" }
  ],
  filas: [{ __filaExcel: 4, texto: "Tema A" }]
};
const contenidoB = {
  objetivo: "Comprender la administración.",
  contenidos: ["Tema A", "Tema B"],
  actividades: [
    { orden: 99, descripcion: "Foro" },
    { orden: 7, descripcion: "Caso práctico" }
  ],
  filas: [{ __filaExcel: 200, texto: "Tema A" }]
};

assert.strictEqual(
  I.hashContenido(contenidoA),
  I.hashContenido(contenidoB),
  "Orden, espacios, duplicados y filas técnicas no deben crear una versión."
);

assert.notStrictEqual(
  I.hashContenido(contenidoA),
  I.hashContenido(Object.assign({}, contenidoB, {
    objetivo: "Aplicar la administración."
  })),
  "Un cambio curricular real debe cambiar la huella."
);

const id1 = I.crearIdMateria(
  "carrera_administracion",
  1,
  "ABC-101",
  "Administración I"
);
const id2 = I.crearIdMateria(
  "carrera_administracion",
  2,
  "ABC-101",
  "Administración I"
);
const id3 = I.crearIdMateria(
  "carrera_administracion",
  1,
  "ABC-101",
  "Administración Aplicada"
);

assert.notStrictEqual(id1, id2, "El nivel debe evitar colisiones.");
assert.notStrictEqual(id1, id3, "El nombre debe evitar colisiones.");

const existente = {
  id: "materia_legacy",
  carreraId: "carrera_administracion",
  nivelNumero: 1,
  codigo: "ABC-101",
  nombre: "Administración I"
};
const itemCodigoCambiado = {
  materia: {
    id: id1,
    carreraId: "carrera_administracion",
    nivelNumero: 1,
    codigo: "ABC-102",
    nombre: "Administración I"
  }
};
const coincidencia = R.encontrarCoincidencia(
  itemCodigoCambiado,
  [existente]
);
assert.strictEqual(coincidencia.materia.id, "materia_legacy");
assert.strictEqual(coincidencia.criterio, "nombre_y_nivel");

assert.strictEqual(
  R.cargaPermiteRetiros(
    { resumenOriginal: { materiasError: 0, materiasAdvertencia: 0 } },
    {}
  ),
  false,
  "Los retiros deben estar desactivados por defecto."
);
assert.strictEqual(
  R.cargaPermiteRetiros(
    { resumenOriginal: { materiasError: 0, materiasAdvertencia: 0 } },
    { detectarEliminadas: true, cargaCompleta: true }
  ),
  true,
  "Solo una carga completa y confirmada puede retirar materias."
);
assert.strictEqual(
  R.cargaPermiteRetiros(
    { resumenOriginal: { materiasError: 0, materiasAdvertencia: 1 } },
    { detectarEliminadas: true, cargaCompleta: true }
  ),
  false,
  "Una carga con observaciones no puede retirar materias."
);

const snapshotA = I.crearSnapshot(
  {
    carreraId: "carrera_administracion",
    carreraNombre: "Administración",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    codigo: "ABC-101",
    nombre: "Administración I",
    estadoValidacion: "completo",
    activo: true
  },
  {
    descripcion: "Descripción",
    objetivo: "Objetivo",
    bibliografia: [
      { orden: 1, referencia: "Libro B" },
      { orden: 2, referencia: "Libro A" }
    ]
  },
  [
    {
      unidadNumero: 1,
      titulo: "Unidad",
      contenidos: ["Tema B", "Tema A"],
      filas: [{ __filaExcel: 1, valor: "técnico" }]
    }
  ],
  {
    actividades: [
      { orden: 1, unidadNumero: 1, descripcion: "Foro" },
      { orden: 2, unidadNumero: 1, descripcion: "Caso" }
    ]
  }
);
const snapshotB = I.crearSnapshot(
  {
    carreraId: "carrera_administracion",
    carreraNombre: "Administración",
    nivelNumero: 1,
    nivelNombre: "1. Nivel",
    codigo: "ABC-101",
    nombre: "Administración I",
    estadoValidacion: "completo",
    activo: true
  },
  {
    descripcion: "Descripción",
    objetivo: "Objetivo",
    bibliografia: [
      { orden: 100, referencia: "Libro A" },
      { orden: 200, referencia: "Libro B" }
    ]
  },
  [
    {
      unidadNumero: 1,
      titulo: "Unidad",
      contenidos: ["Tema A", "Tema B", "Tema A"],
      filas: [{ __filaExcel: 99, valor: "otro técnico" }]
    }
  ],
  {
    actividades: [
      { orden: 20, unidadNumero: 1, descripcion: "Caso" },
      { orden: 10, unidadNumero: 1, descripcion: "Foro" }
    ]
  }
);

assert.strictEqual(
  I.compararSnapshots(snapshotA, snapshotB).cambioReal,
  false,
  "Un reordenamiento técnico no debe crear una versión."
);

console.log(
  "Firebase: robustez semántica, identidad y retiros seguros superados."
);
