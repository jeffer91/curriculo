/*
Nombre del archivo: mat.guardar.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carga\mat.guardar.js
Función:
- Orquesta el guardado completo desde una vista previa
- Lee la carrera actual
- Genera snapshot antes y después
- Devuelve un resultado detallado
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carga = MAT.carga || {};

  MAT.carga.guardarDesdePreview = async function (params) {
    var input = (params && typeof params === "object") ? params : {};
    var careerId = String(input.careerId || "").trim();
    var preview = input.preview || null;
    var currentDoc;
    var beforeSnap;
    var mergeResult;
    var audit;
    var updatedDoc;
    var afterSnap;

    if (!careerId) {
      throw new Error("MAT: No se recibió el id de la carrera.");
    }

    if (!preview || typeof preview !== "object") {
      throw new Error("MAT: No se recibió una vista previa válida.");
    }

    currentDoc = await MAT.carreras.leerUna(careerId);

    if (!currentDoc) {
      throw new Error("MAT: La carrera seleccionada no existe en Firestore.");
    }

    beforeSnap = MAT.snapshot.onlyForLoadType(currentDoc, preview.kind);
    mergeResult = MAT.merge.fromPreview(currentDoc, preview, currentDoc.tipo);

    audit = {
      tipoCarga: String(preview.kind || ""),
      totalLineas: Number(preview.totalLines || 0),
      warnings: Array.isArray(mergeResult.warnings) ? mergeResult.warnings.slice() : [],
      stats: mergeResult.stats || {},
      fechaCliente: new Date().toISOString()
    };

    updatedDoc = await MAT.carga.actualizar(careerId, mergeResult.patch, {
      audit: audit
    });

    afterSnap = MAT.snapshot.onlyForLoadType(updatedDoc, preview.kind);

    return {
      ok: true,
      careerId: careerId,
      kind: String(preview.kind || ""),
      before: beforeSnap,
      after: afterSnap,
      updated: updatedDoc,
      warnings: mergeResult.warnings || [],
      stats: mergeResult.stats || {}
    };
  };

  MAT.carga.guardar = MAT.carga.guardarDesdePreview;
})(window);