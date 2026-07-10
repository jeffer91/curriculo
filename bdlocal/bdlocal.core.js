/* =========================================================
Nombre completo: bdlocal.core.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.core.js
Función o funciones:
- Abrir y preparar la base IndexedDB de Gestión Curricular CCC.
- Crear tablas e índices definidos en bdlocal.schema.js.
- Exponer funciones CRUD reutilizables para guardar, actualizar, buscar y listar datos.
- Manejar transacciones seguras para futuras pantallas.
- Registrar logs internos de importación y errores.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;

  if (!Schema) {
    console.error("[BDLocalCCC.Core] Falta cargar primero bdlocal.schema.js");
    return;
  }

  var dbInstance = null;
  var openPromise = null;

  function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error || new Error("Error en solicitud IndexedDB"));
      };
    });
  }

  function transactionDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () {
        resolve(true);
      };

      tx.onerror = function () {
        reject(tx.error || new Error("Error en transacción IndexedDB"));
      };

      tx.onabort = function () {
        reject(tx.error || new Error("Transacción IndexedDB abortada"));
      };
    });
  }

  function createIndexIfMissing(store, indexDef) {
    if (!store.indexNames.contains(indexDef.name)) {
      store.createIndex(indexDef.name, indexDef.keyPath, indexDef.options || {});
    }
  }

  function createStoreIfMissing(db, definition) {
    var store;

    if (!db.objectStoreNames.contains(definition.name)) {
      store = db.createObjectStore(definition.name, definition.options || {});
    } else {
      store = null;
    }

    return store;
  }

  function ensureSchema(event) {
    var db = event.target.result;

    Schema.STORE_DEFINITIONS.forEach(function (definition) {
      var store = createStoreIfMissing(db, definition);

      if (store && Array.isArray(definition.indexes)) {
        definition.indexes.forEach(function (indexDef) {
          createIndexIfMissing(store, indexDef);
        });
      }
    });

    try {
      var tx = event.target.transaction;

      Schema.STORE_DEFINITIONS.forEach(function (definition) {
        if (!tx.objectStoreNames.contains(definition.name)) return;

        var existingStore = tx.objectStore(definition.name);

        if (Array.isArray(definition.indexes)) {
          definition.indexes.forEach(function (indexDef) {
            createIndexIfMissing(existingStore, indexDef);
          });
        }
      });
    } catch (error) {
      console.warn("[BDLocalCCC.Core] No se pudieron verificar índices existentes:", error);
    }
  }

  function openDB() {
    if (dbInstance) {
      return Promise.resolve(dbInstance);
    }

    if (openPromise) {
      return openPromise;
    }

    openPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("Este navegador no soporta IndexedDB."));
        return;
      }

      var request = window.indexedDB.open(Schema.DB_NAME, Schema.DB_VERSION);

      request.onupgradeneeded = function (event) {
        ensureSchema(event);
      };

      request.onsuccess = function () {
        dbInstance = request.result;

        dbInstance.onversionchange = function () {
          try {
            dbInstance.close();
          } catch (error) {
            console.warn("[BDLocalCCC.Core] Error cerrando BD por cambio de versión:", error);
          }

          dbInstance = null;
          openPromise = null;
        };

        resolve(dbInstance);
      };

      request.onerror = function () {
        reject(request.error || new Error("No se pudo abrir la base local CCC."));
      };

      request.onblocked = function () {
        console.warn("[BDLocalCCC.Core] La actualización de IndexedDB está bloqueada por otra pestaña abierta.");
      };
    });

    return openPromise;
  }

  async function ready() {
    var db = await openDB();

    await put(Schema.STORES.META, {
      key: "estado_bd",
      nombre: Schema.DB_NAME,
      version: Schema.DB_VERSION,
      estado: "lista",
      actualizadoEn: Schema.fechaISO()
    });

    return db;
  }

  async function getDB() {
    return await openDB();
  }

  async function getStore(storeName, mode) {
    var db = await openDB();
    var tx = db.transaction(storeName, mode || "readonly");
    return {
      tx: tx,
      store: tx.objectStore(storeName)
    };
  }

  async function add(storeName, record) {
    var ctx = await getStore(storeName, "readwrite");
    var result = await promisifyRequest(ctx.store.add(record));
    await transactionDone(ctx.tx);
    return result;
  }

  async function put(storeName, record) {
    var ctx = await getStore(storeName, "readwrite");
    var result = await promisifyRequest(ctx.store.put(record));
    await transactionDone(ctx.tx);
    return result;
  }

  async function get(storeName, key) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.get(key));
  }

  async function remove(storeName, key) {
    var ctx = await getStore(storeName, "readwrite");
    var result = await promisifyRequest(ctx.store.delete(key));
    await transactionDone(ctx.tx);
    return result;
  }

  async function clear(storeName) {
    var ctx = await getStore(storeName, "readwrite");
    var result = await promisifyRequest(ctx.store.clear());
    await transactionDone(ctx.tx);
    return result;
  }

  async function count(storeName) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.count());
  }

  async function getAll(storeName) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.getAll());
  }

  async function getAllByIndex(storeName, indexName, value) {
    var ctx = await getStore(storeName, "readonly");

    if (!ctx.store.indexNames.contains(indexName)) {
      throw new Error("El índice '" + indexName + "' no existe en la tabla '" + storeName + "'.");
    }

    var index = ctx.store.index(indexName);
    return await promisifyRequest(index.getAll(value));
  }

  async function getOneByIndex(storeName, indexName, value) {
    var ctx = await getStore(storeName, "readonly");

    if (!ctx.store.indexNames.contains(indexName)) {
      throw new Error("El índice '" + indexName + "' no existe en la tabla '" + storeName + "'.");
    }

    var index = ctx.store.index(indexName);
    return await promisifyRequest(index.get(value));
  }

  async function bulkPut(storeName, records) {
    records = Array.isArray(records) ? records : [];

    if (!records.length) {
      return {
        storeName: storeName,
        total: 0,
        guardados: 0
      };
    }

    var ctx = await getStore(storeName, "readwrite");
    var guardados = 0;

    records.forEach(function (record) {
      var req = ctx.store.put(record);

      req.onsuccess = function () {
        guardados += 1;
      };

      req.onerror = function () {
        console.warn("[BDLocalCCC.Core] No se pudo guardar un registro en " + storeName, req.error);
      };
    });

    await transactionDone(ctx.tx);

    return {
      storeName: storeName,
      total: records.length,
      guardados: guardados
    };
  }

  async function bulkAdd(storeName, records) {
    records = Array.isArray(records) ? records : [];

    if (!records.length) {
      return {
        storeName: storeName,
        total: 0,
        guardados: 0
      };
    }

    var ctx = await getStore(storeName, "readwrite");
    var guardados = 0;

    records.forEach(function (record) {
      var req = ctx.store.add(record);

      req.onsuccess = function () {
        guardados += 1;
      };

      req.onerror = function () {
        console.warn("[BDLocalCCC.Core] No se pudo agregar un registro en " + storeName, req.error);
      };
    });

    await transactionDone(ctx.tx);

    return {
      storeName: storeName,
      total: records.length,
      guardados: guardados
    };
  }

  async function runTransaction(storeNames, mode, callback) {
    var db = await openDB();
    var names = Array.isArray(storeNames) ? storeNames : [storeNames];
    var tx = db.transaction(names, mode || "readonly");

    var stores = {};
    names.forEach(function (name) {
      stores[name] = tx.objectStore(name);
    });

    var result = await callback(stores, tx);
    await transactionDone(tx);
    return result;
  }

  async function log(data) {
    var payload = Object.assign({
      cargaId: data && data.cargaId ? data.cargaId : null,
      tipo: data && data.tipo ? data.tipo : "sistema",
      nivel: data && data.nivel ? data.nivel : "info",
      mensaje: data && data.mensaje ? data.mensaje : "",
      detalle: data && data.detalle ? data.detalle : null,
      creadoEn: Schema.fechaISO()
    }, data || {});

    try {
      return await add(Schema.STORES.LOGS_IMPORTACION, payload);
    } catch (error) {
      console.warn("[BDLocalCCC.Core] No se pudo registrar log:", error);
      return null;
    }
  }

  async function exportarJSON() {
    var resultado = {
      nombreBD: Schema.DB_NAME,
      version: Schema.DB_VERSION,
      exportadoEn: Schema.fechaISO(),
      stores: {}
    };

    var nombres = Object.keys(Schema.STORES).map(function (key) {
      return Schema.STORES[key];
    });

    for (var i = 0; i < nombres.length; i += 1) {
      var storeName = nombres[i];
      resultado.stores[storeName] = await getAll(storeName);
    }

    return resultado;
  }

  async function diagnostico() {
    var nombres = Object.keys(Schema.STORES).map(function (key) {
      return Schema.STORES[key];
    });

    var resumen = {
      nombreBD: Schema.DB_NAME,
      version: Schema.DB_VERSION,
      generadoEn: Schema.fechaISO(),
      tablas: {}
    };

    for (var i = 0; i < nombres.length; i += 1) {
      var storeName = nombres[i];

      try {
        resumen.tablas[storeName] = {
          estado: "ok",
          total: await count(storeName)
        };
      } catch (error) {
        resumen.tablas[storeName] = {
          estado: "error",
          mensaje: error.message
        };
      }
    }

    return resumen;
  }

  NS.Core = {
    ready: ready,
    getDB: getDB,
    add: add,
    put: put,
    get: get,
    remove: remove,
    clear: clear,
    count: count,
    getAll: getAll,
    getAllByIndex: getAllByIndex,
    getOneByIndex: getOneByIndex,
    bulkPut: bulkPut,
    bulkAdd: bulkAdd,
    runTransaction: runTransaction,
    log: log,
    exportarJSON: exportarJSON,
    diagnostico: diagnostico
  };
})(window);