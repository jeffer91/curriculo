/* =========================================================
Nombre completo: comunicados.pdf.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.pdf.js
Función o funciones:
- Construir el documento HTML institucional listo para PDF.
- Aplicar formato institucional en negro basado en comunicado/memorando.
- Mantener el logo original sin filtros, recoloración ni recortes.
- Enviar el HTML al puente seguro de Electron.
- Guardar y verificar el PDF directamente en la carpeta Descargas.
- Permitir generar PDF individual y un único PDF global.
- Usar impresión del navegador como respaldo automático si Electron falla.
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
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/[^\w\s.()-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s/g, "_")
      .replace(/\.+$/g, "")
      .slice(0, 140) || "comunicado";
  }

  function fechaArchivo() {
    var fecha = new Date();

    return [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0"),
      String(fecha.getHours()).padStart(2, "0"),
      String(fecha.getMinutes()).padStart(2, "0"),
      String(fecha.getSeconds()).padStart(2, "0")
    ].join("");
  }

  function asegurarExtensionPDF(nombre) {
    nombre = limpiarNombreArchivo(nombre || "comunicado");

    if (!/\.pdf$/i.test(nombre)) {
      nombre += ".pdf";
    }

    return nombre;
  }

  function electronDisponible() {
    return !!(
      window.CurriculoElectron &&
      window.CurriculoElectron.isElectron === true &&
      typeof window.CurriculoElectron.guardarPDFEnDescargas === "function"
    );
  }

  async function diagnosticarEntorno() {
    var resultado = {
      ok: true,
      electronDisponible: electronDisponible(),
      bridgeVersion: window.CurriculoElectron
        ? texto(window.CurriculoElectron.bridgeVersion || "")
        : "",
      userAgent: navigator.userAgent || ""
    };

    if (
      electronDisponible() &&
      typeof window.CurriculoElectron.diagnosticarPDF === "function"
    ) {
      var diagnostico = await window.CurriculoElectron.diagnosticarPDF();
      resultado.electron = diagnostico || null;

      if (!diagnostico || diagnostico.ok !== true) {
        resultado.ok = false;
        resultado.mensaje = diagnostico && diagnostico.mensaje
          ? diagnostico.mensaje
          : "El puente de PDF de Electron no respondió correctamente.";
      }
    }

    return resultado;
  }

  function obtenerCSSPDF() {
    return `
      @page {
        size: A4;
        margin: 14mm 17mm 15mm 17mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        background: #ffffff;
        color: #000000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        line-height: 1.38;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        counter-reset: page;
      }

      .com-pdf-page {
        width: 100%;
        min-height: 267mm;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        color: #000000;
        page-break-after: always;
        break-after: page;
      }

      .com-pdf-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .com-pdf-header {
        width: 100%;
        margin: 0 0 8mm 0;
        padding: 0;
        text-align: left;
      }

      .com-pdf-logo {
        display: block;
        width: 66mm;
        max-width: 66mm;
        height: auto;
        max-height: 28mm;
        margin: 0;
        padding: 0;
        object-fit: contain;
        object-position: left top;
      }

      .com-pdf-document-number {
        margin: 0 0 10mm 0;
        text-align: center;
        color: #000000;
        font-size: 12px;
        line-height: 1.25;
        font-weight: 400;
      }

      .com-pdf-document-number strong {
        font-weight: 700;
      }

      .com-pdf-document-number span {
        font-weight: 700;
      }

      .com-pdf-routing {
        width: 100%;
        margin: 0 0 9mm 0;
        border-collapse: separate;
        border-spacing: 0 4.5mm;
        table-layout: fixed;
        color: #000000;
      }

      .com-pdf-routing th,
      .com-pdf-routing td {
        border: 0;
        padding: 0;
        vertical-align: top;
        color: #000000;
        background: transparent;
      }

      .com-pdf-routing th {
        width: 22mm;
        text-align: left;
        font-size: 11px;
        line-height: 1.3;
        font-weight: 700;
      }

      .com-pdf-routing-colon {
        width: 7mm;
        text-align: center;
        font-weight: 700;
      }

      .com-pdf-routing-value {
        width: auto;
        text-align: left;
        font-size: 11px;
        line-height: 1.3;
        font-weight: 600;
        text-transform: uppercase;
        overflow-wrap: anywhere;
      }

      .com-pdf-body {
        width: 100%;
        color: #000000;
        font-size: 11px;
        line-height: 1.42;
      }

      .com-pdf-body p {
        margin: 0 0 4mm 0;
        color: #000000;
        text-align: justify;
        orphans: 3;
        widows: 3;
      }

      .com-pdf-body h2 {
        margin: 6mm 0 2.5mm 0;
        padding: 0 0 1.3mm 0;
        border: 0;
        border-bottom: 0.35mm solid #000000;
        background: #ffffff;
        color: #000000;
        font-size: 11px;
        line-height: 1.25;
        font-weight: 700;
        text-transform: uppercase;
        page-break-after: avoid;
        break-after: avoid;
      }

      .com-pdf-body h3 {
        margin: 4.5mm 0 2mm 0;
        padding: 0;
        color: #000000;
        font-size: 11px;
        line-height: 1.3;
        font-weight: 700;
        page-break-after: avoid;
        break-after: avoid;
      }

      .com-pdf-table {
        width: 100%;
        margin: 2.5mm 0 4mm 0;
        border-collapse: collapse;
        table-layout: fixed;
        color: #000000;
        page-break-inside: auto;
        break-inside: auto;
      }

      .com-pdf-table thead {
        display: table-header-group;
      }

      .com-pdf-table tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-table th,
      .com-pdf-table td {
        border: 0.25mm solid #000000;
        padding: 2mm 2.2mm;
        vertical-align: top;
        color: #000000;
        background: #ffffff;
        font-size: 10px;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .com-pdf-table th {
        text-align: left;
        font-weight: 700;
      }

      .com-pdf-datos th {
        width: 34%;
      }

      .com-pdf-actividades th:nth-child(1),
      .com-pdf-actividades td:nth-child(1) {
        width: 20%;
      }

      .com-pdf-actividades th:nth-child(2),
      .com-pdf-actividades td:nth-child(2) {
        width: 50%;
      }

      .com-pdf-actividades th:nth-child(3),
      .com-pdf-actividades td:nth-child(3) {
        width: 30%;
      }

      .com-pdf-unidades {
        width: 100%;
      }

      .com-pdf-unidad {
        margin: 0 0 5mm 0;
        padding: 0;
        border: 0;
        background: #ffffff;
        color: #000000;
        page-break-inside: auto;
        break-inside: auto;
      }

      .com-pdf-unidad > p {
        margin-bottom: 2mm;
      }

      .com-pdf-muted {
        color: #000000;
        font-style: italic;
      }

      .com-pdf-closing {
        margin-top: 7mm !important;
      }

      .com-pdf-signature {
        margin-top: 9mm;
        color: #000000;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-signature p {
        margin: 0 0 4mm 0;
      }

      .com-pdf-signature-space {
        height: 13mm;
      }

      .com-pdf-signature strong,
      .com-pdf-signature span {
        display: block;
        color: #000000;
        line-height: 1.3;
      }

      .com-pdf-signature strong {
        max-width: 95mm;
        font-size: 11px;
        font-weight: 700;
      }

      .com-pdf-signature span {
        margin-top: 0.5mm;
        font-size: 10.5px;
        font-weight: 700;
      }

      .com-pdf-footer {
        margin-top: auto;
        padding-top: 8mm;
        color: #000000;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-nota {
        margin: 0 0 4mm 0;
        padding: 0;
        color: #000000;
        background: #ffffff;
        border: 0;
        font-size: 9.5px;
        line-height: 1.3;
        text-align: justify;
      }

      .com-pdf-footer-line {
        width: 100%;
        height: 0;
        margin: 0 0 2mm 0;
        border-top: 0.25mm solid #000000;
      }

      .com-pdf-footer-institution {
        margin: 0;
        color: #000000;
        font-size: 8.5px;
        line-height: 1.2;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.02em;
      }

      @media print {
        html,
        body {
          width: 210mm;
          min-height: 297mm;
        }

        .com-pdf-page {
          min-height: 267mm;
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escaparHTML(titulo)}</title>
  <style>${obtenerCSSPDF()}</style>
</head>
<body>
  ${htmlComunicados}
</body>
</html>`;
  }

  function esperarRecursosImpresion(frameWindow) {
    return new Promise(function (resolve) {
      var terminado = false;
      var doc = frameWindow.document;
      var imagenes = Array.prototype.slice.call(doc.images || []);

      function finalizar() {
        if (terminado) return;
        terminado = true;
        resolve();
      }

      var promesasImagenes = imagenes.map(function (imagen) {
        if (imagen.complete) return Promise.resolve();

        return new Promise(function (resolverImagen) {
          var lista = false;

          function terminarImagen() {
            if (lista) return;
            lista = true;
            resolverImagen();
          }

          imagen.addEventListener("load", terminarImagen, { once: true });
          imagen.addEventListener("error", terminarImagen, { once: true });
          setTimeout(terminarImagen, 4000);
        });
      });

      var promesaFuentes = doc.fonts && doc.fonts.ready
        ? doc.fonts.ready.catch(function () {})
        : Promise.resolve();

      Promise.all([Promise.all(promesasImagenes), promesaFuentes]).then(function () {
        setTimeout(finalizar, 250);
      });

      setTimeout(finalizar, 5500);
    });
  }

  function imprimirEnNavegador(htmlFinal, nombreArchivo, errorElectron) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement("iframe");
      var timeoutId = null;
      var finalizado = false;

      iframe.setAttribute("title", "Impresión de comunicado");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";

      function limpiar() {
        if (timeoutId) clearTimeout(timeoutId);

        setTimeout(function () {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }

      function fallar(error) {
        if (finalizado) return;
        finalizado = true;
        limpiar();
        reject(error);
      }

      iframe.onload = async function () {
        if (finalizado) return;

        try {
          var win = iframe.contentWindow;

          if (!win || !win.document) {
            throw new Error("No se pudo abrir la vista de impresión.");
          }

          win.document.title = nombreArchivo;
          await esperarRecursosImpresion(win);

          win.focus();
          win.print();

          finalizado = true;
          limpiar();

          resolve({
            ok: true,
            modo: "navegador",
            nombreArchivo: nombreArchivo,
            fallbackElectron: !!errorElectron,
            errorElectron: errorElectron ? texto(errorElectron.message || errorElectron) : "",
            mensaje: errorElectron
              ? "Electron no pudo guardar directamente. Se abrió la impresión de respaldo; selecciona Guardar como PDF."
              : "Se abrió la ventana de impresión. Selecciona Guardar como PDF."
          });
        } catch (error) {
          fallar(error);
        }
      };

      timeoutId = setTimeout(function () {
        fallar(new Error("La vista de impresión tardó demasiado en abrirse."));
      }, 12000);

      document.body.appendChild(iframe);
      iframe.srcdoc = htmlFinal;
    });
  }

  async function mostrarArchivoGenerado(resultado) {
    if (
      !resultado ||
      !resultado.ruta ||
      !window.CurriculoElectron ||
      typeof window.CurriculoElectron.mostrarArchivo !== "function"
    ) {
      return null;
    }

    try {
      return await window.CurriculoElectron.mostrarArchivo(resultado.ruta);
    } catch (error) {
      console.warn("[ComunicadosCCC.PDF] No se pudo mostrar el PDF en el Explorador:", error);
      return null;
    }
  }

  async function guardarHTMLComoPDF(htmlComunicados, opciones) {
    opciones = opciones || {};

    if (!texto(htmlComunicados)) {
      throw new Error("No se recibió contenido HTML para generar PDF.");
    }

    var titulo = texto(opciones.titulo || "Comunicado institucional");
    var nombreArchivo = asegurarExtensionPDF(
      opciones.nombreArchivo || "comunicado_" + fechaArchivo()
    );

    var htmlFinal = construirDocumentoHTML(htmlComunicados, {
      titulo: titulo
    });

    if (!electronDisponible()) {
      return await imprimirEnNavegador(htmlFinal, nombreArchivo, null);
    }

    try {
      var diagnostico = await diagnosticarEntorno();

      if (!diagnostico.ok) {
        throw new Error(
          diagnostico.mensaje ||
          "El puente de PDF de Electron no está disponible."
        );
      }

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

      if (!resultado.nombreArchivo || !resultado.ruta || Number(resultado.bytes || 0) < 100) {
        throw new Error("Electron respondió, pero no confirmó un PDF válido en el disco.");
      }

      if (opciones.mostrarArchivo !== false) {
        await mostrarArchivoGenerado(resultado);
      }

      return resultado;
    } catch (error) {
      console.error("[ComunicadosCCC.PDF] Falló la generación directa en Electron:", error);

      if (opciones.permitirFallbackNavegador === false) {
        throw error;
      }

      return await imprimirEnNavegador(htmlFinal, nombreArchivo, error);
    }
  }

  async function generarPDFDocumento(documento, opciones) {
    opciones = opciones || {};

    if (!documento || !documento.html) {
      throw new Error("No se recibió un documento válido para generar PDF.");
    }

    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo ||
      (documento.numeroComunicado || "COMUNICADO") + "_" +
      (documento.nombreAsignatura || "ASIGNATURA")
    );

    return await guardarHTMLComoPDF(documento.html, {
      titulo: "Comunicado " + (documento.numeroComunicado || ""),
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  }

  async function generarPDFMultiple(resultadoMultiple, opciones) {
    opciones = opciones || {};

    if (!resultadoMultiple || !resultadoMultiple.html) {
      throw new Error("No se recibió un documento múltiple válido para generar PDF.");
    }

    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo || "comunicados_institucionales"
    );

    return await guardarHTMLComoPDF(resultadoMultiple.html, {
      titulo: opciones.titulo || "Comunicados institucionales",
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  }

  NS.PDF = {
    obtenerCSSPDF: obtenerCSSPDF,
    construirDocumentoHTML: construirDocumentoHTML,
    guardarHTMLComoPDF: guardarHTMLComoPDF,
    generarPDFDocumento: generarPDFDocumento,
    generarPDFMultiple: generarPDFMultiple,
    limpiarNombreArchivo: limpiarNombreArchivo,
    electronDisponible: electronDisponible,
    diagnosticarEntorno: diagnosticarEntorno,
    mostrarArchivoGenerado: mostrarArchivoGenerado
  };
})(window, document);
