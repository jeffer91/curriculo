/*
Nombre completo: act.export.js
Ruta o ubicación: /actas/act.export.js
Función o funciones:
- Exportar el acta en JSON
- Exportar el acta en TXT
- Descargar archivos desde el navegador
*/

function actDownloadBlob(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function actBuildFilename(state, extension) {
  const carrera = state?.seleccion?.carreraId || "sin_carrera";
  const nivel = state?.seleccion?.nivelId || "sin_nivel";
  const materia = state?.seleccion?.materiaId || "sin_materia";
  return `acta_${carrera}_${nivel}_${materia}.${extension}`;
}

function actExportJson(state) {
  const filename = actBuildFilename(state, "json");
  const content = JSON.stringify(state, null, 2);
  actDownloadBlob(filename, content, "application/json;charset=utf-8");
}

function actExportText(state) {
  const draft = state?.actaDraft || {};
  const content = [
    "ACTA DE ANÁLISIS CURRICULAR",
    "",
    `Carrera: ${draft.carreraNombre || ""}`,
    `Nivel: ${draft.nivelNombre || ""}`,
    `Asignatura: ${draft.materiaNombre || ""}`,
    `Fecha: ${draft.fechaAnalisis || ""}`,
    `Hora inicio: ${draft.horaInicio || ""}`,
    `Hora cierre: ${draft.horaCierre || ""}`,
    `Lugar: ${draft.lugar || ""}`,
    "",
    "Participantes:",
    `${draft.participantes || ""}`,
    "",
    `Objeto: ${draft.objeto || ""}`,
    "",
    `Finalidad: ${draft.finalidad || ""}`,
    "",
    `Alcance: ${draft.alcance || ""}`,
    "",
    `Observaciones: ${draft.observaciones || ""}`,
    "",
    `Decisiones adoptadas: ${draft.decisiones || ""}`,
    "",
    `Responsables: ${draft.responsables || ""}`
  ].join("\n");

  const filename = actBuildFilename(state, "txt");
  actDownloadBlob(filename, content, "text/plain;charset=utf-8");
}

export {
  actExportJson,
  actExportText
};