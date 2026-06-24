/*
Nombre completo: fch.template.js
Ruta o ubicación: /fichas/fch.template.js
Función o funciones:
- Construir la vista previa HTML de la ficha
- Mostrar un formato legible para revisión antes de guardar o exportar
*/

function fchEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fchBlock(title, value) {
  return `
    <section class="fch-preview-block">
      <h3>${fchEscapeHtml(title)}</h3>
      <p>${fchEscapeHtml(value || "N/D")}</p>
    </section>
  `;
}

function fchTemplateBuildPreview(fichaDraft, peaData) {
  const draft = fichaDraft || {};
  const base = peaData || {};

  const unidades = Array.isArray(base.unidades) && base.unidades.length
    ? `<ul class="fch-preview-list">
        ${base.unidades.map((item) => `<li>${fchEscapeHtml(item)}</li>`).join("")}
      </ul>`
    : "<p>N/D</p>";

  return `
    <article class="fch-preview-doc">
      <header class="fch-preview-head">
        <h2>Ficha individual de análisis</h2>
        <p>Documento preliminar generado desde el módulo de fichas.</p>
      </header>

      ${fchBlock("Carrera", draft.carreraNombre)}
      ${fchBlock("Nivel", draft.nivelNombre)}
      ${fchBlock("Asignatura", draft.materiaNombre)}
      ${fchBlock("Código de asignatura", draft.codigoMateria)}
      ${fchBlock("Objetivo", draft.objetivo)}
      ${fchBlock("Observaciones", draft.observaciones)}
      ${fchBlock("Decisiones adoptadas", draft.decisiones)}
      ${fchBlock("Responsables", draft.responsables)}

      <section class="fch-preview-block">
        <h3>Unidades detectadas desde PEA</h3>
        ${unidades}
      </section>
    </article>
  `;
}

export {
  fchTemplateBuildPreview
};