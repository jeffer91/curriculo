/* =========================================================
Nombre completo: diagnostico-modal.js
Ruta o ubicación: /Curriculo/diagnostico/diagnostico-modal.js
Función o funciones:
- Crear un modal global de errores y bloqueos sin depender de una pantalla concreta.
- Mostrar flujo, etapa, archivo, función, tabla, materia y último paso exitoso.
- Permitir copiar y descargar el diagnóstico completo en JSON.
- Detectar errores visuales ya controlados por las pantallas.
========================================================= */

(function (window, document) {
  "use strict";

  var D = window.DiagnosticoFlujo;
  if (!D || window.DiagnosticoModal) return;

  var overlay = null;
  var detalleActual = null;
  var ultimaFirmaVisual = "";
  var ultimaFirmaVisualMs = 0;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatoTiempo(ms) {
    ms = Math.max(0, Number(ms || 0));
    var total = Math.floor(ms / 1000);
    var minutos = Math.floor(total / 60);
    var segundos = total % 60;
    return String(minutos).padStart(2, "0") + ":" + String(segundos).padStart(2, "0");
  }

  function crear() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "diagnosticoModalGlobal";
    overlay.className = "diag-overlay";
    overlay.hidden = true;
    overlay.innerHTML = [
      '<section class="diag-modal" role="dialog" aria-modal="true" aria-labelledby="diagTitulo">',
      '  <header class="diag-header">',
      '    <div><p class="diag-eyebrow">Diagnóstico técnico del flujo</p><h2 id="diagTitulo">Se produjo un error</h2></div>',
      '    <button id="diagCerrarX" class="diag-close" type="button" aria-label="Cerrar">×</button>',
      '  </header>',
      '  <div id="diagResumen" class="diag-summary"></div>',
      '  <div id="diagCampos" class="diag-grid"></div>',
      '  <section class="diag-section"><h3>Últimos pasos</h3><div id="diagHistorial" class="diag-history"></div></section>',
      '  <details class="diag-section"><summary>Detalle técnico completo</summary><pre id="diagJson" class="diag-json"></pre></details>',
      '  <footer class="diag-actions">',
      '    <button id="diagCopiar" type="button">Copiar diagnóstico</button>',
      '    <button id="diagDescargar" type="button">Descargar JSON</button>',
      '    <button id="diagRecargar" type="button">Recargar pantalla</button>',
      '    <a id="diagAbrirBD" href="../bdlocal/bdlocal.html">Abrir Base Local</a>',
      '    <button id="diagCerrar" class="diag-primary" type="button">Cerrar</button>',
      '  </footer>',
      '</section>'
    ].join("");
    document.body.appendChild(overlay);
    var enSubcarpeta = /\/(subir|bdlocal|comunicados)\//.test(String(window.location.pathname || "").toLowerCase());
    overlay.querySelector("#diagAbrirBD").href = enSubcarpeta ? "../bdlocal/bdlocal.html" : "bdlocal/bdlocal.html";

    overlay.querySelector("#diagCerrarX").addEventListener("click", cerrar);
    overlay.querySelector("#diagCerrar").addEventListener("click", cerrar);
    overlay.querySelector("#diagRecargar").addEventListener("click", function () { window.location.reload(); });
    overlay.querySelector("#diagDescargar").addEventListener("click", function () {
      D.descargar(detalleActual);
    });
    overlay.querySelector("#diagCopiar").addEventListener("click", copiar);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) cerrar();
    });
    return overlay;
  }

  function campo(etiqueta, valor, ancho) {
    return '<div class="diag-field' + (ancho ? " diag-field-wide" : "") + '"><span>' + escapar(etiqueta) + '</span><strong>' + escapar(valor || "No registrado") + '</strong></div>';
  }

  function renderHistorial(historial) {
    historial = Array.isArray(historial) ? historial.slice(-14) : [];
    if (!historial.length) return '<p class="diag-muted">No se registraron pasos anteriores.</p>';
    return historial.reverse().map(function (item) {
      var titulo = item.mensaje || item.etapa || item.operacion || item.tipo;
      var meta = [item.tipo, item.archivo, item.funcion, item.tabla].filter(Boolean).join(" · ");
      return '<div class="diag-event"><time>' + escapar(texto(item.fecha).replace("T", " ").replace("Z", "")) + '</time><div><strong>' + escapar(titulo) + '</strong><span>' + escapar(meta) + '</span></div></div>';
    }).join("");
  }

  function mostrar(detalle) {
    detalleActual = detalle || D.obtenerActual() || D.obtenerUltimo() || {};
    crear();
    var esBloqueo = detalleActual.tipoDiagnostico === "bloqueo";
    var error = detalleActual.error || {};
    overlay.querySelector("#diagTitulo").textContent = detalleActual.titulo || (esBloqueo ? "El flujo dejó de avanzar" : "Se produjo un error");
    overlay.querySelector("#diagResumen").innerHTML = '<strong>' + escapar(detalleActual.mensaje || error.mensaje || "No se pudo completar el proceso.") + '</strong><span>' + escapar(detalleActual.sugerencia || "Revisa el detalle técnico antes de reintentar.") + '</span>';
    overlay.querySelector("#diagCampos").innerHTML = [
      campo("Operación", detalleActual.id),
      campo("Flujo", detalleActual.flujo),
      campo("Etapa", detalleActual.etapa),
      campo("Subetapa", detalleActual.subetapa),
      campo("Archivo", detalleActual.archivo || error.archivo || error.archivoStack),
      campo("Función", detalleActual.funcion || error.funcion),
      campo("Tabla", detalleActual.tabla || error.tabla),
      campo("Operación BD", detalleActual.operacion || error.operacion),
      campo("Materia", detalleActual.materia || error.materia),
      campo("Registro", detalleActual.registro || error.registro),
      campo("Último paso exitoso", detalleActual.ultimoPasoExitoso, true),
      campo("Tiempo total", formatoTiempo(detalleActual.tiempoTranscurridoMs)),
      campo("Sin actividad", formatoTiempo(detalleActual.tiempoSinActividadMs)),
      campo("ZIP", detalleActual.zip)
    ].join("");
    overlay.querySelector("#diagHistorial").innerHTML = renderHistorial(detalleActual.historial);
    overlay.querySelector("#diagJson").textContent = JSON.stringify(detalleActual, null, 2);
    overlay.hidden = false;
    document.body.classList.add("diag-open");
  }

  function cerrar() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("diag-open");
  }

  async function copiar() {
    var contenido = JSON.stringify(detalleActual || {}, null, 2);
    try {
      await navigator.clipboard.writeText(contenido);
    } catch (error) {
      var area = document.createElement("textarea");
      area.value = contenido;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    var boton = overlay.querySelector("#diagCopiar");
    var original = boton.textContent;
    boton.textContent = "Copiado";
    setTimeout(function () { boton.textContent = original; }, 1200);
  }

  function observarErroresVisuales() {
    if (!document.body || typeof MutationObserver === "undefined") return;
    var observer = new MutationObserver(function () {
      var nodo = document.querySelector(".subir-status-error, .bd-status-error, .com-status-error");
      if (!nodo) return;
      var titulo = nodo.querySelector("strong");
      var mensaje = nodo.querySelector("span");
      var firma = texto(titulo && titulo.textContent) + "|" + texto(mensaje && mensaje.textContent);
      if (!firma || (firma === ultimaFirmaVisual && Date.now() - ultimaFirmaVisualMs < 3000)) return;
      ultimaFirmaVisual = firma;
      ultimaFirmaVisualMs = Date.now();
      var ultimo = D.obtenerUltimo ? D.obtenerUltimo() : null;
      var ultimoReciente = ultimo && ultimo.generadoEn && (Date.now() - Date.parse(ultimo.generadoEn) < 5000);
      if (!D.obtenerActual() && !ultimoReciente) {
        D.reportar(new Error(texto(mensaje && mensaje.textContent) || texto(titulo && titulo.textContent)), {
          titulo: texto(titulo && titulo.textContent) || "Error mostrado por la aplicación",
          flujo: "Interfaz de " + window.location.pathname,
          pantalla: window.location.pathname,
          archivo: window.location.pathname.indexOf("/subir/") !== -1 ? "subir/subir.main.js" : "",
          funcion: "pintarEstado()"
        });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("diagnostico:error", function (event) { mostrar(event.detail || {}); });
  document.addEventListener("DOMContentLoaded", function () {
    crear();
    observarErroresVisuales();
  });

  window.DiagnosticoModal = {
    mostrar: mostrar,
    cerrar: cerrar
  };
})(window, document);
