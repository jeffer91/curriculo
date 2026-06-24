/*
Nombre del archivo: mat.snapshot.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carga\mat.snapshot.js
Función:
- Crea snapshots limpios de una carrera
- Extrae solo los campos importantes
- Facilita comparaciones antes y después
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.snapshot = MAT.snapshot || {};

  function copyArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  MAT.snapshot.create = function (careerDoc) {
    var doc = MAT.carreras.ensureShape(careerDoc || {});

    return {
      id: String(doc.id || ""),
      nombre: String(doc.nombre || ""),
      tipo: String(doc.tipo || ""),
      estado: String(doc.estado || ""),
      materiasNivel1: copyArray(doc.materiasNivel1),
      materiasNivel2: copyArray(doc.materiasNivel2),
      materiasNivel3: copyArray(doc.materiasNivel3),
      materiasNivel4: copyArray(doc.materiasNivel4),
      materiasTransversal1: copyArray(doc.materiasTransversal1),
      materiasTransversal2: copyArray(doc.materiasTransversal2),
      materiasTransversal3: copyArray(doc.materiasTransversal3),
      materiasTransversal4: copyArray(doc.materiasTransversal4),
      nucleos: copyArray(doc.nucleos),
      ejes: copyArray(doc.ejes)
    };
  };

  MAT.snapshot.onlyForLoadType = function (careerDoc, loadType) {
    var snap = MAT.snapshot.create(careerDoc || {});
    var type = String(loadType || "").trim();

    if (type === "materias-carrera") {
      return {
        materiasNivel1: snap.materiasNivel1,
        materiasNivel2: snap.materiasNivel2,
        materiasNivel3: snap.materiasNivel3,
        materiasNivel4: snap.materiasNivel4
      };
    }

    if (type === "transversales") {
      return {
        materiasTransversal1: snap.materiasTransversal1,
        materiasTransversal2: snap.materiasTransversal2,
        materiasTransversal3: snap.materiasTransversal3,
        materiasTransversal4: snap.materiasTransversal4
      };
    }

    if (type === "nucleos") {
      return {
        nucleos: snap.nucleos
      };
    }

    if (type === "ejes") {
      return {
        ejes: snap.ejes
      };
    }

    return snap;
  };
})(window);