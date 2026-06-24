/* =========================================================
Nombre completo: curriculo.sync-engine.js
Ruta o ubicación: /shared/local/curriculo.sync-engine.js
Función o funciones:
- Subir a Firebase los cambios locales pendientes
- Ejecutar sincronización diaria solo si hay cambios
- Permitir sincronización manual cuando el usuario lo solicite
- Requiere que la app esté abierta para ejecutarse
========================================================= */
(function attachCurriculoSyncEngine(window) {
  "use strict";

  var DEFAULT_CONFIG = {
    apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
    authDomain: "utet-4387a.firebaseapp.com",
    projectId: "utet-4387a",
    storageBucket: "utet-4387a.firebasestorage.app",
    messagingSenderId: "902848131454",
    appId: "1:902848131454:web:47f515eb6480834724c32f"
  };

  var timerId = null;
  var running = false;
  var DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

  function local() {
    if (!window.CurriculoLocal) {
      throw new Error("CurriculoLocal no está cargado.");
    }

    return window.CurriculoLocal;
  }

  function getFirebaseConfig() {
    if (window.__CURRICULO_FIREBASE_CONFIG__ && typeof window.__CURRICULO_FIREBASE_CONFIG__ === "object") {
      return window.__CURRICULO_FIREBASE_CONFIG__;
    }

    return DEFAULT_CONFIG;
  }

  function initFirebase() {
    var firebase = window.firebase;
    var cfg;

    if (!firebase || !firebase.initializeApp || !firebase.firestore) {
      throw new Error("Firebase compat no está cargado. Revisa los scripts de firebase-app-compat y firebase-firestore-compat.");
    }

    cfg = getFirebaseConfig();

    if (firebase.apps && firebase.apps.length > 0) {
      return firebase.app();
    }

    return firebase.initializeApp(cfg);
  }

  function getDb() {
    var firebase = window.firebase;
    var app = initFirebase();
    return firebase.firestore(app);
  }

  function serverTimestamp() {
    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue &&
      typeof window.firebase.firestore.FieldValue.serverTimestamp === "function"
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    return new Date();
  }

  function dispatch(detail) {
    window.dispatchEvent(new CustomEvent("curriculo-sync-status", {
      detail: detail || {}
    }));
  }

  function shouldRunDaily(status, force) {
    if (force) {
      return true;
    }

    if (!status || !status.hasPending) {
      return false;
    }

    return String(status.lastDailySyncDate || "") !== String(status.today || "");
  }

  function buildRemotePayload(item) {
    var data = item && item.data && typeof item.data === "object" ? item.data : {};
    var payload = {};
    var key;

    for (key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        payload[key] = data[key];
      }
    }

    payload.id = String(item.id || payload.id || "");
    payload.curriculoLocal = {
      collection: String(item.collection || ""),
      queueKey: String(item.key || ""),
      updatedAtLocal: String(item.updatedAtLocal || ""),
      syncedAtClient: new Date().toISOString()
    };
    payload.updatedAt = serverTimestamp();

    if (!payload.createdAt && !payload.createdAtLocal) {
      payload.createdAtLocal = String(item.createdAtLocal || item.updatedAtLocal || new Date().toISOString());
    }

    return payload;
  }

  async function uploadOne(db, item) {
    var collection = String(item.remoteCollection || item.collection || "").trim();
    var id = String(item.id || "").trim();

    if (!collection || !id) {
      throw new Error("Elemento pendiente inválido: falta colección o id.");
    }

    if (item.operation === "delete") {
      await db.collection(collection).doc(id).delete();
      return;
    }

    await db.collection(collection).doc(id).set(buildRemotePayload(item), { merge: true });
  }

  async function syncNow(options) {
    var opts = options || {};
    var force = opts.force === true;
    var status = await local().status();
    var pending;
    var db;
    var uploaded = 0;
    var failed = 0;
    var i;

    if (!status.hasPending) {
      dispatch({ ok: true, skipped: true, reason: "No hay cambios pendientes.", uploaded: 0 });
      return { ok: true, skipped: true, reason: "No hay cambios pendientes.", uploaded: 0 };
    }

    if (!shouldRunDaily(status, force)) {
      dispatch({
        ok: true,
        skipped: true,
        reason: "La subida diaria ya se ejecutó hoy.",
        uploaded: 0,
        pending: status.pending
      });
      return {
        ok: true,
        skipped: true,
        reason: "La subida diaria ya se ejecutó hoy.",
        uploaded: 0,
        pending: status.pending
      };
    }

    if (running) {
      return { ok: false, skipped: true, reason: "Ya hay una sincronización en curso." };
    }

    running = true;
    dispatch({ ok: true, running: true, message: "Subiendo cambios pendientes a Firebase..." });

    try {
      pending = await local().pending();
      db = getDb();

      for (i = 0; i < pending.length; i += 1) {
        try {
          await uploadOne(db, pending[i]);
          await local().markSynced(pending[i].key);
          uploaded += 1;
        } catch (errorItem) {
          failed += 1;
          console.error("[curriculo-sync] No se pudo subir un cambio:", pending[i], errorItem);
        }
      }

      if (uploaded > 0 && failed === 0) {
        await local().setMeta("lastDailySyncDate", local().todayKey());
        await local().setMeta("lastDailySyncAt", new Date().toISOString());
      }

      status = await local().status();
      dispatch({
        ok: failed === 0,
        running: false,
        uploaded: uploaded,
        failed: failed,
        pending: status.pending,
        message: failed === 0
          ? "Cambios subidos correctamente a Firebase."
          : "Algunos cambios no pudieron subirse."
      });

      return {
        ok: failed === 0,
        uploaded: uploaded,
        failed: failed,
        pending: status.pending
      };
    } finally {
      running = false;
    }
  }

  function startDailySync(options) {
    var opts = options || {};
    var intervalMs = Number(opts.intervalMs || DEFAULT_INTERVAL_MS);

    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }

    window.setTimeout(function () {
      syncNow({ force: false }).catch(function (error) {
        console.error("[curriculo-sync] Error en subida diaria:", error);
        dispatch({ ok: false, error: error.message || "No se pudo sincronizar." });
      });
    }, Number(opts.initialDelayMs || 2500));

    timerId = window.setInterval(function () {
      syncNow({ force: false }).catch(function (error) {
        console.error("[curriculo-sync] Error en subida diaria:", error);
        dispatch({ ok: false, error: error.message || "No se pudo sincronizar." });
      });
    }, Math.max(60000, intervalMs));

    return timerId;
  }

  function stopDailySync() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  window.CurriculoSync = {
    syncNow: syncNow,
    startDailySync: startDailySync,
    stopDailySync: stopDailySync,
    getDb: getDb
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      startDailySync();
    });
  } else {
    startDailySync();
  }
})(window);
