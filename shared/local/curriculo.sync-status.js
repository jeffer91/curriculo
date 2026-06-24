/* =========================================================
Nombre completo: curriculo.sync-status.js
Ruta o ubicación: /shared/local/curriculo.sync-status.js
Función o funciones:
- Mostrar estado compacto del guardado local y sincronización
- Actualizar elementos con data-curriculo-sync-status
- Funcionar en todos los módulos sin acoplarse a un diseño específico
========================================================= */
(function attachCurriculoSyncStatus(window, document) {
  "use strict";

  function textForStatus(status) {
    if (!status) {
      return "Guardado local listo.";
    }

    if (Number(status.pending || 0) > 0) {
      return "Local guardado · pendientes por subir: " + Number(status.pending || 0);
    }

    if (status.lastDailySyncAt) {
      return "Local guardado · sincronizado: " + String(status.lastDailySyncAt).slice(0, 16).replace("T", " ");
    }

    return "Local guardado · sin cambios pendientes.";
  }

  function updateDom(status) {
    var nodes = document.querySelectorAll("[data-curriculo-sync-status]");
    var text = textForStatus(status);
    var i;

    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = text;
    }
  }

  async function refresh() {
    if (!window.CurriculoLocal || typeof window.CurriculoLocal.status !== "function") {
      updateDom(null);
      return null;
    }

    try {
      var status = await window.CurriculoLocal.status();
      updateDom(status);
      return status;
    } catch (error) {
      updateDom(null);
      return null;
    }
  }

  window.addEventListener("curriculo-local-status", function (event) {
    updateDom(event.detail || null);
  });

  window.addEventListener("curriculo-sync-status", function () {
    refresh();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }

  window.CurriculoSyncStatus = {
    refresh: refresh,
    updateDom: updateDom
  };
})(window, document);
