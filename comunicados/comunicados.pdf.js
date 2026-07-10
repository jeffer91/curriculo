/* =========================================================
Nombre completo: comunicados.pdf.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.pdf.js
Función o funciones:
- Generar documento institucional desde HTML.
- Enviar el HTML a Electron para convertirlo a PDF.
- Guardar el PDF directamente en la carpeta Descargas.
- Aplicar estilos institucionales al comunicado.
- Permitir generar un PDF individual por materia.
- Permitir generar un solo documento con varios comunicados, uno por página.
========================================================= */

(function (window, document) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escaparHTML(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function limpiarNombreArchivo(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s/g, "_")
      .slice(0, 120) || "comunicado";
  }

  function fechaArchivo() {
    var d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0")
    ].join("");
  }

  function asegurarExtensionPDF(nombre) {
    nombre = limpiarNombreArchivo(nombre || "comunicado");

    if (!/\.pdf$/i.test(nombre)) {
      nombre += ".pdf";
    }

    return nombre;
  }

  function obtenerCSSPDF() {
    return `
      @page {
        size: A4;
        margin: 18mm 16mm 18mm 16mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }

      body {
        counter-reset: page;
      }

      .com-pdf-page {
        width: 100%;
        min-height: 100vh;
        page-break-after: always;
        break-after: page;
        padding: 0;
        background: #ffffff;
      }

      .com-pdf-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .com-pdf-header {
        width: 100%;
        margin: 0 0 18px 0;
        padding: 0 0 12px 0;
        border-bottom: 2px solid #d6b875;
        text-align: center;
      }

      .com-pdf-logo {
        width: 100%;
        max-height: 92px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
      }

      .com-pdf-title {
        margin: 20px 0 18px 0;
        text-align: center;
        font-size: 22px;
        line-height: 1.1;
        letter-spacing: 0.08em;
        color: #111827;
        font-weight: 900;
      }

      .com-pdf-body {
        font-size: 12px;
        color: #111827;
      }

      .com-pdf-body p {
        margin: 0 0 9px 0;
        text-align: justify;
      }

      .com-pdf-body h2 {
        margin: 16px 0 8px 0;
        padding: 7px 9px;
        background: #f3f4f6;
        border-left: 4px solid #184f90;
        color: #111827;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .com-pdf-body h4 {
        margin: 12px 0 7px 0;
        color: #184f90;
        font-size: 12.5px;
        line-height: 1.25;
        font-weight: 900;
      }

      .com-pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 12px 0;
        table-layout: fixed;
      }

      .com-pdf-table th,
      .com-pdf-table td {
        border: 1px solid #d1d5db;
        padding: 6px 7px;
        vertical-align: top;
        word-break: break-word;
      }

      .com-pdf-table th {
        width: 28%;
        background: #f9fafb;
        color: #111827;
        text-align: left;
        font-weight: 900;
      }

      .com-pdf-actividades th {
        background: #eef4fb;
        color: #111827;
      }

      .com-pdf-actividades th:nth-child(1) {
        width: 18%;
      }

      .com-pdf-actividades th:nth-child(2) {
        width: 52%;
      }

      .com-pdf-actividades th:nth-child(3) {
        width: 30%;
      }

      .com-pdf-unidad {
        margin: 10px 0 14px 0;
        padding: 9px 10px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #ffffff;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-unidad p {
        margin-bottom: 6px;
      }

      .com-pdf-muted {
        color: #6b7280;
        font-style: italic;
      }

      .com-pdf-footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid #d1d5db;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-unidad-responsable {
        margin-bottom: 12px;
        text-align: center;
        font-weight: 900;
        font-size: 12px;
        color: #111827;
      }

      .com-pdf-meta {
        margin-top: 8px;
        text-align: left;
      }

      .com-pdf-meta p {
        margin: 0 0 4px 0;
        font-size: 11.5px;
      }

      .com-pdf-meta span {
        font-weight: 900;
        color: #c42626;
      }

      .com-pdf-nota {
        margin-top: 12px;
        padding: 8px 10px;
        background: #f9fafb;
        border-left: 3px solid #d6b875;
        font-size: 11.5px;
      }

      .com-pdf-watermark {
        position: fixed;
        right: 12mm;
        bottom: 8mm;
        color: #9ca3af;
        font-size: 9px;
      }

      @media print {
        html,
        body {
          width: 210mm;
          min-height: 297mm;
        }

        .com-pdf-page {
          min-height: auto;
        }
      }
    `;
  }

  function construirDocumentoHTML(htmlComunicados, opciones) {
    opciones = opciones || {};

    var titulo = texto(opciones.titulo || "Comunicado institucional");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escaparHTML(titulo)}</title>
  <style>${obtenerCSSPDF()}</style>
</head>
<body>
  ${htmlComunicados}
</body>
</html>`;
  }

  async function guardarHTMLComoPDF(htmlComunicados, opciones) {
    opciones = opciones || {};

    if (!htmlComunicados) {
      throw new Error("No se recibió contenido HTML para generar PDF.");
    }

    if (
      !window.CurriculoElectron ||
      typeof window.CurriculoElectron.guardarPDFEnDescargas !== "function"
    ) {
      throw new Error("La descarga directa a Descargas requiere ejecutar la app en Electron y tener actualizado electron/preload.js.");
    }

    var titulo = texto(opciones.titulo || "Comunicado institucional");
    var nombreArchivo = asegurarExtensionPDF(
      opciones.nombreArchivo || "comunicado_" + fechaArchivo()
    );

    var htmlFinal = construirDocumentoHTML(htmlComunicados, {
      titulo: titulo,
      nombreArchivo: nombreArchivo
    });

    var resultado = await window.CurriculoElectron.guardarPDFEnDescargas({
      html: htmlFinal,
      titulo: titulo,
      nombreArchivo: nombreArchivo
    });

    if (!resultado || resultado.ok !== true) {
      throw new Error(
        resultado && resultado.mensaje
          ? resultado.mensaje
          : "No se pudo guardar el PDF en Descargas."
      );
    }

    return resultado;
  }

  async function generarPDFDocumento(documento, opciones) {
    opciones = opciones || {};

    if (!documento || !documento.html) {
      throw new Error("No se recibió un documento válido para generar PDF.");
    }

    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo ||
      documento.numeroComunicado + "_" + documento.nombreAsignatura
    );

    return await guardarHTMLComoPDF(documento.html, {
      titulo: "Comunicado " + (documento.numeroComunicado || ""),
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf"
    });
  }

  async function generarPDFMultiple(resultadoMultiple, opciones) {
    opciones = opciones || {};

    if (!resultadoMultiple || !resultadoMultiple.html) {
      throw new Error("No se recibió un documento múltiple válido para generar PDF.");
    }

    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo ||
      "comunicados_institucionales"
    );

    return await guardarHTMLComoPDF(resultadoMultiple.html, {
      titulo: "Comunicados institucionales",
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf"
    });
  }

  NS.PDF = {
    obtenerCSSPDF: obtenerCSSPDF,
    construirDocumentoHTML: construirDocumentoHTML,
    guardarHTMLComoPDF: guardarHTMLComoPDF,
    generarPDFDocumento: generarPDFDocumento,
    generarPDFMultiple: generarPDFMultiple,
    limpiarNombreArchivo: limpiarNombreArchivo
  };
})(window, document);