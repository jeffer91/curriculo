/* PEA: sincronización diaria sin restricción de hora */
(function (window, document) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;
  var key = "pea_daily_sync_date_v3";

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function pendingCount() {
    var cache;
    var total = 0;

    if (!PEA.store || typeof PEA.store.getLocalCacheSnapshot !== "function") {
      return 0;
    }

    cache = PEA.store.getLocalCacheSnapshot();

    Object.keys((cache && cache.materias) || {}).forEach(function (id) {
      var versions = (((cache.materias || {})[id] || {}).versions) || [];
      versions.forEach(function (item) {
        if (item && item.meta && item.meta.synced !== true) {
          total += 1;
        }
      });
    });

    return total;
  }

  function patchStore() {
    var original;

    if (!PEA.store || PEA.store.__syncDailyPatch) {
      return;
    }

    if (typeof PEA.store.pushPendingToFirebaseIfDue !== "function") {
      return;
    }

    original = PEA.store.pushPendingToFirebaseIfDue;

    PEA.store.pushPendingToFirebaseIfDue = async function (force) {
      var pending = pendingCount();
      var result;

      if (pending <= 0) {
        return {
          ok: true,
          pushed: 0,
          skipped: true,
          reason: "No hay cambios pendientes."
        };
      }

      if (!force && window.localStorage.getItem(key) === today()) {
        return {
          ok: true,
          pushed: 0,
          skipped: true,
          reason: "La subida diaria ya se ejecutó hoy.",
          pending: pending
        };
      }

      result = await original.call(PEA.store, true);

      if (Number((result && result.pushed) || 0) > 0) {
        window.localStorage.setItem(key, today());
      }

      return result;
    };

    PEA.store.__syncDailyPatch = true;
  }

  patchStore();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchStore);
  } else {
    patchStore();
  }
})(window, document);
