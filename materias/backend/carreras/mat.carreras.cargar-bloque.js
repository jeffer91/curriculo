/*
Nombre del archivo: mat.carreras.cargar-bloque.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carreras\mat.carreras.cargar-bloque.js
Función:
- Lee una carrera completa desde Firestore
- Extrae un solo bloque según el tipo de carga
- Lo convierte en una vista previa compatible con el editor
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carreras = MAT.carreras || {};

  function toArray(value) {
    return Array.isArray(value)
      ? value
          .map(function (item) {
            return String(item || "").trim();
          })
          .filter(function (item) {
            return !!item;
          })
      : [];
  }

  function countGrouped(summary) {
    return (
      toArray(summary.nivel1).length +
      toArray(summary.nivel2).length +
      toArray(summary.nivel3).length +
      toArray(summary.nivel4).length +
      toArray(summary.sinNivel).length
    );
  }

  function buildGroupedPreview(kind, doc) {
    var summary = {
      nivel1: [],
      nivel2: [],
      nivel3: [],
      nivel4: [],
      sinNivel: []
    };

    if (kind === "materias-carrera") {
      summary.nivel1 = toArray(doc.materiasNivel1);
      summary.nivel2 = toArray(doc.materiasNivel2);
      summary.nivel3 = toArray(doc.materiasNivel3);
      summary.nivel4 = toArray(doc.materiasNivel4);
    } else {
      summary.nivel1 = toArray(doc.materiasTransversal1);
      summary.nivel2 = toArray(doc.materiasTransversal2);
      summary.nivel3 = toArray(doc.materiasTransversal3);
      summary.nivel4 = toArray(doc.materiasTransversal4);
    }

    return {
      kind: kind,
      totalLines: countGrouped(summary),
      rawLines: [],
      source: "firestore",
      summary: summary
    };
  }

  function buildFlatPreview(kind, doc) {
    var items = [];
    var expected = 0;

    if (kind === "nucleos") {
      items = toArray(doc.nucleos);
      expected = Number(
        (MAT.config &&
          MAT.config.limits &&
          MAT.config.limits.nucleos &&
          MAT.config.limits.nucleos.exactTotal) || 4
      );
    } else {
      items = toArray(doc.ejes);
      expected = (MAT.carreras && typeof MAT.carreras.getEjesEsperados === "function")
        ? MAT.carreras.getEjesEsperados(doc.tipo || "")
        : 4;
    }

    return {
      kind: kind,
      totalLines: items.length,
      rawLines: [],
      source: "firestore",
      summary: {
        expected: expected,
        total: items.length,
        items: items
      }
    };
  }

  MAT.carreras.buildPreviewFromDoc = function (doc, loadType) {
    var safeDoc = (MAT.carreras && typeof MAT.carreras.ensureShape === "function")
      ? MAT.carreras.ensureShape(doc || {})
      : (doc || {});
    var kind = String(loadType || "").trim();

    if (!kind) {
      throw new Error("MAT: Debes indicar el tipo de carga para construir el bloque.");
    }

    if (kind === "materias-carrera" || kind === "transversales") {
      return buildGroupedPreview(kind, safeDoc);
    }

    if (kind === "nucleos" || kind === "ejes") {
      return buildFlatPreview(kind, safeDoc);
    }

    throw new Error("MAT: Tipo de carga no soportado: " + kind);
  };

  MAT.carreras.cargarBloque = async function (careerId, loadType) {
    var currentDoc;
    var preview;

    careerId = String(careerId || "").trim();
    loadType = String(loadType || "").trim();

    if (!careerId) {
      throw new Error("MAT: Debes indicar la carrera para cargar el bloque.");
    }

    if (!loadType) {
      throw new Error("MAT: Debes indicar el tipo de carga para cargar el bloque.");
    }

    currentDoc = await MAT.carreras.leerUna(careerId);

    if (!currentDoc) {
      throw new Error("MAT: No existe la carrera seleccionada.");
    }

    preview = MAT.carreras.buildPreviewFromDoc(currentDoc, loadType);

    return {
      careerId: careerId,
      loadType: loadType,
      currentDoc: currentDoc,
      preview: preview
    };
  };
})(window);