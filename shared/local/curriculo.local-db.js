/* =========================================================
Nombre completo: curriculo.local-db.js
Ruta o ubicación: /shared/local/curriculo.local-db.js
Función o funciones:
- Crear una base local central para Currículo
- Guardar registros por colección e id
- Mantener una cola de cambios pendientes de subir a Firebase
- Funcionar con IndexedDB y respaldo en localStorage
========================================================= */
(function attachCurriculoLocalDb(window) {
  "use strict";

  var DB_NAME = "curriculo_local_db_v1";
  var DB_VERSION = 1;
  var RECORD_STORE = "records";
  var QUEUE_STORE = "sync_queue";
  var META_STORE = "meta";
  var FALLBACK_KEY = "curriculo_local_fallback_v1";
  var dbPromise = null;
  var hasIndexedDb = !!(window.indexedDB && window.IDBKeyRange);

  function nowIso() {
    return new Date().toISOString();
  }

  function todayKey() {
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function safeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function recordKey(collection, id) {
    return safeText(collection) + "::" + safeText(id);
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value == null ? null : value));
    } catch (error) {
      return value;
    }
  }

  function readFallback() {
    var base;
    try {
      base = JSON.parse(window.localStorage.getItem(FALLBACK_KEY) || "{}");
    } catch (error) {
      base = {};
    }

    if (!base || typeof base !== "object") base = {};
    if (!base.records || typeof base.records !== "object") base.records = {};
    if (!base.queue || typeof base.queue !== "object") base.queue = {};
    if (!base.meta || typeof base.meta !== "object") base.meta = {};
    return base;
  }

  function saveFallback(base) {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(base || {}));
  }

  function openDb() {
    if (!hasIndexedDb) {
      return Promise.resolve(null);
    }

    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve) {
      var request;

      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        hasIndexedDb = false;
        resolve(null);
        return;
      }

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains(RECORD_STORE)) {
          db.createObjectStore(RECORD_STORE, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function () {
        hasIndexedDb = false;
        resolve(null);
      };
    });

    return dbPromise;
  }

  function idbGet(storeName, key) {
    return openDb().then(function (db) {
      if (!db) return null;

      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readonly");
        var store = tx.objectStore(storeName);
        var req = store.get(key);

        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbPut(storeName, value) {
    return openDb().then(function (db) {
      if (!db) return false;

      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var req = store.put(value);

        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbDelete(storeName, key) {
    return openDb().then(function (db) {
      if (!db) return false;

      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var req = store.delete(key);

        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbAll(storeName) {
    return openDb().then(function (db) {
      if (!db) return null;

      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readonly");
        var store = tx.objectStore(storeName);
        var req = store.getAll();

        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getRemoteCollection(collection, options) {
    if (options && options.remoteCollection) {
      return safeText(options.remoteCollection);
    }

    return safeText(collection);
  }

  async function putRecord(collection, id, data, options) {
    var col = safeText(collection);
    var safeId = safeText(id);
    var key = recordKey(col, safeId);
    var opts = options || {};
    var record;
    var queueItem;
    var db;
    var base;

    if (!col || !safeId) {
      throw new Error("Currículo local: colección e id son obligatorios.");
    }

    record = {
      key: key,
      collection: col,
      id: safeId,
      data: clone(data || {}),
      updatedAtLocal: nowIso()
    };

    db = await openDb();

    if (db) {
      await idbPut(RECORD_STORE, record);
    } else {
      base = readFallback();
      base.records[key] = record;
      saveFallback(base);
    }

    if (opts.markDirty === false) {
      return clone(record.data);
    }

    queueItem = {
      key: key,
      collection: col,
      remoteCollection: getRemoteCollection(col, opts),
      id: safeId,
      operation: opts.operation || "set",
      data: clone(data || {}),
      createdAtLocal: opts.createdAtLocal || nowIso(),
      updatedAtLocal: nowIso(),
      status: "pending"
    };

    if (db) {
      await idbPut(QUEUE_STORE, queueItem);
    } else {
      base = readFallback();
      base.queue[key] = queueItem;
      saveFallback(base);
    }

    dispatchStatus();
    return clone(record.data);
  }

  async function getRecord(collection, id) {
    var key = recordKey(collection, id);
    var db = await openDb();
    var record;
    var base;

    if (db) {
      record = await idbGet(RECORD_STORE, key);
      return record ? clone(record.data) : null;
    }

    base = readFallback();
    record = base.records[key] || null;
    return record ? clone(record.data) : null;
  }

  async function allRecords(collection) {
    var col = safeText(collection);
    var db = await openDb();
    var all;
    var base;
    var keys;

    if (db) {
      all = await idbAll(RECORD_STORE);
      return all
        .filter(function (item) { return item && item.collection === col; })
        .map(function (item) {
          var data = clone(item.data || {});
          if (!data.id) data.id = item.id;
          return data;
        });
    }

    base = readFallback();
    keys = Object.keys(base.records || {});
    return keys
      .map(function (key) { return base.records[key]; })
      .filter(function (item) { return item && item.collection === col; })
      .map(function (item) {
        var data = clone(item.data || {});
        if (!data.id) data.id = item.id;
        return data;
      });
  }

  async function removeRecord(collection, id, options) {
    var key = recordKey(collection, id);
    var col = safeText(collection);
    var safeId = safeText(id);
    var opts = options || {};
    var db = await openDb();
    var base;
    var queueItem;

    if (db) {
      await idbDelete(RECORD_STORE, key);
    } else {
      base = readFallback();
      delete base.records[key];
      saveFallback(base);
    }

    if (opts.markDirty === false) {
      return true;
    }

    queueItem = {
      key: key,
      collection: col,
      remoteCollection: getRemoteCollection(col, opts),
      id: safeId,
      operation: "delete",
      data: null,
      createdAtLocal: nowIso(),
      updatedAtLocal: nowIso(),
      status: "pending"
    };

    if (db) {
      await idbPut(QUEUE_STORE, queueItem);
    } else {
      base = readFallback();
      base.queue[key] = queueItem;
      saveFallback(base);
    }

    dispatchStatus();
    return true;
  }

  async function pendingItems() {
    var db = await openDb();
    var all;
    var base;

    if (db) {
      all = await idbAll(QUEUE_STORE);
    } else {
      base = readFallback();
      all = Object.keys(base.queue || {}).map(function (key) { return base.queue[key]; });
    }

    return all.filter(function (item) {
      return item && item.status === "pending";
    });
  }

  async function markSynced(queueKey) {
    var db = await openDb();
    var item;
    var base;

    if (db) {
      item = await idbGet(QUEUE_STORE, queueKey);
      if (!item) return false;
      item.status = "synced";
      item.syncedAtLocal = nowIso();
      await idbPut(QUEUE_STORE, item);
    } else {
      base = readFallback();
      if (!base.queue[queueKey]) return false;
      base.queue[queueKey].status = "synced";
      base.queue[queueKey].syncedAtLocal = nowIso();
      saveFallback(base);
    }

    dispatchStatus();
    return true;
  }

  async function getMeta(key, fallback) {
    var safeKey = safeText(key);
    var db = await openDb();
    var record;
    var base;

    if (db) {
      record = await idbGet(META_STORE, safeKey);
      return record ? clone(record.value) : fallback;
    }

    base = readFallback();
    return Object.prototype.hasOwnProperty.call(base.meta, safeKey)
      ? clone(base.meta[safeKey])
      : fallback;
  }

  async function setMeta(key, value) {
    var safeKey = safeText(key);
    var db = await openDb();
    var base;

    if (db) {
      await idbPut(META_STORE, { key: safeKey, value: clone(value) });
    } else {
      base = readFallback();
      base.meta[safeKey] = clone(value);
      saveFallback(base);
    }

    dispatchStatus();
    return clone(value);
  }

  async function count(collection) {
    return (await allRecords(collection)).length;
  }

  async function status() {
    var pending = await pendingItems();
    var lastDailySyncDate = await getMeta("lastDailySyncDate", "");
    var lastDailySyncAt = await getMeta("lastDailySyncAt", "");

    return {
      pending: pending.length,
      hasPending: pending.length > 0,
      lastDailySyncDate: lastDailySyncDate || "",
      lastDailySyncAt: lastDailySyncAt || "",
      today: todayKey(),
      storage: hasIndexedDb ? "indexeddb" : "localstorage"
    };
  }

  function dispatchStatus() {
    window.setTimeout(function () {
      status().then(function (data) {
        window.dispatchEvent(new CustomEvent("curriculo-local-status", { detail: data }));
      }).catch(function () {});
    }, 0);
  }

  window.CurriculoLocal = {
    ready: openDb,
    put: putRecord,
    get: getRecord,
    all: allRecords,
    remove: removeRecord,
    count: count,
    pending: pendingItems,
    markSynced: markSynced,
    getMeta: getMeta,
    setMeta: setMeta,
    status: status,
    todayKey: todayKey,
    dispatchStatus: dispatchStatus
  };

  dispatchStatus();
})(window);
