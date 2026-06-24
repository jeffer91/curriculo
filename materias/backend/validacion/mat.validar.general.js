/*
Nombre del archivo: mat.validar.general.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\validacion\mat.validar.general.js
Función:
- Valida datos antes de guardar
- Separa errores bloqueantes de advertencias
- Resume cantidades por tipo de carga
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.validar = MAT.validar || {};
  MAT.validar.general = MAT.validar.general || {};

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function countLevels(summary) {
    summary = summary || {};

    return {
      nivel1: safeArray(summary.nivel1).length,
      nivel2: safeArray(summary.nivel2).length,
      nivel3: safeArray(summary.nivel3).length,
      nivel4: safeArray(summary.nivel4).length,
      sinNivel: safeArray(summary.sinNivel).length
    };
  }

  function sumLevelCount(counts) {
    return (
      Number(counts.nivel1 || 0) +
      Number(counts.nivel2 || 0) +
      Number(counts.nivel3 || 0) +
      Number(counts.nivel4 || 0) +
      Number(counts.sinNivel || 0)
    );
  }

  MAT.validar.general.preview = function (preview, careerType) {
    var result = {
      ok: true,
      errors: [],
      warnings: [],
      stats: {}
    };
    var kind = String((preview && preview.kind) || "").trim();
    var summary = (preview && preview.summary) || {};
    var counts;
    var total;
    var limits;
    var expected;

    if (!kind) {
      result.ok = false;
      result.errors.push("No hay tipo de carga definido en la vista previa.");
      return result;
    }

    if (kind === "materias-carrera") {
      counts = countLevels(summary);
      total = sumLevelCount(counts);
      limits = (MAT.config && MAT.config.limits && MAT.config.limits.materiasCarrera) || {};

      result.stats = {
        total: total,
        counts: counts
      };

      if (total <= 0) {
        result.ok = false;
        result.errors.push("No se detectaron materias de carrera para guardar.");
        return result;
      }

      ["nivel1", "nivel2", "nivel3", "nivel4"].forEach(function (key) {
        var qty = Number(counts[key] || 0);
        if (qty > 0 && qty < Number(limits.minPerLevel || 4)) {
          result.warnings.push(key + " tiene menos del mínimo recomendado.");
        }
        if (qty > Number(limits.maxPerLevel || 6)) {
          result.warnings.push(key + " supera el máximo recomendado.");
        }
      });

      if (Number(counts.sinNivel || 0) > 0) {
        result.warnings.push("Aún hay materias sin nivel definido. Se reubicarán automáticamente al guardar.");
      }

      return result;
    }

    if (kind === "transversales") {
      counts = countLevels(summary);
      total = sumLevelCount(counts);
      limits = (MAT.config && MAT.config.limits && MAT.config.limits.transversales) || {};

      result.stats = {
        total: total,
        counts: counts
      };

      if (total <= 0) {
        result.ok = false;
        result.errors.push("No se detectaron materias transversales para guardar.");
        return result;
      }

      if (total < Number(limits.minTotal || 1)) {
        result.warnings.push("Hay menos materias transversales de las recomendadas.");
      }

      if (total > Number(limits.maxTotal || 3)) {
        result.warnings.push("Las materias transversales superan el máximo recomendado.");
      }

      return result;
    }

    if (kind === "nucleos") {
      total = safeArray(summary.items).length;
      expected = Number(
        (MAT.config &&
          MAT.config.limits &&
          MAT.config.limits.nucleos &&
          MAT.config.limits.nucleos.exactTotal) || 4
      );

      result.stats = {
        total: total,
        esperado: expected
      };

      if (total <= 0) {
        result.ok = false;
        result.errors.push("No se detectaron núcleos para guardar.");
        return result;
      }

      if (total !== expected) {
        result.warnings.push("Se esperaban " + expected + " núcleos y se detectaron " + total + ".");
      }

      return result;
    }

    if (kind === "ejes") {
      total = safeArray(summary.items).length;
      expected = (MAT.carreras && typeof MAT.carreras.getEjesEsperados === "function")
        ? MAT.carreras.getEjesEsperados(careerType)
        : 4;

      result.stats = {
        total: total,
        esperado: expected
      };

      if (total <= 0) {
        result.ok = false;
        result.errors.push("No se detectaron ejes para guardar.");
        return result;
      }

      if (total !== expected) {
        result.warnings.push("Para esta carrera se esperan " + expected + " ejes y se detectaron " + total + ".");
      }

      return result;
    }

    result.ok = false;
    result.errors.push("Tipo de carga no reconocido.");
    return result;
  };

  MAT.validar.general.beforeSave = function (params) {
    var input = (params && typeof params === "object") ? params : {};
    var result = {
      ok: true,
      errors: [],
      warnings: [],
      stats: {}
    };
    var previewCheck;

    if (!String(input.careerId || "").trim()) {
      result.ok = false;
      result.errors.push("Debes seleccionar una carrera.");
    }

    if (!String(input.loadType || "").trim()) {
      result.ok = false;
      result.errors.push("Debes seleccionar qué vas a subir.");
    }

    if (!input.preview || typeof input.preview !== "object") {
      result.ok = false;
      result.errors.push("No hay una vista previa válida para guardar.");
    }

    if (!result.ok) {
      return result;
    }

    previewCheck = MAT.validar.general.preview(input.preview, input.careerType || "");

    result.ok = previewCheck.ok;
    result.errors = previewCheck.errors.slice();
    result.warnings = previewCheck.warnings.slice();
    result.stats = previewCheck.stats || {};

    return result;
  };
})(window);