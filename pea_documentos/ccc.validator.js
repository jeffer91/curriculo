/*
Nombre completo: ccc.validator.js
Ruta o ubicación: /pea_documentos/ccc.validator.js
Función:
- Validar la estructura CCC de componentes por unidad
- Corregir espacios que dañan la numeración jerárquica
- Separar numeración, nivel jerárquico y descripción limpia
- Preparar hojas de Excel: CCC limpio y Validación
*/
(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function text(value) {
    return String(value == null ? "" : value)
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeNumberingSpaces(value) {
    var clean = text(value);

    // Corrige casos como: 1 .1, 1. 1, 1.1. 1, 1 . 1 . 1
    clean = clean.replace(/(\d)\s*\.\s*(?=\d)/g, "$1.");

    // Corrige doble espacio después de la numeración ya normalizada.
    clean = clean.replace(/^(\d+(?:\.\d+)*\.?)(\S)/, "$1 $2");
    clean = clean.replace(/\s+/g, " ").trim();

    return clean;
  }

  function extractNumbering(value) {
    var original = text(value);
    var normalized = normalizeNumberingSpaces(original);
    var match = normalized.match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/);

    if (!match) {
      return {
        ok: false,
        original: original,
        normalizedLine: normalized,
        number: "",
        description: normalized,
        level: 0
      };
    }

    return {
      ok: true,
      original: original,
      normalizedLine: match[1] + " " + text(match[2]),
      number: match[1],
      description: text(match[2]),
      level: match[1].split(".").length
    };
  }

  function compareNumbering(a, b) {
    var left = String(a || "").split(".").map(function (x) { return Number(x || 0); });
    var right = String(b || "").split(".").map(function (x) { return Number(x || 0); });
    var len = Math.max(left.length, right.length);
    var i;

    for (i = 0; i < len; i += 1) {
      var av = Number(left[i] || 0);
      var bv = Number(right[i] || 0);
      if (av < bv) return -1;
      if (av > bv) return 1;
    }

    return 0;
  }

  function parentNumber(number) {
    var parts = String(number || "").split(".");
    if (parts.length <= 1) return "";
    parts.pop();
    return parts.join(".");
  }

  function findHeaderIndex(rows) {
    var limit = Math.min((rows || []).length, 20);
    var i;

    for (i = 0; i < limit; i += 1) {
      var row = Array.isArray(rows[i]) ? rows[i] : [];
      var joined = row.map(function (cell) { return text(cell).toLowerCase(); }).join("|");
      if (
        joined.indexOf("codigocomponente") >= 0 ||
        joined.indexOf("codigo componente") >= 0 ||
        joined.indexOf("ordencomponente") >= 0 ||
        joined.indexOf("descripcioncomponente") >= 0 ||
        joined.indexOf("descripción componente") >= 0 ||
        joined.indexOf("descripcion componente") >= 0
      ) {
        return i;
      }
    }

    return -1;
  }

  function normalizeHeader(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function headerMap(headerRow) {
    var map = {};
    (Array.isArray(headerRow) ? headerRow : []).forEach(function (cell, idx) {
      var key = normalizeHeader(cell);
      if (!key) return;
      if (key === "codigocomponente" || key === "codigo") map.codigo = idx;
      if (key === "ordencomponente" || key === "orden") map.orden = idx;
      if (key === "descripcioncomponente" || key === "descripcion" || key === "descripciondelcomponente") map.descripcion = idx;
    });
    return map;
  }

  function guessDescriptionIndex(rows) {
    var best = { index: 0, score: -1 };
    var maxCols = 0;
    var i;
    var c;

    (rows || []).slice(0, 40).forEach(function (row) {
      if (Array.isArray(row)) maxCols = Math.max(maxCols, row.length);
    });

    for (c = 0; c < maxCols; c += 1) {
      var score = 0;
      for (i = 0; i < Math.min((rows || []).length, 50); i += 1) {
        var value = Array.isArray(rows[i]) ? rows[i][c] : "";
        if (extractNumbering(value).ok) score += 1;
      }
      if (score > best.score) best = { index: c, score: score };
    }

    return best.score > 0 ? best.index : 0;
  }

  function collectComponentRowsFromSection(section) {
    var rowsOut = [];
    var sheets = section && Array.isArray(section.sheets) ? section.sheets : [];

    sheets.forEach(function (sheet) {
      var rows = Array.isArray(sheet.rows) ? sheet.rows : [];
      var headerIdx = findHeaderIndex(rows);
      var map = headerIdx >= 0 ? headerMap(rows[headerIdx]) : {};
      var start = headerIdx >= 0 ? headerIdx + 1 : 0;
      var descIdx = map.descripcion != null ? map.descripcion : guessDescriptionIndex(rows);
      var codigoIdx = map.codigo != null ? map.codigo : null;
      var ordenIdx = map.orden != null ? map.orden : null;

      rows.slice(start).forEach(function (row, idx) {
        var arr = Array.isArray(row) ? row : [];
        var desc = text(arr[descIdx]);
        var parsed = extractNumbering(desc);

        if (!desc || !parsed.ok) return;

        rowsOut.push({
          sourceSheet: String(sheet.name || "Hoja"),
          sourceRow: start + idx + 1,
          codigoOriginal: codigoIdx != null ? text(arr[codigoIdx]) : "",
          ordenOriginal: ordenIdx != null ? text(arr[ordenIdx]) : "",
          descripcionOriginal: desc,
          parsed: parsed
        });
      });
    });

    return rowsOut;
  }

  function validateComponentRows(rawRows) {
    var rows = Array.isArray(rawRows) ? rawRows : [];
    var seenNumbers = Object.create(null);
    var previousNumber = "";
    var cleanRows = [];
    var detailRows = [];
    var errors = 0;
    var warnings = 0;
    var corrections = 0;

    rows.forEach(function (item, idx) {
      var parsed = item.parsed || extractNumbering(item.descripcionOriginal);
      var number = parsed.number;
      var unitCode = number ? number.split(".")[0] : "";
      var expectedOrder = String(idx + 1);
      var status = "OK";
      var observations = [];

      if (!parsed.ok) {
        status = "ERROR";
        observations.push("No se detectó numeración jerárquica al inicio de la descripción.");
      }

      if (parsed.original !== parsed.normalizedLine) {
        corrections += 1;
        if (status === "OK") status = "CORREGIDO";
        observations.push("Se corrigieron espacios o formato de la numeración/descripción.");
      }

      if (item.codigoOriginal && item.codigoOriginal !== unitCode) {
        warnings += 1;
        if (status === "OK") status = "ADVERTENCIA";
        observations.push("codigoComponente no coincide con la unidad detectada: se sugiere " + unitCode + ".");
      }

      if (item.ordenOriginal && item.ordenOriginal !== expectedOrder) {
        warnings += 1;
        if (status === "OK") status = "ADVERTENCIA";
        observations.push("ordenComponente no es secuencial: se sugiere " + expectedOrder + ".");
      }

      if (number && seenNumbers[number]) {
        errors += 1;
        status = "ERROR";
        observations.push("Numeración duplicada: " + number + ".");
      }

      if (number && previousNumber && compareNumbering(previousNumber, number) >= 0) {
        warnings += 1;
        if (status === "OK") status = "ADVERTENCIA";
        observations.push("La numeración no avanza de forma ascendente respecto al componente anterior.");
      }

      var parent = parentNumber(number);
      if (parent && !seenNumbers[parent]) {
        warnings += 1;
        if (status === "OK") status = "ADVERTENCIA";
        observations.push("No se encontró el componente padre " + parent + " antes de este registro.");
      }

      if (parsed.level > 4) {
        warnings += 1;
        if (status === "OK") status = "ADVERTENCIA";
        observations.push("El nivel jerárquico es muy profundo; se recomienda validar si aporta claridad técnica.");
      }

      if (status === "ERROR") errors += 1;
      if (status === "ADVERTENCIA") warnings += 1;

      if (number) seenNumbers[number] = true;
      if (number) previousNumber = number;

      cleanRows.push({
        codigoComponente: unitCode,
        ordenComponente: expectedOrder,
        descripcionComponente: parsed.normalizedLine,
        numeracionDetectada: number,
        nivelJerarquico: parsed.level,
        descripcionLimpia: parsed.description,
        estadoValidacion: status,
        observacion: observations.join(" ") || "Sin observaciones."
      });

      detailRows.push({
        fila: idx + 1,
        hojaOrigen: item.sourceSheet || "",
        filaOrigen: item.sourceRow || "",
        codigoOriginal: item.codigoOriginal || "",
        ordenOriginal: item.ordenOriginal || "",
        descripcionOriginal: item.descripcionOriginal || "",
        codigoSugerido: unitCode,
        ordenSugerido: expectedOrder,
        descripcionSugerida: parsed.normalizedLine,
        numeracionDetectada: number,
        nivelJerarquico: parsed.level,
        estadoValidacion: status,
        observacion: observations.join(" ") || "Sin observaciones."
      });
    });

    return {
      ok: errors === 0,
      total: cleanRows.length,
      errores: errors,
      advertencias: warnings,
      correcciones: corrections,
      limpio: cleanRows,
      validacion: detailRows
    };
  }

  function validateSection(section) {
    return validateComponentRows(collectComponentRowsFromSection(section));
  }

  function validateUpload(payload) {
    var contenido = payload && payload.contenido ? payload.contenido : payload || {};
    var unidades = validateSection(contenido.unidades || {});

    return {
      ok: unidades.ok,
      unidades: unidades,
      resumen: {
        totalComponentes: unidades.total,
        errores: unidades.errores,
        advertencias: unidades.advertencias,
        correcciones: unidades.correcciones
      }
    };
  }

  function toSheetRowsClean(result) {
    var rows = [[
      "codigoComponente",
      "ordenComponente",
      "descripcionComponente"
    ]];

    ((result && result.limpio) || []).forEach(function (item) {
      rows.push([
        String(item.codigoComponente || ""),
        String(item.ordenComponente || ""),
        String(item.descripcionComponente || "")
      ]);
    });

    return rows;
  }

  function toSheetRowsValidation(result) {
    var rows = [[
      "fila",
      "hojaOrigen",
      "filaOrigen",
      "codigoOriginal",
      "ordenOriginal",
      "descripcionOriginal",
      "codigoSugerido",
      "ordenSugerido",
      "descripcionSugerida",
      "numeracionDetectada",
      "nivelJerarquico",
      "estadoValidacion",
      "observacion"
    ]];

    ((result && result.validacion) || []).forEach(function (item) {
      rows.push([
        String(item.fila || ""),
        String(item.hojaOrigen || ""),
        String(item.filaOrigen || ""),
        String(item.codigoOriginal || ""),
        String(item.ordenOriginal || ""),
        String(item.descripcionOriginal || ""),
        String(item.codigoSugerido || ""),
        String(item.ordenSugerido || ""),
        String(item.descripcionSugerida || ""),
        String(item.numeracionDetectada || ""),
        String(item.nivelJerarquico || ""),
        String(item.estadoValidacion || ""),
        String(item.observacion || "")
      ]);
    });

    return rows;
  }

  function buildObservationText(result, meta) {
    var data = result && result.unidades ? result.unidades : result;
    var lines = [];

    lines.push("Observaciones de validación CCC");
    lines.push("Materia: " + text(meta && meta.materiaNombre || ""));
    lines.push("Carrera: " + text(meta && meta.carreraNombre || ""));
    lines.push("Total componentes: " + Number(data && data.total || 0));
    lines.push("Errores: " + Number(data && data.errores || 0));
    lines.push("Advertencias: " + Number(data && data.advertencias || 0));
    lines.push("Correcciones automáticas: " + Number(data && data.correcciones || 0));
    lines.push("");

    ((data && data.validacion) || []).forEach(function (item) {
      if (item.estadoValidacion === "OK") return;
      lines.push(
        item.fila + ". " +
        item.estadoValidacion + " | " +
        "Original: " + item.descripcionOriginal + " | " +
        "Sugerido: " + item.descripcionSugerida + " | " +
        item.observacion
      );
    });

    if (lines.length <= 8) {
      lines.push("No se detectaron observaciones relevantes.");
    }

    return lines.join("\n");
  }

  PEA.ccc = {
    normalizeNumberingSpaces: normalizeNumberingSpaces,
    extractNumbering: extractNumbering,
    collectComponentRowsFromSection: collectComponentRowsFromSection,
    validateComponentRows: validateComponentRows,
    validateSection: validateSection,
    validateUpload: validateUpload,
    toSheetRowsClean: toSheetRowsClean,
    toSheetRowsValidation: toSheetRowsValidation,
    buildObservationText: buildObservationText
  };
})(window);
