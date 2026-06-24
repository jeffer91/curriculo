(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  var defaultConfig = {
    apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
    authDomain: "utet-4387a.firebaseapp.com",
    projectId: "utet-4387a",
    storageBucket: "utet-4387a.firebasestorage.app",
    messagingSenderId: "902848131454",
    appId: "1:902848131454:web:47f515eb6480834724c32f"
  };

  PEA.firebase = {
    app: null,
    db: null,
    storage: null,
    ready: false,

    getConfig: function () {
      return window.__PEA_FIREBASE_CONFIG__ || defaultConfig;
    },

    init: function () {
      if (this.ready && this.app && this.db && this.storage) {
        return true;
      }

      if (!window.firebase || !window.firebase.initializeApp) {
        console.error("PEA: Firebase no está cargado.");
        return false;
      }

      try {
        if (window.firebase.apps && window.firebase.apps.length > 0) {
          this.app = window.firebase.app();
        } else {
          this.app = window.firebase.initializeApp(this.getConfig());
        }

        this.db = window.firebase.firestore(this.app);
        this.storage = window.firebase.storage(this.app);
        this.ready = true;
        return true;
      } catch (error) {
        console.error("PEA: Error al inicializar Firebase:", error);
        return false;
      }
    },

    getDb: function () {
      if (!this.init()) return null;
      return this.db;
    },

    getStorage: function () {
      if (!this.init()) return null;
      return this.storage;
    },

    getServerTimestamp: function () {
      if (!window.firebase || !window.firebase.firestore) {
        return new Date();
      }
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }
  };
})(window);