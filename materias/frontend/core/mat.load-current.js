/*
Nombre del archivo: mat.load-current.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\core\mat.load-current.js
Función:
- Carga automáticamente el bloque actual al cambiar carrera o tipo
- Refresca después de guardar
- Inicializa la tabla y sus eventos
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  function loadCurrentIfPossible() {
    if (!MAT.state ||
        !MAT.state.data ||
        !MAT.state.data.selectedCareerId ||
        !MAT.state.data.selectedLoadType) {
      if (MAT.tabla && MAT.tabla.render && typeof MAT.tabla.render.noSelection === "function") {
        MAT.tabla.render.noSelection();
      }
      return;
    }

    if (MAT.editor &&
        MAT.editor.cargarDesdeDb &&
        typeof MAT.editor.cargarDesdeDb.fromCurrentSelection === "function") {
      MAT.editor.cargarDesdeDb.fromCurrentSelection().catch(function (error) {
        console.error(error);

        if (MAT.ui && typeof MAT.ui.setStatus === "function") {
          MAT.ui.setStatus("No se pudo cargar el bloque actual desde Firebase.", "error");
        }

        if (MAT.tabla && MAT.tabla.render && typeof MAT.tabla.render.empty === "function") {
          MAT.tabla.render.empty("No se pudo cargar el bloque actual.");
        }
      });
    }
  }

  function patchMainMethods() {
    var originalOnCareerChange;
    var originalOnLoadTypeChange;
    var originalHandleSave;

    if (!MAT.main || MAT.main.__matCurrentPatched) {
      return;
    }

    originalOnCareerChange = MAT.main.onCareerChange;
    originalOnLoadTypeChange = MAT.main.onLoadTypeChange;
    originalHandleSave = MAT.main.handleSave;

    if (typeof originalOnCareerChange === "function") {
      MAT.main.onCareerChange = function (careerId) {
        var result = originalOnCareerChange.apply(this, arguments);
        loadCurrentIfPossible();
        return result;
      };
    }

    if (typeof originalOnLoadTypeChange === "function") {
      MAT.main.onLoadTypeChange = function (value) {
        var result = originalOnLoadTypeChange.apply(this, arguments);
        loadCurrentIfPossible();
        return result;
      };
    }

    if (typeof originalHandleSave === "function") {
      MAT.main.handleSave = async function () {
        var result = await originalHandleSave.apply(this, arguments);
        loadCurrentIfPossible();
        return result;
      };
    }

    MAT.main.__matCurrentPatched = true;
  }

  function init() {
    if (MAT.tabla && typeof MAT.tabla.ensure === "function") {
      MAT.tabla.ensure();
    }

    if (MAT.tabla &&
        MAT.tabla.render &&
        typeof MAT.tabla.render.noSelection === "function") {
      MAT.tabla.render.noSelection();
    }

    if (MAT.tabla &&
        MAT.tabla.edicion &&
        typeof MAT.tabla.edicion.bind === "function") {
      MAT.tabla.edicion.bind();
    }

    patchMainMethods();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);