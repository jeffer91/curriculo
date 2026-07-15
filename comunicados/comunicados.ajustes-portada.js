/* =========================================================
Nombre completo: comunicados.ajustes-portada.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.ajustes-portada.js
Funciones:
- Forzar el uso del PNG externo del logo institucional.
- Aplicar sangría uniforme al bloque PARA, DE, ASUNTO y FECHA.
- Aumentar el espacio disponible para la firma.
- Mantener intactas las páginas técnicas del CCC.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;
  var Plantilla = NS.Plantilla;
  var LOGO_EXTERNO = "../assets/logo-itsqmet-comunicado-oficial.png";

  if (!Plantilla || Plantilla.__ajustesPortadaV2) return;

  /*
   * El generador anterior daba prioridad al logo embebido.
   * Se desactiva esa prioridad para que utilice el PNG colocado
   * físicamente en /Curriculo/assets/.
   */
  window.CURRICULO_LOGO_COMUNICADO_RESPALDO =
    window.CURRICULO_LOGO_COMUNICADO_RESPALDO ||
    window.CURRICULO_LOGO_COMUNICADO ||
    "";
  window.CURRICULO_LOGO_COMUNICADO = "";

  var generarDocumentoOriginal = Plantilla.generarDocumento.bind(Plantilla);
  var generarDocumentoMultipleOriginal = Plantilla.generarDocumentoMultiple.bind(Plantilla);

  function estiloAjustesPortada() {
    return (
      '<style id="com-ajustes-portada-v2">' +
        '.com-pdf-portada .com-portada-datos{' +
          'margin-left:12mm!important;' +
          'width:calc(100% - 12mm)!important;' +
        '}' +
        '.com-pdf-portada .com-portada-firma p{' +
          'margin-bottom:18mm!important;' +
        '}' +
      '</style>'
    );
  }

  function prepararConfig(config) {
    return Object.assign({}, config || {}, {
      logoSrc: LOGO_EXTERNO
    });
  }

  function ajustarDocumento(documento) {
    if (!documento || typeof documento !== "object") return documento;

    documento.data = Object.assign({}, documento.data || {}, {
      logoSrc: LOGO_EXTERNO,
      config: Object.assign({}, documento.data && documento.data.config || {}, {
        logoSrc: LOGO_EXTERNO
      })
    });

    documento.html = estiloAjustesPortada() + String(documento.html || "");
    return documento;
  }

  function generarDocumento(detalle, reserva, config) {
    return ajustarDocumento(
      generarDocumentoOriginal(detalle, reserva, prepararConfig(config))
    );
  }

  function generarDocumentoMultiple(items, config) {
    var resultado = generarDocumentoMultipleOriginal(items, prepararConfig(config));
    var documentos = Array.isArray(resultado && resultado.documentos)
      ? resultado.documentos.map(ajustarDocumento)
      : [];

    if (resultado && typeof resultado === "object") {
      resultado.documentos = documentos;
      resultado.html = documentos.map(function (documento) {
        return documento.html || "";
      }).join("");
    }

    return resultado;
  }

  Plantilla.generarDocumento = generarDocumento;
  Plantilla.generarDocumentoMultiple = generarDocumentoMultiple;
  Plantilla.LOGO_EXTERNO = LOGO_EXTERNO;
  Plantilla.__ajustesPortadaV2 = true;

  console.info("[ComunicadosCCC.AjustesPortada] Sangría, firma y PNG externo activos.");
})(window);
