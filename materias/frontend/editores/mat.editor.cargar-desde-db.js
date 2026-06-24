/*
Nombre del archivo: mat.editor.cargar-desde-db.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\editores\mat.editor.cargar-desde-db.js
Función:
- Carga desde Firebase el bloque actual
- Lo refleja en el preview, editor y tabla
- Sincroniza el estado del módulo
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.editor = MAT.editor || {};
  MAT.editor.cargarDesdeDb = MAT.editor.cargarDesdeDb || {};

  function countItems(preview) {
    if (MAT.tabla &&
        MAT.tabla.acciones &&
        typeof MAT.tabla.acciones.countItems === "function") {
      return MAT.tabla.acciones.countItems(preview);
    }

    return 0;
  }

  MAT.editor.cargarDesdeDb.applyResult = function (result) {
    var preview;
    var total;
    var validation;

    if (!result || !result.preview) {
      throw new Error("MAT: No se recibió un bloque válido desde Firebase.");
    }

    preview = result.preview;
    total = countItems(preview);

    MAT.state.setPreview(preview);
    MAT.state.setDirty(false);

    if (MAT.ui && typeof MAT.ui.renderPreview === "function") {
      MAT.ui.renderPreview(preview);
    }

    if (MAT.editor.base && typeof MAT.editor.base.renderFromPreview === "function") {
      MAT.editor.base.renderFromPreview(preview, result.currentDoc && result.currentDoc.tipo);
    }

    if (MAT.tabla && MAT.tabla.render && typeof MAT.tabla.render.fromPreview === "function") {
      MAT.tabla.render.fromPreview(preview, result.currentDoc && result.currentDoc.tipo, {
        source: "firestore",
        title: "Datos actuales guardados"
      });
    }

    if (MAT.validar &&
        MAT.validar.general &&
        typeof MAT.validar.general.preview === "function" &&
        MAT.ui &&
        MAT.ui.resumen &&
        typeof MAT.ui.resumen.renderValidation === "function") {
      validation = MAT.validar.general.preview(preview, result.currentDoc && result.currentDoc.tipo);
      MAT.ui.resumen.renderValidation(validation);
    }

    if (MAT.ui && typeof MAT.ui.setSaveEnabled === "function") {
      MAT.ui.setSaveEnabled(true);
    }

    if (MAT.ui && typeof MAT.ui.setStatus === "function") {
      if (total > 0) {
        MAT.ui.setStatus("Se cargaron los datos guardados del bloque actual.", "ok");
      } else {
        MAT.ui.setStatus("Este bloque todavía no tiene datos guardados.", "warn");
      }
    }

    return result;
  };

  MAT.editor.cargarDesdeDb.load = async function (careerId, loadType) {
    var result;

    careerId = String(careerId || "").trim();
    loadType = String(loadType || "").trim();

    if (!careerId || !loadType) {
      return null;
    }

    if (MAT.tabla && MAT.tabla.render && typeof MAT.tabla.render.loading === "function") {
      MAT.tabla.render.loading("Cargando datos guardados...");
    }

    result = await MAT.carreras.cargarBloque(careerId, loadType);
    return MAT.editor.cargarDesdeDb.applyResult(result);
  };

  MAT.editor.cargarDesdeDb.fromCurrentSelection = async function () {
    return await MAT.editor.cargarDesdeDb.load(
      MAT.state.data.selectedCareerId,
      MAT.state.data.selectedLoadType
    );
  };
})(window);