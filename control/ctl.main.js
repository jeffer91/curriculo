/* Control general del modulo Curriculo */
(function (window, document) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = el(id);
    if (node) node.textContent = String(value == null ? "" : value);
  }

  function safeDate(value) {
    if (!value) return "Sin registro";
    return String(value).replace("T", " ").slice(0, 19);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function countLocal(collection) {
    if (!window.CurriculoLocal) return 0;
    return await window.CurriculoLocal.count(collection);
  }

  async function renderPendingList(items) {
    var node = el("ctlPendingList");
    if (!node) return;

    if (!items || !items.length) {
      node.innerHTML = "<div class='ctl-empty'>No hay cambios pendientes por subir.</div>";
      return;
    }

    node.innerHTML = items.map(function (item) {
      return "<div class='ctl-row'>" +
        "<strong>" + escapeHtml(item.collection || "sin_coleccion") + "</strong>" +
        "<span>" + escapeHtml(item.id || "sin_id") + "</span>" +
        "<em>" + escapeHtml(item.updatedAtLocal || item.createdAtLocal || "") + "</em>" +
      "</div>";
    }).join("");
  }

  async function refresh() {
    var status;
    var pending;

    if (!window.CurriculoLocal) {
      setText("ctlStatus", "No se encontró la base local. Revisa que los scripts compartidos estén cargados.");
      return;
    }

    status = await window.CurriculoLocal.status();
    pending = await window.CurriculoLocal.pending();

    setText("ctlCountCarreras", await countLocal("carreras"));
    setText("ctlCountFichas", await countLocal("fichas"));
    setText("ctlCountActas", await countLocal("actas"));
    setText("ctlCountPending", status.pending || 0);
    setText("ctlStorage", status.storage || "local");
    setText("ctlLastSync", safeDate(status.lastDailySyncAt));

    setText(
      "ctlStatus",
      "Estado local: " + (status.hasPending ? "hay cambios pendientes" : "sin cambios pendientes") +
      "\nPendientes: " + (status.pending || 0) +
      "\nUltima subida diaria: " + safeDate(status.lastDailySyncAt) +
      "\nLa subida automatica solo ocurre si la app esta abierta."
    );

    await renderPendingList(pending);
  }

  async function runManualSync() {
    var btn = el("ctlSyncNow");

    if (!window.CurriculoSync || typeof window.CurriculoSync.syncNow !== "function") {
      setText("ctlStatus", "No se encontró el motor de sincronización.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sincronizando...";
    }

    try {
      await window.CurriculoSync.syncNow({ force: true });
      await refresh();
    } catch (error) {
      console.error(error);
      setText("ctlStatus", error.message || "No se pudo sincronizar.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Sincronizar ahora";
      }
    }
  }

  function bind() {
    var syncBtn = el("ctlSyncNow");
    var refreshBtn = el("ctlRefresh");

    if (syncBtn) syncBtn.addEventListener("click", runManualSync);
    if (refreshBtn) refreshBtn.addEventListener("click", refresh);

    window.addEventListener("curriculo-local-status", refresh);
    window.addEventListener("curriculo-sync-status", refresh);
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    refresh().catch(function (error) {
      console.error(error);
      setText("ctlStatus", error.message || "No se pudo iniciar Control.");
    });
  });
})(window, document);
