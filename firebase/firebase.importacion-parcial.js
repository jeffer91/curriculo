/* =========================================================
Nombre completo: firebase.importacion-parcial.js
Ruta o ubicación: /Curriculo/firebase/firebase.importacion-parcial.js
Funciones:
- Separar materias completas y materias omitidas antes de Firestore.
- Subir únicamente materias completas, sin bloquearlas por errores ajenos.
- Conservar intactas las versiones existentes de materias defectuosas.
- Registrar en la carga cuántas materias se detectaron, subieron y omitieron.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  if (!NS.importarPaquete || NS.__importacionParcialInstalada === true) return;

  var VERSION = "1.0.0";
  var importarOriginal = NS.importarPaquete;
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" +
    String(NS.SDK_VERSION || "12.16.0") + "/";

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

  function detalleOmitida(materia, validaciones) {
    return {
      materiaId: texto(materia && materia.id),
      carreraId: texto(materia && materia.carreraId),
      nivelId: texto(materia && materia.nivelId),
      codigo: texto(materia && (materia.codigo || materia.codigoMateria)),
      nombre: texto(materia && (materia.nombre || materia.nombreMateria || materia.materia)),
      estado: estadoMateria(materia) || "error",
      motivo: motivoMateria(materia, validaciones)
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
    var completas = materiasOriginales.filter(esMateriaCompleta);
    var omitidasMaterias = materiasOriginales.filter(function (materia) {
      return !esMateriaCompleta(materia);
    });
    var omitidas = omitidasMaterias.map(function (materia) {
      return detalleOmitida(materia, validaciones);
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
      evaluacionesMaterias: filtrarPorIds(
        paquete.evaluacionesMaterias,
        "materiaId",
        materiasIds
      ),
      estadosMaterias: filtrarPorIds(
        paquete.estadosMaterias,
        "materiaId",
        materiasIds
      ),
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

  async function registrarAuditoriaParcial(resultado, separacion) {
    if (
      !resultado || !resultado.cargaId ||
      !NS.CONFIG || !NS.CONFIG.projectId ||
      separacion.omitidas.length < 1
    ) return false;

    try {
      var modulos = await Promise.all([
        importarModulo(SDK_BASE + "firebase-app.js"),
        importarModulo(SDK_BASE + "firebase-firestore.js")
      ]);
      var appSDK = modulos[0];
      var firestoreSDK = modulos[1];
      var app = appSDK.getApps().length
        ? appSDK.getApp()
        : appSDK.initializeApp(NS.CONFIG);
      var db = firestoreSDK.getFirestore(app);
      var referencia = firestoreSDK.doc(
        db,
        (NS.COLECCIONES && NS.COLECCIONES.CARGAS) || "cargas",
        resultado.cargaId
      );

      await firestoreSDK.updateDoc(referencia, {
        estado: "completado_parcial",
        importacionParcial: true,
        totalMateriasDetectadas: separacion.totalDetectadas,
        totalMateriasSubidas: separacion.completas.length,
        totalMateriasOmitidas: separacion.omitidas.length,
        materiasOmitidas: separacion.omitidas.slice(0, 200),
        "resumen.totalMateriasDetectadas": separacion.totalDetectadas,
        "resumen.totalMateriasSubidas": separacion.completas.length,
        "resumen.materiasOmitidas": separacion.omitidas.length,
        "resumen.importacionParcial": true,
        actualizadoEn: firestoreSDK.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.warn(
        "[FirebaseImportacionParcial] La carga se completó, pero no se pudo ampliar su auditoría.",
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
      throw new Error(
        "No se encontró ninguna materia completa para subir. Corrige al menos una materia y vuelve a analizar el ZIP."
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
    resultado.estadoCarga = resultado.importacionParcial
      ? "completado_parcial"
      : "completado";

    if (resultado.importacionParcial) {
      resultado.mensaje =
        "Se procesaron " + separacion.completas.length +
        " materias completas. " + separacion.omitidas.length +
        " materias no se subieron porque tienen errores o advertencias.";
    }

    resultado.auditoriaParcialActualizada = await registrarAuditoriaParcial(
      resultado,
      separacion
    );

    return resultado;
  };

  NS.__importacionParcialInstalada = true;
  NS.ImportacionParcial = {
    VERSION: VERSION,
    separarPaquete: separarPaquete,
    esMateriaCompleta: esMateriaCompleta,
    esBloqueoGlobal: esBloqueoGlobal
  };
})(window);
