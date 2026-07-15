/* =========================================================
Nombre completo: comunicados.formato-oficial.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.formato-oficial.js
Función o funciones:
- Aplicar el formato institucional limpio a la primera página del comunicado.
- Mantener intacto el contenido técnico del CCC desde la segunda página.
- Alinear PARA, DE, ASUNTO y FECHA mediante columnas sin bordes visibles.
- Usar el logo institucional embebido y un PNG externo como respaldo.
- Eliminar líneas divisorias, sangrías y negritas dentro del cuerpo del comunicado.
========================================================= */

(function (window, document) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;
  var PDF = NS.PDF;

  if (!PDF || PDF.__formatoOficialV1) return;

  var guardarHTMLComoPDFOriginal = PDF.guardarHTMLComoPDF.bind(PDF);
  var ocultarCodigoOriginal = typeof PDF.ocultarCodigoEnHTML === "function"
    ? PDF.ocultarCodigoEnHTML.bind(PDF)
    : function (html) { return String(html || ""); };

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
    if (typeof PDF.limpiarNombreArchivo === "function") {
      return PDF.limpiarNombreArchivo(valor);
    }

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

  function obtenerFechaEmision(data) {
    data = data || {};

    return (
      fechaValida(data.fechaEmision) ||
      fechaValida(data.fechaSeleccionada) ||
      fechaValida(data.generadoEn) ||
      new Date()
    );
  }

  function periodoAcademicoPredeterminado(valorFecha) {
    var fecha = fechaValida(valorFecha) || new Date();
    var anio = fecha.getFullYear();
    var mes = fecha.getMonth() + 1;

    if (mes >= 4 && mes <= 9) {
      return "ABRIL " + anio + " - SEPTIEMBRE " + anio;
    }

    if (mes >= 10) {
      return "OCTUBRE " + anio + " - MARZO " + (anio + 1);
    }

    return "OCTUBRE " + (anio - 1) + " - MARZO " + anio;
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

  function resolverLogo(data) {
    data = data || {};

    var logoEmbebido = texto(window.CURRICULO_LOGO_COMUNICADO || "");
    var logoConfigurado = texto(data.logoSrc || (data.config && data.config.logoSrc) || "");

    if (/^data:image\/(?:png|webp|jpeg);base64,/i.test(logoEmbebido)) {
      return logoEmbebido;
    }

    if (/^data:image\/(?:png|webp|jpeg);base64,/i.test(logoConfigurado)) {
      return logoConfigurado;
    }

    return logoConfigurado || "../assets/logo-itsqmet-comunicado-oficial.png";
  }

  function construirFilaMeta(etiqueta, contenido, clase) {
    return (
      '<div class="com-meta-fila ' + escaparHTML(clase || "") + '">' +
        '<div class="com-meta-etiqueta">' + escaparHTML(etiqueta) + "</div>" +
        '<div class="com-meta-separador">:</div>' +
        '<div class="com-meta-contenido">' + contenido + "</div>" +
      "</div>"
    );
  }

  function construirPortada(data) {
    data = data || {};

    var nombreAsignatura = texto(data.nombreAsignatura || "Asignatura sin nombre");
    var periodo = obtenerPeriodoAcademico(data);
    var fechaEmision = texto(data.fechaEmisionTexto) || fechaLargaEspanol(obtenerFechaEmision(data));
    var logoSrc = resolverLogo(data);

    var asunto = (
      '<span class="com-asunto-linea">NOTIFICACIÓN DE DISPONIBILIDAD DEL DOCUMENTO DE</span>' +
      '<span class="com-asunto-linea com-asunto-resaltado">CONSTRUCCIÓN CURRICULAR CONTINUA (CCC) EN SISACAD</span>' +
      '<span class="com-asunto-linea com-asunto-resaltado">PARA LA ELABORACIÓN DEL PEA</span>'
    );

    return (
      '<article class="com-pdf-portada com-pdf-page">' +
        '<div class="com-portada-logo-wrap">' +
          '<img class="com-portada-logo" src="' + escaparHTML(logoSrc) + '" alt="Logotipo del Instituto Superior Tecnológico Quito Metropolitano" />' +
        "</div>" +
        '<p class="com-portada-numero">' + escaparHTML(numeroPortada(data)) + "</p>" +
        '<section class="com-portada-datos">' +
          construirFilaMeta("PARA", "AUTORIDADES, COORDINADORES DE CARRERA Y DOCENTES") +
          construirFilaMeta(
            "DE",
            '<span>MSC. JEFFERSON VILLARREAL</span>' +
            '<span class="com-meta-segunda-linea">UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS</span>'
          ) +
          construirFilaMeta("ASUNTO", asunto, "com-meta-asunto") +
          construirFilaMeta("FECHA", escaparHTML(fechaEmision).toUpperCase()) +
        "</section>" +
        '<section class="com-portada-cuerpo">' +
          "<p>Estimadas autoridades, coordinadores de carrera y docentes:</p>" +
          "<p>Me dirijo a ustedes en esta oportunidad para informarles que el documento de Construcción Curricular Continua (CCC) correspondiente a la asignatura de " +
            escaparHTML(nombreAsignatura) +
            " ya se encuentra oficialmente subido y disponible en la plataforma institucional SISACAD.</p>" +
          "<p>Esta notificación tiene como propósito habilitar a los coordinadores y docentes responsables para que, a partir de este momento, puedan proceder con la elaboración del Plan de Estudio de la Asignatura (PEA) correspondiente al período académico " +
            escaparHTML(periodo) +
            ", tomando como base los lineamientos y contenidos establecidos en el respectivo CCC.</p>" +
          "<p>Agradezco de antemano su valiosa colaboración y compromiso con el cumplimiento de los procesos de planificación académica. Quedo a su entera disposición para cualquier consulta o soporte técnico que puedan requerir durante este proceso.</p>" +
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

  function obtenerCSSFormatoOficial() {
    return `
      <style id="com-formato-oficial-v1">
        .com-pdf-portada {
          min-height: 267mm;
          display: flex;
          flex-direction: column;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          color: #000000;
          border: 0 !important;
        }

        .com-pdf-portada * {
          box-sizing: border-box;
        }

        .com-pdf-portada .com-portada-logo-wrap {
          min-height: 23mm;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          margin: 0 0 4mm 0;
          padding: 0;
          border: 0 !important;
        }

        .com-pdf-portada .com-portada-logo {
          display: block;
          width: 58mm;
          max-width: 58mm;
          max-height: 23mm;
          object-fit: contain;
          object-position: left top;
          margin: 0;
          padding: 0;
          border: 0 !important;
        }

        .com-pdf-portada .com-portada-numero {
          margin: 0 0 7mm 0;
          padding: 0;
          border: 0 !important;
          text-align: center;
          font-size: 11pt;
          line-height: 1.35;
          font-weight: 700;
        }

        .com-pdf-portada .com-portada-datos {
          display: block;
          width: 100%;
          margin: 0 0 7mm 0;
          padding: 0;
          border: 0 !important;
        }

        .com-pdf-portada .com-meta-fila {
          display: grid;
          grid-template-columns: 24mm 5mm minmax(0, 1fr);
          align-items: start;
          width: 100%;
          margin: 0 0 2.8mm 0;
          padding: 0;
          border: 0 !important;
          text-transform: uppercase;
        }

        .com-pdf-portada .com-meta-etiqueta {
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .com-pdf-portada .com-meta-separador {
          font-weight: 700;
          text-align: center;
        }

        .com-pdf-portada .com-meta-contenido {
          min-width: 0;
          text-align: left;
          overflow-wrap: anywhere;
        }

        .com-pdf-portada .com-meta-contenido > span {
          display: block;
        }

        .com-pdf-portada .com-meta-segunda-linea {
          margin-top: 0.8mm;
          font-weight: 700;
        }

        .com-pdf-portada .com-asunto-linea {
          display: block;
          width: fit-content;
          max-width: 100%;
          padding: 0 1mm;
        }

        .com-pdf-portada .com-asunto-resaltado {
          background: #d9d9d9;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .com-pdf-portada .com-portada-cuerpo {
          width: 100%;
          margin: 0;
          padding: 0;
          border: 0 !important;
        }

        .com-pdf-portada .com-portada-cuerpo p {
          margin: 0 0 4.5mm 0;
          padding: 0;
          border: 0 !important;
          text-align: justify;
          text-indent: 0;
          font-weight: 400;
          font-style: normal;
          text-decoration: none;
          orphans: 3;
          widows: 3;
        }

        .com-pdf-portada .com-portada-cuerpo strong,
        .com-pdf-portada .com-portada-cuerpo b,
        .com-pdf-portada .com-portada-cuerpo em,
        .com-pdf-portada .com-portada-cuerpo i,
        .com-pdf-portada .com-portada-cuerpo u {
          font-weight: 400;
          font-style: normal;
          text-decoration: none;
        }

        .com-pdf-portada .com-portada-firma {
          margin-top: auto;
          padding: 4mm 0 0 0;
          border: 0 !important;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .com-pdf-portada .com-portada-firma p {
          margin: 0 0 10mm 0;
          padding: 0;
          border: 0 !important;
        }

        .com-pdf-portada .com-portada-firma strong,
        .com-pdf-portada .com-portada-firma span {
          display: block;
          line-height: 1.35;
          border: 0 !important;
        }
      </style>
    `;
  }

  function reemplazarLogoTecnico(html, logoSrc) {
    var resultado = texto(html);
    var logoEscapado = escaparHTML(logoSrc);

    return resultado
      .replace(/\.\.\/assets\/logo-itsqmet-comunicado-oficial\.svg/gi, logoEscapado)
      .replace(/\.\.\/assets\/logo-itsqmet-comunicado\.png/gi, logoEscapado);
  }

  function prepararHTMLDocumento(documento) {
    if (!documento || !documento.html) {
      throw new Error("No se recibió un documento válido para generar PDF.");
    }

    var data = documento.data || documento;
    var logoSrc = resolverLogo(data);
    var contenidoTecnico = reemplazarLogoTecnico(
      ocultarCodigoOriginal(documento.html),
      logoSrc
    );

    return obtenerCSSFormatoOficial() + construirPortada(data) + contenidoTecnico;
  }

  function prepararHTMLMultiple(resultadoMultiple) {
    var documentos = resultadoMultiple && Array.isArray(resultadoMultiple.documentos)
      ? resultadoMultiple.documentos
      : [];

    if (documentos.length) {
      return obtenerCSSFormatoOficial() + documentos.map(function (documento) {
        var data = documento.data || documento;
        var logoSrc = resolverLogo(data);

        return construirPortada(data) + reemplazarLogoTecnico(
          ocultarCodigoOriginal(documento.html),
          logoSrc
        );
      }).join("");
    }

    if (resultadoMultiple && resultadoMultiple.html) {
      return obtenerCSSFormatoOficial() + ocultarCodigoOriginal(resultadoMultiple.html);
    }

    throw new Error("No se recibió un documento múltiple válido para generar PDF.");
  }

  async function generarPDFDocumento(documento, opciones) {
    opciones = opciones || {};

    var htmlDocumento = prepararHTMLDocumento(documento);
    var nombre = limpiarNombreArchivo(
      opciones.nombreArchivo ||
      (documento.numeroComunicado || "COMUNICADO") + "_" +
      (documento.nombreAsignatura || "ASIGNATURA")
    );

    return await guardarHTMLComoPDFOriginal(htmlDocumento, {
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

    return await guardarHTMLComoPDFOriginal(htmlMultiple, {
      titulo: opciones.titulo || "Comunicados institucionales",
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  }

  var logoInput = document.getElementById("inputLogoSrc");
  if (logoInput && !texto(logoInput.value)) {
    logoInput.value = "../assets/logo-itsqmet-comunicado-oficial.png";
  }

  PDF.construirPortada = construirPortada;
  PDF.prepararHTMLDocumento = prepararHTMLDocumento;
  PDF.prepararHTMLMultiple = prepararHTMLMultiple;
  PDF.generarPDFDocumento = generarPDFDocumento;
  PDF.generarPDFMultiple = generarPDFMultiple;
  PDF.resolverLogo = resolverLogo;
  PDF.__formatoOficialV1 = true;

  console.info("[ComunicadosCCC.FormatoOficial] Formato institucional limpio activo.");
})(window, document);
