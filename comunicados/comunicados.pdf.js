/* =========================================================
Nombre completo: comunicados.pdf.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.pdf.js
Función o funciones:
- Construir el HTML A4 del comunicado institucional.
- Aplicar un diseño sobrio en negro, basado en el formato institucional.
- Mantener todos los contenidos y permitir que continúen entre páginas.
- Generar PDF individual o global con Electron.
- Usar la impresión del navegador como respaldo.
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
    var d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0")
    ].join("");
  }

  function asegurarExtensionPDF(nombre) {
    nombre = limpiarNombreArchivo(nombre || "comunicado");
    if (!/\.pdf$/i.test(nombre)) nombre += ".pdf";
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
        margin: 12mm 16mm 15mm 16mm;
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
        font-size: 9.8pt;
        line-height: 1.4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .com-pdf-page {
        width: 100%;
        margin: 0;
        padding: 0;
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
        margin: 0 0 7mm 0;
        padding: 0 0 4mm 0;
        border-bottom: 1px solid #000000;
      }

      .com-pdf-logo-wrap {
        width: 100%;
        min-height: 24mm;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      }

      .com-pdf-logo {
        display: block;
        width: 58mm;
        max-width: 58mm;
        height: auto;
        max-height: 24mm;
        margin: 0;
        padding: 0;
        object-fit: contain;
        object-position: left top;
        opacity: 1;
        filter: none;
        transform: none;
      }

      .com-pdf-numero {
        margin: 2.5mm 0 0 0;
        text-align: center;
        font-size: 10.8pt;
        line-height: 1.25;
        font-weight: 700;
        color: #000000;
      }

      .com-pdf-body {
        width: 100%;
        color: #000000;
      }

      .com-pdf-body p {
        margin: 0;
        color: #000000;
      }

      .com-pdf-resumen {
        display: grid;
        grid-template-columns: 1fr 1fr;
        width: 100%;
        margin: 0 0 6mm 0;
        border: 1px solid #000000;
      }

      .com-pdf-resumen p {
        min-height: 16mm;
        padding: 3mm 3.5mm;
        border-right: 1px solid #000000;
        border-bottom: 1px solid #000000;
        text-align: left;
      }

      .com-pdf-resumen p:nth-child(2n) {
        border-right: 0;
      }

      .com-pdf-resumen p:nth-last-child(-n + 2) {
        border-bottom: 0;
      }

      .com-pdf-resumen strong {
        display: block;
        margin: 0 0 1.2mm 0;
        font-size: 8.2pt;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .com-pdf-resumen span {
        display: block;
        font-size: 10pt;
      }

      .com-pdf-seccion,
      .com-pdf-unidad {
        width: 100%;
        margin: 0 0 6mm 0;
        color: #000000;
      }

      .com-pdf-seccion > h1,
      .com-pdf-unidad > h2 {
        margin: 0 0 2.5mm 0;
        padding: 2.2mm 3mm;
        border: 1px solid #000000;
        background: #ffffff;
        color: #000000;
        font-size: 10.2pt;
        line-height: 1.25;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        page-break-after: avoid;
        break-after: avoid;
      }

      .com-pdf-seccion > p {
        margin: 0;
        text-align: justify;
      }

      .com-pdf-unidad {
        border: 1px solid #000000;
        page-break-inside: auto;
        break-inside: auto;
      }

      .com-pdf-unidad > h2 {
        margin: 0;
        border-width: 0 0 1px 0;
      }

      .com-pdf-campo {
        margin: 0;
        padding: 3mm;
        border-bottom: 1px solid #bdbdbd;
      }

      .com-pdf-campo:last-child {
        border-bottom: 0;
      }

      .com-pdf-campo > strong {
        display: block;
        margin: 0 0 1.5mm 0;
        font-size: 8.4pt;
        line-height: 1.25;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        page-break-after: avoid;
        break-after: avoid;
      }

      .com-pdf-campo > p {
        text-align: justify;
      }

      .com-pdf-lista-contenidos {
        width: 100%;
        margin: 0;
        padding: 0;
      }

      .com-pdf-contenido {
        margin: 0 0 1.35mm 0 !important;
        padding: 0;
        text-align: left !important;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-contenido:last-child {
        margin-bottom: 0 !important;
      }

      .com-pdf-table {
        width: 100%;
        margin: 0;
        border-collapse: collapse;
        border-spacing: 0;
        table-layout: fixed;
        color: #000000;
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
        border: 1px solid #000000;
        padding: 2.1mm 2.4mm;
        vertical-align: top;
        background: #ffffff;
        color: #000000;
        font-size: 8.8pt;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .com-pdf-table th {
        font-weight: 700;
        text-align: left;
      }

      .com-pdf-actividades th:nth-child(1),
      .com-pdf-actividades td:nth-child(1) {
        width: 7%;
        text-align: center;
      }

      .com-pdf-actividades th:nth-child(2),
      .com-pdf-actividades td:nth-child(2) {
        width: 20%;
      }

      .com-pdf-actividades th:nth-child(3),
      .com-pdf-actividades td:nth-child(3) {
        width: 23%;
      }

      .com-pdf-actividades th:nth-child(4),
      .com-pdf-actividades td:nth-child(4) {
        width: 50%;
      }

      .com-pdf-bibliografia-item {
        margin: 0 0 3.5mm 0;
        padding: 3mm;
        border: 1px solid #000000;
        color: #000000;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-bibliografia-item p {
        margin: 0 0 1.8mm 0;
        text-align: justify;
      }

      .com-pdf-bibliografia-item p:last-child {
        margin-bottom: 0;
      }

      .com-pdf-footer {
        margin: 8mm 0 0 0;
        padding: 3mm 0 0 0;
        border-top: 1px solid #000000;
        display: flex;
        justify-content: space-between;
        gap: 8mm;
        font-size: 8pt;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-pdf-footer strong {
        text-transform: uppercase;
      }

      .com-pdf-footer span {
        text-align: right;
      }

      .com-pdf-vacio {
        font-style: italic;
      }

      @media print {
        html,
        body {
          width: 210mm;
          min-height: 297mm;
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

      var promesasImagenes = imagenes.map(function (img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();

        return new Promise(function (resolverImagen) {
          var lista = false;

          function terminarImagen() {
            if (lista) return;
            lista = true;
            resolverImagen();
          }

          img.addEventListener("load", terminarImagen, { once: true });
          img.addEventListener("error", terminarImagen, { once: true });
          setTimeout(terminarImagen, 5000);
        });
      });

      var promesaFuentes = doc.fonts && doc.fonts.ready
        ? doc.fonts.ready.catch(function () {})
        : Promise.resolve();

      Promise.all([Promise.all(promesasImagenes), promesaFuentes]).then(function () {
        setTimeout(finalizar, 250);
      });

      setTimeout(finalizar, 6500);
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
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
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
              ? "Electron no pudo guardar directamente. Se abrió la impresión de respaldo."
              : "Se abrió la ventana de impresión. Selecciona Guardar como PDF."
          });
        } catch (error) {
          fallar(error);
        }
      };

      timeoutId = setTimeout(function () {
        fallar(new Error("La vista de impresión tardó demasiado en abrirse."));
      }, 14000);

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
      console.warn("[ComunicadosCCC.PDF] No se pudo mostrar el PDF:", error);
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
    var htmlFinal = construirDocumentoHTML(htmlComunicados, { titulo: titulo });

    if (!electronDisponible()) {
      return await imprimirEnNavegador(htmlFinal, nombreArchivo, null);
    }

    try {
      var diagnostico = await diagnosticarEntorno();

      if (!diagnostico.ok) {
        throw new Error(diagnostico.mensaje || "El puente de PDF no está disponible.");
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
        throw new Error("Electron no confirmó un PDF válido en el disco.");
      }

      if (opciones.mostrarArchivo !== false) {
        await mostrarArchivoGenerado(resultado);
      }

      return resultado;
    } catch (error) {
      console.error("[ComunicadosCCC.PDF] Falló la generación directa:", error);

      if (opciones.permitirFallbackNavegador === false) throw error;

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
