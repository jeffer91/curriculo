/* =========================================================
Nombre completo: bdlocal.core.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.core.js
Función o funciones:
- Abrir y preparar IndexedDB de Gestión Curricular CCC.
- Crear tablas e índices definidos en bdlocal.schema.js.
- Exponer operaciones CRUD y transacciones seguras.
- Evitar promesas bloqueadas mediante timeouts y captura temprana de eventos.
- Reutilizar una sola inicialización por sesión para reducir contención.
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

  var DB_TIMEOUT_MS = 15000;
  var TX_TIMEOUT_MS = 15000;
  var REQUEST_TIMEOUT_MS = 15000;

  var dbInstance = null;
  var openPromise = null;
  var readyPromise = null;
  var metaRegistrada = false;

  function errorConContexto(mensaje, causa) {
    var error = new Error(mensaje);
    if (causa) error.cause = causa;
    return error;
  }

  function promisifyRequest(request, contexto, timeoutMs) {
    timeoutMs = Number(timeoutMs || REQUEST_TIMEOUT_MS);

    return new Promise(function (resolve, reject) {
      var terminado = false;
      var timer = setTimeout(function () {
        if (terminado) return;
        terminado = true;
        reject(new Error("Tiempo agotado en IndexedDB: " + (contexto || "solicitud")));
      }, timeoutMs);

      function finalizar(callback, valor) {
        if (terminado) return;
        terminado = true;
        clearTimeout(timer);
        callback(valor);
      }

      request.onsuccess = function () {
        finalizar(resolve, request.result);
      };

      request.onerror = function () {
        finalizar(reject, request.error || new Error("Error en solicitud IndexedDB: " + (contexto || "solicitud")));
      };
    });
  }

  function transactionDone(tx, contexto, timeoutMs) {
    timeoutMs = Number(timeoutMs || TX_TIMEOUT_MS);

    return new Promise(function (resolve, reject) {
      var terminado = false;
      var timer = setTimeout(function () {
        if (terminado) return;
        terminado = true;
        try {
          tx.abort();
        } catch (errorAbortar) {
          console.warn("[BDLocalCCC.Core] No se pudo abortar la transacción vencida:", errorAbortar);
        }
        reject(new Error("Tiempo agotado en transacción IndexedDB: " + (contexto || "transacción")));
      }, timeoutMs);

      function limpiar() {
        clearTimeout(timer);
      }

      function completar() {
        if (terminado) return;
        terminado = true;
        limpiar();
        resolve(true);
      }

      function fallar() {
        if (terminado) return;
        terminado = true;
        limpiar();
        reject(tx.error || new Error("Error en transacción IndexedDB: " + (contexto || "transacción")));
      }

      tx.addEventListener("complete", completar, { once: true });
      tx.addEventListener("error", fallar, { once: true });
      tx.addEventListener("abort", fallar, { once: true });
    });
  }

  function createIndexIfMissing(store, indexDef) {
    if (!store.indexNames.contains(indexDef.name)) {
      store.createIndex(indexDef.name, indexDef.keyPath, indexDef.options || {});
    }
  }

  function createStoreIfMissing(db, definition) {
    if (!db.objectStoreNames.contains(definition.name)) {
      return db.createObjectStore(definition.name, definition.options || {});
    }
    return null;
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

  function resetConnection() {
    dbInstance = null;
    openPromise = null;
    readyPromise = null;
    metaRegistrada = false;
  }

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (openPromise) return openPromise;

    openPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("Este navegador no soporta IndexedDB."));
        return;
      }

      var terminado = false;
      var bloqueada = false;
      var request;

      var timer = setTimeout(function () {
        if (terminado) return;
        terminado = true;
        openPromise = null;
        reject(new Error(
          bloqueada
            ? "IndexedDB está bloqueada por otra ventana de la aplicación. Cierra todas las ventanas de Curriculo y vuelve a abrirla."
            : "Tiempo agotado al abrir la base local CCC."
        ));
      }, DB_TIMEOUT_MS);

      function finalizar(callback, valor) {
        if (terminado) return;
        terminado = true;
        clearTimeout(timer);
        callback(valor);
      }

      try {
        request = window.indexedDB.open(Schema.DB_NAME, Schema.DB_VERSION);
      } catch (errorAbrir) {
        finalizar(reject, errorConContexto("No se pudo iniciar la apertura de IndexedDB.", errorAbrir));
        return;
      }

      request.onupgradeneeded = function (event) {
        ensureSchema(event);
      };

      request.onsuccess = function () {
        if (terminado) {
          try { request.result.close(); } catch (errorCerrar) { /* sin acción */ }
          return;
        }

        dbInstance = request.result;
        dbInstance.onversionchange = function () {
          try { dbInstance.close(); } catch (error) {
            console.warn("[BDLocalCCC.Core] Error cerrando BD por cambio de versión:", error);
          }
          resetConnection();
        };

        finalizar(resolve, dbInstance);
      };

      request.onerror = function () {
        openPromise = null;
        finalizar(reject, request.error || new Error("No se pudo abrir la base local CCC."));
      };

      request.onblocked = function () {
        bloqueada = true;
        console.warn("[BDLocalCCC.Core] IndexedDB está bloqueada por otra ventana abierta.");
      };
    }).catch(function (error) {
      openPromise = null;
      throw error;
    });

    return openPromise;
  }

  async function registrarMetaUnaVez(db) {
    if (metaRegistrada) return true;

    var tx = db.transaction(Schema.STORES.META, "readwrite");
    var completada = transactionDone(tx, "registrar estado de BDLocal");
    var store = tx.objectStore(Schema.STORES.META);
    var request = store.put({
      key: "estado_bd",
      nombre: Schema.DB_NAME,
      version: Schema.DB_VERSION,
      estado: "lista",
      actualizadoEn: Schema.fechaISO()
    });

    await promisifyRequest(request, "guardar metadatos de BDLocal");
    await completada;
    metaRegistrada = true;
    return true;
  }

  async function ready() {
    if (readyPromise) return readyPromise;

    readyPromise = openDB()
      .then(async function (db) {
        await registrarMetaUnaVez(db);
        return db;
      })
      .catch(function (error) {
        readyPromise = null;
        throw error;
      });

    return readyPromise;
  }

  async function getDB() {
    return await openDB();
  }

  async function getStore(storeName, mode) {
    var db = await openDB();
    var tx;
    try {
      tx = db.transaction(storeName, mode || "readonly");
    } catch (error) {
      throw errorConContexto("No se pudo abrir la tabla '" + storeName + "'.", error);
    }
    return { tx: tx, store: tx.objectStore(storeName) };
  }

  async function add(storeName, record) {
    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "agregar en " + storeName);
    var result = await promisifyRequest(ctx.store.add(record), "agregar en " + storeName);
    await completada;
    return result;
  }

  async function put(storeName, record) {
    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "guardar en " + storeName);
    var result = await promisifyRequest(ctx.store.put(record), "guardar en " + storeName);
    await completada;
    return result;
  }

  async function get(storeName, key) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.get(key), "leer " + storeName);
  }

  async function remove(storeName, key) {
    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "eliminar en " + storeName);
    var result = await promisifyRequest(ctx.store.delete(key), "eliminar en " + storeName);
    await completada;
    return result;
  }

  async function clear(storeName) {
    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "vaciar " + storeName);
    var result = await promisifyRequest(ctx.store.clear(), "vaciar " + storeName);
    await completada;
    return result;
  }

  async function count(storeName) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.count(), "contar " + storeName);
  }

  async function getAll(storeName) {
    var ctx = await getStore(storeName, "readonly");
    return await promisifyRequest(ctx.store.getAll(), "listar " + storeName);
  }

  async function getAllByIndex(storeName, indexName, value) {
    var ctx = await getStore(storeName, "readonly");
    if (!ctx.store.indexNames.contains(indexName)) {
      throw new Error("El índice '" + indexName + "' no existe en la tabla '" + storeName + "'.");
    }
    return await promisifyRequest(ctx.store.index(indexName).getAll(value), "consultar " + storeName + "." + indexName);
  }

  async function getOneByIndex(storeName, indexName, value) {
    var ctx = await getStore(storeName, "readonly");
    if (!ctx.store.indexNames.contains(indexName)) {
      throw new Error("El índice '" + indexName + "' no existe en la tabla '" + storeName + "'.");
    }
    return await promisifyRequest(ctx.store.index(indexName).get(value), "consultar " + storeName + "." + indexName);
  }

  async function bulkPut(storeName, records) {
    records = Array.isArray(records) ? records : [];
    if (!records.length) return { storeName: storeName, total: 0, guardados: 0 };

    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "guardado masivo en " + storeName, Math.max(TX_TIMEOUT_MS, records.length * 100));
    var guardados = 0;

    records.forEach(function (record) {
      var req = ctx.store.put(record);
      req.onsuccess = function () { guardados += 1; };
      req.onerror = function () {
        console.warn("[BDLocalCCC.Core] No se pudo guardar un registro en " + storeName, req.error);
      };
    });

    await completada;
    return { storeName: storeName, total: records.length, guardados: guardados };
  }

  async function bulkAdd(storeName, records) {
    records = Array.isArray(records) ? records : [];
    if (!records.length) return { storeName: storeName, total: 0, guardados: 0 };

    var ctx = await getStore(storeName, "readwrite");
    var completada = transactionDone(ctx.tx, "inserción masiva en " + storeName, Math.max(TX_TIMEOUT_MS, records.length * 100));
    var guardados = 0;

    records.forEach(function (record) {
      var req = ctx.store.add(record);
      req.onsuccess = function () { guardados += 1; };
      req.onerror = function () {
        console.warn("[BDLocalCCC.Core] No se pudo agregar un registro en " + storeName, req.error);
      };
    });

    await completada;
    return { storeName: storeName, total: records.length, guardados: guardados };
  }

  async function runTransaction(storeNames, mode, callback, opciones) {
    opciones = opciones || {};
    var db = await openDB();
    var names = Array.isArray(storeNames) ? storeNames : [storeNames];
    var tx = db.transaction(names, mode || "readonly");
    var completada = transactionDone(
      tx,
      opciones.contexto || ("transacción en " + names.join(", ")),
      opciones.timeoutMs || TX_TIMEOUT_MS
    );

    var stores = {};
    names.forEach(function (name) {
      stores[name] = tx.objectStore(name);
    });

    var result;
    try {
      result = await callback(stores, tx);
    } catch (errorCallback) {
      try { tx.abort(); } catch (errorAbortar) { /* sin acción */ }
      throw errorCallback;
    }

    await completada;
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
      resultado.stores[nombres[i]] = await getAll(nombres[i]);
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
        resumen.tablas[storeName] = { estado: "ok", total: await count(storeName) };
      } catch (error) {
        resumen.tablas[storeName] = { estado: "error", mensaje: error.message };
      }
    }

    return resumen;
  }

  function close() {
    if (dbInstance) {
      try { dbInstance.close(); } catch (error) {
        console.warn("[BDLocalCCC.Core] No se pudo cerrar IndexedDB:", error);
      }
    }
    resetConnection();
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
    diagnostico: diagnostico,
    close: close,
    transactionDone: transactionDone
  };
})(window);
