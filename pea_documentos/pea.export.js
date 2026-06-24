(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function ensureLibraries() {
    if (!window.XLSX) {
      throw new Error("No se encontró la librería XLSX.");
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("No se encontró la librería jsPDF.");
    }
  }

  function safeSheets(section) {
    return (section && Array.isArray(section.sheets)) ? section.sheets : [];
  }

  function createPlaceholderSheet(title) {
    return {
      name: "Hoja1",
      rows: [[title], ["Sin información disponible para esta sección."]],
      rowCount: 2
    };
  }

  function addTextBlock(doc, ctx, text, gap) {
    var lines = doc.splitTextToSize(String(text || ""), 180);

    lines.forEach(function (line) {
      if (ctx.y > 280) {
        doc.addPage();
        ctx.y = 18;
      }
      doc.text(line, 15, ctx.y);
      ctx.y += 6;
    });

    ctx.y += Number(gap || 2);
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    try {
      return new Date(value).toLocaleString("es-EC");
    } catch (error) {
      return String(value);
    }
  }

  function addSectionToPdf(doc, ctx, title, section) {
    addTextBlock(doc, ctx, title, 1);

    var sheets = safeSheets(section);
    if (!sheets.length) {
      addTextBlock(doc, ctx, "Sin información registrada.", 4);
      return;
    }

    sheets.forEach(function (sheet) {
      addTextBlock(doc, ctx, "Hoja: " + sheet.name + " | Filas: " + Number(sheet.rowCount || 0), 1);

      (sheet.rows || []).forEach(function (row) {
        var line = (Array.isArray(row) ? row : []).map(function (cell) {
          return String(cell == null ? "" : cell).replace(/\s+/g, " ").trim();
        }).join(" | ");

        addTextBlock(doc, ctx, line || " ", 0);
      });

      ctx.y += 4;
    });
  }

  function sectionToWorkbook(section, emptyTitle) {
    var workbook = XLSX.utils.book_new();
    var sheets = safeSheets(section);

    if (!sheets.length) {
      sheets = [createPlaceholderSheet(emptyTitle)];
    }

    sheets.forEach(function (sheet) {
      var rows = Array.isArray(sheet.rows) ? sheet.rows : [["Sin datos"]];
      var ws = XLSX.utils.aoa_to_sheet(rows);

      XLSX.utils.book_append_sheet(
        workbook,
        ws,
        String(sheet.name || "Hoja1").slice(0, 31) || "Hoja1"
      );
    });

    return workbook;
  }

  PEA.export = {
    downloadPdfVersion: function (versionData) {
      ensureLibraries();

      if (!versionData || !versionData.data || !versionData.meta) {
        throw new Error("No hay una versión cargada para exportar.");
      }

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var ctx = { y: 18 };
      var meta = versionData.meta;
      var content = versionData.data.contenido || {};

      doc.setFont("helvetica", "bold");
      addTextBlock(doc, ctx, "PEA - Documento de versión", 2);
      doc.setFont("helvetica", "normal");

      addTextBlock(doc, ctx, "Materia: " + (meta.materiaNombre || ""), 1);
      addTextBlock(doc, ctx, "Código: " + (meta.materiaCodigo || "Sin código"), 1);
      addTextBlock(doc, ctx, "Versión: " + (meta.versionId || ""), 1);
      addTextBlock(doc, ctx, "Origen: " + (meta.origenTipo || ""), 1);
      addTextBlock(doc, ctx, "Fecha: " + formatDate(meta.createdAtClient), 1);
      addTextBlock(doc, ctx, "Nota: " + (meta.versionNota || "Sin nota"), 4);

      doc.setFont("helvetica", "bold");
      addSectionToPdf(doc, ctx, "BASE", content.base);
      addSectionToPdf(doc, ctx, "UNIDADES", content.unidades);
      addSectionToPdf(doc, ctx, "ACTIVIDADES", content.actividades);
      doc.setFont("helvetica", "normal");

      var fileName = [
        "PEA",
        (meta.materiaNombre || "Materia").replace(/[^\w\-]+/g, "_"),
        (meta.versionId || "version")
      ].join("_") + ".pdf";

      doc.save(fileName);
    },

    downloadPdfComparison: function (comparison) {
      ensureLibraries();

      if (!comparison) {
        throw new Error("No hay una comparación disponible.");
      }

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var ctx = { y: 18 };

      doc.setFont("helvetica", "bold");
      addTextBlock(doc, ctx, "PEA - Comparación de versiones", 2);
      doc.setFont("helvetica", "normal");

      addTextBlock(doc, ctx, "Materia: " + (comparison.materiaNombre || ""), 1);
      addTextBlock(doc, ctx, "Versión A: " + (comparison.versionA.versionId || ""), 1);
      addTextBlock(doc, ctx, "Versión B: " + (comparison.versionB.versionId || ""), 1);
      addTextBlock(doc, ctx, "Total de cambios: " + Number(comparison.totalCambios || 0), 4);

      (comparison.sections || []).forEach(function (section) {
        doc.setFont("helvetica", "bold");
        addTextBlock(doc, ctx, "SECCIÓN: " + section.sectionName, 1);
        doc.setFont("helvetica", "normal");

        addTextBlock(doc, ctx, "Agregadas: " + section.added.length, 0);
        addTextBlock(doc, ctx, "Eliminadas: " + section.removed.length, 0);
        addTextBlock(doc, ctx, "Modificadas: " + section.changed.length, 2);

        section.added.forEach(function (item) {
          addTextBlock(doc, ctx, "+ " + item.sheet + " | " + item.rowsAfter + " filas", 0);
        });

        section.removed.forEach(function (item) {
          addTextBlock(doc, ctx, "- " + item.sheet + " | " + item.rowsBefore + " filas", 0);
        });

        section.changed.forEach(function (item) {
          addTextBlock(doc, ctx, "* " + item.sheet + " | antes: " + item.rowsBefore + " | después: " + item.rowsAfter, 0);
        });

        ctx.y += 4;
      });

      var fileName = [
        "PEA_Comparacion",
        (comparison.materiaNombre || "Materia").replace(/[^\w\-]+/g, "_"),
        (comparison.versionA.versionId || "A"),
        "vs",
        (comparison.versionB.versionId || "B")
      ].join("_") + ".pdf";

      doc.save(fileName);
    },

    downloadThreeExcels: function (versionData) {
      ensureLibraries();

      if (!versionData || !versionData.data || !versionData.meta) {
        throw new Error("No hay una versión cargada para reconstruir Excel.");
      }

      var meta = versionData.meta;
      var content = versionData.data.contenido || {};
      var materiaSafe = (meta.materiaNombre || "Materia").replace(/[^\w\-]+/g, "_");
      var versionSafe = meta.versionId || "v";

      var wbBase = sectionToWorkbook(content.base, "PEA Base");
      var wbUnidades = sectionToWorkbook(content.unidades, "PEA Unidades");
      var wbActividades = sectionToWorkbook(content.actividades, "PEA Actividades");

      XLSX.writeFile(wbBase, "PEA Base - " + materiaSafe + " - " + versionSafe + ".xlsx");
      XLSX.writeFile(wbUnidades, "PEA Unidades - " + materiaSafe + " - " + versionSafe + ".xlsx");
      XLSX.writeFile(wbActividades, "PEA Actividades - " + materiaSafe + " - " + versionSafe + ".xlsx");
    }
  };
})(window);