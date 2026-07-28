/* =========================================================
Nombre completo: firebase.robustez-ajustes.js
Ruta o ubicación: /Curriculo/firebase/firebase.robustez-ajustes.js
Funciones:
- Bloquear cualquier retirada automática de materias.
- Mantener los retiros desactivados hasta disponer de una pantalla de confirmación específica.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  if (!NS.importarPaquete || NS.__ajustesRobustezInstalados === true) return;

  var importarOriginal = NS.importarPaquete;

  NS.importarPaquete = function (paquete, opciones) {
    var opcionesSeguras = Object.assign({}, opciones || {}, {
      detectarEliminadas: false,
      cargaCompleta: false
    });
    return importarOriginal.call(NS, paquete, opcionesSeguras);
  };

  NS.__ajustesRobustezInstalados = true;
  NS.retirosAutomaticos = false;
  if (NS.Robustez) NS.Robustez.retirosAutomaticos = false;
})(window);
