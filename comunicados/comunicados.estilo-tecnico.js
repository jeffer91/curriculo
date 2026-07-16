/* =========================================================
Nombre completo: comunicados.estilo-tecnico.js
Ruta: /Curriculo/comunicados/comunicados.estilo-tecnico.js
Funciones:
- Mejorar exclusivamente el diseño de las páginas técnicas del comunicado.
- Mantener completamente intacta la portada institucional.
- Diferenciar descripción, objetivo, resultados, competencias y contenidos.
- Aplicar jerarquía visual automática a los contenidos según su numeración.
- Modernizar tablas de actividades, bibliografía y resumen de asignatura.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var Plantilla = window.ComunicadosCCC.Plantilla;

  if (!Plantilla || Plantilla.__estiloTecnicoV1) return;

  var generarDocumentoOriginal = Plantilla.generarDocumento.bind(Plantilla);
  var generarMultipleOriginal = Plantilla.generarDocumentoMultiple.bind(Plantilla);

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
  }

  function clasificarContenidos(html) {
    return texto(html).replace(
      /<p class="com-pdf-contenido">([\s\S]*?)<\/p>/gi,
      function (coincidencia, contenidoHTML) {
        var inicio = texto(contenidoHTML)
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/&nbsp;/gi, " ")
          .trim();
        var numeracion = inicio.match(/^(\d+(?:\.\d+)+)/);
        var nivel = 0;

        if (numeracion) {
          nivel = Math.max(1, numeracion[1].split(".").length - 1);
          nivel = Math.min(nivel, 4);
        }

        return (
          '<p class="com-pdf-contenido com-pdf-contenido-nivel-' + nivel + '">' +
            contenidoHTML +
          "</p>"
        );
      }
    );
  }

  function cssTecnico() {
    return `
      <style id="com-estilo-tecnico-v1">
        .com-pdf-page:not(.com-pdf-portada) {
          --com-azul: #184f90;
          --com-azul-oscuro: #123e72;
          --com-azul-claro: #eaf2fb;
          --com-azul-muy-claro: #f5f9fe;
          --com-dorado: #d6b875;
          --com-dorado-claro: #fff7e6;
          --com-verde: #41765a;
          --com-verde-claro: #edf7f1;
          --com-borde: #cbd5e1;
          --com-borde-suave: #dde5ee;
          --com-texto: #172033;
          color: var(--com-texto) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-header {
          margin-bottom: 6mm !important;
          padding-bottom: 3.5mm !important;
          border-bottom: 2px solid var(--com-azul) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-body {
          color: var(--com-texto) !important;
          line-height: 1.48 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-resumen {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 3mm !important;
          margin: 0 0 7mm 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-resumen p,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-resumen.com-pdf-resumen-sin-codigo p {
          min-height: 15mm !important;
          margin: 0 !important;
          padding: 3mm 3.4mm !important;
          border: 1px solid var(--com-borde) !important;
          border-top: 3px solid var(--com-azul) !important;
          border-radius: 8px !important;
          background: var(--com-azul-muy-claro) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-resumen strong {
          margin-bottom: 1.4mm !important;
          color: var(--com-azul-oscuro) !important;
          font-size: 8.1pt !important;
          letter-spacing: .055em !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-resumen span {
          color: var(--com-texto) !important;
          font-size: 9.7pt !important;
          line-height: 1.35 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-seccion:not(.com-pdf-salto-preferido) {
          margin-bottom: 6mm !important;
          border: 1px solid var(--com-borde) !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-seccion > h1,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-unidad > h2 {
          margin: 0 !important;
          padding: 2.7mm 3.6mm !important;
          border: 0 !important;
          background: var(--com-azul-oscuro) !important;
          color: #ffffff !important;
          font-size: 10.2pt !important;
          line-height: 1.3 !important;
          letter-spacing: .035em !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-seccion:not(.com-pdf-salto-preferido) > h1 {
          border-radius: 8px 8px 0 0 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-seccion:not(.com-pdf-salto-preferido) > p {
          margin: 0 !important;
          padding: 3.6mm 4mm !important;
          color: var(--com-texto) !important;
          line-height: 1.55 !important;
          text-align: justify !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-unidad {
          margin: 0 0 7mm 0 !important;
          border: 1px solid var(--com-borde) !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          box-shadow: 0 1.2mm 3mm rgba(18, 62, 114, .08) !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-unidad > h2 {
          border-radius: 9px 9px 0 0 !important;
          font-size: 10.8pt !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo {
          margin: 0 !important;
          padding: 3.4mm 4mm !important;
          border-bottom: 1px solid var(--com-borde-suave) !important;
          color: var(--com-texto) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:last-child {
          border-bottom: 0 !important;
          border-radius: 0 0 9px 9px !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:nth-of-type(1) {
          border-left: 4px solid var(--com-azul) !important;
          background: var(--com-azul-claro) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:nth-of-type(2) {
          border-left: 4px solid var(--com-dorado) !important;
          background: var(--com-dorado-claro) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:nth-of-type(3) {
          border-left: 4px solid var(--com-verde) !important;
          background: #ffffff !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo > strong {
          display: block !important;
          margin: 0 0 1.7mm 0 !important;
          color: var(--com-azul-oscuro) !important;
          font-size: 8.7pt !important;
          line-height: 1.3 !important;
          letter-spacing: .035em !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:nth-of-type(2) > strong {
          color: #70561c !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo:nth-of-type(3) > strong {
          color: var(--com-verde) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-campo > p {
          margin: 0 !important;
          color: var(--com-texto) !important;
          line-height: 1.5 !important;
          text-align: justify !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-lista-contenidos {
          margin: 0 !important;
          padding: 0 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido {
          position: relative !important;
          margin: 0 !important;
          padding: 1.25mm 2.5mm 1.25mm 6mm !important;
          border-bottom: 1px solid #e8edf3 !important;
          color: var(--com-texto) !important;
          line-height: 1.38 !important;
          text-align: left !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido:last-child {
          border-bottom: 0 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido::before {
          content: "";
          position: absolute;
          left: 2.6mm;
          top: 3.25mm;
          width: 1.35mm;
          height: 1.35mm;
          border-radius: 50%;
          background: #8ca6c4;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-1 {
          margin-top: 1.5mm !important;
          padding: 1.8mm 3mm 1.8mm 4mm !important;
          border: 0 !important;
          border-left: 3px solid var(--com-azul) !important;
          border-radius: 5px !important;
          background: var(--com-azul-claro) !important;
          color: var(--com-azul-oscuro) !important;
          font-weight: 700 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-1::before {
          display: none !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-2 {
          padding-left: 8mm !important;
          font-weight: 600 !important;
          color: #263d59 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-2::before {
          left: 4.6mm !important;
          background: var(--com-azul) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-3,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-4 {
          padding-left: 12mm !important;
          color: #445469 !important;
          font-size: 9.2pt !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-3::before,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-contenido-nivel-4::before {
          left: 8.5mm !important;
          width: 1.1mm !important;
          height: 1.1mm !important;
          background: var(--com-dorado) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-salto-preferido {
          margin-top: 8mm !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-salto-preferido > h1 {
          margin-bottom: 3mm !important;
          border-radius: 8px !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table {
          width: 100% !important;
          border: 1px solid var(--com-borde) !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table th,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table td {
          border: 0 !important;
          border-right: 1px solid var(--com-borde) !important;
          border-bottom: 1px solid var(--com-borde) !important;
          padding: 2.5mm 2.7mm !important;
          color: var(--com-texto) !important;
          font-size: 8.7pt !important;
          line-height: 1.38 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table th:last-child,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table td:last-child {
          border-right: 0 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table tbody tr:last-child td {
          border-bottom: 0 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table th {
          background: var(--com-azul-oscuro) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          letter-spacing: .025em !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-table tbody tr:nth-child(even) td {
          background: var(--com-azul-muy-claro) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-actividades td:nth-child(1) {
          background: var(--com-azul-claro) !important;
          color: var(--com-azul-oscuro) !important;
          font-weight: 700 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-actividades td:nth-child(2) {
          color: var(--com-azul-oscuro) !important;
          font-weight: 600 !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-bibliografia-item {
          margin: 0 0 4mm 0 !important;
          padding: 3.5mm 4mm !important;
          border: 1px solid var(--com-borde) !important;
          border-left: 4px solid var(--com-azul) !important;
          border-radius: 8px !important;
          background: var(--com-azul-muy-claro) !important;
          color: var(--com-texto) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-bibliografia-item p {
          margin: 0 0 2mm 0 !important;
          color: var(--com-texto) !important;
          line-height: 1.48 !important;
          text-align: justify !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-bibliografia-item p:first-child strong {
          color: var(--com-azul-oscuro) !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-bibliografia-item p:nth-child(2) strong {
          color: #70561c !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-footer {
          margin-top: 8mm !important;
          padding-top: 3.5mm !important;
          border-top: 2px solid var(--com-azul) !important;
          color: #52647b !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-footer strong {
          color: var(--com-azul-oscuro) !important;
        }

        @media print {
          .com-pdf-page:not(.com-pdf-portada) .com-pdf-table,
          .com-pdf-page:not(.com-pdf-portada) .com-pdf-unidad,
          .com-pdf-page:not(.com-pdf-portada) .com-pdf-bibliografia-item {
            box-shadow: none !important;
          }
        }
      </style>
    `;
  }

  function ajustarDocumento(documento) {
    if (!documento || typeof documento !== "object") return documento;
    if (documento.__estiloTecnicoV1) return documento;

    documento.html = clasificarContenidos(documento.html) + cssTecnico();
    documento.__estiloTecnicoV1 = true;

    return documento;
  }

  Plantilla.generarDocumento = function (detalle, reserva, config) {
    return ajustarDocumento(
      generarDocumentoOriginal(detalle, reserva, config)
    );
  };

  Plantilla.generarDocumentoMultiple = function (items, config) {
    var resultado = generarMultipleOriginal(items, config);
    var documentos = resultado && Array.isArray(resultado.documentos)
      ? resultado.documentos.map(ajustarDocumento)
      : [];

    if (resultado && typeof resultado === "object") {
      resultado.documentos = documentos;
      resultado.html = documentos.map(function (documento) {
        return documento.html || "";
      }).join("");
    }

    return resultado;
  };

  Plantilla.__estiloTecnicoV1 = true;

  console.info("[ComunicadosCCC.EstiloTecnico] Diseño técnico institucional activo; portada intacta.");
})(window);
