/*
Nombre del archivo: mat.merge.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carga\mat.merge.js
Función:
- Convierte la vista previa en un patch listo para Firestore
- Distribuye datos sin nivel de forma inteligente
- Construye advertencias y estadísticas
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.merge = MAT.merge || {};

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanArray(list) {
    var seen = Object.create(null);

    if (!Array.isArray(list)) return [];

    return list
      .map(cleanText)
      .filter(function (item) {
        return !!item;
      })
      .filter(function (item) {
        var key = item.toLowerCase();

        if (seen[key]) {
          return false;
        }

        seen[key] = true;
        return true;
      });
  }

  function cloneLevels(source) {
    return {
      nivel1: cleanArray(source && source.nivel1),
      nivel2: cleanArray(source && source.nivel2),
      nivel3: cleanArray(source && source.nivel3),
      nivel4: cleanArray(source && source.nivel4)
    };
  }

  function getShortestLevelKey(levels, maxPerLevel) {
    var keys = ["nivel1", "nivel2", "nivel3", "nivel4"];
    var chosen = keys[0];
    var chosenLen = Number.MAX_SAFE_INTEGER;
    var i;
    var key;
    var size;

    for (i = 0; i < keys.length; i += 1) {
      key = keys[i];
      size = Array.isArray(levels[key]) ? levels[key].length : 0;

      if (size < chosenLen && size < maxPerLevel) {
        chosen = key;
        chosenLen = size;
      }
    }

    if (chosenLen === Number.MAX_SAFE_INTEGER) {
      chosen = "nivel1";
      chosenLen = Array.isArray(levels.nivel1) ? levels.nivel1.length : 0;

      for (i = 1; i < keys.length; i += 1) {
        key = keys[i];
        size = Array.isArray(levels[key]) ? levels[key].length : 0;

        if (size < chosenLen) {
          chosen = key;
          chosenLen = size;
        }
      }
    }

    return chosen;
  }

  function distributeSmart(levels, extraItems, maxPerLevel) {
    var extras = cleanArray(extraItems);
    var assigned = 0;
    var i;
    var targetKey;

    for (i = 0; i < extras.length; i += 1) {
      targetKey = getShortestLevelKey(levels, maxPerLevel);
      levels[targetKey].push(extras[i]);
      assigned += 1;
    }

    return assigned;
  }

  function distributeSequential(levels, extraItems) {
    var extras = cleanArray(extraItems);
    var keys = ["nivel1", "nivel2", "nivel3", "nivel4"];
    var assigned = 0;
    var i;
    var key;

    for (i = 0; i < extras.length; i += 1) {
      key = keys[i % keys.length];
      levels[key].push(extras[i]);
      assigned += 1;
    }

    return assigned;
  }

  function countLevelItems(levels) {
    return (
      levels.nivel1.length +
      levels.nivel2.length +
      levels.nivel3.length +
      levels.nivel4.length
    );
  }

  function buildMateriasCarrera(preview) {
    var summary = (preview && preview.summary) || {};
    var limits = (MAT.config && MAT.config.limits && MAT.config.limits.materiasCarrera) || {};
    var maxPerLevel = Number(limits.maxPerLevel || 6);
    var levels = cloneLevels(summary);
    var extras = cleanArray(summary.sinNivel);
    var assigned = distributeSmart(levels, extras, maxPerLevel);
    var warnings = [];
    var key;
    var levelKeys = ["nivel1", "nivel2", "nivel3", "nivel4"];

    for (var i = 0; i < levelKeys.length; i += 1) {
      key = levelKeys[i];
      if (levels[key].length > maxPerLevel) {
        warnings.push(key + " supera el máximo recomendado de " + maxPerLevel + ".");
      }
    }

    return {
      patch: {
        materiasNivel1: levels.nivel1,
        materiasNivel2: levels.nivel2,
        materiasNivel3: levels.nivel3,
        materiasNivel4: levels.nivel4
      },
      warnings: warnings,
      stats: {
        totalAsignado: countLevelItems(levels),
        sinNivelDetectado: extras.length,
        sinNivelReubicado: assigned
      }
    };
  }

  function buildTransversales(preview) {
    var summary = (preview && preview.summary) || {};
    var limits = (MAT.config && MAT.config.limits && MAT.config.limits.transversales) || {};
    var maxTotal = Number(limits.maxTotal || 3);
    var levels = cloneLevels(summary);
    var extras = cleanArray(summary.sinNivel);
    var assigned = distributeSequential(levels, extras);
    var total = countLevelItems(levels);
    var warnings = [];

    if (total > maxTotal) {
      warnings.push("Las materias transversales superan el máximo recomendado de " + maxTotal + ".");
    }

    return {
      patch: {
        materiasTransversal1: levels.nivel1,
        materiasTransversal2: levels.nivel2,
        materiasTransversal3: levels.nivel3,
        materiasTransversal4: levels.nivel4
      },
      warnings: warnings,
      stats: {
        totalAsignado: total,
        sinNivelDetectado: extras.length,
        sinNivelReubicado: assigned
      }
    };
  }

  function buildNucleos(preview) {
    var summary = (preview && preview.summary) || {};
    var items = cleanArray(summary.items);
    var expected = Number((MAT.config && MAT.config.limits && MAT.config.limits.nucleos && MAT.config.limits.nucleos.exactTotal) || 4);
    var warnings = [];

    if (items.length !== expected) {
      warnings.push("Se esperaban " + expected + " núcleos y se detectaron " + items.length + ".");
    }

    return {
      patch: {
        nucleos: items
      },
      warnings: warnings,
      stats: {
        totalAsignado: items.length
      }
    };
  }

  function buildEjes(preview, careerType) {
    var summary = (preview && preview.summary) || {};
    var items = cleanArray(summary.items);
    var expected = MAT.carreras.getEjesEsperados(careerType);
    var warnings = [];

    if (items.length !== expected) {
      warnings.push("Para esta carrera se esperaban " + expected + " ejes y se detectaron " + items.length + ".");
    }

    return {
      patch: {
        ejes: items
      },
      warnings: warnings,
      stats: {
        totalAsignado: items.length,
        esperado: expected
      }
    };
  }

  MAT.merge.fromPreview = function (currentDoc, preview, careerType) {
    var kind;
    var result;

    currentDoc = currentDoc || {};
    preview = preview || {};
    kind = String(preview.kind || "").trim();

    if (!kind) {
      throw new Error("MAT: La vista previa no indica el tipo de carga.");
    }

    if (kind === "materias-carrera") {
      result = buildMateriasCarrera(preview);
    } else if (kind === "transversales") {
      result = buildTransversales(preview);
    } else if (kind === "nucleos") {
      result = buildNucleos(preview);
    } else if (kind === "ejes") {
      result = buildEjes(preview, careerType || currentDoc.tipo || "");
    } else {
      throw new Error("MAT: Tipo de carga no reconocido: " + kind);
    }

    result.kind = kind;
    return result;
  };
})(window);