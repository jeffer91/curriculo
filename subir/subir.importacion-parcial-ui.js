/* =========================================================
Nombre completo: subir.importacion-parcial-ui.js
Ruta o ubicación: /Curriculo/subir/subir.importacion-parcial-ui.js
Funciones:
- Guardar todas las materias detectadas en la base local.
- Sincronizar con Firebase únicamente las materias completas.
- Permitir persistir localmente aun cuando no exista ninguna materia completa.
- Mantener una sola acción de guardado clara para el usuario.
========================================================= */
(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "2.0.0";
  var instalado = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function esCompleta(materia) {
    if (NS.FiltroImportacion && typeof NS.FiltroImportacion.esCompleta === "function") {
      return NS.FiltroImportacion.esCompleta(materia) && materia && materia.bloqueaImportacion !== true;
    }
    var estado = texto(
      materia && (
        materia.estadoClasificado ||
        materia.estadoValidacion ||
        materia.estado
      )
    ).toLowerCase();
    return ["completa", "completo", "ok", "validado", "validada"].indexOf(estado) !== -1 &&
      materia && materia.bloqueaImportacion !== true;
  }

  function resumenActual(paquete) {
    paquete = paquete || {};
    var materias = arr(paquete.materias);
    var completas = materias.filter(esCompleta).length;
    var omitidas = materias.length - completas;
    var resumen = paquete.resumenValidacion || {};
    var control = paquete.diagnosticoExcel
      ? paquete.diagnosticoExcel.controlLectura || {}
      : {};

    return {
      total: materias.length,
      completas: completas,
      omitidas: omitidas,
      bloqueado: resumen.bloqueaImportacion === true || control.bloqueaImportacion === true
    };
  }

  function actualizarBotones(paquete) {
    var btn = document.getElementById("btnImportar");
    var btnObservaciones = document.getElementById("btnImportarObservaciones");
    var info = resumenActual(paquete);
    var procesando = NS.Main && typeof NS.Main.getEstado === "function"
      ? NS.Main.getEstado().procesando === true
      : false;

    if (btnObservaciones) {
      btnObservaciones.hidden = true;
      btnObservaciones.disabled = true;
    }

    if (!btn) return info;

    btn.disabled = procesando || info.bloqueado || info.total < 1;
    if (info.total < 1) {
      btn.textContent = "No hay materias para guardar";
    } else if (info.completas < 1) {
      btn.textContent = "Guardar " + info.total + " en base local";
    } else if (info.omitidas > 0) {
      btn.textContent = "Guardar todo · sincronizar " + info.completas;
    } else {
      btn.textContent = "Guardar y sincronizar " + info.completas;
    }

    if (info.omitidas > 0) {
      btn.title = "La base local guardará las " + info.total + " materias. Firebase recibirá solo las " + info.completas + " completas y únicamente si tienen cambios.";
    } else {
      btn.title = "La base local guardará todas las materias y Firebase sincronizará únicamente cambios reales.";
    }

    return info;
  }

  function confirmarParcial(info) {
    return window.__confirmImportacionParcialOriginal(
      "La base local guardará todas las materias detectadas.\n\n" +
      "Materias detectadas: " + info.total + "\n" +
      "Materias completas para Firebase: " + info.completas + "\n" +
      "Materias con problemas que quedarán locales: " + info.omitidas + "\n\n" +
      "Firebase solo recibirá cambios de las materias completas.\n\n" +
      "¿Deseas continuar?"
    );
  }

  function interceptarClick(event) {
    var btn = event.target && event.target.closest
      ? event.target.closest("#btnImportar, #btnImportarObservaciones")
      : null;
    if (!btn || !NS.Main || typeof NS.Main.importar !== "function") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var estado = NS.Main.getEstado ? NS.Main.getEstado() : {};
    var info = actualizarBotones(estado.paqueteValidado);
    if (info.bloqueado || info.total < 1 || estado.procesando === true) return;

    NS.Main.importar(info.omitidas > 0);
  }

  function instalarConfirmacion() {
    if (!window.__confirmImportacionParcialOriginal) {
      window.__confirmImportacionParcialOriginal = window.confirm.bind(window);
    }
    var confirmAnterior = window.confirm.bind(window);
    window.confirm = function (mensaje) {
      var estado = NS.Main && typeof NS.Main.getEstado === "function"
        ? NS.Main.getEstado()
        : {};
      var info = resumenActual(estado.paqueteValidado);
      if (/El ZIP tiene observaciones/i.test(texto(mensaje)) && info.omitidas > 0) {
        return confirmarParcial(info);
      }
      return confirmAnterior(mensaje);
    };
  }

  function instalar() {
    if (instalado) return;
    instalado = true;

    if (NS.Preview && typeof NS.Preview.pintarPaquete === "function") {
      var pintarOriginal = NS.Preview.pintarPaquete;
      NS.Preview.pintarPaquete = function (paquete) {
        var resultado = pintarOriginal.apply(NS.Preview, arguments);
        window.setTimeout(function () { actualizarBotones(paquete); }, 0);
        return resultado;
      };
    }

    instalarConfirmacion();
    document.addEventListener("click", interceptarClick, true);

    window.addEventListener("subirccc:importacion-fin", function () {
      var estado = NS.Main && typeof NS.Main.getEstado === "function"
        ? NS.Main.getEstado()
        : {};
      window.setTimeout(function () { actualizarBotones(estado.paqueteValidado); }, 0);
    });

    var estado = NS.Main && typeof NS.Main.getEstado === "function"
      ? NS.Main.getEstado()
      : {};
    actualizarBotones(estado.paqueteValidado);
  }

  NS.ImportacionParcialUI = {
    VERSION: VERSION,
    instalar: instalar,
    actualizarBotones: actualizarBotones,
    resumenActual: resumenActual
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", instalar, { once: true });
  else instalar();
})(window, document);