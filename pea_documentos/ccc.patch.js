/*
Nombre completo: ccc.patch.js
Ruta o ubicación: /pea_documentos/ccc.patch.js
Función:
- Convertir el flujo PEA visible a flujo CCC sin romper compatibilidad interna
- Ejecutar validación CCC después de procesar los archivos
- Adjuntar resumen de validación dentro de cada versión local
*/
(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  function patchParser() {
    if (!PEA.parser || !PEA.ccc || PEA.parser.__cccPatched) return;
    if (typeof PEA.parser.buildNormalizedUpload !== "function") return;

    var original = PEA.parser.buildNormalizedUpload;

    PEA.parser.buildNormalizedUpload = async function (params) {
      var payload = await original.call(PEA.parser, params || {});
      var validation = PEA.ccc.validateUpload(payload);

      payload.documentoTipo = "CCC";
      payload.validacionCCC = validation;
      payload.resumen = payload.resumen || {};
      payload.resumen.ccc = validation.resumen || {};

      return payload;
    };

    PEA.parser.__cccPatched = true;
  }

  patchParser();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchParser);
  } else {
    patchParser();
  }
})(window);
