/* =========================================================
Nombre completo: mallas.conciliacion-ui.js
Ruta o ubicación: /Curriculo/mallas/mallas.conciliacion-ui.js
Funciones:
- Conciliar las materias importadas con las que ya se muestran desde Firebase.
- Fusionar automáticamente diferencias de tildes, signos, mayúsculas y números romanos.
- Pedir confirmación únicamente cuando los nombres son parecidos, pero no idénticos.
========================================================= */
(function (window, document) {
  "use strict";

  var Parser = window.MallasParser;
  var Conciliador = window.MallasConciliador;
  if (!Parser || !Conciliador || window.__mallasConciliacionUI) return;
  window.__mallasConciliacionUI = true;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  function materiasActuales() {
    return Array.from(document.querySelectorAll("#listaMateriasMalla [data-index]")).map(function (fila) {
      var inputNivel = fila.querySelector('[data-campo="nivelNumero"]');
      var inputNombre = fila.querySelector('[data-campo="nombreOficial"]');
      if (!inputNivel || !inputNombre) return null;
      return {
        fila: fila,
        inputNivel: inputNivel,
        inputNombre: inputNombre,
        nivelNumero: numero(inputNivel.value),
        nombreOficial: texto(inputNombre.value),
        materiaFirebaseId: texto(fila.getAttribute("data-materia-firebase-id"))
      };
    }).filter(Boolean);
  }

  function actualizarNombre(actual, nombreOficial) {
    nombreOficial = texto(nombreOficial).replace(/[.;,:]+\s*$/, "");
    if (!actual || !actual.inputNombre || !nombreOficial) return;
    actual.nombreOficial = nombreOficial;
    actual.inputNombre.value = nombreOficial;
    actual.inputNombre.dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  function mensajeConfirmacion(actual, importada) {
    return [
      "¿Estas materias son la misma?",
      "",
      "Firebase: " + texto(actual.nombreOficial),
      "Malla: " + texto(importada.nombreOficial),
      "",
      "Aceptar: vincular y usar el nombre de la malla.",
      "Cancelar: conservarlas como materias diferentes."
    ].join("\n");
  }

  function mostrarResumen(conciliacion) {
    window.setTimeout(function () {
      var estado = document.getElementById("mlEstado");
      if (!estado || !conciliacion) return;
      var partes = [];
      if (conciliacion.automaticas) partes.push(conciliacion.automaticas + " vinculadas automáticamente");
      if (conciliacion.confirmadas) partes.push(conciliacion.confirmadas + " vinculadas por confirmación");
      if (conciliacion.nuevas) partes.push(conciliacion.nuevas + " nuevas");
      if (!partes.length) partes.push("sin cambios");
      estado.className = "ml-status ml-status-ok";
      estado.innerHTML = "<strong>Importación conciliada</strong><span>" + partes.join(" · ") + ".</span>";
    }, 0);
  }

  function conciliarResultado(resultado) {
    resultado = resultado || {};
    var importadas = Array.isArray(resultado.materias) ? resultado.materias : [];
    var actuales = materiasActuales();
    var usados = {};
    var resumen = { automaticas: 0, confirmadas: 0, nuevas: 0 };

    importadas.forEach(function (importada) {
      importada.nombreOficial = texto(importada.nombreOficial).replace(/[.;,:]+\s*$/, "");
      var exacta = actuales.find(function (actual) {
        return Conciliador.sonIgualesSeguras(actual, importada);
      });
      if (exacta) {
        actualizarNombre(exacta, importada.nombreOficial);
        resumen.automaticas += 1;
        return;
      }

      var posible = Conciliador.buscarMejorPosible(actuales, importada, usados);
      if (posible) {
        usados[posible.clave] = true;
        if (window.confirm(mensajeConfirmacion(posible.actual, importada))) {
          actualizarNombre(posible.actual, importada.nombreOficial);
          resumen.confirmadas += 1;
          return;
        }
      }
      resumen.nuevas += 1;
    });

    resultado.conciliacion = resumen;
    mostrarResumen(resumen);
    return resultado;
  }

  function envolver(nombreFuncion) {
    var original = Parser[nombreFuncion];
    if (typeof original !== "function" || original.__conciliacionMallas === true) return;
    var envuelta = function () {
      return conciliarResultado(original.apply(Parser, arguments));
    };
    envuelta.__conciliacionMallas = true;
    envuelta.__original = original;
    Parser[nombreFuncion] = envuelta;
  }

  envolver("parsearTexto");
  envolver("parsearFilasExcel");
})(window, document);
