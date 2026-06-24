/*
Nombre del archivo: mat.carreras.leer.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carreras\mat.carreras.leer.js
Función:
- Lee carreras desde Firestore
- Ordena por nombre
- Devuelve estructura limpia para selector
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carreras = MAT.carreras || {};

  MAT.carreras.listar = async function () {
    var ref = MAT.refs.carreras();
    var snapshot;
    var list = [];

    if (!ref) {
      return list;
    }

    snapshot = await ref.get();

    snapshot.forEach(function (doc) {
      var data = doc.data() || {};

      list.push({
        id: String(doc.id || ""),
        nombre: String(data.nombre || ""),
        tipo: String(data.tipo || ""),
        estado: String(data.estado || ""),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });

    list.sort(function (a, b) {
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
        sensitivity: "base",
        numeric: true
      });
    });

    return list;
  };

  MAT.carreras.buscarLocal = function (id) {
    return MAT.state.getCareerById(id);
  };
})(window);