/*
Nombre del archivo: mat.ui.resumen.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\ui\mat.ui.resumen.js
Función:
- Renderiza resúmenes de validación
- Renderiza resúmenes de guardado
- Muestra advertencias y cambios antes/después
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.ui = MAT.ui || {};
  MAT.ui.resumen = MAT.ui.resumen || {};

  function esc(value) {
    return (MAT.ui && typeof MAT.ui.escapeHtml === "function")
      ? MAT.ui.escapeHtml(value)
      : String(value || "");
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function renderList(items) {
    var list = toArray(items);
    var html = "";

    if (!list.length) {
      return "<div style='color:#64748b;'>Sin datos.</div>";
    }

    html += "<ul style='margin:6px 0 0 18px;padding:0;'>";

    list.forEach(function (item) {
      html += "<li style='margin:4px 0;'>" + esc(item) + "</li>";
    });

    html += "</ul>";
    return html;
  }

  function renderMap(title, data) {
    var html = "";
    var key;
    var value;

    html += "<div style='margin-top:12px;'>";
    html += "<div style='font-weight:700;'>" + esc(title) + "</div>";

    if (!data || typeof data !== "object") {
      html += "<div style='margin-top:6px;color:#64748b;'>Sin datos.</div>";
      html += "</div>";
      return html;
    }

    for (key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        value = data[key];

        if (Array.isArray(value)) {
          html += "<div style='margin-top:8px;'><b>" + esc(key) + ":</b> " + esc(String(value.length)) + "</div>";
          html += renderList(value);
        } else if (value && typeof value === "object") {
          html += "<div style='margin-top:8px;'><b>" + esc(key) + ":</b></div>";
          html += "<pre style='margin:6px 0 0;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;'>" + esc(JSON.stringify(value, null, 2)) + "</pre>";
        } else {
          html += "<div style='margin-top:8px;'><b>" + esc(key) + ":</b> " + esc(String(value)) + "</div>";
        }
      }
    }

    html += "</div>";
    return html;
  }

  MAT.ui.resumen.renderValidation = function (validation) {
    var data = validation || {};
    var html = "";

    html += "<div>";
    html += "<div style='font-size:15px;font-weight:700;'>Revisión previa</div>";

    if (data.ok) {
      html += "<p style='margin:8px 0 0;color:#166534;'>La estructura es válida para guardar.</p>";
    } else {
      html += "<p style='margin:8px 0 0;color:#991b1b;'>Hay errores que bloquean el guardado.</p>";
    }

    if (Array.isArray(data.errors) && data.errors.length) {
      html += "<div style='margin-top:10px;'><b>Errores</b></div>";
      html += renderList(data.errors);
    }

    if (Array.isArray(data.warnings) && data.warnings.length) {
      html += "<div style='margin-top:10px;'><b>Advertencias</b></div>";
      html += renderList(data.warnings);
    }

    if (data.stats && typeof data.stats === "object") {
      html += renderMap("Estadísticas", data.stats);
    }

    html += "</div>";

    MAT.ui.setSummaryHtml(html);
  };

  MAT.ui.resumen.renderSaveResult = function (result) {
    var data = result || {};
    var html = "";

    html += "<div>";
    html += "<div style='font-size:15px;font-weight:700;'>Resumen de guardado</div>";
    html += "<p style='margin:8px 0 0;color:#166534;'>Los cambios se guardaron correctamente.</p>";

    html += "<div style='margin-top:10px;'><b>Tipo de carga:</b> " + esc(data.kind || "") + "</div>";

    if (Array.isArray(data.warnings) && data.warnings.length) {
      html += "<div style='margin-top:10px;'><b>Advertencias</b></div>";
      html += renderList(data.warnings);
    }

    if (data.stats && typeof data.stats === "object") {
      html += renderMap("Estadísticas", data.stats);
    }

    if (data.before && typeof data.before === "object") {
      html += renderMap("Antes", data.before);
    }

    if (data.after && typeof data.after === "object") {
      html += renderMap("Después", data.after);
    }

    html += "</div>";

    MAT.ui.setSummaryHtml(html);
  };
})(window);