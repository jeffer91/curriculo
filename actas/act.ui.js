/*
Nombre completo: act.ui.js
Ruta o ubicación: /actas/act.ui.js
Función o funciones:
- Manejar la interfaz del módulo
- Llenar selectores con filtro por carrera y nivel
- Leer selección y campos del acta
- Mostrar estado, resumen base y vista previa
- Limpiar la pantalla completa
*/

let actCatalogosCache = {
  carreras: [],
  niveles: [],
  materias: []
};

function actSafeText(value) {
  return String(value ?? "").trim();
}

function actFillSelect(selectId, items, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder || "Seleccione";
  select.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = actSafeText(item.id);
    option.textContent = actSafeText(item.nombre || item.label || item.id);
    select.appendChild(option);
  });
}

function actGetCurrentCarreraId() {
  return actSafeText(document.getElementById("actCarrera")?.value);
}

function actGetCurrentNivelId() {
  return actSafeText(document.getElementById("actNivel")?.value);
}

function actFilterMaterias(carreraId, nivelId) {
  return (actCatalogosCache.materias || []).filter((item) => {
    const sameCarrera = !carreraId || actSafeText(item.carreraId) === carreraId;
    const sameNivel = !nivelId || actSafeText(item.nivelId) === nivelId;
    return sameCarrera && sameNivel;
  });
}

function actRefreshMateriasSelect() {
  const carreraId = actGetCurrentCarreraId();
  const nivelId = actGetCurrentNivelId();
  const materias = actFilterMaterias(carreraId, nivelId);
  actFillSelect("actMateria", materias, materias.length ? "Seleccione" : "Sin materias para esta selección");
}

function actBindSelectorFilters() {
  const carrera = document.getElementById("actCarrera");
  const nivel = document.getElementById("actNivel");

  if (carrera && !carrera.__actFilterBound) {
    carrera.addEventListener("change", actRefreshMateriasSelect);
    carrera.__actFilterBound = true;
  }

  if (nivel && !nivel.__actFilterBound) {
    nivel.addEventListener("change", actRefreshMateriasSelect);
    nivel.__actFilterBound = true;
  }
}

function actUiBindCatalogos(catalogos) {
  actCatalogosCache = {
    carreras: Array.isArray(catalogos?.carreras) ? catalogos.carreras : [],
    niveles: Array.isArray(catalogos?.niveles) ? catalogos.niveles : [],
    materias: Array.isArray(catalogos?.materias) ? catalogos.materias : []
  };

  actFillSelect("actCarrera", actCatalogosCache.carreras, "Seleccione");
  actFillSelect("actNivel", actCatalogosCache.niveles, "Seleccione");
  actRefreshMateriasSelect();
  actBindSelectorFilters();
}

function actUiReadSeleccion() {
  return {
    carreraId: actSafeText(document.getElementById("actCarrera")?.value),
    nivelId: actSafeText(document.getElementById("actNivel")?.value),
    materiaId: actSafeText(document.getElementById("actMateria")?.value)
  };
}

function actUiFillForm(data) {
  const draft = data || {};
  const map = {
    actCarreraNombre: draft.carreraNombre,
    actNivelNombre: draft.nivelNombre,
    actMateriaNombre: draft.materiaNombre,
    actFechaAnalisis: draft.fechaAnalisis,
    actHoraInicio: draft.horaInicio,
    actHoraCierre: draft.horaCierre,
    actLugar: draft.lugar,
    actParticipantes: draft.participantes,
    actObjeto: draft.objeto,
    actFinalidad: draft.finalidad,
    actAlcance: draft.alcance,
    actObservaciones: draft.observaciones,
    actDecisiones: draft.decisiones,
    actResponsables: draft.responsables
  };

  Object.keys(map).forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.value = actSafeText(map[id]);
  });
}

function actUiReadForm() {
  return {
    carreraNombre: actSafeText(document.getElementById("actCarreraNombre")?.value),
    nivelNombre: actSafeText(document.getElementById("actNivelNombre")?.value),
    materiaNombre: actSafeText(document.getElementById("actMateriaNombre")?.value),
    fechaAnalisis: actSafeText(document.getElementById("actFechaAnalisis")?.value),
    horaInicio: actSafeText(document.getElementById("actHoraInicio")?.value),
    horaCierre: actSafeText(document.getElementById("actHoraCierre")?.value),
    lugar: actSafeText(document.getElementById("actLugar")?.value),
    participantes: actSafeText(document.getElementById("actParticipantes")?.value),
    objeto: actSafeText(document.getElementById("actObjeto")?.value),
    finalidad: actSafeText(document.getElementById("actFinalidad")?.value),
    alcance: actSafeText(document.getElementById("actAlcance")?.value),
    observaciones: actSafeText(document.getElementById("actObservaciones")?.value),
    decisiones: actSafeText(document.getElementById("actDecisiones")?.value),
    responsables: actSafeText(document.getElementById("actResponsables")?.value)
  };
}

function actUiSetFichaRelacionada(value) {
  const node = document.getElementById("actFichaRelacionada");
  if (!node) return;
  node.value = actSafeText(value);
}

function actUiSetEstado(message, type = "normal") {
  const node = document.getElementById("actEstado");
  if (!node) return;

  node.textContent = actSafeText(message || "");
  node.classList.remove("act-status-ok", "act-status-error");

  if (type === "ok") {
    node.classList.add("act-status-ok");
  }

  if (type === "error") {
    node.classList.add("act-status-error");
  }
}

function actUiRenderResumenBase(input) {
  const node = document.getElementById("actResumenBase");
  if (!node) return;

  const fichaData = input?.fichaData || null;
  const peaData = input?.peaData || null;

  if (!fichaData && !peaData) {
    node.textContent = "No hay datos cargados todavía.";
    return;
  }

  const lines = [
    `Ficha: ${fichaData?.key || "N/D"}`,
    `Carrera: ${fichaData?.ficha?.carreraNombre || peaData?.carreraNombre || "N/D"}`,
    `Nivel: ${fichaData?.ficha?.nivelNombre || peaData?.nivelNombre || "N/D"}`,
    `Materia: ${fichaData?.ficha?.materiaNombre || peaData?.materiaNombre || "N/D"}`,
    `Objetivo base: ${fichaData?.ficha?.objetivo || peaData?.objetivo || "N/D"}`
  ];

  node.innerHTML = "";
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.className = "act-summary-line";
    p.textContent = line;
    node.appendChild(p);
  });
}

function actUiRenderPreview(html) {
  const node = document.getElementById("actPreview");
  if (!node) return;
  node.innerHTML = html || "La vista previa aparecerá aquí.";
}

function actUiResetAll() {
  const form = document.getElementById("actForm");
  if (form) {
    form.reset();
  }

  const resumen = document.getElementById("actResumenBase");
  if (resumen) {
    resumen.textContent = "No hay datos cargados todavía.";
  }

  const preview = document.getElementById("actPreview");
  if (preview) {
    preview.textContent = "La vista previa aparecerá aquí.";
  }

  const ficha = document.getElementById("actFichaRelacionada");
  if (ficha) {
    ficha.value = "";
  }

  ["actCarrera", "actNivel", "actMateria"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.value = "";
    }
  });

  actRefreshMateriasSelect();
}

export {
  actUiBindCatalogos,
  actUiReadSeleccion,
  actUiFillForm,
  actUiReadForm,
  actUiSetFichaRelacionada,
  actUiSetEstado,
  actUiRenderResumenBase,
  actUiRenderPreview,
  actUiResetAll
};
