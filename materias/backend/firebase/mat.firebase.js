/*
Nombre del archivo: mat.firebase.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\firebase\mat.firebase.js
Función:
- Inicializa Firebase
- Reutiliza la app si ya existe
- Expone la base Firestore
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.firebase = {
    app: null,
    db: null,
    ready: false,

    init: function () {
      var cfg;

      if (this.ready && this.db) {
        return this.db;
      }

      if (!window.firebase || !window.firebase.initializeApp || !window.firebase.firestore) {
        console.error("MAT: Firebase SDK no está cargado.");
        return null;
      }

      cfg = MAT.config.getFirebaseConfig();

      if (!MAT.config.isFirebaseConfigComplete(cfg)) {
        console.warn("MAT: Configuración de Firebase incompleta. Debes llenar mat.config.js o window.__MAT_FIREBASE_CONFIG__.");
        return null;
      }

      if (window.firebase.apps && window.firebase.apps.length > 0) {
        this.app = window.firebase.app();
      } else {
        this.app = window.firebase.initializeApp(cfg);
      }

      this.db = window.firebase.firestore(this.app);
      this.ready = !!this.db;

      return this.db;
    }
  };
})(window);