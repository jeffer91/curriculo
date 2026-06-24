/*
Nombre del archivo: mat.ui.carrera-summary.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\ui\mat.ui.carrera-summary.js
Función:
- Construye el resumen compacto de carga por carrera
- Cuenta materias, transversales, núcleos y ejes
- Renderiza un texto corto, compacto y conciso
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.ui = MAT.ui || {};
  MAT.ui.carreraSummary = MAT.ui.carreraSummary || {};

  function esc(value) {
    if (MAT.ui && typeof MAT.ui.escapeHtml === "function") {
      return MAT.ui.escapeHtml(value);
    }

    return String(value || "");
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function sumArrays(doc, keys) {
    var total = 0;
    var i;

    for (i = 0; i < keys.length; i += 1) {
      total += toArray(doc && doc[keys[i]]).length;
    }

    return total;
  }

  function getStats(doc) {
    var data = doc && typeof doc === "object" ? doc : {};

    return {
      materias: sumArrays(data, [
        "materiasNivel1",
        "materiasNivel2",
        "materiasNivel3",
        "materiasNivel4"
      ]),
      transversales: sumArrays(data, [
        "materiasTransversal1",
        "materiasTransversal2",
        "materiasTransversal3",
        "materiasTransversal4"
      ]),
      nucleos: toArray(data.nucleos).length,
      ejes: toArray(data.ejes).length
    };
  }

  function splitLoadedAndMissing(stats) {
    var loaded = [];
    var missing = [];

    if (stats.materias > 0) {
      loaded.push("Materias " + stats.materias);
    } else {
      missing.push("Materias");
    }

    if (stats.transversales > 0) {
      loaded.push("Transversales " + stats.transversales);
    } else {
      missing.push("Transversales");
    }

    if (stats.nucleos > 0) {
      loaded.push("Núcleos " + stats.nucleos);
    } else {
      missing.push("Núcleos");
    }

    if (stats.ejes > 0) {
      loaded.push("Ejes " + stats.ejes);
    } else {
      missing.push("Ejes");
    }

    return {
      loaded: loaded,
      missing: missing
    };
  }

  function buildHtml(doc) {
    var stats = getStats(doc);
    var parts = splitLoadedAndMissing(stats);
    var loadedText = parts.loaded.length ? parts.loaded.join(" · ") : "Nada";
    var missingText = parts.missing.length ? parts.missing.join(" · ") : "Nada";

    return ""
      + "<div class='mat-quick-summary-title'>Resumen de carga</div>"
      + "<div class='mat-quick-summary-line'>"
      +   "<span class='mat-quick-summary-label'>Hay:</span>"
      +   "<span class='mat-quick-summary-text'>" + esc(loadedText) + "</span>"
      + "</div>"
      + "<div class='mat-quick-summary-line'>"
      +   "<span class='mat-quick-summary-label'>Falta:</span>"
      +   "<span class='mat-quick-summary-text'>" + esc(missingText) + "</span>"
      + "</div>";
  }

  function buildStateHtml(label, text) {
    return ""
      + "<div class='mat-quick-summary-title'>Resumen de carga</div>"
      + "<div class='mat-quick-summary-line'>"
      +   "<span class='mat-quick-summary-label'>" + esc(label) + ":</span>"
      +   "<span class='mat-quick-summary-text'>" + esc(text) + "</span>"
      + "</div>";
  }

  MAT.ui.carreraSummary.getStats = function (doc) {
    return getStats(doc);
  };

  MAT.ui.carreraSummary.render = function (doc) {
    if (typeof MAT.ui.setCareerQuickSummaryHtml !== "function") {
      return;
    }

    MAT.ui.setCareerQuickSummaryHtml(buildHtml(doc));
  };

  MAT.ui.carreraSummary.renderLoading = function () {
    if (typeof MAT.ui.setCareerQuickSummaryHtml !== "function") {
      return;
    }

    MAT.ui.setCareerQuickSummaryHtml(
      buildStateHtml("Estado", "Revisando carga...")
    );
  };

  MAT.ui.carreraSummary.renderError = function () {
    if (typeof MAT.ui.clearCareerQuickSummary === "function") {
      MAT.ui.clearCareerQuickSummary("No se pudo leer el resumen.");
    }
  };
})(window);