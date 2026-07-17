/* =========================================================
Nombre completo: comunicados.pdf.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.pdf.js
Función o funciones:
- Construir el HTML A4 del comunicado institucional.
- Generar una portada independiente como primera hoja de cada comunicado.
- Iniciar el contenido técnico del CCC desde la segunda hoja.
- Ocultar el campo Código en el PDF sin modificar la pantalla ni la BDLocal.
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
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 180) || "comunicado";
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

  function fechaValida(valor) {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;

    if (texto(valor)) {
      var fecha = new Date(valor);
      if (!Number.isNaN(fecha.getTime())) return fecha;
    }

    return null;
  }

  function fechaLargaEspanol(valor) {
    var fecha = fechaValida(valor) || new Date();
    var meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];

    return fecha.getDate() + " de " + meses[fecha.getMonth()] + " de " + fecha.getFullYear();
  }

  function periodoAcademicoPredeterminado(valorFecha) {
    var fecha = fechaValida(valorFecha) || new Date();
    var anio = fecha.getFullYear();
    var mes = fecha.getMonth() + 1;

    if (mes >= 4 && mes <= 9) {
      return "ABRIL " + anio + " – SEPTIEMBRE " + anio;
    }

    if (mes >= 10) {
      return "OCTUBRE " + anio + " – MARZO " + (anio + 1);
    }

    return "OCTUBRE " + (anio - 1) + " – MARZO " + anio;
  }

  function obtenerFechaEmision(data) {
    data = data || {};

    return (
      fechaValida(data.fechaEmision) ||
      fechaValida(data.fechaSeleccionada) ||
      fechaValida(data.generadoEn) ||
      new Date()
    );
  }

  function obtenerPeriodoAcademico(data) {
    data = data || {};
    var config = data.config || {};

    return texto(
      data.periodoAcademico ||
      data.periodo ||
      config.periodoAcademico ||
      config.periodo ||
      periodoAcademicoPredeterminado(obtenerFechaEmision(data))
    );
  }

  function numeroPortada(data) {
    data = data || {};

    var numeroFijo = texto(data.numeroFijo || "01").replace(/-+$/g, "");
    var codigo = texto(data.numeroComunicado || "").replace(/^Comunicado\s+No\.\s*/i, "");

    if (!codigo) return "Comunicado No. " + numeroFijo;
    if (codigo.indexOf(numeroFijo + "-") === 0) return "Comunicado No. " + codigo;

    return "Comunicado No. " + numeroFijo + "-" + codigo;
  }

  function construirPortada(data) {
    data = data || {};

    var nombreAsignatura = texto(data.nombreAsignatura || "Asignatura sin nombre");
    var periodo = obtenerPeriodoAcademico(data);
    var fechaEmision = texto(data.fechaEmisionTexto) || fechaLargaEspanol(obtenerFechaEmision(data));
    var logoSrc = texto(data.logoSrc || "../assets/logo-itsqmet-comunicado-oficial.svg");

    return (
      '<article class="com-pdf-portada com-pdf-page">' +
        '<div class="com-portada-logo-wrap">' +
          '<img class="com-portada-logo" src="' + escaparHTML(logoSrc) + '" alt="ITSQMET" />' +
        "</div>" +
        '<p class="com-portada-numero">' + escaparHTML(numeroPortada(data)) + "</p>" +
        '<section class="com-portada-datos">' +
          '<p><strong>PARA:</strong> AUTORIDADES, COORDINADORES DE CARRERA Y DOCENTES</p>' +
          '<p><strong>DE:</strong> MSC. JEFFERSON VILLARREAL<br>' +
            '<span>UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS</span></p>' +
          '<p><strong>ASUNTO:</strong> NOTIFICACIÓN DE DISPONIBILIDAD DEL DOCUMENTO DE CONSTRUCCIÓN CURRICULAR CONTINUA (CCC) EN SISACAD PARA LA ELABORACIÓN DEL PEA</p>' +
          '<p><strong>FECHA:</strong> ' + escaparHTML(fechaEmision).toUpperCase() + "</p>" +
        "</section>" +
        '<section class="com-portada-cuerpo">' +
          '<p>Estimadas autoridades, coordinadores de carrera y docentes:</p>' +
          '<p>Me dirijo a ustedes en esta oportunidad para informarles que el documento de Construcción Curricular Continua (CCC) correspondiente a la asignatura de <strong>' +
            escaparHTML(nombreAsignatura) +
            '</strong> ya se encuentra oficialmente subido y disponible en la plataforma institucional SISACAD.</p>' +
          '<p>Esta notificación tiene como propósito habilitar a los coordinadores y docentes responsables para que, a partir de este momento, puedan proceder con la elaboración del Plan de Estudio de la Asignatura (PEA) correspondiente al período académico <strong>' +
            escaparHTML(periodo) +
            '</strong>, tomando como base los lineamientos y contenidos establecidos en el respectivo CCC.</p>' +
          '<p>Agradezco de antemano su valiosa colaboración y compromiso con el cumplimiento de los procesos de planificación académica. Quedo a su entera disposición para cualquier consulta o soporte técnico que puedan requerir durante este proceso.</p>' +
        "</section>" +
        '<section class="com-portada-firma">' +
          "<p>Atentamente,</p>" +
          "<strong>MSC. JEFFERSON VILLARREAL</strong>" +
          "<span>GESTOR DE PROCESOS ACADÉMICOS</span>" +
          "<span>ITSQMET</span>" +
        "</section>" +
      "</article>"
    );
  }

  function ocultarCodigoEnHTML(html) {
    var resultado = texto(html);

    resultado = resultado.replace(
      /<p>\s*<strong>\s*C[oó]digo\s*<\/strong>\s*<span>[\s\S]*?<\/span>\s*<\/p>/gi,
      ""
    );

    resultado = resultado.replace(
      /class="com-pdf-resumen(?![^\"]*com-pdf-resumen-sin-codigo)([^\"]*)"/g,
      'class="com-pdf-resumen com-pdf-resumen-sin-codigo$1"'
    );

    return resultado;
  }

  function prepararHTMLDocumento(documento) {
    if (!documento || !documento.html) {
      throw new Error("No se recibió un documento válido para generar PDF.");
    }

    return construirPortada(documento.data || documento) + ocultarCodigoEnHTML(documento.html);
  }

  function prepararHTMLMultiple(resultadoMultiple) {
    var documentos = resultadoMultiple && Array.isArray(resultadoMultiple.documentos)
      ? resultadoMultiple.documentos
      : [];

    if (documentos.length) {
      return documentos.map(prepararHTMLDocumento).join("");
    }

    if (resultadoMultiple && resultadoMultiple.html) {
      return ocultarCodigoEnHTML(resultadoMultiple.html);
    }

    throw new Error("No se recibió un documento múltiple válido para generar PDF.");
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

      .com-pdf-portada {
        min-height: 267mm;
        display: flex;
        flex-direction: column;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-portada-logo-wrap {
        min-height: 21mm;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        margin: 0 0 4mm 0;
      }

      .com-portada-logo {
        display: block;
        width: 54mm;
        max-width: 54mm;
        max-height: 21mm;
        object-fit: contain;
        object-position: left top;
      }

      .com-portada-numero {
        margin: 0 0 6mm 0;
        padding: 0 0 3mm 0;
        border-bottom: 1px solid #000000;
        text-align: center;
        font-size: 10.5pt;
        line-height: 1.3;
        font-weight: 700;
      }

      .com-portada-datos {
        margin: 0 0 6mm 0;
      }

      .com-portada-datos p {
        margin: 0 0 2.5mm 0;
        text-align: justify;
      }

      .com-portada-datos strong {
        display: inline-block;
        min-width: 18mm;
      }

      .com-portada-datos span {
        display: inline-block;
        margin: 1mm 0 0 18.5mm;
        font-weight: 700;
      }

      .com-pdf-portada .com-portada-datos .com-meta-contenido {
        padding-left: 18.5mm !important;
        font-weight: 400 !important;
      }

      .com-pdf-portada .com-portada-datos .com-meta-contenido,
      .com-pdf-portada .com-portada-datos .com-meta-contenido * {
        font-weight: 400 !important;
      }

      .com-pdf-portada .com-portada-datos .com-meta-contenido > span {
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      .com-portada-cuerpo p {
        margin: 0 0 4mm 0;
        text-align: justify;
      }

      .com-portada-firma {
        margin-top: auto;
        padding-top: 4mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .com-portada-firma p {
        margin: 0 0 10mm 0;
      }

      .com-portada-firma strong,
      .com-portada-firma span {
        display: block;
        line-height: 1.35;
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
      }

      .com-pdf-numero {
        margin: 2.5mm 0 0 0;
        text-align: center;
        font-size: 10.8pt;
        line-height: 1.25;
        font-weight: 700;
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

      .com-pdf-resumen.com-pdf-resumen-sin-codigo {
        grid-template-columns: 1.15fr 1.55fr 0.8fr;
      }

      .com-pdf-resumen p {
        min-height: 16mm;
        padding: 3mm 3.5mm;
        border-right: 1px solid #000000;
        border-bottom: 1px solid #000000;
        text-align: left;
      }

      .com-pdf-resumen.com-pdf-resumen-sin-codigo p {
        border-bottom: 0;
      }

      .com-pdf-resumen.com-pdf-resumen-sin-codigo p:last-child {
        border-right: 0;
      }

      .com-pdf-resumen:not(.com-pdf-resumen-sin-codigo) p:nth-child(2n) {
        border-right: 0;
      }

      .com-pdf-resumen:not(.com-pdf-resumen-sin-codigo) p:nth-last-child(-n + 2) {
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

    var htmlDocumento = prepararHTMLDocumento(documento);
    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo ||
      (documento.numeroComunicado || "COMUNICADO") + "_" +
      (documento.nombreAsignatura || "ASIGNATURA")
    );

    return await guardarHTMLComoPDF(htmlDocumento, {
      titulo: "Comunicado " + (documento.numeroComunicado || ""),
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  }

  async function generarPDFMultiple(resultadoMultiple, opciones) {
    opciones = opciones || {};

    var htmlMultiple = prepararHTMLMultiple(resultadoMultiple);
    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo || "comunicados_institucionales"
    );

    return await guardarHTMLComoPDF(htmlMultiple, {
      titulo: opciones.titulo || "Comunicados institucionales",
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  }

  NS.PDF = {
    obtenerCSSPDF: obtenerCSSPDF,
    construirDocumentoHTML: construirDocumentoHTML,
    construirPortada: construirPortada,
    ocultarCodigoEnHTML: ocultarCodigoEnHTML,
    prepararHTMLDocumento: prepararHTMLDocumento,
    prepararHTMLMultiple: prepararHTMLMultiple,
    guardarHTMLComoPDF: guardarHTMLComoPDF,
    generarPDFDocumento: generarPDFDocumento,
    generarPDFMultiple: generarPDFMultiple,
    limpiarNombreArchivo: limpiarNombreArchivo,
    electronDisponible: electronDisponible,
    diagnosticarEntorno: diagnosticarEntorno,
    mostrarArchivoGenerado: mostrarArchivoGenerado
  };
})(window, document);
