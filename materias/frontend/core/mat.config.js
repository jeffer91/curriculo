/*
Nombre del archivo: mat.config.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\core\mat.config.js
Función:
- Configuración global del módulo materias
- Selectores del DOM
- Tipos de carga
- Límites de negocio
- Configuración de Firebase
- Selectores del modal de carga masiva
- Selector del resumen compacto por carrera
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.config = {
    appName: "materias",
    collectionName: "carreras",

    selectors: {
      status: "#mat-status",
      careerSelect: "#mat-career-select",
      careerTypeDisplay: "#mat-career-type-display",
      careerQuickSummary: "#mat-career-quick-summary",
      loadTypeSelect: "#mat-load-type-select",
      refreshButton: "#mat-refresh-btn",
      saveButton: "#mat-save-btn",
      openMassiveButton: "#mat-open-massive-btn",
      processButton: "#mat-modal-process-btn",
      clearButton: "#mat-modal-clear-btn",
      applyMassiveButton: "#mat-modal-apply-btn",
      massiveInput: "#mat-modal-massive-input",
      previewBody: "#mat-modal-preview-body",
      editor: "#mat-editor",
      editorHint: "#mat-editor-hint",
      saveSummary: "#mat-save-summary",
      modal: "#mat-massive-modal",
      modalPanel: "#mat-massive-modal-panel",
      modalClose: "#mat-modal-close-btn",
      modalStatus: "#mat-modal-status"
    },

    loadTypes: [
      { value: "materias-carrera", label: "Materias de carrera" },
      { value: "transversales", label: "Materias transversales" },
      { value: "nucleos", label: "Núcleos" },
      { value: "ejes", label: "Ejes" }
    ],

    limits: {
      materiasCarrera: {
        minPerLevel: 4,
        maxPerLevel: 6,
        levels: 4
      },
      transversales: {
        minTotal: 1,
        maxTotal: 3,
        levels: 4
      },
      nucleos: {
        exactTotal: 4
      },
      ejes: {
        universitaria: 6,
        superior: 4,
        tecnica: 4
      }
    },

    firebaseConfig: {
      apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
      authDomain: "utet-4387a.firebaseapp.com",
      projectId: "utet-4387a",
      storageBucket: "utet-4387a.firebasestorage.app",
      messagingSenderId: "902848131454",
      appId: "1:902848131454:web:47f515eb6480834724c32f"
    }
  };

  MAT.config.isFirebaseConfigComplete = function (cfg) {
    if (!cfg || typeof cfg !== "object") return false;

    return !!(
      cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.storageBucket &&
      cfg.messagingSenderId &&
      cfg.appId
    );
  };

  MAT.config.getFirebaseConfig = function () {
    if (
      window.__MAT_FIREBASE_CONFIG__ &&
      typeof window.__MAT_FIREBASE_CONFIG__ === "object"
    ) {
      return window.__MAT_FIREBASE_CONFIG__;
    }

    return MAT.config.firebaseConfig;
  };
})(window);