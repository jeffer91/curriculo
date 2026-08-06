const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function resumenMateriaArchivos(archivos) {
  function contar(tipo) {
    return archivos.filter(function (archivo) { return archivo.tipo === tipo; }).length;
  }

  const encontrados = {
    pea_base: contar("pea_base"),
    pea_unidades: contar("pea_unidades"),
    pea_actividades: contar("pea_actividades")
  };
  const faltantes = [];
  const duplicados = [];

  Object.keys(encontrados).forEach(function (tipo) {
    if (!encontrados[tipo]) faltantes.push(tipo);
    if (encontrados[tipo] > 1) duplicados.push(tipo);
  });

  return {
    total: archivos.length,
    encontrados: encontrados,
    faltantes: faltantes,
    duplicados: duplicados,
    noIdentificados: archivos.filter(function (archivo) { return !archivo.tipo; }).length,
    noExcel: 0,
    erroresExcel: 0,
    completo: faltantes.length === 0 && duplicados.length === 0
  };
}

const matrices = {
  actividades: [
    ["nivel", "Mecanismo", "tema", "descripcion"],
    ["4", "Actividad Contacto Docente 1", "Tema A", "Descripción A"],
    ["4", "Taller práctico", "Tema B", "Descripción B"]
  ],
  base: [
    ["codigoComponente", "ordenComponente", "descripcionComponente"],
    ["1", "1", "Descripción de la asignatura"],
    ["2", "1", "Objetivo de la asignatura"],
    ["3", "1", "Unidad 1"],
    ["4", "1", "Competencia"],
    ["5", "1", "Resultado"],
    ["8", "1", "Bibliografía"]
  ],
  unidades: [
    ["codigoComponente", "ordenComponente", "descripcionComponente"],
    ["4", "1", "1.1 Tema"],
    ["4", "2", "2.1 Tema"],
    ["4", "3", "3.1 Tema"],
    ["4", "4", "4.1 Tema"]
  ]
};

const window = {
  XLSX: {
    read: function (contenido) {
      return {
        SheetNames: ["Hoja1"],
        Sheets: { Hoja1: { matriz: contenido.matriz } }
      };
    },
    utils: {
      sheet_to_json: function (hoja) {
        return matrices[hoja.matriz];
      }
    }
  },
  SubirCCC: {
    Normalizador: {
      extensionArchivo: function () { return "xlsx"; },
      crearIdArchivo: function (materiaId, tipo, ruta) {
        return [materiaId, tipo, ruta].join("|");
      }
    },
    DetectorArchivos: {
      TIPOS: {
        BASE: "pea_base",
        UNIDADES: "pea_unidades",
        ACTIVIDADES: "pea_actividades"
      },
      LABELS: {
        pea_base: "PEA Base",
        pea_unidades: "PEA Unidades",
        pea_actividades: "PEA Actividades"
      },
      agruparPorMateria: function (archivos) {
        return archivos.reduce(function (mapa, archivo) {
          mapa[archivo.materiaId] = mapa[archivo.materiaId] || [];
          mapa[archivo.materiaId].push(archivo);
          return mapa;
        }, {});
      },
      resumenMateriaArchivos: resumenMateriaArchivos,
      enriquecerPaquete: function (paquete) {
        return Object.assign({}, paquete, {
          archivos: paquete.archivos.map(function (archivo) { return Object.assign({}, archivo); }),
          advertencias: [{ tipo: "materia_incompleta", materiaId: "m1" }],
          carga: {},
          diagnostico: {}
        });
      }
    }
  }
};

vm.runInNewContext(
  fs.readFileSync("subir/subir.detector-contenido.js", "utf8"),
  { window: window, console: console, Date: Date, Number: Number, Object: Object, Array: Array, String: String, Math: Math, RegExp: RegExp }
);

const resultado = window.SubirCCC.DetectorArchivos.enriquecerPaquete({
  materias: [{ id: "m1", nombre: "Sistema de Aprendizaje Humano" }],
  archivos: [
    {
      materiaId: "m1",
      nombreArchivo: "PEA INFORMACIÓN Sistema de Aprendizaje Humano.xlsx",
      extension: "xlsx",
      esExcel: true,
      contenidoBinario: { matriz: "base" },
      tipo: "pea_base",
      confianza: 65,
      rutaOriginal: "base.xlsx"
    },
    {
      materiaId: "m1",
      nombreArchivo: "Pea Unidades Aprendizaje Sistema de Aprendizaje.xlsx",
      extension: "xlsx",
      esExcel: true,
      contenidoBinario: { matriz: "unidades" },
      tipo: "pea_unidades",
      confianza: 100,
      rutaOriginal: "unidades.xlsx"
    },
    {
      materiaId: "m1",
      nombreArchivo: "Sistema de Aprendizaje Humano.xlsx",
      extension: "xlsx",
      esExcel: true,
      contenidoBinario: { matriz: "actividades" },
      tipo: "",
      confianza: 0,
      rutaOriginal: "actividades.xlsx"
    }
  ]
});

assert.strictEqual(resultado.archivos[0].tipo, "pea_base");
assert.strictEqual(resultado.archivos[0].confianza, 99);
assert.strictEqual(resultado.archivos[2].tipo, "pea_actividades");
assert.strictEqual(resultado.archivos[2].confianza, 99);
assert.strictEqual(resultado.materias[0].estadoValidacion, "completo");
assert.strictEqual(
  resultado.advertencias.filter(function (item) { return item.tipo === "materia_incompleta"; }).length,
  0
);
assert.strictEqual(resultado.diagnostico.totalClasificadosPorContenido, 2);

console.log("OK: detector de PEA por contenido");
