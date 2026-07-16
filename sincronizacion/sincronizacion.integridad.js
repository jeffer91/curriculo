/* =========================================================
Nombre completo: sincronizacion.integridad.js
Ruta: /Curriculo/sincronizacion/sincronizacion.integridad.js
Funciones:
- Verificar módulos, elementos obligatorios, IndexedDB y fetch.
- Ejecutar las pruebas internas del comparador.
- Mostrar errores inesperados sin dejar la pantalla aparentemente congelada.
========================================================= */
(function (window, document) {
  "use strict";

  var IDS_REQUERIDOS = [
    "estadoPrincipal",
    "estadoTitulo",
    "estadoMensaje",
    "formConfiguracion",
    "btnProbarConexion",
    "btnComparar",
    "btnSincronizar",
    "tablaComparacion",
    "listaPendientes",
    "listaHistorial"
  ];

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function mostrarError(titulo, mensaje) {
    var contenedor = document.getElementById("estadoPrincipal");
    var tituloEl = document.getElementById("estadoTitulo");
    var mensajeEl = document.getElementById("estadoMensaje");

    if (contenedor) contenedor.className = "sync-status sync-status-error";
    if (tituloEl) tituloEl.textContent = titulo || "Error interno";
    if (mensajeEl) mensajeEl.textContent = mensaje || "La pantalla detectó un problema inesperado.";

    ["btnProbarConexion", "btnComparar", "btnSincronizar"].forEach(function (id) {
      var boton = document.getElementById(id);
      if (boton) boton.disabled = true;
    });
  }

  function verificar() {
    var problemas = [];
    var Sync = window.CurriculoSync || {};

    IDS_REQUERIDOS.forEach(function (id) {
      if (!document.getElementById(id)) problemas.push("Falta el elemento #" + id + ".");
    });

    if (!window.indexedDB) problemas.push("IndexedDB no está disponible.");
    if (typeof window.fetch !== "function") problemas.push("fetch no está disponible.");
    if (!Sync.Storage) problemas.push("No se cargó Sync.Storage.");
    if (!Sync.Versiones) problemas.push("No se cargó Sync.Versiones.");
    if (!Sync.Client) problemas.push("No se cargó Sync.Client.");
    if (!Sync.VersionHistory || !Sync.VersionHistory.activo) problemas.push("No se activó el historial de versiones.");

    var pruebas = Sync.SelfTest && typeof Sync.SelfTest.ejecutar === "function"
      ? Sync.SelfTest.ejecutar()
      : { ok: false, errores: ["No se cargó Sync.SelfTest."] };

    if (!pruebas.ok) {
      problemas = problemas.concat(pruebas.errores || ["Fallaron las pruebas internas."]);
    }

    var resultado = {
      ok: problemas.length === 0,
      problemas: problemas,
      pruebas: pruebas,
      verificadoEn: new Date().toISOString()
    };

    window.__CURRICULO_SYNC_INTEGRIDAD__ = resultado;
    document.documentElement.setAttribute("data-sync-integridad", resultado.ok ? "ok" : "error");

    if (!resultado.ok) {
      console.error("[Sincronizacion.Integridad]", problemas);
      mostrarError("Error interno de sincronización", problemas.join(" "));
    } else {
      console.info("[Sincronizacion.Integridad] Pantalla verificada correctamente.");
    }

    return resultado;
  }

  window.addEventListener("unhandledrejection", function (event) {
    var motivo = event && event.reason;
    var mensaje = texto(motivo && motivo.message ? motivo.message : motivo);
    if (!mensaje) return;

    console.error("[Sincronizacion] Promesa no controlada:", motivo);
    mostrarError("Operación de sincronización interrumpida", mensaje);
    event.preventDefault();
  });

  window.addEventListener("error", function (event) {
    var archivo = texto(event && event.filename);
    if (archivo && archivo.indexOf("sincronizacion") === -1 && archivo.indexOf("sync/") === -1) return;

    var mensaje = texto(event && event.message) || "Error inesperado en la pantalla de sincronización.";
    console.error("[Sincronizacion] Error global:", event && event.error || mensaje);
    mostrarError("Error en la pantalla de sincronización", mensaje);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(verificar, 250);
    }, { once: true });
  } else {
    setTimeout(verificar, 250);
  }
})(window, document);