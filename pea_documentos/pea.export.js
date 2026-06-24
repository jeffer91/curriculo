(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;
  var NAVY = [15, 42, 74];
  var GOLD = [203, 174, 102];
  var MUTED = [90, 105, 125];

  function ensureXlsx() {
    if (!window.XLSX) {
      throw new Error("No se encontró la librería XLSX.");
    }
  }

  function ensurePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("No se encontró la librería jsPDF.");
    }
  }

  function safeSheets(section) {
    return (section && Array.isArray(section.sheets)) ? section.sheets : [];
  }

  function cleanText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function fileSafe(value) {
    return cleanText(value || "Materia").replace(/[^\w\-áéíóúÁÉÍÓÚñÑ]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    try {
      return new Date(value).toLocaleString("es-EC");
    } catch (error) {
      return String(value);
    }
  }

  function createPlaceholderSheet(title) {
    return {
      name: "Hoja1",
      rows: [[String(title || "Sin información")], ["Sin información disponible para esta sección."]],
      rowCount: 2
    };
  }

  function rowsAsText(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      return (Array.isArray(row) ? row : []).map(function (cell) {
        return String(cell == null ? "" : cell);
      });
    });
  }

  function aoaToTextSheet(rows) {
    var ws = XLSX.utils.aoa_to_sheet(rowsAsText(rows));
    var range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    var r;
    var c;
    for (r = range.s.r; r <= range.e.r; r += 1) {
      for (c = range.s.c; c <= range.e.c; c += 1) {
        var addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        ws[addr].t = "s";
        ws[addr].v = String(ws[addr].v == null ? "" : ws[addr].v);
        ws[addr].z = "@";
      }
    }
    ws["!cols"] = Array.from({ length: Math.max(1, range.e.c + 1) }).map(function () {
      return { wch: 32 };
    });
    return ws;
  }

  function appendSheet(workbook, name, rows) {
    XLSX.utils.book_append_sheet(
      workbook,
      aoaToTextSheet(rows),
      String(name || "Hoja").slice(0, 31) || "Hoja"
    );
  }

  function sectionToWorkbook(section, emptyTitle) {
    var workbook = XLSX.utils.book_new();
    var sheets = safeSheets(section);

    if (!sheets.length) {
      sheets = [createPlaceholderSheet(emptyTitle)];
    }

    sheets.forEach(function (sheet) {
      appendSheet(workbook, sheet.name || "Hoja1", Array.isArray(sheet.rows) ? sheet.rows : [["Sin datos"]]);
    });

    return workbook;
  }

  function validateVersion(versionData) {
    if (!versionData || !versionData.data) return null;
    if (versionData.data.validacionCCC) return versionData.data.validacionCCC;
    if (PEA.ccc && typeof PEA.ccc.validateUpload === "function") {
      return PEA.ccc.validateUpload(versionData.data);
    }
    return null;
  }

  function addValidationSheets(workbook, versionData) {
    var validation = validateVersion(versionData);
    var unidades = validation && validation.unidades ? validation.unidades : null;

    if (!unidades || !PEA.ccc) return;

    appendSheet(workbook, "CCC limpio", PEA.ccc.toSheetRowsClean(unidades));
    appendSheet(workbook, "Validacion", PEA.ccc.toSheetRowsValidation(unidades));
    appendSheet(workbook, "Resumen", [[
      "totalComponentes", "errores", "advertencias", "correcciones"
    ], [
      String(unidades.total || 0),
      String(unidades.errores || 0),
      String(unidades.advertencias || 0),
      String(unidades.correcciones || 0)
    ]]);
  }

  function pageCheck(doc, ctx, extra) {
    if (ctx.y + Number(extra || 10) > 282) {
      doc.addPage();
      ctx.y = 18;
    }
  }

  function addTextBlock(doc, ctx, text, options) {
    var opts = options || {};
    var x = Number(opts.x || 16);
    var width = Number(opts.width || 178);
    var fontSize = Number(opts.fontSize || 10);
    var gap = Number(opts.gap == null ? 2 : opts.gap);
    var color = opts.color || [25, 35, 55];
    var style = opts.style || "normal";
    var lines;

    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    lines = doc.splitTextToSize(String(text || ""), width);

    lines.forEach(function (line) {
      pageCheck(doc, ctx, fontSize / 2 + 4);
      doc.text(line, x, ctx.y);
      ctx.y += Math.max(5, fontSize * 0.45);
    });

    ctx.y += gap;
  }

  function drawLogoHeader(doc, title) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 36, "F");

    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(12, 8, 22, 22, 1.5, 1.5);
    doc.line(17, 13, 29, 13);
    doc.line(17, 25, 29, 25);
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.circle(23, 19, 2.1, "F");

    doc.setFont("times", "bold");
    doc.setFontSize(25);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("ITSQMET", 42, 19);
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.7);
    doc.line(42, 23, 195, 23);
    doc.setFontSize(9);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("FORMANDO PROFESIONALES DE ÉLITE", 42, 29);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(String(title || "CCC"), 12, 43);
    doc.setDrawColor(220, 226, 235);
    doc.line(12, 46, 198, 46);
  }

  function addMetaTable(doc, ctx, rows) {
    var x = 16;
    var w1 = 48;
    var w2 = 130;
    var h = 8;

    rows.forEach(function (row) {
      pageCheck(doc, ctx, h + 2);
      doc.setDrawColor(220, 226, 235);
      doc.setFillColor(245, 248, 252);
      doc.rect(x, ctx.y - 5.5, w1, h, "FD");
      doc.setFillColor(255, 255, 255);
      doc.rect(x + w1, ctx.y - 5.5, w2, h, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(String(row[0] || ""), x + 2, ctx.y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(String(row[1] || ""), w2 - 4), x + w1 + 2, ctx.y);
      ctx.y += h;
    });
    ctx.y += 4;
  }

  function addSectionTitle(doc, ctx, title) {
    pageCheck(doc, ctx, 14);
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.roundedRect(14, ctx.y - 6, 182, 9, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(title || ""), 17, ctx.y);
    ctx.y += 10;
  }

  function addSectionSummary(doc, ctx, title, section) {
    var sheets = safeSheets(section);
    addSectionTitle(doc, ctx, title);

    if (!sheets.length) {
      addTextBlock(doc, ctx, "Sin información registrada.", { color: MUTED });
      return;
    }

    sheets.forEach(function (sheet) {
      addTextBlock(doc, ctx, "• " + (sheet.name || "Hoja") + " | filas: " + Number(sheet.rowCount || 0), {
        fontSize: 9,
        color: [30, 41, 59]
      });
    });
  }

  function addValidationSummary(doc, ctx, validation) {
    var v = validation && validation.unidades ? validation.unidades : null;
    if (!v) return;

    addSectionTitle(doc, ctx, "Validación inteligente de componentes CCC");
    addMetaTable(doc, ctx, [
      ["Componentes", String(v.total || 0)],
      ["Errores", String(v.errores || 0)],
      ["Advertencias", String(v.advertencias || 0)],
      ["Correcciones", String(v.correcciones || 0)]
    ]);

    (v.validacion || []).filter(function (item) {
      return item.estadoValidacion !== "OK";
    }).slice(0, 12).forEach(function (item) {
      addTextBlock(doc, ctx, item.estadoValidacion + " · " + item.descripcionOriginal + " → " + item.descripcionSugerida, {
        fontSize: 8.5,
        color: item.estadoValidacion === "ERROR" ? [153, 27, 27] : [146, 64, 14]
      });
    });
  }

  function addComparisonSummary(doc, ctx, comparison) {
    if (!comparison) return;

    addSectionTitle(doc, ctx, "Comparativa entre versiones");
    addMetaTable(doc, ctx, [
      ["Versión antigua", String(comparison.versionA && comparison.versionA.versionId || "")],
      ["Versión nueva", String(comparison.versionB && comparison.versionB.versionId || "")],
      ["Cambios", String(comparison.totalCambios || 0)],
      ["Porcentaje", String(comparison.porcentajeCambio || 0) + "%"]
    ]);

    (comparison.sections || []).forEach(function (section) {
      addTextBlock(doc, ctx,
        section.sectionName + ": " +
        "nuevo " + Number(section.added.length || 0) + ", " +
        "antiguo eliminado " + Number(section.removed.length || 0) + ", " +
        "modificado " + Number(section.changed.length || 0) + ", " +
        "cambio " + Number(section.porcentajeCambio || 0) + "%",
        { fontSize: 9, color: [30, 41, 59] }
      );
    });
  }

  function buildPreviousComparison(versionData, options) {
    var opts = options || {};
    var versions = Array.isArray(opts.versions) ? opts.versions.slice() : [];
    var meta = versionData && versionData.meta ? versionData.meta : {};
    var currentId = String(meta.versionId || "");
    var currentIndex;
    var previousMeta;
    var previousData;

    if (!versions.length || !PEA.compare || !opts.store || typeof opts.store.readVersionLocal !== "function") {
      return null;
    }

    versions.sort(function (a, b) { return Number(a.versionNumber || 0) - Number(b.versionNumber || 0); });
    currentIndex = versions.findIndex(function (item) { return String(item.versionId || "") === currentId; });
    if (currentIndex <= 0) return null;

    previousMeta = versions[currentIndex - 1];
    previousData = opts.store.readVersionLocal(meta.materiaId, previousMeta.versionId);
    return PEA.compare.compareVersions(previousData, versionData);
  }

  PEA.export = {
    downloadPdfVersion: function (versionData, options) {
      ensurePdf();

      if (!versionData || !versionData.data || !versionData.meta) {
        throw new Error("No hay una versión cargada para exportar.");
      }

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var ctx = { y: 54 };
      var meta = versionData.meta;
      var content = versionData.data.contenido || {};
      var validation = validateVersion(versionData);
      var autoComparison = buildPreviousComparison(versionData, options || {});

      drawLogoHeader(doc, "Componente Curricular de Carrera · CCC");
      addMetaTable(doc, ctx, [
        ["Carrera", meta.carreraNombre || versionData.data.carreraNombre || ""],
        ["Materia", meta.materiaNombre || ""],
        ["Código", meta.materiaCodigo || "Sin código"],
        ["Versión", meta.versionId || ""],
        ["Origen", meta.origenTipo || ""],
        ["Fecha", formatDate(meta.createdAtClient)],
        ["Nota", meta.versionNota || "Sin nota"]
      ]);

      addSectionSummary(doc, ctx, "Base", content.base);
      addSectionSummary(doc, ctx, "Unidades / Componentes", content.unidades);
      addSectionSummary(doc, ctx, "Actividades", content.actividades);
      addValidationSummary(doc, ctx, validation);
      addComparisonSummary(doc, ctx, autoComparison);

      doc.save(["CCC", fileSafe(meta.materiaNombre), meta.versionId || "version"].join("_") + ".pdf");
    },

    downloadPdfComparison: function (comparison) {
      ensurePdf();

      if (!comparison) {
        throw new Error("No hay una comparación disponible.");
      }

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var ctx = { y: 54 };

      drawLogoHeader(doc, "CCC · Comparación de versiones");
      addMetaTable(doc, ctx, [
        ["Materia", comparison.materiaNombre || ""],
        ["Versión antigua", comparison.versionA.versionId || ""],
        ["Versión nueva", comparison.versionB.versionId || ""],
        ["Total cambios", String(comparison.totalCambios || 0)],
        ["Porcentaje", String(comparison.porcentajeCambio || 0) + "%"]
      ]);

      addComparisonSummary(doc, ctx, comparison);

      (comparison.sections || []).forEach(function (section) {
        addSectionTitle(doc, ctx, "Detalle · " + section.sectionName);
        section.added.forEach(function (item) {
          addTextBlock(doc, ctx, "NUEVO: " + item.sheet + " | filas: " + item.rowsAfter, { fontSize: 8.5, color: [22, 101, 52] });
        });
        section.removed.forEach(function (item) {
          addTextBlock(doc, ctx, "ANTIGUO ELIMINADO: " + item.sheet + " | filas: " + item.rowsBefore, { fontSize: 8.5, color: [153, 27, 27] });
        });
        section.changed.forEach(function (item) {
          addTextBlock(doc, ctx, "MODIFICADO: " + item.sheet + " | antes: " + item.rowsBefore + " | nuevo: " + item.rowsAfter, { fontSize: 8.5, color: [146, 64, 14] });
        });
      });

      doc.save(["CCC_Comparacion", fileSafe(comparison.materiaNombre), comparison.versionA.versionId || "A", "vs", comparison.versionB.versionId || "B"].join("_") + ".pdf");
    },

    downloadThreeExcels: function (versionData) {
      ensureXlsx();

      if (!versionData || !versionData.data || !versionData.meta) {
        throw new Error("No hay una versión cargada para reconstruir Excel.");
      }

      var meta = versionData.meta;
      var content = versionData.data.contenido || {};
      var materiaSafe = fileSafe(meta.materiaNombre || "Materia");
      var versionSafe = fileSafe(meta.versionId || "v");
      var wbBase = sectionToWorkbook(content.base, "CCC Base");
      var wbUnidades = sectionToWorkbook(content.unidades, "CCC Unidades");
      var wbActividades = sectionToWorkbook(content.actividades, "CCC Actividades");

      addValidationSheets(wbUnidades, versionData);

      XLSX.writeFile(wbBase, "CCC Base - " + materiaSafe + " - " + versionSafe + ".xlsx");
      XLSX.writeFile(wbUnidades, "CCC Unidades - " + materiaSafe + " - " + versionSafe + ".xlsx");
      XLSX.writeFile(wbActividades, "CCC Actividades - " + materiaSafe + " - " + versionSafe + ".xlsx");
    },

    downloadValidationExcel: function (versionData) {
      ensureXlsx();

      if (!versionData || !versionData.data || !versionData.meta) {
        throw new Error("No hay una versión cargada para exportar validación CCC.");
      }

      var validation = validateVersion(versionData);
      var unidades = validation && validation.unidades ? validation.unidades : null;
      var wb = XLSX.utils.book_new();
      var meta = versionData.meta;

      if (!unidades || !PEA.ccc) {
        throw new Error("No hay validación CCC disponible para esta versión.");
      }

      appendSheet(wb, "CCC limpio", PEA.ccc.toSheetRowsClean(unidades));
      appendSheet(wb, "Validacion", PEA.ccc.toSheetRowsValidation(unidades));
      appendSheet(wb, "Resumen", [[
        "materia", "version", "totalComponentes", "errores", "advertencias", "correcciones"
      ], [
        String(meta.materiaNombre || ""),
        String(meta.versionId || ""),
        String(unidades.total || 0),
        String(unidades.errores || 0),
        String(unidades.advertencias || 0),
        String(unidades.correcciones || 0)
      ]]);

      XLSX.writeFile(wb, "CCC Validacion - " + fileSafe(meta.materiaNombre) + " - " + fileSafe(meta.versionId || "v") + ".xlsx");
    },

    buildObservationText: function (versionData) {
      var validation = validateVersion(versionData);
      return PEA.ccc && validation
        ? PEA.ccc.buildObservationText(validation, versionData && versionData.meta)
        : "No hay observaciones disponibles.";
    }
  };
})(window);
