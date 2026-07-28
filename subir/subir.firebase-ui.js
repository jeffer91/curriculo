/* =========================================================
Nombre completo: subir.firebase-ui.js
Ruta o ubicación: /Curriculo/subir/subir.firebase-ui.js
Funciones:
- Sustituir textos heredados de BDLocal por Firebase.
- Mostrar el resultado inteligente: nuevas, actualizadas, sin cambios y versiones.
- Mantener compatibilidad sin reescribir el controlador principal de subida.
========================================================= */
(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "1.0.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
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
      var sinCambios = Number(resumen.sinCambios || 0);
      var nuevas = Number(resumen.nuevas || 0);
      var actualizadas = Number(resumen.actualizadas || 0);
      var retiradas = Number(resumen.retiradas || 0);
      var versiones = Number(resumen.versionesCreadas || 0);
      var totalCambios = nuevas + actualizadas + retiradas;
      var titulo = totalCambios ? "Firebase actualizado" : "Sin cambios en Firebase";
      var mensaje = totalCambios
        ? "Nuevas: " + nuevas + " · Actualizadas: " + actualizadas + " · Retiradas: " + retiradas + " · Sin cambios: " + sinCambios + " · Versiones creadas: " + versiones
        : "Las " + sinCambios + " materias ya tenían el mismo contenido. No se creó ninguna versión nueva.";
      NS.Preview.pintarEstado("ok", titulo, mensaje);
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
      btnImportar: "Subir a Firebase",
      btnImportarObservaciones: "Subir con observaciones"
    };
    Object.keys(textos).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = textos[id];
    });
  }

  NS.FirebaseUI = { VERSION: VERSION, instalar: instalar, reemplazar: reemplazar };
  instalar();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", actualizarEtiquetas, { once: true });
  else actualizarEtiquetas();
})(window, document);
