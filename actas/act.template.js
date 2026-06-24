/*
Nombre completo: act.template.js
Ruta o ubicación: /actas/act.template.js
Función o funciones:
- Construir la vista previa HTML del acta
- Mostrar el documento preliminar de forma legible y organizada
*/

function actEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function actBlock(title, value) {
  return `
    <section class="act-preview-block">
      <h3>${actEscapeHtml(title)}</h3>
      <p>${actEscapeHtml(value || "N/D")}</p>
    </section>
  `;
}

function actFormatMultilineList(value) {
  const items = String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.length) {
    return "<p>N/D</p>";
  }

  return `
    <ul class="act-preview-list">
      ${items.map((item) => `<li>${actEscapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function actTemplateBuildPreview(actaDraft, fichaData, peaData) {
  const draft = actaDraft || {};

  return `
    <article class="act-preview-doc">
      <header class="act-preview-head">
        <h2>Acta de análisis curricular</h2>
        <p>Documento preliminar generado desde el módulo de actas.</p>
      </header>

      ${actBlock("Carrera", draft.carreraNombre)}
      ${actBlock("Nivel", draft.nivelNombre)}
      ${actBlock("Asignatura", draft.materiaNombre)}
      ${actBlock("Fecha del análisis", draft.fechaAnalisis)}
      ${actBlock("Hora de inicio", draft.horaInicio)}
      ${actBlock("Hora de cierre", draft.horaCierre)}
      ${actBlock("Lugar o plataforma", draft.lugar)}

      <section class="act-preview-block">
        <h3>Participantes</h3>
        ${actFormatMultilineList(draft.participantes)}
      </section>

      ${actBlock("Objeto del acta", draft.objeto)}
      ${actBlock("Finalidad", draft.finalidad)}
      ${actBlock("Alcance del análisis", draft.alcance)}
      ${actBlock("Observaciones", draft.observaciones)}
      ${actBlock("Decisiones adoptadas", draft.decisiones)}
      ${actBlock("Responsables", draft.responsables)}

      ${actBlock("Ficha relacionada", fichaData?.key || "N/D")}
      ${actBlock("Fuente base", peaData?.fuente || "N/D")}
    </article>
  `;
}

export {
  actTemplateBuildPreview
};