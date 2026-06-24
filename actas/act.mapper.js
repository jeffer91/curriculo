/*
Nombre completo: act.mapper.js
Ruta o ubicación: /actas/act.mapper.js
Función o funciones:
- Transformar los datos de ficha y PEA en un borrador inicial del acta
- Normalizar y proponer valores iniciales
*/

function actSafeText(value) {
  return String(value ?? "").trim();
}

function actToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function actMapperBuildDraft(input) {
  const fichaData = input?.fichaData || {};
  const peaData = input?.peaData || {};
  const ficha = fichaData?.ficha || {};

  return {
    carreraNombre: actSafeText(ficha.carreraNombre || peaData.carreraNombre),
    nivelNombre: actSafeText(ficha.nivelNombre || peaData.nivelNombre),
    materiaNombre: actSafeText(ficha.materiaNombre || peaData.materiaNombre),
    fechaAnalisis: actToday(),
    horaInicio: "",
    horaCierre: "",
    lugar: "",
    participantes: "",
    objeto: "Dejar constancia formal del análisis técnico, pedagógico y académico realizado.",
    finalidad: "Garantizar la coherencia, pertinencia y alineación curricular de la asignatura analizada.",
    alcance: "Descripción de la asignatura, objetivos, unidades, competencias, resultados de aprendizaje, bibliografía y actividades.",
    observaciones: actSafeText(ficha.observaciones),
    decisiones: actSafeText(ficha.decisiones),
    responsables: actSafeText(ficha.responsables)
  };
}

export {
  actMapperBuildDraft
};