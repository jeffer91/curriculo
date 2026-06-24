/*
Nombre del archivo: mat.actualizar.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carga\mat.actualizar.js
Función:
- Actualiza una carrera en Firestore
- Usa merge para no borrar otros campos
- Devuelve el documento ya actualizado
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carga = MAT.carga || {};

  function getServerTimestamp() {
    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue &&
      typeof window.firebase.firestore.FieldValue.serverTimestamp === "function"
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    return new Date();
  }

  MAT.carga.actualizar = async function (careerId, patch, options) {
    var ref = MAT.refs.carreras();
    var payload = {};
    var key;

    careerId = String(careerId || "").trim();
    patch = (patch && typeof patch === "object") ? patch : {};
    options = (options && typeof options === "object") ? options : {};

    if (!careerId) {
      throw new Error("MAT: Debes indicar el id de la carrera.");
    }

    if (!ref) {
      throw new Error("MAT: No hay referencia a la colección carreras.");
    }

    for (key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        payload[key] = patch[key];
      }
    }

    payload.updatedAt = getServerTimestamp();

    if (options.audit && typeof options.audit === "object") {
      payload.ultimaCarga = options.audit;
    }

    await ref.doc(careerId).set(payload, { merge: true });

    return await MAT.carreras.leerUna(careerId);
  };
})(window);