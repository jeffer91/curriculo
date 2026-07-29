/* =========================================================
Nombre completo: subir.firebase-ui.js
Ruta o ubicación: /Curriculo/subir/subir.firebase-ui.js
Funciones:
- Sustituir textos heredados de BDLocal por Firebase.
- Mostrar nuevas, actualizadas, sin cambios, versiones y materias omitidas.
- Diferenciar una carga completa de una carga parcial segura.
========================================================= */
(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "1.1.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
  }

  function numero(valor) {
    var n = Number(valor || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function reemplazar(valor) {
    return texto(valor)
      .replace(/BDLocalCCC/g, "Firebase Firestore")
      .replace(/BDLocal/g, "Firebase")
      .replace(/base local/gi, "Firebase")
      .replace(/IndexedDB/g, "Cloud Firestore");
  }

  function instalar() {
    if (!NS.Preview || NS.Preview.__firebaseUI === true) return false;

    var pintarEstadoOriginal = NS.Preview.pintarEstado;
    if (typeof pintarEstadoOriginal === "function") {
      NS.Preview.pintarEstado = function (tipo, titulo, mensaje) {
        return pintarEstadoOriginal.call(NS.Preview, tipo, reemplazar(titulo), reemplazar(mensaje));
      };
    }

    NS.Preview.mostrarResultadoImportacion = function (resultado) {
      resultado = resultado || {};
      var resumen = resultado.resumen || resultado.resultado && resultado.resultado.resumen || {};
      var sinCambios = numero(resumen.sinCambios);
      var nuevas = numero(resumen.nuevas);
      var actualizadas = numero(resumen.actualizadas);
      var retiradas = numero(resumen.retiradas);
      var versiones = numero(resumen.versionesCreadas);
      var detectadas = numero(
        resumen.totalMateriasDetectadas || resultado.totalMateriasDetectadas || resumen.totalMaterias
      );
      var subidas = numero(
        resumen.totalMateriasSubidas || resultado.totalMateriasSubidas ||
        (nuevas + actualizadas + sinCambios)
      );
      var omitidas = numero(
        resumen.materiasOmitidas || resumen.materiasNoSubidas ||
        resultado.totalMateriasOmitidas
      );
      var totalCambios = nuevas + actualizadas + retiradas;
      var parcial = omitidas > 0 || resultado.importacionParcial === true;
      var titulo;
      var mensaje;
      var tipo;

      if (parcial) {
        titulo = "Carga parcial completada";
        tipo = "warn";
        mensaje =
          "Detectadas: " + detectadas +
          " · Procesadas: " + subidas +
          " · No subidas: " + omitidas +
          " · Nuevas: " + nuevas +
          " · Actualizadas: " + actualizadas +
          " · Sin cambios: " + sinCambios +
          " · Versiones creadas: " + versiones +
          ". Las materias con problemas no modificaron Firebase.";
      } else if (totalCambios) {
        titulo = "Firebase actualizado";
        tipo = "ok";
        mensaje =
          "Nuevas: " + nuevas +
          " · Actualizadas: " + actualizadas +
          " · Retiradas: " + retiradas +
          " · Sin cambios: " + sinCambios +
          " · Versiones creadas: " + versiones;
      } else {
        titulo = "Sin cambios en Firebase";
        tipo = "ok";
        mensaje = "Las " + sinCambios +
          " materias ya tenían el mismo contenido. No se creó ninguna versión nueva.";
      }

      NS.Preview.pintarEstado(tipo, titulo, mensaje);
    };

    var confirmarOriginal = window.confirm.bind(window);
    window.confirm = function (mensaje) {
      return confirmarOriginal(reemplazar(mensaje));
    };

    NS.Preview.__firebaseUI = true;
    return true;
  }

  function actualizarEtiquetas() {
    var textos = {
      linkBDLocal: "Ver Firebase",
      btnProbarBD: "Probar Firebase",
      btnImportar: "Subir materias completas",
      btnImportarObservaciones: "Subir materias completas"
    };
    Object.keys(textos).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = textos[id];
    });
  }

  NS.FirebaseUI = { VERSION: VERSION, instalar: instalar, reemplazar: reemplazar };
  instalar();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", actualizarEtiquetas, { once: true });
  } else {
    actualizarEtiquetas();
  }
})(window, document);
