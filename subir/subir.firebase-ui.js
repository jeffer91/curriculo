/* =========================================================
Nombre completo: subir.firebase-ui.js
Ruta o ubicación: /Curriculo/subir/subir.firebase-ui.js
Funciones:
- Mostrar el resultado combinado de Base local + Firebase.
- Informar cuando Firebase no recibió operaciones por no existir cambios.
- Informar cuando la base local quedó guardada pero Firebase quedó pendiente.
========================================================= */
(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "2.0.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
  }

  function numero(valor) {
    var n = Number(valor || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function instalar() {
    if (!NS.Preview || NS.Preview.__firebaseUI === true) return false;

    NS.Preview.mostrarResultadoImportacion = function (resultado) {
      resultado = resultado || {};
      var firebase = resultado.firebase || resultado;
      var local = resultado.local || null;
      var resumen = firebase.resumen || resultado.resumen || {};
      var sinCambios = numero(resumen.sinCambios);
      var nuevas = numero(resumen.nuevas);
      var actualizadas = numero(resumen.actualizadas);
      var retiradas = numero(resumen.retiradas);
      var versiones = numero(resumen.versionesCreadas);
      var operaciones = numero(resumen.operacionesFirestore);
      var detectadas = numero(
        resumen.totalMateriasDetectadas || firebase.totalMateriasDetectadas ||
        (local && local.resumen && local.resumen.totalMaterias)
      );
      var subidas = numero(
        resumen.totalMateriasSubidas || firebase.totalMateriasSubidas ||
        (nuevas + actualizadas + sinCambios)
      );
      var omitidas = numero(
        resumen.materiasOmitidas || resumen.materiasNoSubidas || firebase.totalMateriasOmitidas
      );

      if (firebase && firebase.ok === false) {
        NS.Preview.pintarEstado(
          "warn",
          "Guardado local · Firebase pendiente",
          "La información quedó segura en la base local. Firebase no pudo sincronizarse: " +
          texto(firebase.mensaje || "sin conexión") + "."
        );
        return;
      }

      if (resultado.firebaseOmitida === true || firebase.estado === "sin_cambios_local") {
        NS.Preview.pintarEstado(
          "ok",
          "Guardado local · Firebase sin cambios",
          "Base local actualizada. Firebase realizó 0 operaciones porque el contenido coincide con la última sincronización."
        );
        return;
      }

      if (omitidas > 0) {
        NS.Preview.pintarEstado(
          "warn",
          "Guardado local y sincronización parcial",
          "Detectadas: " + detectadas +
          " · Base local: " + detectadas +
          " · Completas para Firebase: " + subidas +
          " · Con problemas: " + omitidas +
          " · Nuevas: " + nuevas +
          " · Actualizadas: " + actualizadas +
          " · Sin cambios: " + sinCambios +
          " · Operaciones Firebase: " + operaciones + "."
        );
        return;
      }

      if (nuevas + actualizadas + retiradas > 0) {
        NS.Preview.pintarEstado(
          "ok",
          "Base local y Firebase actualizados",
          "Nuevas: " + nuevas +
          " · Actualizadas: " + actualizadas +
          " · Retiradas: " + retiradas +
          " · Sin cambios: " + sinCambios +
          " · Versiones: " + versiones +
          " · Operaciones Firebase: " + operaciones + "."
        );
      } else {
        NS.Preview.pintarEstado(
          "ok",
          "Guardado local · Firebase sin cambios",
          "La base local fue actualizada y Firebase no necesitó cambios curriculares."
        );
      }
    };

    NS.Preview.__firebaseUI = true;
    return true;
  }

  function actualizarEtiquetas() {
    var textos = {
      linkBDLocal: "Firebase",
      linkBaseLocal: "Base local",
      btnProbarBD: "Probar bases"
    };
    Object.keys(textos).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = textos[id];
    });
  }

  NS.FirebaseUI = { VERSION: VERSION, instalar: instalar };
  instalar();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", actualizarEtiquetas, { once: true });
  else actualizarEtiquetas();
})(window, document);