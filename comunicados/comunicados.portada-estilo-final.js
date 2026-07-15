/* =========================================================
Nombre completo: comunicados.portada-estilo-final.js
Ruta: /Curriculo/comunicados/comunicados.portada-estilo-final.js
Función:
- Aplicar al final las reglas visuales definitivas de la portada.
- Evitar que estilos anteriores restituyan sangría, sombreado o líneas.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var Plantilla = window.ComunicadosCCC.Plantilla;
  if (!Plantilla || Plantilla.__estiloPortadaFinalV4) return;

  var generarDocumentoOriginal = Plantilla.generarDocumento.bind(Plantilla);
  var generarMultipleOriginal = Plantilla.generarDocumentoMultiple.bind(Plantilla);

  function cssFinal() {
    return `
      <style id="com-portada-estilo-final-v4">
        .com-pdf-portada,
        .com-pdf-portada .com-portada-logo-wrap,
        .com-pdf-portada .com-portada-numero,
        .com-pdf-portada .com-portada-datos,
        .com-pdf-portada .com-meta-fila,
        .com-pdf-portada .com-portada-cuerpo,
        .com-pdf-portada .com-portada-firma {
          border: 0 !important;
          box-shadow: none !important;
        }

        .com-pdf-portada .com-portada-numero {
          padding: 0 !important;
          border-bottom: 0 !important;
        }

        .com-pdf-portada .com-portada-datos {
          margin-left: 20mm !important;
          width: calc(100% - 20mm) !important;
        }

        .com-pdf-portada .com-asunto-linea,
        .com-pdf-portada .com-asunto-resaltado {
          display: block !important;
          width: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .com-pdf-portada .com-portada-cuerpo p {
          margin: 0 0 4.5mm 0 !important;
          padding: 0 !important;
          text-align: justify !important;
          text-indent: 0 !important;
          font-weight: 400 !important;
          font-style: normal !important;
          text-decoration: none !important;
        }

        .com-pdf-portada .com-portada-firma p {
          margin-bottom: 18mm !important;
        }

        .com-pdf-page:not(.com-pdf-portada) .com-pdf-numero,
        .com-pdf-page:not(.com-pdf-portada) .com-pdf-codigo {
          display: none !important;
        }
      </style>
    `;
  }

  function ajustar(documento) {
    if (!documento || typeof documento !== "object") return documento;
    documento.html = String(documento.html || "") + cssFinal();
    return documento;
  }

  Plantilla.generarDocumento = function (detalle, reserva, config) {
    return ajustar(generarDocumentoOriginal(detalle, reserva, config));
  };

  Plantilla.generarDocumentoMultiple = function (items, config) {
    var resultado = generarMultipleOriginal(items, config);
    var documentos = resultado && Array.isArray(resultado.documentos)
      ? resultado.documentos.map(ajustar)
      : [];

    if (resultado && typeof resultado === "object") {
      resultado.documentos = documentos;
      resultado.html = documentos.map(function (documento) {
        return documento.html || "";
      }).join("");
    }

    return resultado;
  };

  Plantilla.__estiloPortadaFinalV4 = true;

  console.info("[ComunicadosCCC.PortadaEstiloFinal] Estilo definitivo activo.");
})(window);
