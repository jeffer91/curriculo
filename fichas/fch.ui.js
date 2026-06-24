/*
Nombre completo: fch.ui.js
Ruta o ubicación: /fichas/fch.ui.js
Función o funciones:
- Manejar la interfaz del módulo
- Llenar selectores con filtro por carrera y nivel
- Leer la selección y el formulario
- Mostrar estado, resumen base y vista previa
- Limpiar toda la pantalla
*/

let fchCatalogosCache = {
  carreras: [],
  niveles: [],
  materias: []
};

function fchSafeText(value) {
  return String(value ?? "").trim();
}

function fchFillSelect(selectId, items, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder || "Seleccione";
  select.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = fchSafeText(item.id);
    option.textContent = fchSafeText(item.nombre || item.label || item.id);
    select.appendChild(option);
  });
}

function fchGetCurrentCarreraId() {
  return fchSafeText(document.getElementById("fchCarrera")?.value);
}

function fchGetCurrentNivelId() {
  return fchSafeText(document.getElementById("fchNivel")?.value);
}

function fchFilterMaterias(carreraId, nivelId) {
  return (fchCatalogosCache.materias || []).filter((item) => {
    const sameCarrera = !carreraId || fchSafeText(item.carreraId) === carreraId;
    const sameNivel = !nivelId || fchSafeText(item.nivelId) === nivelId;
    return sameCarrera && sameNivel;
  });
}

function fchRefreshMateriasSelect() {
  const carreraId = fchGetCurrentCarreraId();
  const nivelId = fchGetCurrentNivelId();
  const materias = fchFilterMaterias(carreraId, nivelId);
  fchFillSelect("fchMateria", materias, materias.length ? "Seleccione" : "Sin materias para esta selección");
}

function fchBindSelectorFilters() {
  const carrera = document.getElementById("fchCarrera");
  const nivel = document.getElementById("fchNivel");

  if (carrera && !carrera.__fchFilterBound) {
    carrera.addEventListener("change", fchRefreshMateriasSelect);
    carrera.__fchFilterBound = true;
  }

  if (nivel && !nivel.__fchFilterBound) {
    nivel.addEventListener("change", fchRefreshMateriasSelect);
    nivel.__fchFilterBound = true;
  }
}

function fchUiBindCatalogos(catalogos) {
  fchCatalogosCache = {
    carreras: Array.isArray(catalogos?.carreras) ? catalogos.carreras : [],
    niveles: Array.isArray(catalogos?.niveles) ? catalogos.niveles : [],
    materias: Array.isArray(catalogos?.materias) ? catalogos.materias : []
  };

  fchFillSelect("fchCarrera", fchCatalogosCache.carreras, "Seleccione");
  fchFillSelect("fchNivel", fchCatalogosCache.niveles, "Seleccione");
  fchRefreshMateriasSelect();
  fchBindSelectorFilters();
}

function fchUiReadSeleccion() {
  return {
    carreraId: fchSafeText(document.getElementById("fchCarrera")?.value),
    nivelId: fchSafeText(document.getElementById("fchNivel")?.value),
    materiaId: fchSafeText(document.getElementById("fchMateria")?.value)
  };
}

function fchUiFillForm(data) {
  const draft = data || {};
  const map = {
    fchCarreraNombre: draft.carreraNombre,
    fchNivelNombre: draft.nivelNombre,
    fchMateriaNombre: draft.materiaNombre,
    fchCodigoMateria: draft.codigoMateria,
    fchObjetivo: draft.objetivo,
    fchObservaciones: draft.observaciones,
    fchDecisiones: draft.decisiones,
    fchResponsables: draft.responsables
  };

  Object.keys(map).forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.value = fchSafeText(map[id]);
  });
}

function fchUiReadForm() {
  return {
    carreraNombre: fchSafeText(document.getElementById("fchCarreraNombre")?.value),
    nivelNombre: fchSafeText(document.getElementById("fchNivelNombre")?.value),
    materiaNombre: fchSafeText(document.getElementById("fchMateriaNombre")?.value),
    codigoMateria: fchSafeText(document.getElementById("fchCodigoMateria")?.value),
    objetivo: fchSafeText(document.getElementById("fchObjetivo")?.value),
    observaciones: fchSafeText(document.getElementById("fchObservaciones")?.value),
    decisiones: fchSafeText(document.getElementById("fchDecisiones")?.value),
    responsables: fchSafeText(document.getElementById("fchResponsables")?.value)
  };
}

function fchUiSetEstado(message, type = "normal") {
  const node = document.getElementById("fchEstado");
  if (!node) return;

  node.textContent = fchSafeText(message || "");
  node.classList.remove("fch-status-ok", "fch-status-error");

  if (type === "ok") {
    node.classList.add("fch-status-ok");
  }

  if (type === "error") {
    node.classList.add("fch-status-error");
  }
}

function fchUiRenderResumenBase(peaData) {
  const node = document.getElementById("fchResumenBase");
  if (!node) return;

  if (!peaData) {
    node.textContent = "No hay datos cargados todavía.";
    return;
  }

  const lines = [
    `Carrera: ${peaData.carreraNombre || "N/D"}`,
    `Nivel: ${peaData.nivelNombre || "N/D"}`,
    `Materia: ${peaData.materiaNombre || "N/D"}`,
    `Código: ${peaData.codigoMateria || "N/D"}`,
    `Objetivo base: ${peaData.objetivo || "N/D"}`,
    `Unidades detectadas: ${Array.isArray(peaData.unidades) ? peaData.unidades.length : 0}`
  ];

  node.innerHTML = "";
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.className = "fch-summary-line";
    p.textContent = line;
    node.appendChild(p);
  });
}

function fchUiRenderPreview(html) {
  const node = document.getElementById("fchPreview");
  if (!node) return;
  node.innerHTML = html || "La vista previa aparecerá aquí.";
}

function fchUiResetAll() {
  const form = document.getElementById("fchForm");
  if (form) {
    form.reset();
  }

  const resumen = document.getElementById("fchResumenBase");
  if (resumen) {
    resumen.textContent = "No hay datos cargados todavía.";
  }

  const preview = document.getElementById("fchPreview");
  if (preview) {
    preview.textContent = "La vista previa aparecerá aquí.";
  }

  ["fchCarrera", "fchNivel", "fchMateria"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.value = "";
    }
  });

  fchRefreshMateriasSelect();
}

export {
  fchUiBindCatalogos,
  fchUiReadSeleccion,
  fchUiFillForm,
  fchUiReadForm,
  fchUiSetEstado,
  fchUiRenderResumenBase,
  fchUiRenderPreview,
  fchUiResetAll
};
