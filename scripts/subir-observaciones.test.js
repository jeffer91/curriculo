"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

function crearContexto(elementos) {
  const document = {
    getElementById(id) {
      return elementos && elementos[id] ? elementos[id] : null;
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    }
  };

  const context = {
    window: { SubirCCC: {} },
    document,
    console,
    alert() {},
    setTimeout,
    clearTimeout
  };

  vm.createContext(context);
  return context;
}

function archivoBase(sufijo, tipo, datos) {
  return {
    id: "archivo_" + sufijo,
    carreraId: "carrera_contabilidad",
    nivelId: "nivel_2",
    materiaId: "materia_costos",
    nombreArchivo: sufijo + ".xlsx",
    rutaOriginal: "MATRIZ CCC/Contabilidad/2. Nivel/Costos/" + sufijo + ".xlsx",
    extension: "xlsx",
    esExcel: true,
    tipo,
    confianza: 100,
    contenidoBinario: new ArrayBuffer(8),
    tieneContenidoBinario: true,
    excelLeido: true,
    errorExcel: "",
    datosProcesados: datos
  };
}

const contextoMain = crearContexto();
vm.runInContext(leer("subir/subir.main.js"), contextoMain, {
  filename: "subir.main.js"
});

const aplicarControlLectura = contextoMain.window.SubirCCC.Main.aplicarControlLectura;

const archivosCorrectos = [
  archivoBase("PEA Base Costos", "pea_base", { descripcion: "Materia de costos" }),
  archivoBase("PEA Unidades Costos", "pea_unidades", [
    { unidadNumero: 1, contenidos: ["1.1 Costos directos"] }
  ]),
  archivoBase("PEA Actividades Costos", "pea_actividades", [
    { unidadNumero: 1, actividadDetectada: "Resolver un caso" }
  ])
];

const paqueteCorrecto = aplicarControlLectura(
  { archivos: archivosCorrectos, advertencias: [] },
  { archivos: archivosCorrectos, advertencias: [] },
  null
);

assert.strictEqual(
  paqueteCorrecto.diagnosticoExcel.controlLectura.lecturaParcial,
  false,
  "Los arreglos válidos de Unidades y Actividades no deben producir lectura parcial."
);
assert.strictEqual(paqueteCorrecto.diagnosticoExcel.totalConDatosProcesados, 3);
assert.strictEqual(
  paqueteCorrecto.advertencias.some((item) => item.tipo === "lectura_excel_parcial"),
  false
);

const archivosConError = archivosCorrectos.map((archivo) => ({ ...archivo }));
archivosConError[2] = {
  ...archivosConError[2],
  excelLeido: false,
  datosProcesados: undefined,
  errorExcel: "No se encontró una hoja válida en el libro."
};

const paqueteConError = aplicarControlLectura(
  { archivos: archivosCorrectos, advertencias: [] },
  { archivos: archivosConError, advertencias: [] },
  null
);

const controlError = paqueteConError.diagnosticoExcel.controlLectura;
assert.strictEqual(controlError.lecturaParcial, true);
assert.strictEqual(controlError.totalProblemas, 1);
assert.strictEqual(controlError.totalErroresExcel, 1);
assert.strictEqual(controlError.archivosProblema[0].materiaId, "materia_costos");
assert.strictEqual(controlError.archivosProblema[0].nombreArchivo, "PEA Actividades Costos.xlsx");
assert.match(controlError.archivosProblema[0].errorTecnico, /hoja válida/);

contextoMain.window.SubirCCC.Normalizador = {};
vm.runInContext(leer("subir/subir.validador.js"), contextoMain, {
  filename: "subir.validador.js"
});

const paqueteValidado = contextoMain.window.SubirCCC.Validador.validarPaquete({
  carreras: [{ id: "carrera_contabilidad", nombre: "Contabilidad", confianza: 100 }],
  niveles: [{ id: "nivel_2", carreraId: "carrera_contabilidad", nombre: "2. Nivel", confianza: 100 }],
  materias: [{
    id: "materia_costos",
    carreraId: "carrera_contabilidad",
    nivelId: "nivel_2",
    codigo: "CON-202",
    nombre: "Costos"
  }],
  archivos: archivosConError,
  advertencias: [{
    tipo: "excel_no_leido",
    archivoId: archivosConError[2].id,
    nombreArchivo: archivosConError[2].nombreArchivo
  }]
});

const erroresLectura = paqueteValidado.validacionesSubida.filter((item) => {
  return item.tipo === "error_lectura_excel";
});

assert.strictEqual(erroresLectura.length, 1);
assert.strictEqual(erroresLectura[0].carrera, "Contabilidad");
assert.strictEqual(erroresLectura[0].nivel, "2. Nivel");
assert.strictEqual(erroresLectura[0].materia, "Costos");
assert.strictEqual(erroresLectura[0].detalle[0].nombreArchivo, "PEA Actividades Costos.xlsx");
assert.strictEqual(
  paqueteValidado.validacionesSubida.some((item) => item.tipo === "excel_no_leido"),
  false,
  "La alerta genérica duplicada debe ser reemplazada por la validación específica."
);

const listaValidaciones = { innerHTML: "" };
const contextoPreview = crearContexto({ listaValidaciones });
contextoPreview.window.SubirCCC.DetectorArchivos = {
  nombreTipo(tipo) {
    return {
      pea_base: "PEA Base",
      pea_unidades: "PEA Unidades",
      pea_actividades: "PEA Actividades"
    }[tipo] || "No identificado";
  }
};

vm.runInContext(leer("subir/subir.preview.js"), contextoPreview, {
  filename: "subir.preview.js"
});

contextoPreview.window.SubirCCC.Preview.pintarPaquete(paqueteValidado);

assert.match(listaValidaciones.innerHTML, /Contabilidad/);
assert.match(listaValidaciones.innerHTML, /2\. Nivel/);
assert.match(listaValidaciones.innerHTML, /CON-202/);
assert.match(listaValidaciones.innerHTML, /Costos/);
assert.match(listaValidaciones.innerHTML, /PEA Actividades Costos\.xlsx/);
assert.match(listaValidaciones.innerHTML, /No se encontró una hoja válida/);
assert.match(listaValidaciones.innerHTML, /MATRIZ CCC\/Contabilidad/);

console.log("Subir ZIP: pruebas de observaciones superadas.");
