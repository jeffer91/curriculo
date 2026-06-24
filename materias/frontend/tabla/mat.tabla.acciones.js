/*
Nombre del archivo: mat.tabla.acciones.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\tabla\mat.tabla.acciones.js
Función:
- Manipula la vista previa activa
- Quita items
- Mueve items
- Construye vistas previas vacías
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.tabla = MAT.tabla || {};
  MAT.tabla.acciones = MAT.tabla.acciones || {};

  function cloneDeep(value) {
    try {
      return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
      return value || null;
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isGrouped(kind) {
    return kind === "materias-carrera" || kind === "transversales";
  }

  function getListRef(preview, group) {
    if (!preview || !preview.summary) {
      return null;
    }

    if (isGrouped(preview.kind)) {
      if (!Object.prototype.hasOwnProperty.call(preview.summary, group)) {
        return null;
      }

      preview.summary[group] = toArray(preview.summary[group]);
      return preview.summary[group];
    }

    if (group === "items") {
      preview.summary.items = toArray(preview.summary.items);
      return preview.summary.items;
    }

    return null;
  }

  function recount(preview) {
    if (!preview || !preview.summary) {
      return preview;
    }

    if (isGrouped(preview.kind)) {
      preview.totalLines =
        toArray(preview.summary.nivel1).length +
        toArray(preview.summary.nivel2).length +
        toArray(preview.summary.nivel3).length +
        toArray(preview.summary.nivel4).length +
        toArray(preview.summary.sinNivel).length;
    } else {
      preview.summary.items = toArray(preview.summary.items);
      preview.summary.total = preview.summary.items.length;
      preview.totalLines = preview.summary.items.length;
    }

    return preview;
  }

  MAT.tabla.acciones.countItems = function (preview) {
    var safe = preview || {};
    var sum = 0;

    if (isGrouped(safe.kind)) {
      sum += toArray(safe.summary && safe.summary.nivel1).length;
      sum += toArray(safe.summary && safe.summary.nivel2).length;
      sum += toArray(safe.summary && safe.summary.nivel3).length;
      sum += toArray(safe.summary && safe.summary.nivel4).length;
      sum += toArray(safe.summary && safe.summary.sinNivel).length;
      return sum;
    }

    return toArray(safe.summary && safe.summary.items).length;
  };

  MAT.tabla.acciones.removeItem = function (preview, group, index) {
    var copy = cloneDeep(preview);
    var list = getListRef(copy, group);

    index = Number(index);

    if (!list || index < 0 || index >= list.length) {
      return copy;
    }

    list.splice(index, 1);
    return recount(copy);
  };

  MAT.tabla.acciones.moveUp = function (preview, group, index) {
    var copy = cloneDeep(preview);
    var list = getListRef(copy, group);
    var temp;

    index = Number(index);

    if (!list || index <= 0 || index >= list.length) {
      return copy;
    }

    temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;

    return recount(copy);
  };

  MAT.tabla.acciones.moveDown = function (preview, group, index) {
    var copy = cloneDeep(preview);
    var list = getListRef(copy, group);
    var temp;

    index = Number(index);

    if (!list || index < 0 || index >= list.length - 1) {
      return copy;
    }

    temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;

    return recount(copy);
  };

  MAT.tabla.acciones.clearBlock = function (loadType, careerType) {
    var kind = String(loadType || "").trim();
    var expected = 0;

    if (kind === "materias-carrera" || kind === "transversales") {
      return {
        kind: kind,
        totalLines: 0,
        rawLines: [],
        source: "memory",
        summary: {
          nivel1: [],
          nivel2: [],
          nivel3: [],
          nivel4: [],
          sinNivel: []
        }
      };
    }

    if (kind === "nucleos") {
      expected = Number(
        (MAT.config &&
          MAT.config.limits &&
          MAT.config.limits.nucleos &&
          MAT.config.limits.nucleos.exactTotal) || 4
      );

      return {
        kind: kind,
        totalLines: 0,
        rawLines: [],
        source: "memory",
        summary: {
          expected: expected,
          total: 0,
          items: []
        }
      };
    }

    if (kind === "ejes") {
      expected = (MAT.carreras && typeof MAT.carreras.getEjesEsperados === "function")
        ? MAT.carreras.getEjesEsperados(careerType || "")
        : 4;

      return {
        kind: kind,
        totalLines: 0,
        rawLines: [],
        source: "memory",
        summary: {
          expected: expected,
          total: 0,
          items: []
        }
      };
    }

    return {
      kind: kind,
      totalLines: 0,
      rawLines: [],
      source: "memory",
      summary: {
        items: []
      }
    };
  };
})(window);