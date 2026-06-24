/*
Nombre completo: fch.export.js
Ruta o ubicación: /fichas/fch.export.js
Función o funciones:
- Exportar la ficha en JSON
- Exportar la ficha en TXT
- Descargar archivos directamente desde el navegador
*/

function fchDownloadBlob(filename, content, mimeType) {
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

function fchBuildFilename(state, extension) {
  const carrera = state?.seleccion?.carreraId || "sin_carrera";
  const nivel = state?.seleccion?.nivelId || "sin_nivel";
  const materia = state?.seleccion?.materiaId || "sin_materia";
  return `ficha_${carrera}_${nivel}_${materia}.${extension}`;
}

function fchExportJson(state) {
  const filename = fchBuildFilename(state, "json");
  const content = JSON.stringify(state, null, 2);
  fchDownloadBlob(filename, content, "application/json;charset=utf-8");
}

function fchExportText(state) {
  const draft = state?.fichaDraft || {};
  const content = [
    "FICHA INDIVIDUAL DE ANÁLISIS",
    "",
    `Carrera: ${draft.carreraNombre || ""}`,
    `Nivel: ${draft.nivelNombre || ""}`,
    `Asignatura: ${draft.materiaNombre || ""}`,
    `Código: ${draft.codigoMateria || ""}`,
    "",
    `Objetivo: ${draft.objetivo || ""}`,
    "",
    `Observaciones: ${draft.observaciones || ""}`,
    "",
    `Decisiones adoptadas: ${draft.decisiones || ""}`,
    "",
    `Responsables: ${draft.responsables || ""}`
  ].join("\n");

  const filename = fchBuildFilename(state, "txt");
  fchDownloadBlob(filename, content, "text/plain;charset=utf-8");
}

export {
  fchExportJson,
  fchExportText
};