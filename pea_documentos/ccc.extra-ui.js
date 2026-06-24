/*
Nombre completo: ccc.extra-ui.js
Ruta o ubicación: /pea_documentos/ccc.extra-ui.js
Función:
- Complementar la pantalla CCC sin romper compatibilidad interna PEA
- Usar la versión seleccionada en los selectores para PDF, Excel y correo
- Permitir descargar validación CCC y enviar observaciones por correo
*/
(function (window, document) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function el(id) {
    return document.getElementById(id);
  }

  function value(id) {
    var node = el(id);
    return String(node && node.value || "").trim();
  }

  function setStatus(message, type) {
    var node = el("peaStatus");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.remove("is-ok", "is-error");
    if (type === "ok") node.classList.add("is-ok");
    if (type === "error") node.classList.add("is-error");
  }

  function getMateriaId() {
    return value("peaMateriaSelect");
  }

  function getSelectedVersionId() {
    return value("peaCompareA") || value("peaCompareB");
  }

  function getVersionData() {
    var materiaId = getMateriaId();
    var versionId = getSelectedVersionId();

    if (!materiaId) throw new Error("Selecciona una materia y carga el historial.");
    if (!versionId) throw new Error("Selecciona una versión del historial.");
    if (!PEA.store || typeof PEA.store.readVersionLocal !== "function") {
      throw new Error("No se encontró el almacenamiento local de CCC.");
    }

    return PEA.store.readVersionLocal(materiaId, versionId);
  }

  function getVersions() {
    var materiaId = getMateriaId();
    if (!materiaId || !PEA.store || typeof PEA.store.listVersionsLocal !== "function") return [];
    return PEA.store.listVersionsLocal(materiaId);
  }

  function getComparison() {
    var materiaId = getMateriaId();
    var versionA = value("peaCompareA");
    var versionB = value("peaCompareB");

    if (!materiaId) throw new Error("Selecciona una materia.");
    if (!versionA || !versionB) throw new Error("Selecciona dos versiones.");
    if (versionA === versionB) throw new Error("Selecciona dos versiones diferentes.");
    if (!PEA.compare || typeof PEA.compare.compareVersions !== "function") {
      throw new Error("No se encontró el comparador CCC.");
    }

    return PEA.compare.compareVersions(
      PEA.store.readVersionLocal(materiaId, versionB),
      PEA.store.readVersionLocal(materiaId, versionA)
    );
  }

  function stop(event) {
    if (!event) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function bindCapture(id, handler) {
    var node = el(id);
    if (!node || node.__cccExtraBound) return;
    node.addEventListener("click", function (event) {
      stop(event);
      try {
        handler();
      } catch (error) {
        console.error(error);
        setStatus(error.message || "No se pudo completar la acción.", "error");
      }
    }, true);
    node.__cccExtraBound = true;
  }

  function openObservationEmail(versionData) {
    if (!PEA.export || typeof PEA.export.buildObservationText !== "function") {
      throw new Error("No se encontró el generador de observaciones.");
    }

    var meta = versionData && versionData.meta ? versionData.meta : {};
    var subject = "Observaciones CCC - " + String(meta.materiaNombre || "Materia");
    var body = PEA.export.buildObservationText(versionData);
    var href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    window.location.href = href;
  }

  function bind() {
    bindCapture("peaBtnPdf", function () {
      var versionData = getVersionData();
      PEA.export.downloadPdfVersion(versionData, {
        versions: getVersions(),
        store: PEA.store
      });
      setStatus("PDF CCC generado correctamente.", "ok");
    });

    bindCapture("peaBtnExcel", function () {
      PEA.export.downloadThreeExcels(getVersionData());
      setStatus("Se descargaron los 3 Excel CCC en formato texto.", "ok");
    });

    bindCapture("peaBtnExcelValidado", function () {
      PEA.export.downloadValidationExcel(getVersionData());
      setStatus("Excel de validación CCC descargado correctamente.", "ok");
    });

    bindCapture("peaBtnCorreoObservaciones", function () {
      openObservationEmail(getVersionData());
      setStatus("Correo de observaciones preparado.", "ok");
    });

    bindCapture("peaBtnPdfComparativo", function () {
      PEA.export.downloadPdfComparison(getComparison());
      setStatus("PDF comparativo CCC generado correctamente.", "ok");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(window, document);
