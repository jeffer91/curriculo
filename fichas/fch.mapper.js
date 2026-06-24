/*
Nombre completo: fch.mapper.js
Ruta o ubicación: /fichas/fch.mapper.js
Función o funciones:
- Transformar los datos cargados desde PEA en un borrador inicial de ficha
- Normalizar los campos base antes de mostrarlos en pantalla
*/

function fchSafeText(value) {
  return String(value ?? "").trim();
}

function fchMapperBuildDraftFromPea(input) {
  const peaData = input?.peaData || {};

  return {
    carreraNombre: fchSafeText(peaData.carreraNombre),
    nivelNombre: fchSafeText(peaData.nivelNombre),
    materiaNombre: fchSafeText(peaData.materiaNombre),
    codigoMateria: fchSafeText(peaData.codigoMateria),
    objetivo: fchSafeText(peaData.objetivo),
    observaciones: "",
    decisiones: "",
    responsables: ""
  };
}

export {
  fchMapperBuildDraftFromPea
};