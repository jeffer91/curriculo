/*
Nombre del archivo: mat.masiva.modal.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\carga-masiva\mat.masiva.modal.js
Función:
- Mantiene el estado temporal de la importación
- Abre y cierra el popup
- Resetea la importación temporal
- Maneja cierre por fondo y Escape
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.masiva = MAT.masiva || {};

  MAT.masiva.state = {
    rawText: "",
    preview: null
  };

  MAT.masiva.modal = MAT.masiva.modal || {};

  MAT.masiva.modal.syncUiFromState = function () {
    var input = MAT.ui.modal.getInput();

    if (input) {
      input.value = String(MAT.masiva.state.rawText || "");
    }

    if (MAT.masiva.state.preview) {
      MAT.ui.renderPreview(MAT.masiva.state.preview);
      MAT.ui.modal.setApplyEnabled(true);
    } else {
      MAT.ui.clearPreview();
      MAT.ui.modal.setApplyEnabled(false);
    }
  };

  MAT.masiva.modal.resetTemp = function () {
    var input = MAT.ui.modal.getInput();

    MAT.masiva.state.rawText = "";
    MAT.masiva.state.preview = null;

    if (input) {
      input.value = "";
    }

    MAT.ui.clearPreview();
    MAT.ui.modal.setApplyEnabled(false);
    MAT.ui.modal.setStatus("Pega el contenido y presiona Procesar.", "");
  };

  MAT.masiva.modal.open = function () {
    if (!MAT.state.data.selectedCareerId) {
      MAT.ui.setStatus("Primero selecciona una carrera.", "warn");
      return;
    }

    if (!MAT.state.data.selectedLoadType) {
      MAT.ui.setStatus("Primero selecciona qué vas a subir.", "warn");
      return;
    }

    MAT.ui.modal.open();
    this.syncUiFromState();

    if (!MAT.masiva.state.preview) {
      MAT.ui.modal.setStatus("Pega el contenido y presiona Procesar.", "");
    } else {
      MAT.ui.modal.setStatus("Puedes seguir corrigiendo esta importación temporal o aplicarla al editor.", "ok");
    }

    MAT.ui.modal.focusInput();
  };

  MAT.masiva.modal.close = function () {
    MAT.ui.modal.close();
  };

  MAT.masiva.modal.bind = function () {
    var openButton = MAT.ui.getEl("openMassiveButton");
    var closeButton = MAT.ui.modal.getCloseButton();
    var modalRoot = MAT.ui.modal.getRoot();
    var input = MAT.ui.modal.getInput();

    if (openButton && !openButton.__matBound) {
      openButton.addEventListener("click", function () {
        MAT.masiva.modal.open();
      });

      openButton.__matBound = true;
    }

    if (closeButton && !closeButton.__matBound) {
      closeButton.addEventListener("click", function () {
        MAT.masiva.modal.close();
      });

      closeButton.__matBound = true;
    }

    if (modalRoot && !modalRoot.__matBound) {
      modalRoot.addEventListener("click", function (event) {
        if (event.target === modalRoot) {
          MAT.masiva.modal.close();
        }
      });

      modalRoot.__matBound = true;
    }

    if (!document.__matMassiveEscapeBound) {
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && MAT.ui.modal.isOpen()) {
          MAT.masiva.modal.close();
        }
      });

      document.__matMassiveEscapeBound = true;
    }

    if (input && !input.__matBound) {
      input.addEventListener("input", function () {
        MAT.masiva.state.rawText = String(input.value || "");

        if (MAT.masiva.state.preview) {
          MAT.masiva.state.preview = null;
          MAT.ui.clearPreview();
          MAT.ui.modal.setApplyEnabled(false);
          MAT.ui.modal.setStatus("El texto cambió. Debes procesarlo nuevamente.", "warn");
        }
      });

      input.__matBound = true;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      MAT.masiva.modal.bind();
    });
  } else {
    MAT.masiva.modal.bind();
  }
})(window, document);