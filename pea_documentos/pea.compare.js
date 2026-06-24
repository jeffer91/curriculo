(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function safeSheets(section) {
    return (section && Array.isArray(section.sheets)) ? section.sheets : [];
  }

  function normalizeCell(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function flattenSheet(sheet) {
    return safeRows(sheet).map(function (row) {
      return (Array.isArray(row) ? row : []).map(normalizeCell).join(" | ");
    }).join("\n");
  }

  function safeRows(sheet) {
    return (sheet && Array.isArray(sheet.rows)) ? sheet.rows : [];
  }

  function buildSheetMap(section) {
    var map = Object.create(null);
    safeSheets(section).forEach(function (sheet) {
      map[String(sheet.name || "")] = {
        name: String(sheet.name || ""),
        rowCount: Number(sheet.rowCount || safeRows(sheet).length || 0),
        text: flattenSheet(sheet)
      };
    });
    return map;
  }

  function compareSection(sectionName, sectionA, sectionB) {
    var mapA = buildSheetMap(sectionA);
    var mapB = buildSheetMap(sectionB);
    var names = Object.keys(mapA).concat(Object.keys(mapB)).filter(function (name, idx, arr) {
      return arr.indexOf(name) === idx;
    });

    var added = [];
    var removed = [];
    var changed = [];
    var unchanged = [];

    names.forEach(function (name) {
      var a = mapA[name];
      var b = mapB[name];

      if (!a && b) {
        added.push({
          sheet: name,
          rowsBefore: 0,
          rowsAfter: b.rowCount
        });
        return;
      }

      if (a && !b) {
        removed.push({
          sheet: name,
          rowsBefore: a.rowCount,
          rowsAfter: 0
        });
        return;
      }

      if (a && b && a.text !== b.text) {
        changed.push({
          sheet: name,
          rowsBefore: a.rowCount,
          rowsAfter: b.rowCount
        });
        return;
      }

      unchanged.push({
        sheet: name,
        rowsBefore: a ? a.rowCount : 0,
        rowsAfter: b ? b.rowCount : 0
      });
    });

    return {
      sectionName: sectionName,
      added: added,
      removed: removed,
      changed: changed,
      unchanged: unchanged,
      totalChanges: added.length + removed.length + changed.length
    };
  }

  PEA.compare = {
    compareVersions: function (versionA, versionB) {
      if (!versionA || !versionB) {
        throw new Error("Se requieren dos versiones para comparar.");
      }

      var contentA = versionA.data && versionA.data.contenido ? versionA.data.contenido : {};
      var contentB = versionB.data && versionB.data.contenido ? versionB.data.contenido : {};

      var base = compareSection("Base", contentA.base, contentB.base);
      var unidades = compareSection("Unidades", contentA.unidades, contentB.unidades);
      var actividades = compareSection("Actividades", contentA.actividades, contentB.actividades);

      return {
        materiaId: versionA.meta.materiaId || versionB.meta.materiaId || "",
        materiaNombre: versionA.meta.materiaNombre || versionB.meta.materiaNombre || "",
        versionA: versionA.meta,
        versionB: versionB.meta,
        sections: [base, unidades, actividades],
        totalCambios:
          Number(base.totalChanges || 0) +
          Number(unidades.totalChanges || 0) +
          Number(actividades.totalChanges || 0)
      };
    }
  };
})(window);