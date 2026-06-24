(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function slugify(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " y ")
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function arrayBufferFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function (event) {
        resolve(event.target.result);
      };

      reader.onerror = function () {
        reject(new Error("No se pudo leer el archivo: " + (file && file.name ? file.name : "desconocido")));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  function worksheetToRows(sheet) {
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false
    });
  }

  function parseWorkbookPayload(workbook, fileName) {
    var sheets = workbook.SheetNames.map(function (sheetName) {
      var rows = worksheetToRows(workbook.Sheets[sheetName]);
      return {
        name: sheetName,
        rows: rows,
        rowCount: rows.length
      };
    });

    return {
      fileName: fileName || "archivo.xlsx",
      sheetCount: sheets.length,
      sheets: sheets
    };
  }

  function detectSectionByNameOrContent(text) {
    var value = cleanText(text).toLowerCase();

    if (
      value.indexOf("pea base") >= 0 ||
      value.indexOf("datos generales") >= 0 ||
      value.indexOf("descripcion de la asignatura") >= 0 ||
      value.indexOf("objetivo de la asignatura") >= 0 ||
      value.indexOf("competencia de asignatura") >= 0
    ) {
      return "base";
    }

    if (
      value.indexOf("unidad") >= 0 ||
      value.indexOf("resultado de aprendizaje") >= 0 ||
      value.indexOf("competencia de la unidad") >= 0 ||
      value.indexOf("contenidos") >= 0
    ) {
      return "unidades";
    }

    if (
      value.indexOf("actividad en contacto con el docente") >= 0 ||
      value.indexOf("taller 1") >= 0 ||
      value.indexOf("taller 2") >= 0 ||
      value.indexOf("actividad autónoma") >= 0 ||
      value.indexOf("actividad autonoma") >= 0 ||
      value.indexOf("proyecto final") >= 0 ||
      value.indexOf("actividad") >= 0
    ) {
      return "actividades";
    }

    return "";
  }

  function createEmptySection(label) {
    return {
      label: label,
      fileName: "",
      sheetCount: 0,
      sheets: []
    };
  }

  function pushSheetToSection(section, sheet) {
    section.sheets.push({
      name: sheet.name,
      rows: Array.isArray(sheet.rows) ? sheet.rows : [],
      rowCount: Array.isArray(sheet.rows) ? sheet.rows.length : 0
    });
    section.sheetCount = section.sheets.length;
  }

  function detectSheetSection(sheet) {
    var headerText = String(sheet.name || "");
    var firstRowsText = ((sheet.rows || []).slice(0, 12).flat().join(" ")) || "";
    var byName = detectSectionByNameOrContent(headerText);
    var byContent = detectSectionByNameOrContent(firstRowsText);
    return byName || byContent || "";
  }

  function splitConsolidatedPayload(consolidated) {
    var base = createEmptySection("base");
    var unidades = createEmptySection("unidades");
    var actividades = createEmptySection("actividades");
    var unknownSheets = [];

    base.fileName = consolidated.fileName || "";
    unidades.fileName = consolidated.fileName || "";
    actividades.fileName = consolidated.fileName || "";

    (consolidated.sheets || []).forEach(function (sheet) {
      var detected = detectSheetSection(sheet);

      if (detected === "base") {
        pushSheetToSection(base, sheet);
        return;
      }

      if (detected === "unidades") {
        pushSheetToSection(unidades, sheet);
        return;
      }

      if (detected === "actividades") {
        pushSheetToSection(actividades, sheet);
        return;
      }

      unknownSheets.push(sheet);
    });

    unknownSheets.forEach(function (sheet) {
      if (!base.sheets.length) {
        pushSheetToSection(base, sheet);
      } else if (!unidades.sheets.length) {
        pushSheetToSection(unidades, sheet);
      } else {
        pushSheetToSection(actividades, sheet);
      }
    });

    return {
      base: base,
      unidades: unidades,
      actividades: actividades
    };
  }

  function countRows(section) {
    return (section && section.sheets || []).reduce(function (acc, sheet) {
      return acc + Number(sheet.rowCount || 0);
    }, 0);
  }

  function buildSummary(payload) {
    return {
      tieneBase: !!(payload.base && payload.base.sheets && payload.base.sheets.length),
      tieneUnidades: !!(payload.unidades && payload.unidades.sheets && payload.unidades.sheets.length),
      tieneActividades: !!(payload.actividades && payload.actividades.sheets && payload.actividades.sheets.length),
      totalHojasBase: payload.base && payload.base.sheets ? payload.base.sheets.length : 0,
      totalHojasUnidades: payload.unidades && payload.unidades.sheets ? payload.unidades.sheets.length : 0,
      totalHojasActividades: payload.actividades && payload.actividades.sheets ? payload.actividades.sheets.length : 0,
      totalFilasBase: countRows(payload.base),
      totalFilasUnidades: countRows(payload.unidades),
      totalFilasActividades: countRows(payload.actividades)
    };
  }

  async function readWorkbookFromFile(file) {
    if (!file) {
      throw new Error("No se recibió un archivo para procesar.");
    }

    var buffer = await arrayBufferFromFile(file);
    var workbook = XLSX.read(buffer, { type: "array" });
    return parseWorkbookPayload(workbook, file.name);
  }

  async function parseTripleFiles(baseFile, unidadesFile, actividadesFile) {
    if (!baseFile || !unidadesFile || !actividadesFile) {
      throw new Error("Debes cargar los 3 archivos: Base, Unidades y Actividades.");
    }

    var base = await readWorkbookFromFile(baseFile);
    var unidades = await readWorkbookFromFile(unidadesFile);
    var actividades = await readWorkbookFromFile(actividadesFile);

    return {
      origenTipo: "triple",
      base: base,
      unidades: unidades,
      actividades: actividades,
      consolidado: null
    };
  }

  async function parseConsolidatedFile(file) {
    if (!file) {
      throw new Error("Debes cargar el archivo consolidado.");
    }

    var consolidado = await readWorkbookFromFile(file);
    var split = splitConsolidatedPayload(consolidado);

    return {
      origenTipo: "consolidado",
      base: split.base,
      unidades: split.unidades,
      actividades: split.actividades,
      consolidado: consolidado
    };
  }

  PEA.parser = {
    cleanText: cleanText,
    slugify: slugify,

    createMateriaId: function (nombre, codigo) {
      var code = cleanText(codigo);
      var name = cleanText(nombre);

      if (code) {
        return slugify(code);
      }

      if (!name) {
        throw new Error("Debes indicar el nombre de la materia o un código.");
      }

      return slugify(name);
    },

    buildNormalizedUpload: async function (params) {
      var input = params || {};
      var materiaNombre = cleanText(input.materiaNombre);
      var materiaCodigo = cleanText(input.materiaCodigo);
      var versionNota = cleanText(input.versionNota);
      var modo = cleanText(input.modo || "triple");
      var parsed;

      if (!materiaNombre && !materiaCodigo) {
        throw new Error("Debes indicar el nombre de la materia o un código.");
      }

      if (modo === "triple") {
        parsed = await parseTripleFiles(input.baseFile, input.unidadesFile, input.actividadesFile);
      } else if (modo === "consolidado") {
        parsed = await parseConsolidatedFile(input.consolidadoFile);
      } else {
        throw new Error("Modo de carga no reconocido.");
      }

      return {
        materiaId: PEA.parser.createMateriaId(materiaNombre, materiaCodigo),
        materiaNombre: materiaNombre || materiaCodigo,
        materiaCodigo: materiaCodigo,
        versionNota: versionNota,
        origenTipo: parsed.origenTipo,
        createdAtClient: new Date().toISOString(),
        contenido: {
          base: parsed.base || createEmptySection("base"),
          unidades: parsed.unidades || createEmptySection("unidades"),
          actividades: parsed.actividades || createEmptySection("actividades"),
          consolidado: parsed.consolidado || null
        },
        resumen: buildSummary({
          base: parsed.base,
          unidades: parsed.unidades,
          actividades: parsed.actividades
        })
      };
    }
  };
})(window);