/*
Nombre completo: fch.state.js
Ruta o ubicación: /fichas/fch.state.js
Función o funciones:
- Crear el estado base del módulo
- Actualizar catálogos, selección, datos PEA y borrador de ficha
- Reiniciar el estado manteniendo los catálogos cargados
*/

function fchClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fchCreateEmptyDraft() {
  return {
    carreraNombre: "",
    nivelNombre: "",
    materiaNombre: "",
    codigoMateria: "",
    objetivo: "",
    observaciones: "",
    decisiones: "",
    responsables: ""
  };
}

function fchCreateInitialState() {
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
    peaData: null,
    fichaDraft: fchCreateEmptyDraft()
  };
}

function fchSetCatalogos(state, catalogos) {
  const next = fchClone(state);
  next.catalogos = {
    carreras: Array.isArray(catalogos?.carreras) ? catalogos.carreras : [],
    niveles: Array.isArray(catalogos?.niveles) ? catalogos.niveles : [],
    materias: Array.isArray(catalogos?.materias) ? catalogos.materias : []
  };
  return next;
}

function fchSetSeleccion(state, seleccion) {
  const next = fchClone(state);
  next.seleccion = {
    carreraId: String(seleccion?.carreraId || "").trim(),
    nivelId: String(seleccion?.nivelId || "").trim(),
    materiaId: String(seleccion?.materiaId || "").trim()
  };
  return next;
}

function fchSetPeaData(state, peaData) {
  const next = fchClone(state);
  next.peaData = peaData ? fchClone(peaData) : null;
  return next;
}

function fchSetFichaDraft(state, fichaDraft) {
  const next = fchClone(state);
  next.fichaDraft = {
    ...fchCreateEmptyDraft(),
    ...(fichaDraft || {})
  };
  return next;
}

function fchResetState(state) {
  return {
    catalogos: fchClone(state.catalogos),
    seleccion: {
      carreraId: "",
      nivelId: "",
      materiaId: ""
    },
    peaData: null,
    fichaDraft: fchCreateEmptyDraft()
  };
}

export {
  fchCreateInitialState,
  fchCreateEmptyDraft,
  fchSetCatalogos,
  fchSetSeleccion,
  fchSetPeaData,
  fchSetFichaDraft,
  fchResetState
};