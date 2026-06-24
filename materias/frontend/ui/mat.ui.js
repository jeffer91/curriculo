/*
Nombre del archivo: mat.ui.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\ui\mat.ui.js
Función:
- Centraliza utilidades de interfaz
- Maneja status, preview del modal, resumen y botón guardar
- Evita repetir consultas al DOM
- Maneja el resumen compacto de carga por carrera
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.ui = MAT.ui || {};

  MAT.ui.getSelector = function (name, fallback) {
    var selectors = (MAT.config && MAT.config.selectors) || {};
    return selectors[name] || fallback || "";
  };

  MAT.ui.getEl = function (name, fallback) {
    var selector = MAT.ui.getSelector(name, fallback);

    if (!selector) {
      return null;
    }

    return document.querySelector(selector);
  };

  MAT.ui.escapeHtml = function (value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  MAT.ui.setStatus = function (message, type) {
    var el = MAT.ui.getEl("status");

    if (!el) return;

    el.className = "mat-status";

    if (type) {
      el.classList.add(type);
    }

    el.textContent = String(message || "");
  };

  MAT.ui.setSaveEnabled = function (enabled) {
    var el = MAT.ui.getEl("saveButton");

    if (!el) return;

    el.disabled = !enabled;
  };

  MAT.ui.setEditorHint = function (text) {
    var el = MAT.ui.getEl("editorHint");

    if (!el) return;

    el.textContent = String(text || "");
  };

  MAT.ui.clearPreview = function () {
    var el = MAT.ui.getEl("previewBody");

    if (!el) return;

    el.innerHTML = "Aún no hay datos procesados en esta importación.";
  };

  MAT.ui.renderPreview = function (analysis) {
    var el = MAT.ui.getEl("previewBody");
    var html = "";
    var summary;
    var key;

    if (!el) return;

    if (!analysis || typeof analysis !== "object") {
      MAT.ui.clearPreview();
      return;
    }

    summary = analysis.summary || {};

    html += "<div><b>Tipo detectado:</b> " + MAT.ui.escapeHtml(analysis.kind) + "</div>";
    html += "<div style='margin-top:6px;'><b>Líneas útiles:</b> " + MAT.ui.escapeHtml(String(analysis.totalLines || 0)) + "</div>";

    if (analysis.kind === "materias-carrera" || analysis.kind === "transversales") {
      html += "<ul>";

      for (key in summary) {
        if (Object.prototype.hasOwnProperty.call(summary, key)) {
          html += "<li><b>" + MAT.ui.escapeHtml(key) + ":</b> " +
            MAT.ui.escapeHtml(String(Array.isArray(summary[key]) ? summary[key].length : 0)) + "</li>";
        }
      }

      html += "</ul>";
    } else {
      if (typeof summary.expected !== "undefined") {
        html += "<div style='margin-top:6px;'><b>Esperado:</b> " + MAT.ui.escapeHtml(String(summary.expected)) + "</div>";
      }

      if (typeof summary.total !== "undefined") {
        html += "<div style='margin-top:6px;'><b>Detectado:</b> " + MAT.ui.escapeHtml(String(summary.total)) + "</div>";
      }

      if (Array.isArray(summary.items) && summary.items.length) {
        html += "<ul>";

        summary.items.forEach(function (item) {
          html += "<li>" + MAT.ui.escapeHtml(item) + "</li>";
        });

        html += "</ul>";
      }
    }

    el.innerHTML = html;
  };

  MAT.ui.renderEditorPlaceholder = function (message) {
    var el = MAT.ui.getEl("editor");
    var text = String(message || "Aquí se mostrará el editor dinámico.");

    if (!el) return;

    el.innerHTML = ""
      + "<strong>Editor dinámico</strong>"
      + "<p>" + MAT.ui.escapeHtml(text) + "</p>";
  };

  MAT.ui.setSummaryHtml = function (html) {
    var el = MAT.ui.getEl("saveSummary", "#mat-save-summary");

    if (!el) return;

    el.innerHTML = String(html || "");
  };

  MAT.ui.clearSummary = function (message) {
    var text = String(message || "Aún no has guardado cambios.");

    MAT.ui.setSummaryHtml("<p style='margin:0;color:#64748b;'>" + MAT.ui.escapeHtml(text) + "</p>");
  };

  MAT.ui.setCareerQuickSummaryHtml = function (html) {
    var el = MAT.ui.getEl("careerQuickSummary");

    if (!el) return;

    el.className = "mat-quick-summary";
    el.innerHTML = String(html || "");
  };

  MAT.ui.clearCareerQuickSummary = function (message) {
    var text = String(message || "Selecciona una carrera para ver qué está cargado.");

    MAT.ui.setCareerQuickSummaryHtml(
      ""
      + "<div class='mat-quick-summary-title'>Resumen de carga</div>"
      + "<div class='mat-quick-summary-line'>"
      +   "<span class='mat-quick-summary-label'>Estado:</span>"
      +   "<span class='mat-quick-summary-text'>" + MAT.ui.escapeHtml(text) + "</span>"
      + "</div>"
    );
  };
})(window, document);