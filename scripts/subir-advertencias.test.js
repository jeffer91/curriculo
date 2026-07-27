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
    SubirCCC: {
      Validador: {
        validarPaquete(paquete) {
          return paquete;
        }
      }
    }
  },
  console
};

vm.createContext(context);
vm.runInContext(leer("subir/subir.advertencias.js"), context, {
  filename: "subir.advertencias.js"
});

const paqueteConDetalle = context.window.SubirCCC.Validador.validarPaquete({
  materias: [{
    id: "materia_costos",
    carreraId: "carrera_contabilidad",
    nivelId: "nivel_2",
    codigo: "CON-202",
    nombre: "Contabilidad de Costos",
    estadoValidacion: "revision"
  }],
  validacionesSubida: [{
    id: "val_1",
    tipo: "contenido_base_incompleto",
    severidad: "advertencia",
    bloqueaImportacion: false,
    materiaId: "materia_costos",
    mensaje: "No se identificó el objetivo de la asignatura.",
    detalle: [{
      archivoId: "archivo_base",
      nombreArchivo: "PEA Base Costos.xlsx",
      rutaOriginal: "MATRIZ CCC/Contabilidad/Nivel 2/Costos/PEA Base Costos.xlsx",
      tipoCodigo: "pea_base",
      motivo: "Falta el objetivo de la asignatura."
    }]
  }],
  resumenValidacion: {
    materiasIncompletas: 0,
    materiasRevision: 1
  },
  carga: {}
});

assert.strictEqual(paqueteConDetalle.validacionesSubida.length, 1);

const validacion = paqueteConDetalle.validacionesSubida[0];
assert.strictEqual(validacion.titulo, "PEA Base con información incompleta");
assert.match(validacion.solucion, /descripción y el objetivo/i);
assert.match(validacion.accionRecomendada, /PEA Base/i);
assert.strictEqual(validacion.archivoAfectado, "PEA Base Costos.xlsx");
assert.match(validacion.rutaArchivo, /MATRIZ CCC/);
assert.strictEqual(validacion.puedeImportar, true);
assert.strictEqual(validacion.diagnosticoUsuario.codigo, "contenido_base_incompleto");
assert.strictEqual(validacion.diagnosticoUsuario.archivo.nombre, "PEA Base Costos.xlsx");
assert.match(validacion.diagnosticoUsuario.impacto, /No bloquea/i);
assert.strictEqual(paqueteConDetalle.resumenValidacion.totalValidaciones, 1);
assert.strictEqual(paqueteConDetalle.resumenValidacion.requiereRevision, true);
assert.strictEqual(paqueteConDetalle.resumenValidacion.puedeImportarConObservaciones, true);

const paqueteSinDetalle = context.window.SubirCCC.Validador.validarPaquete({
  materias: [{
    id: "materia_finanzas",
    carreraId: "carrera_contabilidad",
    nivelId: "nivel_2",
    codigo: "FIN-201",
    nombre: "Finanzas",
    estadoValidacion: "revision"
  }],
  validacionesSubida: [],
  resumenValidacion: {
    materiasIncompletas: 0,
    materiasRevision: 1
  },
  carga: {}
});

assert.strictEqual(paqueteSinDetalle.validacionesSubida.length, 1);
assert.strictEqual(paqueteSinDetalle.validacionesSubida[0].tipo, "revision_sin_detalle");
assert.strictEqual(paqueteSinDetalle.validacionesSubida[0].materiaId, "materia_finanzas");
assert.match(paqueteSinDetalle.validacionesSubida[0].solucion, /tres archivos PEA/i);
assert.strictEqual(paqueteSinDetalle.resumenValidacion.totalValidaciones, 1);
assert.strictEqual(paqueteSinDetalle.carga.estado, "con_observaciones");

const paqueteCritico = context.window.SubirCCC.Validador.validarPaquete({
  materias: [],
  validacionesSubida: [{
    tipo: "lectura_excel_total_fallida",
    severidad: "critico",
    bloqueaImportacion: true,
    mensaje: "No se obtuvo contenido curricular."
  }],
  resumenValidacion: {},
  carga: {}
});

assert.strictEqual(paqueteCritico.validacionesSubida[0].puedeImportar, false);
assert.strictEqual(paqueteCritico.resumenValidacion.bloqueaImportacion, true);
assert.strictEqual(paqueteCritico.resumenValidacion.puedeImportarConObservaciones, false);
assert.strictEqual(paqueteCritico.carga.estado, "bloqueado");

console.log("Subir ZIP: estructura de advertencias superada.");
