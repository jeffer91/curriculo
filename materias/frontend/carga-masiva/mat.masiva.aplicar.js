/*
Nombre del archivo: mat.masiva.aplicar.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\carga-masiva\mat.masiva.aplicar.js
Función:
- Toma la vista previa temporal
- La aplica al editor principal
- Cierra el modal
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.masiva = MAT.masiva || {};
  MAT.masiva.aplicar = MAT.masiva.aplicar || {};

  function cloneDeep(value) {
    try {
      return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
      return value || null;
    }
  }

  MAT.masiva.aplicar.toEditor = function () {
    var preview = cloneDeep(MAT.masiva.state.preview);

    if (!preview) {
      MAT.ui.modal.setStatus("Primero procesa una importación válida.", "warn");
      return null;
    }

    if (typeof MAT.main.applyImportedPreview === "function") {
      MAT.main.applyImportedPreview(preview);
      MAT.masiva.modal.close();
      return preview;
    }

    MAT.ui.modal.setStatus("No se encontró la lógica principal para aplicar la importación.", "error");
    return null;
  };

  MAT.masiva.aplicar.bind = function () {
    var applyButton = MAT.ui.getEl("applyMassiveButton");

    if (applyButton && !applyButton.__matBound) {
      applyButton.addEventListener("click", function () {
        MAT.masiva.aplicar.toEditor();
      });

      applyButton.__matBound = true;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      MAT.masiva.aplicar.bind();
    });
  } else {
    MAT.masiva.aplicar.bind();
  }
})(window, document);