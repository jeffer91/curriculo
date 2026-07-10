/* =========================================================
Nombre completo: comunicados.pdf.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.pdf.js
Función o funciones:
- Construir el documento HTML institucional listo para PDF.
- Enviar el HTML al puente seguro de Electron.
- Guardar y verificar el PDF directamente en la carpeta Descargas.
- Permitir generar un PDF individual por materia.
- Permitir generar un único PDF global con varios comunicados.
- Usar impresión del navegador como respaldo automático si Electron falla.
- Exponer diagnóstico del entorno de generación.
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
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        counter-reset: page;
      }

      .com-pdf-page {
        width: 100%;
        min-height: 260mm;
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
        if (img.complete) return Promise.resolve();

        return new Promise(function (resolverImagen) {
          var lista = false;

          function terminarImagen() {
            if (lista) return;
            lista = true;
            resolverImagen();
          }

          img.addEventListener("load", terminarImagen, { once: true });
          img.addEventListener("error", terminarImagen, { once: true });
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
