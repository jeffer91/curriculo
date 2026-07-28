/* =========================================================
Nombre completo: subir.conexion-bdlocal.js
Ruta o ubicación: /Curriculo/subir/subir.conexion-bdlocal.js
Funciones:
- Mantener la interfaz histórica de conexión usada por subir.main.js.
- Conectar la pantalla Subir ZIP exclusivamente con Firebase Firestore.
- Eliminar contenido binario antes de enviar el paquete al importador remoto.
- Emitir progreso, resultado y errores de la comparación inteligente.
========================================================= */
(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "6.0.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function fechaISO() {
    return new Date().toISOString();
  }

  function emitir(nombre, detalle) {
    try {
      window.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} }));
    } catch (error) {
      console.warn("[SubirCCC.ConexionFirebase] No se pudo emitir:", nombre, error);
    }
  }

  function obtenerFirebase() {
    if (!window.CurriculoFirebase || typeof window.CurriculoFirebase.importarPaquete !== "function") {
      throw new Error("El servicio CurriculoFirebase no está disponible.");
    }
    return window.CurriculoFirebase;
  }

  function limpiarBinarios(valor, clave) {
    if (valor === null || typeof valor === "undefined") return valor;
    if (clave === "contenidoBinario" || clave === "archivoOriginal" || clave === "workbook" || clave === "file" || clave === "blob" || clave === "raw") {
      return null;
    }
    if (valor instanceof ArrayBuffer) return null;
    if (ArrayBuffer.isView && ArrayBuffer.isView(valor)) return null;
    if (Array.isArray(valor)) {
      return valor.map(function (item) { return limpiarBinarios(item, ""); });
    }
    if (typeof valor === "object") {
      var salida = {};
      Object.keys(valor).forEach(function (k) {
        var limpio = limpiarBinarios(valor[k], k);
        if (limpio === null && ["contenidoBinario", "archivoOriginal", "workbook", "file", "blob", "raw"].indexOf(k) !== -1) return;
        salida[k] = limpio;
      });
      return salida;
    }
    return valor;
  }

  function validarAntesDeImportar(paquete, opciones) {
    opciones = opciones || {};
    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para Firebase.");
    }
    var validado = paquete;
    if (NS.Validador && typeof NS.Validador.validarPaquete === "function") {
      validado = NS.Validador.validarPaquete(paquete, { lanzarSiBloquea: false });
    }
    var resumen = validado.resumenValidacion || {};
    if (opciones.bloquearCriticos !== false && resumen.bloqueaImportacion === true) {
      var criticos = arr(validado.validacionesSubida).filter(function (item) {
        return item && (item.bloqueaImportacion === true || item.severidad === "critico");
      });
      throw new Error(
        "No se puede subir a Firebase porque existen errores críticos: " +
        criticos.map(function (item) { return texto(item.mensaje || item.titulo); }).filter(Boolean).join(" | ")
      );
    }
    return validado;
  }

  async function probarConexion() {
    try {
      var Firebase = obtenerFirebase();
      var resultado = await Firebase.probarConexion();
      return Object.assign({ proyectoId: Firebase.CONFIG && Firebase.CONFIG.projectId }, resultado);
    } catch (error) {
      return {
        ok: false,
        estado: "error",
        mensaje: error && error.message ? error.message : "No se pudo conectar con Firebase."
      };
    }
  }

  async function importarPaquete(paquete, opciones) {
    opciones = opciones || {};
    emitir("subirccc:importacion-inicio", {
      etapa: "inicio",
      porcentaje: 5,
      mensaje: "Preparando comparación con Firebase.",
      creadoEn: fechaISO()
    });

    var Firebase = obtenerFirebase();
    await Firebase.ready();

    emitir("subirccc:importacion-progreso", {
      etapa: "validacion",
      porcentaje: 15,
      mensaje: "Validando el paquete curricular."
    });

    var validado = validarAntesDeImportar(paquete, opciones);
    var paqueteSinBinarios = limpiarBinarios(validado, "");

    emitir("subirccc:importacion-progreso", {
      etapa: "comparacion",
      porcentaje: 20,
      mensaje: "Buscando diferencias y versiones anteriores en Firebase."
    });

    var resultado = await Firebase.importarPaquete(paqueteSinBinarios, {
      detectarEliminadas: opciones.detectarEliminadas !== false,
      onProgress: function (data) {
        emitir("subirccc:importacion-progreso", data);
      }
    });

    emitir("subirccc:importacion-fin", {
      etapa: "finalizado",
      porcentaje: 100,
      mensaje: resultado.mensaje || "Firebase actualizado.",
      resultado: resultado
    });

    return resultado;
  }

  async function importarSiEstaListo(paquete, opciones) {
    opciones = opciones || {};
    var validado = validarAntesDeImportar(paquete, opciones);
    var resumen = validado.resumenValidacion || {};
    if (resumen.requiereRevision && opciones.importarConRevision !== true) {
      return {
        ok: false,
        estado: "requiere_revision",
        mensaje: "El paquete tiene observaciones. Confirma la subida manualmente.",
        paquete: validado,
        resumen: resumen,
        validaciones: validado.validacionesSubida || []
      };
    }
    return await importarPaquete(validado, opciones);
  }

  var API = {
    VERSION: VERSION,
    probarConexion: probarConexion,
    importarPaquete: importarPaquete,
    importarSiEstaListo: importarSiEstaListo,
    validarAntesDeImportar: validarAntesDeImportar,
    limpiarPaqueteParaFirebase: function (paquete) { return limpiarBinarios(paquete, ""); },
    limpiarPaqueteParaBDLocal: function (paquete) { return limpiarBinarios(paquete, ""); }
  };

  NS.ConexionFirebase = API;
  NS.ConexionBDLocal = API;
})(window);
