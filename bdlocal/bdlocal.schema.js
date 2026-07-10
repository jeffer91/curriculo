/* =========================================================
Nombre completo: bdlocal.schema.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.schema.js
Función o funciones:
- Definir el nombre, versión y estructura oficial de la base IndexedDB.
- Declarar tablas e índices para Gestión Curricular CCC.
- Preparar almacenamiento de carreras, matrices, niveles, materias y archivos PEA.
- Preparar almacenamiento de datos procesados desde Excel: PEA Base, PEA Unidades y PEA Actividades.
- Centralizar estados, tipos de archivos PEA y utilidades base de normalización.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;

  var DB_NAME = "BD_GESTION_CURRICULAR_CCC";
  var DB_VERSION = 2;

  var ESTADOS_VALIDACION = Object.freeze({
    COMPLETO: "completo",
    INCOMPLETO: "incompleto",
    PENDIENTE: "pendiente",
    REVISION: "revision",
    ERROR: "error"
  });

  var TIPOS_PEA = Object.freeze({
    BASE: "pea_base",
    UNIDADES: "pea_unidades",
    ACTIVIDADES: "pea_actividades"
  });

  var SEVERIDADES = Object.freeze({
    INFO: "info",
    ADVERTENCIA: "advertencia",
    ERROR: "error",
    CRITICO: "critico"
  });

  var STORES = Object.freeze({
    META: "meta",
    CARGAS_ZIP: "cargas_zip",
    CARRERAS: "carreras",
    MATRICES: "matrices",
    NIVELES: "niveles",
    MATERIAS: "materias",
    PEA_ARCHIVOS: "pea_archivos",
    PEA_BASE: "pea_base",
    PEA_UNIDADES: "pea_unidades",
    PEA_ACTIVIDADES: "pea_actividades",
    VALIDACIONES: "validaciones",
    LOGS_IMPORTACION: "logs_importacion"
  });

  var STORE_DEFINITIONS = [
    {
      name: STORES.META,
      options: { keyPath: "key" },
      indexes: [
        { name: "actualizadoEn", keyPath: "actualizadoEn", options: { unique: false } }
      ]
    },
    {
      name: STORES.CARGAS_ZIP,
      options: { keyPath: "id", autoIncrement: true },
      indexes: [
        { name: "nombreZip", keyPath: "nombreZip", options: { unique: false } },
        { name: "fechaCarga", keyPath: "fechaCarga", options: { unique: false } },
        { name: "estado", keyPath: "estado", options: { unique: false } },
        { name: "creadoEn", keyPath: "creadoEn", options: { unique: false } }
      ]
    },
    {
      name: STORES.CARRERAS,
      options: { keyPath: "id" },
      indexes: [
        { name: "nombre", keyPath: "nombre", options: { unique: false } },
        { name: "nombreNormalizado", keyPath: "nombreNormalizado", options: { unique: true } },
        { name: "estado", keyPath: "estado", options: { unique: false } },
        { name: "actualizadoEn", keyPath: "actualizadoEn", options: { unique: false } }
      ]
    },
    {
      name: STORES.MATRICES,
      options: { keyPath: "id" },
      indexes: [
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "tipo", keyPath: "tipo", options: { unique: false } },
        { name: "nombreNormalizado", keyPath: "nombreNormalizado", options: { unique: false } },
        { name: "estado", keyPath: "estado", options: { unique: false } }
      ]
    },
    {
      name: STORES.NIVELES,
      options: { keyPath: "id" },
      indexes: [
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "matrizId", keyPath: "matrizId", options: { unique: false } },
        { name: "numero", keyPath: "numero", options: { unique: false } },
        { name: "nombreNormalizado", keyPath: "nombreNormalizado", options: { unique: false } },
        { name: "carreraNivel", keyPath: ["carreraId", "numero"], options: { unique: false } }
      ]
    },
    {
      name: STORES.MATERIAS,
      options: { keyPath: "id" },
      indexes: [
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "matrizId", keyPath: "matrizId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "codigo", keyPath: "codigo", options: { unique: false } },
        { name: "nombre", keyPath: "nombre", options: { unique: false } },
        { name: "nombreNormalizado", keyPath: "nombreNormalizado", options: { unique: false } },
        { name: "estadoValidacion", keyPath: "estadoValidacion", options: { unique: false } },
        { name: "carreraNivel", keyPath: ["carreraId", "nivelId"], options: { unique: false } },
        { name: "codigoCarrera", keyPath: ["carreraId", "codigo"], options: { unique: false } }
      ]
    },
    {
      name: STORES.PEA_ARCHIVOS,
      options: { keyPath: "id" },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "matrizId", keyPath: "matrizId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "materiaId", keyPath: "materiaId", options: { unique: false } },
        { name: "tipo", keyPath: "tipo", options: { unique: false } },
        { name: "estado", keyPath: "estado", options: { unique: false } },
        { name: "confianza", keyPath: "confianza", options: { unique: false } },
        { name: "rutaOriginal", keyPath: "rutaOriginal", options: { unique: false } },
        { name: "excelLeido", keyPath: "excelLeido", options: { unique: false } },
        { name: "tieneContenidoBinario", keyPath: "tieneContenidoBinario", options: { unique: false } },
        { name: "materiaTipo", keyPath: ["materiaId", "tipo"], options: { unique: false } }
      ]
    },
    {
      name: STORES.PEA_BASE,
      options: { keyPath: "materiaId" },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "codigoMateria", keyPath: "codigoMateria", options: { unique: false } },
        { name: "nombreMateria", keyPath: "nombreMateria", options: { unique: false } },
        { name: "archivoId", keyPath: "archivoId", options: { unique: false } },
        { name: "actualizadoEn", keyPath: "actualizadoEn", options: { unique: false } }
      ]
    },
    {
      name: STORES.PEA_UNIDADES,
      options: { keyPath: "id" },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "materiaId", keyPath: "materiaId", options: { unique: false } },
        { name: "codigoMateria", keyPath: "codigoMateria", options: { unique: false } },
        { name: "archivoId", keyPath: "archivoId", options: { unique: false } },
        { name: "unidadNumero", keyPath: "unidadNumero", options: { unique: false } },
        { name: "temaDetectado", keyPath: "temaDetectado", options: { unique: false } },
        { name: "materiaUnidad", keyPath: ["materiaId", "unidadNumero"], options: { unique: false } }
      ]
    },
    {
      name: STORES.PEA_ACTIVIDADES,
      options: { keyPath: "id" },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "materiaId", keyPath: "materiaId", options: { unique: false } },
        { name: "codigoMateria", keyPath: "codigoMateria", options: { unique: false } },
        { name: "archivoId", keyPath: "archivoId", options: { unique: false } },
        { name: "unidadNumero", keyPath: "unidadNumero", options: { unique: false } },
        { name: "tipoActividad", keyPath: "tipoActividad", options: { unique: false } },
        { name: "actividadDetectada", keyPath: "actividadDetectada", options: { unique: false } },
        { name: "materiaUnidad", keyPath: ["materiaId", "unidadNumero"], options: { unique: false } }
      ]
    },
    {
      name: STORES.VALIDACIONES,
      options: { keyPath: "id", autoIncrement: true },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "carreraId", keyPath: "carreraId", options: { unique: false } },
        { name: "nivelId", keyPath: "nivelId", options: { unique: false } },
        { name: "materiaId", keyPath: "materiaId", options: { unique: false } },
        { name: "tipo", keyPath: "tipo", options: { unique: false } },
        { name: "severidad", keyPath: "severidad", options: { unique: false } },
        { name: "estado", keyPath: "estado", options: { unique: false } },
        { name: "creadoEn", keyPath: "creadoEn", options: { unique: false } }
      ]
    },
    {
      name: STORES.LOGS_IMPORTACION,
      options: { keyPath: "id", autoIncrement: true },
      indexes: [
        { name: "cargaId", keyPath: "cargaId", options: { unique: false } },
        { name: "tipo", keyPath: "tipo", options: { unique: false } },
        { name: "nivel", keyPath: "nivel", options: { unique: false } },
        { name: "creadoEn", keyPath: "creadoEn", options: { unique: false } }
      ]
    }
  ];

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-]+/g, " ")
      .replace(/[^\w\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizarCodigo(valor) {
    return String(valor || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");
  }

  function slug(valor) {
    var limpio = normalizarTexto(valor)
      .replace(/\./g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    return limpio || "sin_nombre";
  }

  function fechaISO() {
    return new Date().toISOString();
  }

  function uid(prefijo) {
    var base = Date.now().toString(36);
    var rnd = Math.random().toString(36).slice(2, 10);
    return String(prefijo || "id") + "_" + base + "_" + rnd;
  }

  function crearIdCarrera(nombreCarrera) {
    return "carrera_" + slug(nombreCarrera);
  }

  function crearIdMatriz(carreraId, nombreMatriz) {
    return "matriz_" + slug(carreraId) + "_" + slug(nombreMatriz || "ccc");
  }

  function crearIdNivel(carreraId, numeroNivel) {
    return "nivel_" + slug(carreraId) + "_" + String(numeroNivel || "sn");
  }

  function crearIdMateria(carreraId, nivelId, codigo, nombreMateria) {
    var codigoLimpio = normalizarCodigo(codigo || "");

    if (codigoLimpio) {
      return "materia_" + slug(carreraId) + "_" + slug(codigoLimpio);
    }

    return "materia_" + slug(carreraId) + "_" + slug(nivelId) + "_" + slug(nombreMateria);
  }

  function crearIdArchivo(materiaId, tipoArchivo, rutaOriginal) {
    return "archivo_" + slug(materiaId) + "_" + slug(tipoArchivo) + "_" + slug(rutaOriginal).slice(0, 80);
  }

  function asegurarArray(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  NS.Schema = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORES: STORES,
    STORE_DEFINITIONS: STORE_DEFINITIONS,
    ESTADOS_VALIDACION: ESTADOS_VALIDACION,
    TIPOS_PEA: TIPOS_PEA,
    SEVERIDADES: SEVERIDADES,

    normalizarTexto: normalizarTexto,
    normalizarCodigo: normalizarCodigo,
    slug: slug,
    fechaISO: fechaISO,
    uid: uid,
    crearIdCarrera: crearIdCarrera,
    crearIdMatriz: crearIdMatriz,
    crearIdNivel: crearIdNivel,
    crearIdMateria: crearIdMateria,
    crearIdArchivo: crearIdArchivo,
    asegurarArray: asegurarArray
  };
})(window);