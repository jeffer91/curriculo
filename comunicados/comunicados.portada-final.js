/* =========================================================
Nombre completo: comunicados.portada-final.js
Ruta: /Curriculo/comunicados/comunicados.portada-final.js
Funciones:
- Mostrar el número del comunicado únicamente en la primera hoja.
- Aplicar una sangría mayor al bloque PARA, DE, ASUNTO y FECHA.
- Mantener el texto del asunto sin sombreado.
- Añadir carrera y asignatura dentro del asunto.
- Usar el PNG externo del logo con respaldo embebido.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var PDF = window.ComunicadosCCC.PDF;
  if (!PDF || PDF.__portadaFinalV3) return;

  var guardarHTMLComoPDF = PDF.guardarHTMLComoPDF.bind(PDF);
  var ocultarCodigo = typeof PDF.ocultarCodigoEnHTML === "function"
    ? PDF.ocultarCodigoEnHTML.bind(PDF)
    : function (html) { return String(html || ""); };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function limpiarNombre(valor) {
    if (typeof PDF.limpiarNombreArchivo === "function") {
      return PDF.limpiarNombreArchivo(valor);
    }

    return texto(valor)
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "") || "comunicado";
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
    var fecha = texto(valor) ? new Date(valor) : null;
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
  }

  function fechaLarga(valor) {
    var fecha = fechaValida(valor) || new Date();
    var meses = [
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    return fecha.getDate() + " DE " + meses[fecha.getMonth()] + " DE " + fecha.getFullYear();
  }

  function periodo(data) {
    data = data || {};
    var config = data.config || {};
    var fecha = fechaValida(data.fechaEmision || data.fechaSeleccionada || data.generadoEn) || new Date();
    var anio = fecha.getFullYear();
    var mes = fecha.getMonth() + 1;
    var defecto = mes >= 4 && mes <= 9
      ? "ABRIL " + anio + " - SEPTIEMBRE " + anio
      : mes >= 10
        ? "OCTUBRE " + anio + " - MARZO " + (anio + 1)
        : "OCTUBRE " + (anio - 1) + " - MARZO " + anio;

    return texto(data.periodoAcademico || data.periodo || config.periodoAcademico || config.periodo || defecto);
  }

  function numeroComunicado(data) {
    data = data || {};
    var codigo = texto(data.numeroComunicado || "").replace(/^Comunicado\s+No\.\s*/i, "");
    return "Comunicado No. 01" + (codigo ? " " + codigo : "");
  }

  function logoHTML(data) {
    data = data || {};
    var externo = texto(data.logoSrc || (data.config && data.config.logoSrc)) ||
      "../assets/logo-itsqmet-comunicado-oficial.png";
    var respaldo = texto(
      window.CURRICULO_LOGO_COMUNICADO_RESPALDO ||
      window.CURRICULO_LOGO_COMUNICADO ||
      ""
    );
    var onerror = respaldo
      ? ' onerror="this.onerror=null;this.src=\'' + escapar(respaldo) + '\';"'
      : "";

    return '<img class="com-portada-logo" src="' + escapar(externo) + '"' + onerror +
      ' alt="Logotipo del Instituto Superior Tecnológico Quito Metropolitano" />';
  }

  function fila(etiqueta, contenido) {
    return (
      '<div class="com-meta-fila">' +
        '<div class="com-meta-etiqueta">' + escapar(etiqueta) + "</div>" +
        '<div class="com-meta-separador">:</div>' +
        '<div class="com-meta-contenido">' + contenido + "</div>" +
      "</div>"
    );
  }

  function construirPortada(data) {
    data = data || {};

    var carrera = texto(data.carrera || "CARRERA NO REGISTRADA").toUpperCase();
    var asignatura = texto(data.nombreAsignatura || "ASIGNATURA NO REGISTRADA").toUpperCase();
    var fecha = texto(data.fechaEmisionTexto)
      ? texto(data.fechaEmisionTexto).toUpperCase()
      : fechaLarga(data.fechaEmision || data.fechaSeleccionada || data.generadoEn);

    var asunto = [
      "NOTIFICACIÓN DE DISPONIBILIDAD DEL DOCUMENTO DE",
      "CONSTRUCCIÓN CURRICULAR CONTINUA (CCC) EN SISACAD",
      "PARA LA ELABORACIÓN DEL PEA",
      "CARRERA: " + carrera,
      "ASIGNATURA: " + asignatura
    ].map(function (linea) {
      return '<span class="com-asunto-linea">' + escapar(linea) + "</span>";
    }).join("");

    return (
      '<article class="com-pdf-portada com-pdf-page">' +
        '<div class="com-portada-logo-wrap">' + logoHTML(data) + "</div>" +
        '<p class="com-portada-numero">' + escapar(numeroComunicado(data)) + "</p>" +
        '<section class="com-portada-datos">' +
          fila("PARA", "AUTORIDADES, COORDINADORES DE CARRERA Y DOCENTES") +
          fila(
            "DE",
            '<span>MSC. JEFFERSON VILLARREAL</span>' +
            '<span class="com-meta-segunda-linea">UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS</span>'
          ) +
          fila("ASUNTO", asunto) +
          fila("FECHA", escapar(fecha)) +
        "</section>" +
        '<section class="com-portada-cuerpo">' +
          "<p>Estimadas autoridades, coordinadores de carrera y docentes:</p>" +
          "<p>Me dirijo a ustedes en esta oportunidad para informarles que el documento de Construcción Curricular Continua (CCC) correspondiente a la asignatura de " +
            escapar(asignatura) +
            " ya se encuentra oficialmente subido y disponible en la plataforma institucional SISACAD.</p>" +
          "<p>Esta notificación tiene como propósito habilitar a los coordinadores y docentes responsables para que puedan proceder con la elaboración del Plan de Estudio de la Asignatura (PEA) correspondiente al período académico " +
            escapar(periodo(data)) +
            ", tomando como base los lineamientos y contenidos establecidos en el respectivo CCC.</p>" +
          "<p>Agradezco de antemano su colaboración y compromiso con el cumplimiento de los procesos de planificación académica. Quedo a su disposición para cualquier consulta o soporte técnico que puedan requerir durante este proceso.</p>" +
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

  function cssPortada() {
    return `
      <style id="com-portada-final-v3">
        .com-pdf-portada .com-portada-datos {
          margin-left: 20mm !important;
          width: calc(100% - 20mm) !important;
        }
        .com-pdf-portada .com-meta-fila {
          display: grid !important;
          grid-template-columns: 24mm 5mm minmax(0, 1fr) !important;
          align-items: start !important;
          margin: 0 0 2.8mm 0 !important;
          padding: 0 !important;
          border: 0 !important;
          text-transform: uppercase !important;
        }
        .com-pdf-portada .com-meta-etiqueta,
        .com-pdf-portada .com-meta-separador {
          font-weight: 700 !important;
        }
        .com-pdf-portada .com-meta-separador {
          text-align: center !important;
        }
        .com-pdf-portada .com-meta-contenido > span,
        .com-pdf-portada .com-asunto-linea {
          display: block !important;
        }
        .com-pdf-portada .com-meta-segunda-linea {
          margin-top: .8mm !important;
          font-weight: 700 !important;
        }
        .com-pdf-portada .com-asunto-linea,
        .com-pdf-portada .com-asunto-resaltado {
          width: auto !important;
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .com-pdf-portada .com-portada-firma p {
          margin-bottom: 18mm !important;
        }
      </style>
    `;
  }

  function quitarNumeroDePaginasTecnicas(html) {
    return texto(html)
      .replace(/<div class="com-pdf-numero">[\s\S]*?<\/div>/gi, "")
      .replace(/<div class="com-pdf-codigo">[\s\S]*?<\/div>/gi, "");
  }

  function prepararDocumento(documento) {
    if (!documento || !documento.html) {
      throw new Error("No se recibió un documento válido para generar PDF.");
    }

    var data = documento.data || documento;
    var tecnico = quitarNumeroDePaginasTecnicas(
      ocultarCodigo(documento.html)
    );

    return cssPortada() + construirPortada(data) + tecnico;
  }

  function nombreArchivoComunicado(documento) {
    documento = documento || {};

    var data = documento.data || documento;
    var partes = [
      "Comunicado No. 01",
      texto(documento.numeroComunicado || data.numeroComunicado),
      texto(documento.nombreAsignatura || data.nombreAsignatura || "Materia")
    ].filter(function (parte) {
      return !!texto(parte);
    });

    return limpiarNombre(partes.join(" ")) + ".pdf";
  }

  function construirHTMLFinalDocumento(documento) {
    if (typeof PDF.construirDocumentoHTML !== "function") {
      throw new Error("No está disponible el constructor final de PDF.");
    }

    return PDF.construirDocumentoHTML(
      prepararDocumento(documento),
      {
        titulo: "Comunicado " + texto(documento && documento.numeroComunicado)
      }
    );
  }

  function prepararMultiple(resultado) {
    var documentos = resultado && Array.isArray(resultado.documentos)
      ? resultado.documentos
      : [];

    if (!documentos.length) {
      throw new Error("No se recibieron documentos válidos para generar el PDF múltiple.");
    }

    return cssPortada() + documentos.map(function (documento) {
      var data = documento.data || documento;
      return construirPortada(data) + quitarNumeroDePaginasTecnicas(
        ocultarCodigo(documento.html)
      );
    }).join("");
  }

  PDF.generarPDFDocumento = async function (documento, opciones) {
    opciones = opciones || {};
    var nombre = nombreArchivoComunicado(documento);

    return await guardarHTMLComoPDF(prepararDocumento(documento), {
      titulo: "Comunicado " + (documento.numeroComunicado || ""),
      nombreArchivo: nombre,
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  };

  PDF.generarZIPDocumentos = async function (documentos, opciones) {
    opciones = opciones || {};
    documentos = Array.isArray(documentos) ? documentos : [];

    if (!documentos.length) {
      throw new Error("No se recibieron comunicados para generar el ZIP.");
    }

    if (
      !window.CurriculoElectron ||
      typeof window.CurriculoElectron.guardarComunicadosZIP !== "function"
    ) {
      throw new Error("La generación del ZIP está disponible al ejecutar la aplicación en Electron.");
    }

    var archivos = documentos.map(function (documento) {
      return {
        html: construirHTMLFinalDocumento(documento),
        titulo: "Comunicado " + texto(documento.numeroComunicado),
        nombreArchivo: nombreArchivoComunicado(documento)
      };
    });

    var nombreZIP = limpiarNombre(opciones.nombreArchivo || "Comunicados") + ".zip";
    var resultado = await window.CurriculoElectron.guardarComunicadosZIP({
      nombreArchivo: nombreZIP,
      documentos: archivos
    });

    if (!resultado || resultado.ok !== true) {
      throw new Error(
        resultado && resultado.mensaje
          ? resultado.mensaje
          : "No se pudo guardar el ZIP de comunicados."
      );
    }

    if (
      !resultado.nombreArchivo ||
      !resultado.ruta ||
      Number(resultado.bytes || 0) < 100 ||
      Number(resultado.cantidad || 0) !== documentos.length
    ) {
      throw new Error("Electron no confirmó un ZIP completo y válido.");
    }

    if (
      opciones.mostrarArchivo !== false &&
      typeof PDF.mostrarArchivoGenerado === "function"
    ) {
      await PDF.mostrarArchivoGenerado(resultado);
    }

    return resultado;
  };

  PDF.generarPDFMultiple = async function (resultado, opciones) {
    opciones = opciones || {};
    var nombre = limpiarNombre(opciones.nombreArchivo || "comunicados_institucionales");

    return await guardarHTMLComoPDF(prepararMultiple(resultado), {
      titulo: opciones.titulo || "Comunicados institucionales",
      nombreArchivo: nombre + "_" + fechaArchivo() + ".pdf",
      mostrarArchivo: opciones.mostrarArchivo !== false,
      permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
    });
  };

  PDF.construirPortadaFinal = construirPortada;
  PDF.prepararDocumentoFinal = prepararDocumento;
  PDF.construirHTMLFinalDocumento = construirHTMLFinalDocumento;
  PDF.nombreArchivoComunicado = nombreArchivoComunicado;
  PDF.__portadaFinalV3 = true;

  console.info("[ComunicadosCCC.PortadaFinal] Corrección final de portada activa.");
})(window);
