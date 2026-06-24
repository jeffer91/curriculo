/* =========================================================
Nombre completo: curriculo.sync-queue.js
Ruta o ubicación: /shared/local/curriculo.sync-queue.js
Función o funciones:
- Exponer utilidades simples para consultar cambios pendientes
- Marcar registros como pendientes usando la base local
- Mantener una API común para todos los módulos
========================================================= */
(function attachCurriculoSyncQueue(window) {
  "use strict";

  function requireLocal() {
    if (!window.CurriculoLocal) {
      throw new Error("CurriculoLocal no está cargado.");
    }

    return window.CurriculoLocal;
  }

  async function add(collection, id, data, options) {
    return await requireLocal().put(collection, id, data, options || {});
  }

  async function listPending() {
    return await requireLocal().pending();
  }

  async function countPending() {
    return (await listPending()).length;
  }

  async function hasPending() {
    return (await countPending()) > 0;
  }

  async function markSynced(queueKey) {
    return await requireLocal().markSynced(queueKey);
  }

  async function status() {
    return await requireLocal().status();
  }

  window.CurriculoSyncQueue = {
    add: add,
    listPending: listPending,
    countPending: countPending,
    hasPending: hasPending,
    markSynced: markSynced,
    status: status
  };
})(window);
