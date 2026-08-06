/* =========================================================
Nombre completo: comunicados.nombre-archivo.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.nombre-archivo.js
Funciones:
- Nombrar cada PDF con código del comunicado, carrera y materia.
- Aplicar el mismo formato al PDF individual, ZIP de selección, ZIP de carrera y ZIP general.
- Limpiar caracteres incompatibles con Windows sin perder tildes ni nombres institucionales.
========================================================= */
(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var PDF = window.ComunicadosCCC.PDF;

  if (!PDF || PDF.__nombreArchivoCodigoCarreraMateria === true) return;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function limpiar(valor) {
    if (typeof PDF.limpiarNombreArchivo === "function") {
      return PDF.limpiarNombreArchivo(valor);
    }

    return texto(valor)
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 180) || "comunicado";
  }

  function obtenerDatos(documento) {
    documento = documento || {};
    return documento.data || documento;
  }

  function obtenerCodigo(documento, data) {
    return texto(
      documento.numeroComunicado ||
      data.numeroComunicado ||
      documento.codigoComunicado ||
      data.codigoComunicado
    ).replace(/^Comunicado\s+No\.\s*/i, "");
  }

  function obtenerCarrera(documento, data) {
    return texto(
      documento.carrera ||
      data.carrera ||
      documento.carreraNombre ||
      data.carreraNombre ||
      documento.nombreCarrera ||
      data.nombreCarrera
    );
  }

  function obtenerMateria(documento, data) {
    return texto(
      documento.nombreAsignatura ||
      data.nombreAsignatura ||
      documento.nombreMateria ||
      data.nombreMateria ||
      documento.materia ||
      data.materia
    );
  }

  function nombreArchivoComunicado(documento) {
    documento = documento || {};
    var data = obtenerDatos(documento);
    var codigo = obtenerCodigo(documento, data) || "SIN CÓDIGO";
    var carrera = obtenerCarrera(documento, data) || "Carrera sin nombre";
    var materia = obtenerMateria(documento, data) || "Materia sin nombre";

    return limpiar([codigo, carrera, materia].join(" - ")) + ".pdf";
  }

  PDF.nombreArchivoComunicado = nombreArchivoComunicado;

  PDF.generarPDFDocumento = async function (documento, opciones) {
    opciones = opciones || {};

    if (typeof PDF.prepararDocumentoFinal !== "function") {
      throw new Error("No está disponible el constructor final del comunicado.");
    }
    if (typeof PDF.guardarHTMLComoPDF !== "function") {
      throw new Error("No está disponible el guardado de PDF.");
    }

    return await PDF.guardarHTMLComoPDF(
      PDF.prepararDocumentoFinal(documento),
      {
        titulo: "Comunicado " + texto(documento && documento.numeroComunicado),
        nombreArchivo: nombreArchivoComunicado(documento),
        mostrarArchivo: opciones.mostrarArchivo !== false,
        permitirFallbackNavegador: opciones.permitirFallbackNavegador !== false
      }
    );
  };

  PDF.generarZIPDocumentos = async function (documentos, opciones) {
    opciones = opciones || {};
    documentos = Array.isArray(documentos) ? documentos : [];

    if (!documentos.length) {
      throw new Error("No se recibieron comunicados para generar el ZIP.");
    }
    if (typeof PDF.construirHTMLFinalDocumento !== "function") {
      throw new Error("No está disponible el constructor final de PDF.");
    }
    if (
      !window.CurriculoElectron ||
      typeof window.CurriculoElectron.guardarComunicadosZIP !== "function"
    ) {
      throw new Error("La generación del ZIP está disponible al ejecutar la aplicación en Electron.");
    }

    var archivos = documentos.map(function (documento) {
      return {
        html: PDF.construirHTMLFinalDocumento(documento),
        titulo: "Comunicado " + texto(documento.numeroComunicado),
        nombreArchivo: nombreArchivoComunicado(documento)
      };
    });

    var nombreZIP = limpiar(opciones.nombreArchivo || "Comunicados") + ".zip";
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

  PDF.__nombreArchivoCodigoCarreraMateria = true;
  console.info("[ComunicadosCCC] Nombre de archivo: código - carrera - materia.");
})(window);
