/*
Nombre del archivo: mat.refs.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\firebase\mat.refs.js
Función:
- Centraliza referencias de Firestore
- Devuelve la colección carreras
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.refs = {
    carreras: function () {
      var db = MAT.firebase.init();

      if (!db) {
        return null;
      }

      return db.collection(MAT.config.collectionName);
    }
  };
})(window);