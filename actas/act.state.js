/*
Nombre completo: act.state.js
Ruta o ubicación: /actas/act.state.js
Función o funciones:
- Crear el estado base del módulo de actas
- Actualizar catálogos, selección, ficha, datos PEA y borrador del acta
- Reiniciar el estado manteniendo los catálogos cargados
*/

function actClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actCreateEmptyDraft() {
  return {
    carreraNombre: "",
    nivelNombre: "",
    materiaNombre: "",
    fechaAnalisis: "",
    horaInicio: "",
    horaCierre: "",
    lugar: "",
    participantes: "",
    objeto: "",
    finalidad: "",
    alcance: "",
    observaciones: "",
    decisiones: "",
    responsables: ""
  };
}

function actCreateInitialState() {
  return {
    catalogos: {
      carreras: [],
      niveles: [],
      materias: []
    },
    seleccion: {
      carreraId: "",
      nivelId: "",
      materiaId: ""
    },
    fichaData: null,
    peaData: null,
    actaDraft: actCreateEmptyDraft()
  };
}

function actSetCatalogos(state, catalogos) {
  const next = actClone(state);
  next.catalogos = {
    carreras: Array.isArray(catalogos?.carreras) ? catalogos.carreras : [],
    niveles: Array.isArray(catalogos?.niveles) ? catalogos.niveles : [],
    materias: Array.isArray(catalogos?.materias) ? catalogos.materias : []
  };
  return next;
}

function actSetSeleccion(state, seleccion) {
  const next = actClone(state);
  next.seleccion = {
    carreraId: String(seleccion?.carreraId || "").trim(),
    nivelId: String(seleccion?.nivelId || "").trim(),
    materiaId: String(seleccion?.materiaId || "").trim()
  };
  return next;
}

function actSetFichaData(state, fichaData) {
  const next = actClone(state);
  next.fichaData = fichaData ? actClone(fichaData) : null;
  return next;
}

function actSetPeaData(state, peaData) {
  const next = actClone(state);
  next.peaData = peaData ? actClone(peaData) : null;
  return next;
}

function actSetActaDraft(state, actaDraft) {
  const next = actClone(state);
  next.actaDraft = {
    ...actCreateEmptyDraft(),
    ...(actaDraft || {})
  };
  return next;
}

function actResetState(state) {
  return {
    catalogos: actClone(state.catalogos),
    seleccion: {
      carreraId: "",
      nivelId: "",
      materiaId: ""
    },
    fichaData: null,
    peaData: null,
    actaDraft: actCreateEmptyDraft()
  };
}

export {
  actCreateInitialState,
  actCreateEmptyDraft,
  actSetCatalogos,
  actSetSeleccion,
  actSetFichaData,
  actSetPeaData,
  actSetActaDraft,
  actResetState
};