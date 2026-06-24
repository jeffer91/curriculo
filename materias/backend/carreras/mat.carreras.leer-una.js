/*
Nombre del archivo: mat.carreras.leer-una.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carreras\mat.carreras.leer-una.js
Función:
- Lee una carrera específica desde Firestore
- Asegura una estructura consistente
- Normaliza los arreglos base del documento
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carreras = MAT.carreras || {};

  function toCleanArray(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(function (item) {
        return !!item;
      });
  }

  MAT.carreras.ensureShape = function (data) {
    var source = (data && typeof data === "object") ? data : {};
    var out = {};
    var key;

    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        out[key] = source[key];
      }
    }

    out.nombre = String(out.nombre || "");
    out.tipo = String(out.tipo || "");
    out.estado = String(out.estado || "");

    out.materiasNivel1 = toCleanArray(out.materiasNivel1);
    out.materiasNivel2 = toCleanArray(out.materiasNivel2);
    out.materiasNivel3 = toCleanArray(out.materiasNivel3);
    out.materiasNivel4 = toCleanArray(out.materiasNivel4);

    out.materiasTransversal1 = toCleanArray(out.materiasTransversal1);
    out.materiasTransversal2 = toCleanArray(out.materiasTransversal2);
    out.materiasTransversal3 = toCleanArray(out.materiasTransversal3);
    out.materiasTransversal4 = toCleanArray(out.materiasTransversal4);

    out.nucleos = toCleanArray(out.nucleos);
    out.ejes = toCleanArray(out.ejes);

    return out;
  };

  MAT.carreras.leerUna = async function (careerId) {
    var ref = MAT.refs.carreras();
    var doc;
    var data;

    careerId = String(careerId || "").trim();

    if (!careerId) {
      throw new Error("MAT: Debes indicar el id de la carrera.");
    }

    if (!ref) {
      throw new Error("MAT: No hay referencia a la colección carreras.");
    }

    doc = await ref.doc(careerId).get();

    if (!doc.exists) {
      return null;
    }

    data = MAT.carreras.ensureShape(doc.data() || {});
    data.id = String(doc.id || "");

    return data;
  };
})(window);