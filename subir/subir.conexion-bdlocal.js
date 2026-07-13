/* =========================================================
Nombre completo: subir.conexion-bdlocal.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.conexion-bdlocal.js
Función o funciones:
- Comunicar la carpeta subir con la carpeta bdlocal sin acoplarlas internamente.
- Validar el paquete final antes de importarlo a BDLocalCCC.
- Limpiar datos temporales no guardables antes de enviar a IndexedDB.
- Ejecutar la importación mediante window.BDLocalCCC.importarPaqueteCCC().
- Emitir eventos para que la pantalla pueda mostrar progreso, éxito o errores.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;

  function fechaISO() {
    return new Date().toISOString();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function emitir(nombre, detalle) {
    try {
      window.dispatchEvent(new CustomEvent(nombre, {
        detail: detalle || {}
      }));
    } catch (error) {
      console.warn("[SubirCCC.ConexionBDLocal] No se pudo emitir evento:", nombre, error);
    }
  }

  function obtenerBDLocal() {
    if (!window.BDLocalCCC) {
      return null;
    }

    return window.BDLocalCCC;
  }

  function verificarBDLocalDisponible() {
    var BD = obtenerBDLocal();

    if (!BD) {
      throw new Error("BDLocalCCC no está cargado. Revisa que los scripts de /bdlocal estén incluidos en el HTML.");
    }

    if (typeof BD.importarPaqueteCCC !== "function") {
      throw new Error("BDLocalCCC.importarPaqueteCCC no está disponible. Falta bdlocal.importador.js o bdlocal.api.js.");
    }

    return BD;
  }

  async function inicializarBDLocal() {
    var BD = verificarBDLocalDisponible();

    if (typeof BD.inicializar === "function") {
      await BD.inicializar();
    }

    return BD;
  }

  function esArrayBuffer(valor) {
    return valor instanceof ArrayBuffer;
  }

  function copiarContenidoBinario(valor) {
    if (!valor) return null;

    if (esArrayBuffer(valor)) {
      return valor.slice(0);
    }

    return valor;
  }

  function limpiarArchivoParaBDLocal(archivo, opciones) {
    opciones = opciones || {};

    var conservarContenidoBinario = opciones.conservarContenidoBinario !== false;

    var limpio = {
      id: archivo.id,
      cargaId: archivo.cargaId || null,
      carreraId: archivo.carreraId || "",
      matrizId: archivo.matrizId || "",
      nivelId: archivo.nivelId || "",
      materiaId: archivo.materiaId || "",
      carrera: archivo.carrera || "",
      nivel: archivo.nivel || "",
      numeroNivel: archivo.numeroNivel || 0,
      codigo: archivo.codigo || "",
      materia: archivo.materia || "",
      tipo: archivo.tipo || "",
      tipoSugerido: archivo.tipoSugerido || archivo.tipo || "",
      tipoLabel: archivo.tipoLabel || "",
      nombreArchivo: archivo.nombreArchivo || archivo.nombre || "",
      rutaOriginal: archivo.rutaOriginal || archivo.ruta || "",
      extension: archivo.extension || "",
      esExcel: archivo.esExcel !== false,
      estado: archivo.estado || "",
      confianza: typeof archivo.confianza === "number" ? archivo.confianza : 0,
      razonesDeteccion: arr(archivo.razonesDeteccion),
      puntajesDeteccion: arr(archivo.puntajesDeteccion),
      tamanoBytes: archivo.tamanoBytes || 0,
      tieneContenidoBinario: false,
      contenidoBinario: null,
      datosProcesados: archivo.datosProcesados || archivo.datos || null,
      errorExcel: archivo.errorExcel || archivo.errorLectura || "",
      errorLectura: archivo.errorLectura || archivo.errorExcel || "",
      creadoEn: archivo.creadoEn || fechaISO(),
      actualizadoEn: fechaISO()
    };

    if (conservarContenidoBinario && archivo.contenidoBinario) {
      limpio.contenidoBinario = copiarContenidoBinario(archivo.contenidoBinario);
      limpio.tieneContenidoBinario = !!limpio.contenidoBinario;
    }

    return limpio;
  }

  function limpiarPaqueteParaBDLocal(paquete, opciones) {
    opciones = opciones || {};

    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para preparar.");
    }

    var limpio = {
      carga: Object.assign({}, paquete.carga || {}, {
        preparadoParaBDLocalEn: fechaISO()
      }),
      carreras: arr(paquete.carreras).map(function (item) {
        return Object.assign({}, item);
      }),
      matrices: arr(paquete.matrices).map(function (item) {
        return Object.assign({}, item);
      }),
      niveles: arr(paquete.niveles).map(function (item) {
        return Object.assign({}, item);
      }),
      materias: arr(paquete.materias).map(function (item) {
        return Object.assign({}, item);
      }),
      archivos: arr(paquete.archivos).map(function (archivo) {
        return limpiarArchivoParaBDLocal(archivo, opciones);
      }),
      advertencias: arr(paquete.advertencias).map(function (item) {
        return Object.assign({}, item);
      }),
      validacionesSubida: arr(paquete.validacionesSubida).map(function (item) {
        return Object.assign({}, item);
      }),
      evaluacionesMaterias: arr(paquete.evaluacionesMaterias).map(function (item) {
        return Object.assign({}, item);
      }),
      resumenValidacion: Object.assign({}, paquete.resumenValidacion || {}),
      diagnostico: Object.assign({}, paquete.diagnostico || {}),
      diagnosticoExcel: Object.assign({}, paquete.diagnosticoExcel || {}),
      zip: Object.assign({}, paquete.zip || {}),
      origen: "subir",
      preparadoEn: fechaISO()
    };

    return limpio;
  }

  function validarAntesDeImportar(paquete, opciones) {
    opciones = opciones || {};

    var paqueteValidado = paquete;

    if (NS.Validador && typeof NS.Validador.validarPaquete === "function") {
      paqueteValidado = NS.Validador.validarPaquete(paquete, {
        lanzarSiBloquea: false
      });
    }

    var resumen = paqueteValidado.resumenValidacion || {};

    if (opciones.bloquearCriticos !== false && resumen.bloqueaImportacion === true) {
      var criticos = arr(paqueteValidado.validacionesSubida).filter(function (v) {
        return v.bloqueaImportacion === true || v.severidad === "critico";
      });

      throw new Error(
        "No se puede importar porque existen errores críticos: " +
        criticos.map(function (v) { return v.mensaje; }).join(" | ")
      );
    }

    return paqueteValidado;
  }

  async function probarConexion() {
    try {
      var BD = await inicializarBDLocal();

      var diagnostico = null;

      if (typeof BD.diagnostico === "function") {
        diagnostico = await BD.diagnostico();
      }

      return {
        ok: true,
        estado: "conectado",
        mensaje: "BDLocalCCC está disponible.",
        diagnostico: diagnostico
      };
    } catch (error) {
      return {
        ok: false,
        estado: "error",
        mensaje: error.message
      };
    }
  }

  async function importarPaquete(paquete, opciones) {
    opciones = opciones || {};

    emitir("subirccc:importacion-inicio", {
      etapa: "inicio",
      mensaje: "Preparando importación hacia BDLocal.",
      creadoEn: fechaISO()
    });

    var BD = await inicializarBDLocal();

    emitir("subirccc:importacion-progreso", {
      etapa: "validacion",
      mensaje: "Validando paquete antes de guardar.",
      porcentaje: 20
    });

    var validado = validarAntesDeImportar(paquete, opciones);

    emitir("subirccc:importacion-progreso", {
      etapa: "limpieza",
      mensaje: "Limpiando datos temporales antes de guardar.",
      porcentaje: 40
    });

    var paqueteLimpio = limpiarPaqueteParaBDLocal(validado, opciones);

    emitir("subirccc:importacion-progreso", {
      etapa: "bdlocal",
      mensaje: "Guardando información en BDLocal.",
      porcentaje: 70
    });

    var resultado = await BD.importarPaqueteCCC(paqueteLimpio);

    emitir("subirccc:importacion-fin", {
      etapa: "finalizado",
      mensaje: "Importación completada.",
      porcentaje: 100,
      resultado: resultado
    });

    return resultado;
  }

  async function importarSiEstaListo(paquete, opciones) {
    opciones = opciones || {};

    var validado = validarAntesDeImportar(paquete, {
      bloquearCriticos: opciones.bloquearCriticos !== false
    });

    var resumen = validado.resumenValidacion || {};

    if (resumen.requiereRevision && opciones.importarConRevision !== true) {
      return {
        ok: false,
        estado: "requiere_revision",
        mensaje: "El paquete tiene observaciones. Confirma la importación manualmente.",
        paquete: validado,
        resumen: resumen,
        validaciones: validado.validacionesSubida || []
      };
    }

    var resultado = await importarPaquete(validado, opciones);

    return {
      ok: true,
      estado: "importado",
      resultado: resultado,
      resumen: resultado.resumen || null
    };
  }

  function crearPaqueteDePrueba() {
    var ahora = fechaISO();

    return {
      carga: {
        nombreZip: "prueba-local.zip",
        fechaCarga: ahora,
        estado: "prueba",
        totalCarreras: 1,
        totalNiveles: 1,
        totalMaterias: 1,
        totalArchivos: 3
      },
      carreras: [
        {
          id: "carrera_prueba",
          nombre: "Carrera Prueba",
          nombreNormalizado: "carrera prueba",
          estado: "activo",
          creadoEn: ahora,
          actualizadoEn: ahora
        }
      ],
      matrices: [
        {
          id: "matriz_carrera_prueba_ccc",
          carreraId: "carrera_prueba",
          nombre: "Matriz CCC",
          tipo: "ccc",
          estado: "activo",
          creadoEn: ahora,
          actualizadoEn: ahora
        }
      ],
      niveles: [
        {
          id: "nivel_carrera_prueba_1",
          carreraId: "carrera_prueba",
          matrizId: "matriz_carrera_prueba_ccc",
          numero: 1,
          nombre: "1. Nivel",
          estado: "activo",
          creadoEn: ahora,
          actualizadoEn: ahora
        }
      ],
      materias: [
        {
          id: "materia_carrera_prueba_0001",
          carreraId: "carrera_prueba",
          matrizId: "matriz_carrera_prueba_ccc",
          nivelId: "nivel_carrera_prueba_1",
          codigo: "0001",
          nombre: "Materia Prueba",
          estadoValidacion: "completo",
          totalArchivosEsperados: 3,
          totalArchivosEncontrados: 3,
          creadoEn: ahora,
          actualizadoEn: ahora
        }
      ],
      archivos: [
        {
          id: "archivo_prueba_base",
          carreraId: "carrera_prueba",
          matrizId: "matriz_carrera_prueba_ccc",
          nivelId: "nivel_carrera_prueba_1",
          materiaId: "materia_carrera_prueba_0001",
          tipo: "pea_base",
          nombreArchivo: "PEA Base - Materia Prueba.xlsx",
          rutaOriginal: "Carrera Prueba/Matriz CCC/1. Nivel/Materia Prueba/PEA Base - Materia Prueba.xlsx",
          extension: "xlsx",
          esExcel: true,
          estado: "detectado",
          confianza: 100
        },
        {
          id: "archivo_prueba_unidades",
          carreraId: "carrera_prueba",
          matrizId: "matriz_carrera_prueba_ccc",
          nivelId: "nivel_carrera_prueba_1",
          materiaId: "materia_carrera_prueba_0001",
          tipo: "pea_unidades",
          nombreArchivo: "PEA Unidades - Materia Prueba.xlsx",
          rutaOriginal: "Carrera Prueba/Matriz CCC/1. Nivel/Materia Prueba/PEA Unidades - Materia Prueba.xlsx",
          extension: "xlsx",
          esExcel: true,
          estado: "detectado",
          confianza: 100
        },
        {
          id: "archivo_prueba_actividades",
          carreraId: "carrera_prueba",
          matrizId: "matriz_carrera_prueba_ccc",
          nivelId: "nivel_carrera_prueba_1",
          materiaId: "materia_carrera_prueba_0001",
          tipo: "pea_actividades",
          nombreArchivo: "PEA Actividades - Materia Prueba.xlsx",
          rutaOriginal: "Carrera Prueba/Matriz CCC/1. Nivel/Materia Prueba/PEA Actividades - Materia Prueba.xlsx",
          extension: "xlsx",
          esExcel: true,
          estado: "detectado",
          confianza: 100
        }
      ],
      advertencias: [],
      validacionesSubida: [],
      resumenValidacion: {
        listoParaImportar: true,
        bloqueaImportacion: false,
        requiereRevision: false
      }
    };
  }

  async function importarPrueba() {
    var paquete = crearPaqueteDePrueba();

    return await importarPaquete(paquete, {
      importarConRevision: true,
      conservarContenidoBinario: false
    });
  }

  NS.ConexionBDLocal = {
    probarConexion: probarConexion,
    inicializarBDLocal: inicializarBDLocal,
    verificarBDLocalDisponible: verificarBDLocalDisponible,
    limpiarArchivoParaBDLocal: limpiarArchivoParaBDLocal,
    limpiarPaqueteParaBDLocal: limpiarPaqueteParaBDLocal,
    validarAntesDeImportar: validarAntesDeImportar,
    importarPaquete: importarPaquete,
    importarSiEstaListo: importarSiEstaListo,
    crearPaqueteDePrueba: crearPaqueteDePrueba,
    importarPrueba: importarPrueba
  };
})(window);
