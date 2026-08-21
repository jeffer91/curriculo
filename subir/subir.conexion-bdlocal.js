/* =========================================================
Nombre completo: subir.conexion-bdlocal.js
Ruta o ubicación: /Curriculo/subir/subir.conexion-bdlocal.js
Funciones:
- Guardar primero el paquete validado en IndexedDB.
- Sincronizar después con Firebase Firestore.
- Evitar una nueva consulta/escritura remota cuando el paquete coincide exactamente
  con la última sincronización confirmada desde este equipo.
- Mantener compatibilidad con la interfaz histórica ConexionBDLocal.
- Permitir trabajo local aunque Firebase esté temporalmente fuera de línea.
========================================================= */
(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "7.0.0";
  var PREFIJO_SYNC = "firebase_sync_paquete_";

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
      console.warn("[SubirCCC.ConexionHibrida] No se pudo emitir:", nombre, error);
    }
  }

  function obtenerFirebase() {
    if (!window.CurriculoFirebase || typeof window.CurriculoFirebase.importarPaquete !== "function") {
      throw new Error("El servicio CurriculoFirebase no está disponible.");
    }
    return window.CurriculoFirebase;
  }

  function obtenerLocal() {
    var Local = window.BDLocalCCC;
    if (!Local || !Local.Core || !Local.Schema || typeof Local.importarPaqueteCCC !== "function") {
      throw new Error("La base local IndexedDB no está disponible.");
    }
    return Local;
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
      throw new Error("No se recibió un paquete válido.");
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
        "No se puede guardar porque existen errores críticos: " +
        criticos.map(function (item) { return texto(item.mensaje || item.titulo); }).filter(Boolean).join(" | ")
      );
    }
    return validado;
  }

  async function probarConexion() {
    var respuesta = {
      ok: false,
      localOk: false,
      firebaseOk: false,
      estado: "error",
      mensaje: "No se pudo preparar el almacenamiento."
    };

    try {
      var Local = obtenerLocal();
      await Local.inicializar();
      respuesta.localOk = true;
    } catch (errorLocal) {
      respuesta.errorLocal = errorLocal && errorLocal.message ? errorLocal.message : texto(errorLocal);
    }

    try {
      var Firebase = obtenerFirebase();
      var remoto = await Firebase.probarConexion();
      respuesta.firebaseOk = !!(remoto && remoto.ok);
      respuesta.proyectoId = Firebase.CONFIG && Firebase.CONFIG.projectId;
      if (!respuesta.firebaseOk) respuesta.errorFirebase = remoto && remoto.mensaje ? remoto.mensaje : "Firebase no respondió.";
    } catch (errorFirebase) {
      respuesta.errorFirebase = errorFirebase && errorFirebase.message ? errorFirebase.message : texto(errorFirebase);
    }

    respuesta.ok = respuesta.localOk;
    if (respuesta.localOk && respuesta.firebaseOk) {
      respuesta.estado = "ok";
      respuesta.mensaje = "Base local y Firebase disponibles.";
    } else if (respuesta.localOk) {
      respuesta.estado = "solo_local";
      respuesta.mensaje = "Base local disponible. Firebase está fuera de línea; los datos pueden guardarse localmente.";
    } else {
      respuesta.estado = "error";
      respuesta.mensaje = respuesta.errorLocal || "La base local no está disponible.";
    }

    return respuesta;
  }

  function prepararFirmaSincronizacion(Firebase, paqueteValidado) {
    if (!Firebase.Inteligencia || typeof Firebase.Inteligencia.prepararPaquete !== "function") return null;

    var separacion = null;
    var paqueteFirebase = paqueteValidado;
    if (Firebase.ImportacionParcial && typeof Firebase.ImportacionParcial.separarPaquete === "function") {
      separacion = Firebase.ImportacionParcial.separarPaquete(paqueteValidado);
      paqueteFirebase = separacion.paquete;
    }

    var preparado = Firebase.Inteligencia.prepararPaquete(limpiarBinarios(paqueteFirebase, ""), "");
    var materias = arr(preparado.materias).map(function (item) {
      return {
        id: texto(item && item.materia && item.materia.id),
        hashContenido: texto(item && item.materia && item.materia.hashContenido)
      };
    }).sort(function (a, b) { return a.id.localeCompare(b.id); });

    var pendientes = arr(separacion && separacion.omitidas).map(function (item) {
      return {
        materiaId: texto(item && item.materiaId),
        estado: texto(item && (item.estadoValidacion || item.estado)),
        pea: item && item.pea ? item.pea : null,
        motivo: texto(item && item.motivo)
      };
    }).sort(function (a, b) { return a.materiaId.localeCompare(b.materiaId); });

    var carreras = arr(preparado.carreras).map(function (carrera) {
      return texto(carrera && carrera.id);
    }).filter(Boolean).sort();

    var firma = Firebase.Inteligencia.hashContenido({
      carreras: carreras,
      materias: materias,
      pendientes: pendientes
    });
    var claveAmbito = Firebase.Inteligencia.hashContenido(carreras.length ? carreras : ["sin_carrera"]);

    return {
      key: PREFIJO_SYNC + claveAmbito,
      firma: firma,
      carreras: carreras,
      totalCompletas: materias.length,
      totalPendientes: pendientes.length,
      totalDetectadas: arr(paqueteValidado && paqueteValidado.materias).length
    };
  }

  async function leerMarcaSync(Local, info) {
    if (!info) return null;
    try {
      return await Local.Core.get(Local.Schema.STORES.META, info.key);
    } catch (error) {
      console.warn("[SubirCCC.ConexionHibrida] No se pudo leer la marca local de sincronización:", error);
      return null;
    }
  }

  async function guardarMarcaSync(Local, Firebase, info, resultadoFirebase) {
    if (!info) return false;
    try {
      await Local.Core.put(Local.Schema.STORES.META, {
        key: info.key,
        tipo: "firebase_sync_paquete",
        firma: info.firma,
        carreras: info.carreras,
        totalDetectadas: info.totalDetectadas,
        totalCompletas: info.totalCompletas,
        totalPendientes: info.totalPendientes,
        proyectoId: Firebase.CONFIG && Firebase.CONFIG.projectId ? Firebase.CONFIG.projectId : "",
        cargaFirebaseId: texto(resultadoFirebase && resultadoFirebase.cargaId),
        estado: "sincronizado",
        sincronizadoEn: fechaISO(),
        actualizadoEn: fechaISO()
      });
      return true;
    } catch (error) {
      console.warn("[SubirCCC.ConexionHibrida] Firebase se sincronizó, pero no se pudo guardar la marca local:", error);
      return false;
    }
  }

  function resultadoFirebaseOmitido(info, marca) {
    return {
      ok: true,
      estado: "sin_cambios_local",
      cargaId: texto(marca && marca.cargaFirebaseId),
      importacionParcial: info.totalPendientes > 0,
      totalMateriasDetectadas: info.totalDetectadas,
      totalMateriasSubidas: info.totalCompletas,
      totalMateriasOmitidas: info.totalPendientes,
      resumen: {
        totalMaterias: info.totalCompletas,
        totalMateriasDetectadas: info.totalDetectadas,
        totalMateriasSubidas: info.totalCompletas,
        materiasOmitidas: info.totalPendientes,
        materiasNoSubidas: info.totalPendientes,
        nuevas: 0,
        actualizadas: 0,
        retiradas: 0,
        sinCambios: info.totalCompletas,
        versionesCreadas: 0,
        operacionesFirestore: 0
      },
      cambios: [],
      mensaje: "El paquete coincide con la última sincronización confirmada. Firebase no fue consultado ni modificado."
    };
  }

  async function importarPaquete(paquete, opciones) {
    opciones = opciones || {};
    var validado = validarAntesDeImportar(paquete, opciones);
    var Local = obtenerLocal();

    emitir("subirccc:importacion-inicio", {
      etapa: "local",
      porcentaje: 5,
      mensaje: "Guardando primero en la base local.",
      creadoEn: fechaISO()
    });

    await Local.inicializar();
    var resultadoLocal = await Local.importarPaqueteCCC(validado);

    emitir("subirccc:importacion-progreso", {
      etapa: "local_completado",
      porcentaje: 45,
      mensaje: "Base local guardada. Revisando si Firebase necesita cambios."
    });

    var Firebase;
    try {
      Firebase = obtenerFirebase();
      await Firebase.ready();
    } catch (errorConexionFirebase) {
      var soloLocal = {
        ok: true,
        estado: "guardado_local_pendiente_firebase",
        local: resultadoLocal,
        firebase: { ok: false, estado: "sin_conexion", mensaje: errorConexionFirebase.message || texto(errorConexionFirebase) },
        resumen: resultadoLocal && resultadoLocal.resumen ? resultadoLocal.resumen : {},
        mensaje: "La base local quedó guardada. Firebase no está disponible y podrá sincronizarse en una próxima carga."
      };
      emitir("subirccc:importacion-fin", { etapa: "solo_local", porcentaje: 100, mensaje: soloLocal.mensaje, resultado: soloLocal });
      return soloLocal;
    }

    var infoFirma = prepararFirmaSincronizacion(Firebase, validado);
    var marcaAnterior = await leerMarcaSync(Local, infoFirma);
    var mismoProyecto = marcaAnterior && texto(marcaAnterior.proyectoId) === texto(Firebase.CONFIG && Firebase.CONFIG.projectId);
    var mismaFirma = marcaAnterior && texto(marcaAnterior.firma) === texto(infoFirma && infoFirma.firma);

    var resultadoFirebase;
    var firebaseOmitida = false;

    if (infoFirma && mismoProyecto && mismaFirma && opciones.forzarFirebase !== true) {
      firebaseOmitida = true;
      resultadoFirebase = resultadoFirebaseOmitido(infoFirma, marcaAnterior);
      emitir("subirccc:importacion-progreso", {
        etapa: "sin_cambios",
        porcentaje: 90,
        mensaje: "Sin cambios desde la última sincronización. Firebase no necesita operaciones."
      });
    } else {
      try {
        emitir("subirccc:importacion-progreso", {
          etapa: "firebase",
          porcentaje: 55,
          mensaje: "Comparando con Firebase. Solo se escribirán cambios reales."
        });

        resultadoFirebase = await Firebase.importarPaquete(limpiarBinarios(validado, ""), {
          detectarEliminadas: opciones.detectarEliminadas === true,
          cargaCompleta: opciones.cargaCompleta === true,
          onProgress: function (data) {
            var copia = Object.assign({}, data || {});
            if (Number(copia.porcentaje || 0) < 55) copia.porcentaje = 55;
            emitir("subirccc:importacion-progreso", copia);
          }
        });

        if (resultadoFirebase && resultadoFirebase.ok !== false) {
          await guardarMarcaSync(Local, Firebase, infoFirma, resultadoFirebase);
        }
      } catch (errorFirebase) {
        var pendiente = {
          ok: true,
          estado: "guardado_local_pendiente_firebase",
          local: resultadoLocal,
          firebase: {
            ok: false,
            estado: "error",
            mensaje: errorFirebase && errorFirebase.message ? errorFirebase.message : texto(errorFirebase)
          },
          resumen: resultadoLocal && resultadoLocal.resumen ? resultadoLocal.resumen : {},
          mensaje: "La base local quedó guardada, pero Firebase no pudo sincronizarse. La próxima importación volverá a intentarlo."
        };
        emitir("subirccc:importacion-fin", { etapa: "solo_local", porcentaje: 100, mensaje: pendiente.mensaje, resultado: pendiente });
        return pendiente;
      }
    }

    var salida = Object.assign({}, resultadoFirebase || {}, {
      ok: true,
      local: resultadoLocal,
      firebase: resultadoFirebase,
      firebaseOmitida: firebaseOmitida,
      estadoLocal: "guardado",
      mensaje: firebaseOmitida
        ? "Base local actualizada. Firebase no recibió operaciones porque no existen cambios desde la última sincronización."
        : (resultadoFirebase && resultadoFirebase.mensaje
          ? "Base local actualizada. " + resultadoFirebase.mensaje
          : "Base local y Firebase actualizados.")
    });

    emitir("subirccc:importacion-fin", {
      etapa: "finalizado",
      porcentaje: 100,
      mensaje: salida.mensaje,
      resultado: salida
    });

    return salida;
  }

  async function importarSiEstaListo(paquete, opciones) {
    opciones = opciones || {};
    var validado = validarAntesDeImportar(paquete, opciones);
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
    return await importarPaquete(validado, opciones);
  }

  var API = {
    VERSION: VERSION,
    probarConexion: probarConexion,
    importarPaquete: importarPaquete,
    importarSiEstaListo: importarSiEstaListo,
    validarAntesDeImportar: validarAntesDeImportar,
    prepararFirmaSincronizacion: prepararFirmaSincronizacion,
    limpiarPaqueteParaFirebase: function (paquete) { return limpiarBinarios(paquete, ""); },
    limpiarPaqueteParaBDLocal: function (paquete) { return paquete; }
  };

  NS.ConexionHibrida = API;
  NS.ConexionFirebase = API;
  NS.ConexionBDLocal = API;
})(window);