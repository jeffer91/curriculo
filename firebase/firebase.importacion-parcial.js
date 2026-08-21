/* =========================================================
Nombre completo: firebase.importacion-parcial.js
Ruta o ubicación: /Curriculo/firebase/firebase.importacion-parcial.js
Funciones:
- Separar materias completas y materias omitidas antes de Firestore.
- Subir únicamente materias completas, sin bloquearlas por errores ajenos.
- Conservar intactas las versiones existentes de materias defectuosas.
- Registrar en la carga cuántas materias se detectaron, subieron y omitieron.
- Mantener un registro vigente de materias pendientes para Estadísticas.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  if (!NS.importarPaquete || NS.__importacionParcialInstalada === true) return;

  var VERSION = "1.1.0";
  var importarOriginal = NS.importarPaquete;
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" +
    String(NS.SDK_VERSION || "12.16.0") + "/";
  var COLECCION_PENDIENTES = "materias_pendientes";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function estadoMateria(materia) {
    return texto(
      materia && (
        materia.estadoClasificado ||
        materia.estadoValidacion ||
        materia.estado
      )
    ).toLowerCase();
  }

  function esMateriaCompleta(materia) {
    var completa = [
      "completa", "completo", "ok", "validado", "validada"
    ].indexOf(estadoMateria(materia)) !== -1;

    return completa &&
      materia &&
      materia.bloqueaImportacion !== true &&
      materia.subibleFirebase !== false &&
      materia.puedeImportar !== false;
  }

  function esValidacionGlobal(validacion) {
    return !texto(validacion && validacion.materiaId);
  }

  function esBloqueoGlobal(paquete) {
    var validacionesGlobales = arr(paquete && paquete.validacionesSubida)
      .filter(esValidacionGlobal);
    var control = paquete && paquete.diagnosticoExcel
      ? paquete.diagnosticoExcel.controlLectura || {}
      : {};

    return control.bloqueaImportacion === true ||
      validacionesGlobales.some(function (validacion) {
        return validacion && (
          validacion.bloqueaImportacion === true ||
          texto(validacion.severidad).toLowerCase() === "critico"
        );
      });
  }

  function motivoMateria(materia, validaciones) {
    var propias = arr(validaciones).filter(function (validacion) {
      return texto(validacion && validacion.materiaId) === texto(materia && materia.id);
    });
    var mensajes = propias.map(function (validacion) {
      return texto(validacion && (validacion.mensaje || validacion.titulo || validacion.tipo));
    }).filter(Boolean);

    if (mensajes.length) return mensajes.slice(0, 4).join(" · ");

    var motivos = arr(materia && materia.motivosEstado).map(texto).filter(Boolean);
    if (motivos.length) return motivos.slice(0, 4).join(" · ");

    var faltantes = arr(materia && materia.archivosFaltantes).map(texto).filter(Boolean);
    if (faltantes.length) return "Faltan archivos obligatorios: " + faltantes.join(", ");

    return estadoMateria(materia) === "advertencia" || estadoMateria(materia) === "revision"
      ? "La materia tiene advertencias pendientes."
      : "La materia tiene errores o información incompleta.";
  }

  function contieneTipo(lista, tipo) {
    var buscado = normalizar(tipo);
    return arr(lista).some(function (item) {
      var valor = normalizar(item);
      return valor === buscado || valor === buscado.replace(/^pea\s+/, "");
    });
  }

  function estadoPEADesdeEvaluacion(evaluacion, tipo) {
    if (!evaluacion) return "incompleto";
    if (contieneTipo(evaluacion.faltantes, tipo)) return "faltante";

    var resultado = arr(evaluacion.resultadosArchivos).find(function (item) {
      return normalizar(item && item.tipo) === normalizar(tipo);
    }) || null;

    if (!resultado) return "faltante";
    if (resultado.error || resultado.leido !== true) return "incompleto";
    return resultado.contenidoValido === true ? "completo" : "incompleto";
  }

  function detalleOmitida(materia, validaciones, evaluacion) {
    materia = materia || {};
    var tipoMateria = texto(materia.tipoMateria || materia.estructuraTipo || materia.tipo);
    return {
      materiaId: texto(materia.id),
      carreraId: texto(materia.carreraId),
      nivelId: texto(materia.nivelId),
      nivelNumero: numero(materia.nivelNumero || materia.numeroNivel, 0),
      nivelNombre: texto(materia.nivelNombre || materia.nivel),
      codigo: texto(materia.codigo || materia.codigoMateria),
      nombre: texto(materia.nombre || materia.nombreMateria || materia.materia),
      estado: estadoMateria(materia) || "error",
      estadoValidacion: estadoMateria(materia) || "incompleto",
      motivo: motivoMateria(materia, validaciones),
      motivosEstado: arr(materia.motivosEstado).map(texto).filter(Boolean),
      archivosFaltantes: arr(materia.archivosFaltantes).map(texto).filter(Boolean),
      archivosSinContenido: arr(materia.archivosSinContenido).map(texto).filter(Boolean),
      tipoMateria: tipoMateria,
      estructuraTipo: texto(materia.estructuraTipo),
      esTransversal: materia.esTransversal === true,
      perteneceMalla: materia.perteneceMalla !== false,
      origenMateria: texto(materia.origenMateria),
      esNucleo: materia.esNucleo === true || normalizar(tipoMateria) === "nucleo",
      nucleoNumero: numero(materia.nucleoNumero, 0),
      nucleoNombre: texto(materia.nucleoNombre),
      pea: {
        base: estadoPEADesdeEvaluacion(evaluacion, "pea_base"),
        unidades: estadoPEADesdeEvaluacion(evaluacion, "pea_unidades"),
        actividades: estadoPEADesdeEvaluacion(evaluacion, "pea_actividades")
      }
    };
  }

  function filtrarPorIds(lista, campo, ids) {
    return arr(lista).filter(function (item) {
      return ids[texto(item && item[campo])] === true;
    });
  }

  function separarPaquete(paquete) {
    paquete = paquete || {};
    var materiasOriginales = arr(paquete.materias);
    var validaciones = arr(paquete.validacionesSubida);
    var evaluaciones = {};

    arr(paquete.evaluacionesMaterias).forEach(function (evaluacion) {
      var materiaId = texto(evaluacion && evaluacion.materiaId);
      if (materiaId) evaluaciones[materiaId] = evaluacion;
    });

    var completas = materiasOriginales.filter(esMateriaCompleta);
    var omitidasMaterias = materiasOriginales.filter(function (materia) {
      return !esMateriaCompleta(materia);
    });
    var omitidas = omitidasMaterias.map(function (materia) {
      return detalleOmitida(materia, validaciones, evaluaciones[texto(materia && materia.id)] || null);
    });

    var materiasIds = {};
    var nivelesIds = {};
    var carrerasIds = {};
    completas.forEach(function (materia) {
      materiasIds[texto(materia.id)] = true;
      nivelesIds[texto(materia.nivelId)] = true;
      carrerasIds[texto(materia.carreraId)] = true;
    });

    var validacionesGlobales = validaciones.filter(esValidacionGlobal);
    var registrosOmitidas = omitidas.map(function (item) {
      return {
        id: "omitida_" + item.materiaId,
        tipo: "materia_omitida_importacion",
        severidad: item.estado === "advertencia" || item.estado === "revision"
          ? "advertencia"
          : "error",
        bloqueaImportacion: false,
        materiaId: item.materiaId,
        carreraId: item.carreraId,
        nivelId: item.nivelId,
        mensaje: item.nombre + " no se subió a Firebase: " + item.motivo,
        detalle: item
      };
    });

    var resumenOriginal = Object.assign({}, paquete.resumenValidacion || {});
    var resumenFiltrado = Object.assign({}, resumenOriginal, {
      totalMaterias: completas.length,
      totalMateriasDetectadas: materiasOriginales.length,
      totalMateriasSubidas: completas.length,
      materiasCompletas: completas.length,
      materiasSubibles: completas.length,
      materiasOmitidas: omitidas.length,
      materiasNoSubidas: omitidas.length,
      materiasAdvertencia: 0,
      materiasError: 0,
      materiasRevision: 0,
      materiasIncompletas: 0,
      requiereRevision: false,
      bloqueaImportacion: false,
      listoParaImportar: completas.length > 0,
      puedeImportarConObservaciones: completas.length > 0,
      importacionParcial: omitidas.length > 0
    });

    var filtrado = Object.assign({}, paquete, {
      carreras: arr(paquete.carreras).filter(function (carrera) {
        return carrerasIds[texto(carrera && carrera.id)] === true;
      }),
      niveles: arr(paquete.niveles).filter(function (nivel) {
        return nivelesIds[texto(nivel && nivel.id)] === true;
      }),
      materias: completas,
      archivos: filtrarPorIds(paquete.archivos, "materiaId", materiasIds),
      evaluacionesMaterias: filtrarPorIds(paquete.evaluacionesMaterias, "materiaId", materiasIds),
      estadosMaterias: filtrarPorIds(paquete.estadosMaterias, "materiaId", materiasIds),
      validacionesSubida: validacionesGlobales.concat(registrosOmitidas),
      advertencias: arr(paquete.advertencias).filter(function (advertencia) {
        return !texto(advertencia && advertencia.materiaId) ||
          materiasIds[texto(advertencia && advertencia.materiaId)] === true;
      }),
      resumenValidacion: resumenFiltrado,
      resumenValidacionOriginal: resumenOriginal,
      importacionParcial: {
        totalDetectadas: materiasOriginales.length,
        totalSubibles: completas.length,
        totalOmitidas: omitidas.length,
        omitidas: omitidas
      },
      carga: Object.assign({}, paquete.carga || {}, {
        totalMateriasDetectadas: materiasOriginales.length,
        totalMaterias: completas.length,
        materiasCompletas: completas.length,
        materiasSubibles: completas.length,
        materiasOmitidas: omitidas.length,
        importacionParcial: omitidas.length > 0
      })
    });

    return {
      paquete: filtrado,
      completas: completas,
      omitidas: omitidas,
      totalDetectadas: materiasOriginales.length,
      bloqueoGlobal: esBloqueoGlobal(paquete)
    };
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrirFirebase() {
    if (!NS.CONFIG || !NS.CONFIG.projectId) throw new Error("Firebase no tiene configuración disponible.");
    var modulos = await Promise.all([
      importarModulo(SDK_BASE + "firebase-app.js"),
      importarModulo(SDK_BASE + "firebase-firestore.js")
    ]);
    var appSDK = modulos[0];
    var firestoreSDK = modulos[1];
    var app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(NS.CONFIG);
    return {
      firestoreSDK: firestoreSDK,
      db: firestoreSDK.getFirestore(app)
    };
  }

  async function sincronizarPendientes(conexion, separacion, cargaId) {
    var F = conexion.firestoreSDK;
    var db = conexion.db;
    var operaciones = [];

    separacion.completas.forEach(function (materia) {
      var id = texto(materia && materia.id);
      if (id) operaciones.push({ tipo: "delete", id: id });
    });

    separacion.omitidas.forEach(function (item) {
      var id = texto(item && item.materiaId);
      if (!id) return;
      operaciones.push({
        tipo: "set",
        id: id,
        data: Object.assign({}, item, {
          id: id,
          activo: true,
          cargaId: texto(cargaId),
          origen: "importacion_parcial",
          actualizadoEn: F.serverTimestamp()
        })
      });
    });

    for (var inicio = 0; inicio < operaciones.length; inicio += 400) {
      var lote = operaciones.slice(inicio, inicio + 400);
      var batch = F.writeBatch(db);
      lote.forEach(function (op) {
        var ref = F.doc(db, COLECCION_PENDIENTES, op.id);
        if (op.tipo === "delete") batch.delete(ref);
        else batch.set(ref, op.data, { merge: true });
      });
      await batch.commit();
    }

    return operaciones.length;
  }

  async function guardarPendientesSinImportacion(separacion) {
    try {
      var conexion = await abrirFirebase();
      await sincronizarPendientes(conexion, separacion, "");
      return true;
    } catch (error) {
      console.warn("[FirebaseImportacionParcial] No se pudieron registrar las materias pendientes.", error);
      return false;
    }
  }

  async function registrarAuditoriaParcial(resultado, separacion) {
    if (!resultado || !resultado.cargaId || !NS.CONFIG || !NS.CONFIG.projectId) return false;

    try {
      var conexion = await abrirFirebase();
      var F = conexion.firestoreSDK;
      var db = conexion.db;
      var referencia = F.doc(
        db,
        (NS.COLECCIONES && NS.COLECCIONES.CARGAS) || "cargas",
        resultado.cargaId
      );
      var parcial = separacion.omitidas.length > 0;
      var actualizacion = {
        importacionParcial: parcial,
        totalMateriasDetectadas: separacion.totalDetectadas,
        totalMateriasSubidas: separacion.completas.length,
        totalMateriasOmitidas: separacion.omitidas.length,
        materiasOmitidas: separacion.omitidas.slice(0, 200),
        "resumen.totalMateriasDetectadas": separacion.totalDetectadas,
        "resumen.totalMateriasSubidas": separacion.completas.length,
        "resumen.materiasOmitidas": separacion.omitidas.length,
        "resumen.importacionParcial": parcial,
        actualizadoEn: F.serverTimestamp()
      };
      if (parcial) actualizacion.estado = "completado_parcial";

      await F.updateDoc(referencia, actualizacion);
      await sincronizarPendientes(conexion, separacion, resultado.cargaId);
      return true;
    } catch (error) {
      console.warn(
        "[FirebaseImportacionParcial] La carga se completó, pero no se pudo ampliar su auditoría o pendientes.",
        error
      );
      return false;
    }
  }

  NS.importarPaquete = async function (paquete, opciones) {
    var separacion = separarPaquete(paquete);

    if (separacion.bloqueoGlobal) {
      throw new Error(
        "El ZIP tiene un error global que impide identificar de forma segura las materias."
      );
    }

    if (!separacion.completas.length) {
      await guardarPendientesSinImportacion(separacion);
      throw new Error(
        "No se encontró ninguna materia completa para subir. Las materias con problemas quedaron registradas como pendientes."
      );
    }

    var resultado = await importarOriginal.call(
      NS,
      separacion.paquete,
      Object.assign({}, opciones || {}, {
        detectarEliminadas: false,
        cargaCompleta: false
      })
    );

    resultado = resultado || {};
    resultado.resumen = Object.assign({}, resultado.resumen || {}, {
      totalMateriasDetectadas: separacion.totalDetectadas,
      totalMateriasSubidas: separacion.completas.length,
      materiasOmitidas: separacion.omitidas.length,
      materiasNoSubidas: separacion.omitidas.length,
      importacionParcial: separacion.omitidas.length > 0
    });
    resultado.totalMateriasDetectadas = separacion.totalDetectadas;
    resultado.totalMateriasSubidas = separacion.completas.length;
    resultado.totalMateriasOmitidas = separacion.omitidas.length;
    resultado.materiasOmitidas = separacion.omitidas;
    resultado.importacionParcial = separacion.omitidas.length > 0;
    resultado.estadoCarga = resultado.importacionParcial ? "completado_parcial" : "completado";

    if (resultado.importacionParcial) {
      resultado.mensaje =
        "Se procesaron " + separacion.completas.length +
        " materias completas. " + separacion.omitidas.length +
        " materias quedaron pendientes porque tienen errores o advertencias.";
    }

    resultado.auditoriaParcialActualizada = await registrarAuditoriaParcial(resultado, separacion);
    return resultado;
  };

  NS.__importacionParcialInstalada = true;
  NS.ImportacionParcial = {
    VERSION: VERSION,
    separarPaquete: separarPaquete,
    esMateriaCompleta: esMateriaCompleta,
    esBloqueoGlobal: esBloqueoGlobal,
    detalleOmitida: detalleOmitida,
    sincronizarPendientes: sincronizarPendientes
  };
})(window);
