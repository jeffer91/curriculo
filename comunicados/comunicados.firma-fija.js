/* =========================================================
Nombre completo: comunicados.firma-fija.js
Ruta: /Curriculo/comunicados/comunicados.firma-fija.js
Funciones:
- Reservar una zona amplia y constante para la firma manual.
- Mantener los datos del firmante siempre en la misma posición.
- Evitar que la extensión del contenido mueva el bloque de firma.
- Aplicar la corrección a PDF individuales y múltiples.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var Plantilla = window.ComunicadosCCC.Plantilla;

  if (!Plantilla || Plantilla.__firmaFijaPortadaV1) return;

  var generarDocumentoOriginal = Plantilla.generarDocumento.bind(Plantilla);
  var generarMultipleOriginal = Plantilla.generarDocumentoMultiple.bind(Plantilla);

  function cssFirmaFija() {
    return `
      <style id="com-firma-fija-portada-v1">
        .com-pdf-portada {
          position: relative !important;
          width: 100% !important;
          height: 267mm !important;
          min-height: 267mm !important;
          padding-bottom: 62mm !important;
          overflow: hidden !important;
        }

        .com-pdf-portada .com-portada-firma {
          position: absolute !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 58mm !important;
          margin: 0 !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .com-pdf-portada .com-portada-firma p {
          flex: 0 0 auto !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.35 !important;
        }

        .com-pdf-portada .com-portada-firma strong {
          display: block !important;
          margin-top: auto !important;
          padding: 0 !important;
          line-height: 1.35 !important;
        }

        .com-pdf-portada .com-portada-firma span {
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.35 !important;
        }

        @media print {
          .com-pdf-portada {
            height: 267mm !important;
            min-height: 267mm !important;
          }
        }
      </style>
    `;
  }

  function ajustarDocumento(documento) {
    if (!documento || typeof documento !== "object") return documento;
    if (documento.__firmaFijaPortadaV1) return documento;

    documento.html = String(documento.html || "") + cssFirmaFija();
    documento.__firmaFijaPortadaV1 = true;

    return documento;
  }

  Plantilla.generarDocumento = function (detalle, reserva, config) {
    return ajustarDocumento(
      generarDocumentoOriginal(detalle, reserva, config)
    );
  };

  Plantilla.generarDocumentoMultiple = function (items, config) {
    var resultado = generarMultipleOriginal(items, config);
    var documentos = resultado && Array.isArray(resultado.documentos)
      ? resultado.documentos.map(ajustarDocumento)
      : [];

    if (resultado && typeof resultado === "object") {
      resultado.documentos = documentos;
      resultado.html = documentos.map(function (documento) {
        return documento.html || "";
      }).join("");
    }

    return resultado;
  };

  Plantilla.__firmaFijaPortadaV1 = true;

  console.info("[ComunicadosCCC.FirmaFija] Zona fija y amplia para firma activa.");
})(window);
