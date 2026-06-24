(function (window, document) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  var state = {
    carreraId: "",
    materiaId: "",
    versions: [],
    currentVersion: null,
    currentComparison: null,
    carreras: [],
    materias: [],
    syncTimerId: null
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function hasEl(id) {
    return !!getEl(id);
  }

  function safeCleanText(value) {
    if (PEA.parser && typeof PEA.parser.cleanText === "function") {
      return PEA.parser.cleanText(value);
    }

    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, type) {
    var el = getEl("peaStatus");
    if (!el) return;

    el.textContent = String(message || "");
    el.classList.remove("is-ok", "is-error");

    if (type === "ok") {
      el.classList.add("is-ok");
    } else if (type === "error") {
      el.classList.add("is-error");
    }
  }

  function getCurrentMode() {
    var checked = document.querySelector('input[name="peaModoCarga"]:checked');
    return checked ? String(checked.value || "triple") : "triple";
  }

  function toggleMode() {
    var mode = getCurrentMode();
    var triple = getEl("peaCargaTriple");
    var consolidado = getEl("peaCargaConsolidado");

    if (!triple || !consolidado) return;

    if (mode === "triple") {
      triple.classList.remove("pea-hidden");
      consolidado.classList.add("pea-hidden");
    } else {
      triple.classList.add("pea-hidden");
      consolidado.classList.remove("pea-hidden");
    }
  }

  function uniqueSorted(list) {
    var seen = Object.create(null);
    var out = [];

    (Array.isArray(list) ? list : []).forEach(function (item) {
      var text = String(item || "").trim();
      var key = text.toLowerCase();

      if (!text || seen[key]) return;

      seen[key] = true;
      out.push(text);
    });

    out.sort(function (a, b) {
      return a.localeCompare(b, "es", {
        sensitivity: "base",
        numeric: true
      });
    });

    return out;
  }

  function createMateriaId(carreraId, materiaNombre) {
    var normalized = String(materiaNombre || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return String(carreraId || "") + "__" + normalized;
  }

  function getSelectedCarreraById(id) {
    var safeId = safeCleanText(id);

    return state.carreras.find(function (item) {
      return String(item.id || "") === safeId;
    }) || null;
  }

  function getSelectedMateriaById(id) {
    var safeId = safeCleanText(id);

    return state.materias.find(function (item) {
      return String(item.id || "") === safeId;
    }) || null;
  }

  async function loadCarrerasForSelect() {
    var select = getEl("peaCarreraSelect");
    if (!select) return;

    if (!PEA.firebase || typeof PEA.firebase.init !== "function") {
      throw new Error("PEA.firebase no está disponible.");
    }

    if (!PEA.firebase.init()) {
      throw new Error("No se pudo inicializar Firebase para leer carreras.");
    }

    var db = PEA.firebase.getDb();
    if (!db) {
      throw new Error("No se pudo obtener la base Firestore.");
    }

    var snap = await db.collection("carreras").orderBy("nombre").get();

    state.carreras = snap.docs.map(function (doc) {
      var data = doc.data() || {};
      return {
        id: String(doc.id || ""),
        nombre: String(data.nombre || ""),
        tipo: String(data.tipo || ""),
        estado: String(data.estado || "")
      };
    });

    select.innerHTML =
      '<option value="">Selecciona una carrera</option>' +
      state.carreras.map(function (item) {
        return (
          '<option value="' +
          escapeHtml(item.id) +
          '">' +
          escapeHtml(item.nombre) +
          "</option>"
        );
      }).join("");
  }

  async function loadMateriasForCarrera(carreraId) {
    var materiaSelect = getEl("peaMateriaSelect");
    var tipoInput = getEl("peaMateriaTipo");

    if (!materiaSelect || !tipoInput) return;

    state.materias = [];
    state.materiaId = "";
    materiaSelect.innerHTML = '<option value="">Selecciona una materia</option>';
    tipoInput.value = "";

    if (!carreraId) {
      state.carreraId = "";
      return;
    }

    if (!PEA.firebase || typeof PEA.firebase.init !== "function" || !PEA.firebase.init()) {
      throw new Error("No se pudo inicializar Firebase.");
    }

    var db = PEA.firebase.getDb();
    var docSnap = await db.collection("carreras").doc(String(carreraId)).get();

    if (!docSnap.exists) {
      throw new Error("No se encontró la carrera seleccionada.");
    }

    var data = docSnap.data() || {};
    var carrera = getSelectedCarreraById(carreraId);

    var materiasCarrera = []
      .concat(Array.isArray(data.materiasNivel1) ? data.materiasNivel1 : [])
      .concat(Array.isArray(data.materiasNivel2) ? data.materiasNivel2 : [])
      .concat(Array.isArray(data.materiasNivel3) ? data.materiasNivel3 : [])
      .concat(Array.isArray(data.materiasNivel4) ? data.materiasNivel4 : [])
      .concat(Array.isArray(data.materiasTransversal1) ? data.materiasTransversal1 : [])
      .concat(Array.isArray(data.materiasTransversal2) ? data.materiasTransversal2 : [])
      .concat(Array.isArray(data.materiasTransversal3) ? data.materiasTransversal3 : [])
      .concat(Array.isArray(data.materiasTransversal4) ? data.materiasTransversal4 : []);

    materiasCarrera = uniqueSorted(materiasCarrera);

    state.carreraId = String(carreraId || "");
    state.materias = materiasCarrera.map(function (nombreMateria) {
      return {
        id: createMateriaId(carreraId, nombreMateria),
        nombre: nombreMateria,
        carreraId: String(carreraId || ""),
        carreraNombre: carrera ? String(carrera.nombre || "") : "",
        carreraTipo: carrera ? String(carrera.tipo || "") : ""
      };
    });

    materiaSelect.innerHTML =
      '<option value="">Selecciona una materia</option>' +
      state.materias.map(function (item) {
        return (
          '<option value="' +
          escapeHtml(item.id) +
          '">' +
          escapeHtml(item.nombre) +
          "</option>"
        );
      }).join("");

    tipoInput.value = carrera ? String(carrera.tipo || "") : "";
  }

  function updateSelectedMeta() {
    var carreraSelect = getEl("peaCarreraSelect");
    var materiaSelect = getEl("peaMateriaSelect");
    var tipoInput = getEl("peaMateriaTipo");

    var carreraId = carreraSelect ? safeCleanText(carreraSelect.value) : "";
    var materiaId = materiaSelect ? safeCleanText(materiaSelect.value) : "";
    var carrera = getSelectedCarreraById(carreraId);
    var materia = getSelectedMateriaById(materiaId);

    state.carreraId = carrera ? carrera.id : "";
    state.materiaId = materia ? materia.id : "";

    if (tipoInput) {
      tipoInput.value = carrera ? String(carrera.tipo || "") : "";
    }
  }

  function getMateriaData() {
    var carrera = getSelectedCarreraById(
      hasEl("peaCarreraSelect") ? getEl("peaCarreraSelect").value : ""
    );
    var materia = getSelectedMateriaById(
      hasEl("peaMateriaSelect") ? getEl("peaMateriaSelect").value : ""
    );

    if (!carrera) {
      throw new Error("Debes seleccionar una carrera.");
    }

    if (!materia) {
      throw new Error("Debes seleccionar una materia.");
    }

    return {
      carreraId: String(carrera.id || ""),
      carreraNombre: String(carrera.nombre || ""),
      materiaId: String(materia.id || ""),
      materiaNombre: String(materia.nombre || ""),
      materiaCodigo: String(materia.id || ""),
      materiaTipo: String(carrera.tipo || "")
    };
  }

  function buildPreviewHtml(versionData) {
    if (!versionData || !versionData.meta || !versionData.data) {
      return "No hay datos para mostrar.";
    }

    var meta = versionData.meta || {};
    var data = versionData.data || {};
    var content = data.contenido || {};

    function block(title, section) {
      var sheets = section && Array.isArray(section.sheets) ? section.sheets : [];
      var lines = [];

      if (!sheets.length) {
        lines.push("Sin hojas registradas.");
      } else {
        sheets.forEach(function (sheet) {
          lines.push(
            "- " +
            String(sheet.name || "Hoja") +
            " | filas: " +
            Number(sheet.rowCount || 0)
          );
        });
      }

      return [
        '<div class="pea-preview-block">',
        '<div class="pea-preview-title">' + escapeHtml(title) + "</div>",
        '<div class="pea-preview-lines">' + escapeHtml(lines.join("\n")) + "</div>",
        "</div>"
      ].join("");
    }

    var carreraNombre = meta.carreraNombre || data.carreraNombre || "";

    return [
      '<div class="pea-preview-block">',
      '<div class="pea-preview-title">' +
        escapeHtml(String(meta.materiaNombre || "")) +
        " · " +
        escapeHtml(String(meta.versionId || "")) +
      "</div>",
      '<div class="pea-preview-lines">' +
        escapeHtml(
          "Carrera: " + String(carreraNombre || "") + "\n" +
          "Origen: " + String(meta.origenTipo || "") + "\n" +
          "Fecha: " + String(meta.createdAtClient || "") + "\n" +
          "Nota: " + String(meta.versionNota || "Sin nota") + "\n" +
          "Sincronizado: " + (meta.synced ? "Sí" : "No")
        ) +
      "</div>",
      "</div>",
      block("Base", content.base),
      block("Unidades", content.unidades),
      block("Actividades", content.actividades)
    ].join("");
  }

  function renderPreview(versionData) {
    var el = getEl("peaPreview");
    if (!el) return;
    el.innerHTML = buildPreviewHtml(versionData);
  }

  function renderHistorial() {
    var el = getEl("peaHistorial");
    var compareA = getEl("peaCompareA");
    var compareB = getEl("peaCompareB");

    if (!el || !compareA || !compareB) return;

    if (!state.versions.length) {
      el.innerHTML = "No existen versiones locales para esta materia.";
      compareA.innerHTML = "";
      compareB.innerHTML = "";
      return;
    }

    el.innerHTML = state.versions.map(function (item) {
      var resumen = item.resumen || {};

      return [
        '<div class="pea-version-card">',
        '<div class="pea-version-head">',
        "<div>",
        '<div class="pea-version-title">' +
          escapeHtml(String(item.versionId || "")) +
          ' <span class="pea-badge">' +
          escapeHtml(String(item.origenTipo || "")) +
          "</span></div>",
        '<div class="pea-version-meta">' +
          escapeHtml(String(item.createdAtClient || "")) +
          "</div>",
        "</div>",
        "</div>",
        '<div class="pea-version-meta">' +
          "Base: " + Number(resumen.totalHojasBase || 0) +
          " · Unidades: " + Number(resumen.totalHojasUnidades || 0) +
          " · Actividades: " + Number(resumen.totalHojasActividades || 0) +
        "</div>",
        '<div class="pea-version-meta">Nota: ' +
          escapeHtml(String(item.versionNota || "Sin nota")) +
        "</div>",
        '<div class="pea-version-meta">Sincronizado: ' +
          (item.synced ? "Sí" : "No") +
        "</div>",
        '<div class="pea-version-actions">',
        '<button class="pea-btn pea-btn-primary" type="button" data-load-version="' +
          escapeHtml(String(item.versionId || "")) +
          '">Cargar</button>',
        "</div>",
        "</div>"
      ].join("");
    }).join("");

    compareA.innerHTML = state.versions.map(function (item) {
      return (
        '<option value="' +
        escapeHtml(String(item.versionId || "")) +
        '">' +
        escapeHtml(String(item.versionId || "")) +
        "</option>"
      );
    }).join("");

    compareB.innerHTML = state.versions.map(function (item) {
      return (
        '<option value="' +
        escapeHtml(String(item.versionId || "")) +
        '">' +
        escapeHtml(String(item.versionId || "")) +
        "</option>"
      );
    }).join("");

    if (state.versions.length > 1) {
      compareA.value = String(state.versions[state.versions.length - 1].versionId || "");
      compareB.value = String(state.versions[0].versionId || "");
    } else {
      compareA.value = String(state.versions[0].versionId || "");
      compareB.value = String(state.versions[0].versionId || "");
    }
  }

  function renderComparePreview(comparison) {
    var el = getEl("peaComparePreview");
    if (!el) return;

    if (!comparison) {
      el.textContent = "Aquí aparecerá el resumen comparativo.";
      return;
    }

    var lines = [];
    lines.push("Materia: " + String(comparison.materiaNombre || ""));
    lines.push("Versión A: " + String((comparison.versionA && comparison.versionA.versionId) || ""));
    lines.push("Versión B: " + String((comparison.versionB && comparison.versionB.versionId) || ""));
    lines.push("Total cambios: " + Number(comparison.totalCambios || 0));
    lines.push("");

    (comparison.sections || []).forEach(function (section) {
      lines.push(String(section.sectionName || "").toUpperCase());
      lines.push("  Agregadas: " + Number((section.added || []).length));
      lines.push("  Eliminadas: " + Number((section.removed || []).length));
      lines.push("  Modificadas: " + Number((section.changed || []).length));
      lines.push("");
    });

    el.textContent = lines.join("\n");
  }

  function reloadLocalHistorialIfPossible() {
    if (!state.materiaId) return;
    if (!PEA.store || typeof PEA.store.listVersionsLocal !== "function") return;

    state.versions = PEA.store.listVersionsLocal(state.materiaId);
    renderHistorial();
  }

  function cargarHistorial() {
    var materia = getMateriaData();

    if (!PEA.store || typeof PEA.store.listVersionsLocal !== "function") {
      throw new Error("PEA.store.listVersionsLocal no está disponible.");
    }

    state.materiaId = materia.materiaId;
    state.versions = PEA.store.listVersionsLocal(materia.materiaId);
    renderHistorial();
    setStatus("Historial local cargado correctamente.", "ok");
  }

  function cargarVersion(versionId) {
    var materia = getMateriaData();

    if (!PEA.store || typeof PEA.store.readVersionLocal !== "function") {
      throw new Error("PEA.store.readVersionLocal no está disponible.");
    }

    state.materiaId = materia.materiaId;
    state.currentVersion = PEA.store.readVersionLocal(materia.materiaId, versionId);
    renderPreview(state.currentVersion);
    setStatus("Versión local cargada correctamente.", "ok");
  }

  async function guardarVersionLocal() {
    var materia = getMateriaData();
    var mode = getCurrentMode();
    var versionNota = hasEl("peaVersionNota")
      ? safeCleanText(getEl("peaVersionNota").value)
      : "";
    var payload;

    if (!PEA.parser || typeof PEA.parser.buildNormalizedUpload !== "function") {
      throw new Error("PEA.parser.buildNormalizedUpload no está disponible.");
    }

    if (!PEA.store || typeof PEA.store.saveVersionLocal !== "function") {
      throw new Error("PEA.store.saveVersionLocal no está disponible.");
    }

    setStatus("Procesando archivos...");

    if (mode === "triple") {
      payload = await PEA.parser.buildNormalizedUpload({
        materiaNombre: materia.materiaNombre,
        materiaCodigo: materia.materiaCodigo,
        versionNota: versionNota,
        modo: "triple",
        baseFile: hasEl("peaFileBase") ? getEl("peaFileBase").files[0] : null,
        unidadesFile: hasEl("peaFileUnidades") ? getEl("peaFileUnidades").files[0] : null,
        actividadesFile: hasEl("peaFileActividades") ? getEl("peaFileActividades").files[0] : null
      });
    } else {
      payload = await PEA.parser.buildNormalizedUpload({
        materiaNombre: materia.materiaNombre,
        materiaCodigo: materia.materiaCodigo,
        versionNota: versionNota,
        modo: "consolidado",
        consolidadoFile: hasEl("peaFileConsolidado") ? getEl("peaFileConsolidado").files[0] : null
      });
    }

    payload.carreraId = materia.carreraId;
    payload.carreraNombre = materia.carreraNombre;

    state.materiaId = payload.materiaId;

    var result = PEA.store.saveVersionLocal(payload);

    setStatus("Versión guardada en local: " + String(result.versionId || ""), "ok");
    cargarHistorial();
    cargarVersion(String(result.versionId || ""));
  }

  async function syncNow() {
    try {
      if (!PEA.store) {
        throw new Error("PEA.store no está disponible.");
      }

      setStatus("Sincronizando...");

      var pullResult = { ok: true, pulled: 0, skipped: true };
      var pushResult = { ok: true, pushed: 0, skipped: true };

      if (typeof PEA.store.pullFromFirebaseIfDue === "function") {
        pullResult = await PEA.store.pullFromFirebaseIfDue();
      }

      if (typeof PEA.store.pushPendingToFirebaseIfDue === "function") {
        pushResult = await PEA.store.pushPendingToFirebaseIfDue();
      }

      reloadLocalHistorialIfPossible();

      var parts = [];
      if (!pullResult.skipped) parts.push("descarga: " + Number(pullResult.pulled || 0));
      if (!pushResult.skipped) parts.push("subida: " + Number(pushResult.pushed || 0));
      if (!parts.length) parts.push("sin acciones pendientes");

      setStatus("Sincronización completada, " + parts.join(" · "), "ok");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "No se pudo sincronizar.", "error");
    }
  }

  async function compararVersiones() {
    var materia = getMateriaData();
    var versionA = hasEl("peaCompareA") ? safeCleanText(getEl("peaCompareA").value) : "";
    var versionB = hasEl("peaCompareB") ? safeCleanText(getEl("peaCompareB").value) : "";

    if (!versionA || !versionB) {
      throw new Error("Debes seleccionar dos versiones.");
    }

    if (versionA === versionB) {
      throw new Error("Debes escoger dos versiones diferentes.");
    }

    if (!PEA.store || typeof PEA.store.readVersionLocal !== "function") {
      throw new Error("PEA.store.readVersionLocal no está disponible.");
    }

    if (!PEA.compare || typeof PEA.compare.compareVersions !== "function") {
      throw new Error("PEA.compare.compareVersions no está disponible.");
    }

    var dataA = PEA.store.readVersionLocal(materia.materiaId, versionA);
    var dataB = PEA.store.readVersionLocal(materia.materiaId, versionB);

    state.currentComparison = PEA.compare.compareVersions(dataA, dataB);
    renderComparePreview(state.currentComparison);
    setStatus("Comparación generada correctamente.", "ok");
  }

  function clearForm() {
    if (hasEl("peaCarreraSelect")) getEl("peaCarreraSelect").value = "";

    if (hasEl("peaMateriaSelect")) {
      getEl("peaMateriaSelect").innerHTML = '<option value="">Selecciona una materia</option>';
      getEl("peaMateriaSelect").value = "";
    }

    if (hasEl("peaMateriaTipo")) getEl("peaMateriaTipo").value = "";
    if (hasEl("peaVersionNota")) getEl("peaVersionNota").value = "";
    if (hasEl("peaFileBase")) getEl("peaFileBase").value = "";
    if (hasEl("peaFileUnidades")) getEl("peaFileUnidades").value = "";
    if (hasEl("peaFileActividades")) getEl("peaFileActividades").value = "";
    if (hasEl("peaFileConsolidado")) getEl("peaFileConsolidado").value = "";

    state.carreraId = "";
    state.materiaId = "";
    state.materias = [];
    state.versions = [];
    state.currentVersion = null;
    state.currentComparison = null;

    if (hasEl("peaHistorial")) {
      getEl("peaHistorial").innerHTML = "Aún no se ha cargado el historial de esta materia.";
    }

    if (hasEl("peaPreview")) {
      getEl("peaPreview").innerHTML = "Selecciona una versión para verla aquí.";
    }

    renderComparePreview(null);
    setStatus("Formulario limpio.");
  }

  function bindVersionCardActions() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-load-version]");
      if (!button) return;

      var versionId = String(button.getAttribute("data-load-version") || "").trim();
      if (!versionId) return;

      try {
        cargarVersion(versionId);
      } catch (error) {
        console.error(error);
        setStatus(error.message || "No se pudo cargar la versión.", "error");
      }
    });
  }

  function bindEvents() {
    Array.prototype.slice.call(
      document.querySelectorAll('input[name="peaModoCarga"]')
    ).forEach(function (radio) {
      radio.addEventListener("change", toggleMode);
    });

    if (hasEl("peaCarreraSelect")) {
      getEl("peaCarreraSelect").addEventListener("change", function () {
        var carreraId = safeCleanText(getEl("peaCarreraSelect").value);

        loadMateriasForCarrera(carreraId)
          .then(function () {
            updateSelectedMeta();
            setStatus("Carrera seleccionada correctamente.", "ok");
          })
          .catch(function (error) {
            console.error(error);
            setStatus(error.message || "No se pudieron cargar las materias.", "error");
          });
      });
    }

    if (hasEl("peaMateriaSelect")) {
      getEl("peaMateriaSelect").addEventListener("change", function () {
        updateSelectedMeta();
      });
    }

    if (hasEl("peaBtnGuardar")) {
      getEl("peaBtnGuardar").addEventListener("click", function () {
        guardarVersionLocal().catch(function (error) {
          console.error(error);
          setStatus(error.message || "No se pudo guardar en local.", "error");
        });
      });
    }

    if (hasEl("peaBtnHistorial")) {
      getEl("peaBtnHistorial").addEventListener("click", function () {
        try {
          cargarHistorial();
        } catch (error) {
          console.error(error);
          setStatus(error.message || "No se pudo cargar historial.", "error");
        }
      });
    }

    if (hasEl("peaBtnSync")) {
      getEl("peaBtnSync").addEventListener("click", function () {
        syncNow();
      });
    }

    if (hasEl("peaBtnLimpiar")) {
      getEl("peaBtnLimpiar").addEventListener("click", clearForm);
    }

    if (hasEl("peaBtnPdf")) {
      getEl("peaBtnPdf").addEventListener("click", function () {
        try {
          if (!PEA.export || typeof PEA.export.downloadPdfVersion !== "function") {
            throw new Error("PEA.export.downloadPdfVersion no está disponible.");
          }
          PEA.export.downloadPdfVersion(state.currentVersion);
          setStatus("PDF generado correctamente.", "ok");
        } catch (error) {
          console.error(error);
          setStatus(error.message || "No se pudo generar el PDF.", "error");
        }
      });
    }

    if (hasEl("peaBtnExcel")) {
      getEl("peaBtnExcel").addEventListener("click", function () {
        try {
          if (!PEA.export || typeof PEA.export.downloadThreeExcels !== "function") {
            throw new Error("PEA.export.downloadThreeExcels no está disponible.");
          }
          PEA.export.downloadThreeExcels(state.currentVersion);
          setStatus("Excel reconstruido correctamente.", "ok");
        } catch (error) {
          console.error(error);
          setStatus(error.message || "No se pudieron descargar los Excel.", "error");
        }
      });
    }

    if (hasEl("peaBtnComparar")) {
      getEl("peaBtnComparar").addEventListener("click", function () {
        compararVersiones().catch(function (error) {
          console.error(error);
          setStatus(error.message || "No se pudo comparar.", "error");
        });
      });
    }

    if (hasEl("peaBtnPdfComparativo")) {
      getEl("peaBtnPdfComparativo").addEventListener("click", function () {
        try {
          if (!PEA.export || typeof PEA.export.downloadPdfComparison !== "function") {
            throw new Error("PEA.export.downloadPdfComparison no está disponible.");
          }
          PEA.export.downloadPdfComparison(state.currentComparison);
          setStatus("PDF comparativo generado correctamente.", "ok");
        } catch (error) {
          console.error(error);
          setStatus(error.message || "No se pudo generar el PDF comparativo.", "error");
        }
      });
    }

    bindVersionCardActions();
  }

  async function boot() {
    toggleMode();
    bindEvents();
    await loadCarrerasForSelect();

    try {
      await syncNow();
    } catch (error) {
      console.error(error);
    }

    if (state.syncTimerId) {
      clearInterval(state.syncTimerId);
    }

    state.syncTimerId = window.setInterval(function () {
      syncNow();
    }, 60000);

    setStatus("Pantalla lista.");
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (error) {
      console.error(error);
      setStatus(error.message || "No se pudo iniciar la pantalla.", "error");
    });
  });
})(window, document);