/* =========================================================
Nombre completo: bdlocal.importador-base.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.importador-base.js
Función o funciones:
- Conservar una referencia estable al importador original.
- Permitir que el orquestador ejecute una sola importación sin capas duplicadas.
- Evitar que Integridad e Inteligencia vuelvan a envolver el mismo flujo.
========================================================= */

(function (window) {
  "use strict";

  var BD = window.BDLocalCCC;
  if (!BD || !BD.Importador || typeof BD.Importador.importarPaqueteCCC !== "function") {
    console.error("[BDLocalCCC.ImportadorBase] No está disponible el importador original.");
    return;
  }

  if (!BD.Importador.importarPaqueteBase) {
    BD.Importador.importarPaqueteBase = BD.Importador.importarPaqueteCCC.bind(BD.Importador);
    BD.__importarPaqueteBase = BD.Importador.importarPaqueteBase;
  }

  console.info("[BDLocalCCC.ImportadorBase] Importador original preservado.");
})(window);
