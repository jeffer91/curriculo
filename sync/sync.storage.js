/* =========================================================
Nombre completo: sync.storage.js
Ruta: /Curriculo/sync/sync.storage.js
Funciones:
- Crear una base IndexedDB separada para configuración y pruebas de sincronización.
- Guardar estado, cola, conflictos, historial y registros de prueba.
- No modificar ni reemplazar BDLocal.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoSync = window.CurriculoSync || {};
  var NS = window.CurriculoSync;

  var DB_NAME = "BD_SYNC_CURRICULO_CCC";
  var DB_VERSION = 1;
  var dbPromise = null;

  var STORES = Object.freeze({
    CONFIG: "sync_config",
    STATE: "sync_state",
    QUEUE: "sync_queue",
    CONFLICTS: "sync_conflicts",
    LOGS: "sync_logs",
    TEST: "sync_test_records"
  });

  function fechaISO() {
    return new Date().toISOString();
  }

  function uid(prefijo) {
    return String(prefijo || "sync") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function crearStore(db, nombre, opciones, indices) {
    if (db.objectStoreNames.contains(nombre)) return;
    var store = db.createObjectStore(nombre, opciones || { keyPath: "id" });
    (indices || []).forEach(function (indice) {
      store.createIndex(indice.name, indice.keyPath, indice.options || { unique: false });
    });
  }

  function abrir() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        crearStore(db, STORES.CONFIG, { keyPath: "key" }, [
          { name: "actualizadoEn", keyPath: "actualizadoEn" }
        ]);
        crearStore(db, STORES.STATE, { keyPath: "key" }, [
          { name: "actualizadoEn", keyPath: "actualizadoEn" }
        ]);
        crearStore(db, STORES.QUEUE, { keyPath: "id" }, [
          { name: "estado", keyPath: "estado" },
          { name: "registroId", keyPath: "registroId" },
          { name: "creadoEn", keyPath: "creadoEn" }
        ]);
        crearStore(db, STORES.CONFLICTS, { keyPath: "id" }, [
          { name: "estado", keyPath: "estado" },
          { name: "registroId", keyPath: "registroId" },
          { name: "creadoEn", keyPath: "creadoEn" }
        ]);
        crearStore(db, STORES.LOGS, { keyPath: "id" }, [
          { name: "tipo", keyPath: "tipo" },
          { name: "creadoEn", keyPath: "creadoEn" }
        ]);
        crearStore(db, STORES.TEST, { keyPath: "id" }, [
          { name: "version", keyPath: "version" },
          { name: "actualizadoEn", keyPath: "actualizadoEn" }
        ]);
      };

      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = function () {
        dbPromise = null;
        reject(request.error || new Error("No se pudo abrir la base de sincronización."));
      };

      request.onblocked = function () {
        reject(new Error("La base de sincronización está bloqueada por otra ventana."));
      };
    });

    return dbPromise;
  }

  async function operacion(storeName, mode, callback) {
    var db = await abrir();
    return await new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, mode || "readonly");
      var store = tx.objectStore(storeName);
      var resultado;

      try {
        resultado = callback(store, tx);
      } catch (error) {
        try { tx.abort(); } catch (ignorar) { /* sin acción */ }
        reject(error);
        return;
      }

      tx.oncomplete = function () { resolve(resultado); };
      tx.onerror = function () { reject(tx.error || new Error("Error en " + storeName)); };
      tx.onabort = function () { reject(tx.error || new Error("Operación cancelada en " + storeName)); };
    });
  }

  async function get(storeName, key) {
    var db = await abrir();
    return await new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error || new Error("No se pudo leer " + storeName)); };
    });
  }

  async function getAll(storeName) {
    var db = await abrir();
    return await new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
      request.onsuccess = function () { resolve(request.result || []); };
      request.onerror = function () { reject(request.error || new Error("No se pudo listar " + storeName)); };
    });
  }

  async function put(storeName, record) {
    await operacion(storeName, "readwrite", function (store) {
      store.put(record);
    });
    return record;
  }

  async function remove(storeName, key) {
    await operacion(storeName, "readwrite", function (store) {
      store.delete(key);
    });
    return true;
  }

  async function clear(storeName) {
    await operacion(storeName, "readwrite", function (store) {
      store.clear();
    });
    return true;
  }

  async function count(storeName) {
    var db = await abrir();
    return await new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, "readonly").objectStore(storeName).count();
      request.onsuccess = function () { resolve(Number(request.result || 0)); };
      request.onerror = function () { reject(request.error || new Error("No se pudo contar " + storeName)); };
    });
  }

  function dispositivoPredeterminado() {
    var plataforma = navigator.platform || "equipo";
    return plataforma.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "equipo_local";
  }

  async function inicializar() {
    await abrir();

    var config = await get(STORES.CONFIG, "config");
    if (!config) {
      config = {
        key: "config",
        entorno: "pruebas",
        endpoint: "",
        spreadsheetId: "",
        token: "",
        dispositivoId: dispositivoPredeterminado(),
        automatica: false,
        alIniciar: false,
        alRecuperarConexion: true,
        intervaloMinutos: 15,
        actualizadoEn: fechaISO()
      };
      await put(STORES.CONFIG, config);
    }

    var state = await get(STORES.STATE, "estado");
    if (!state) {
      state = {
        key: "estado",
        estado: "sin_configurar",
        conectado: false,
        ultimaConexionEn: "",
        ultimaComparacionEn: "",
        ultimaSincronizacionEn: "",
        registrosRemotos: 0,
        sincronizados: 0,
        pendientes: 0,
        conflictos: 0,
        errores: 0,
        mensaje: "Configura el endpoint de pruebas.",
        actualizadoEn: fechaISO()
      };
      await put(STORES.STATE, state);
    }

    return { config: config, state: state };
  }

  async function guardarConfig(cambios) {
    var actual = await get(STORES.CONFIG, "config") || { key: "config" };
    var nuevo = Object.assign({}, actual, cambios || {}, { key: "config", actualizadoEn: fechaISO() });
    return await put(STORES.CONFIG, nuevo);
  }

  async function actualizarEstado(cambios) {
    var actual = await get(STORES.STATE, "estado") || { key: "estado" };
    var nuevo = Object.assign({}, actual, cambios || {}, { key: "estado", actualizadoEn: fechaISO() });
    return await put(STORES.STATE, nuevo);
  }

  async function registrarLog(tipo, mensaje, detalle) {
    var log = {
      id: uid("sync_log"),
      tipo: tipo || "info",
      mensaje: mensaje || "",
      detalle: detalle || null,
      creadoEn: fechaISO()
    };
    await put(STORES.LOGS, log);
    return log;
  }

  NS.Storage = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORES: STORES,
    abrir: abrir,
    inicializar: inicializar,
    get: get,
    getAll: getAll,
    put: put,
    remove: remove,
    clear: clear,
    count: count,
    guardarConfig: guardarConfig,
    actualizarEstado: actualizarEstado,
    registrarLog: registrarLog,
    fechaISO: fechaISO,
    uid: uid
  };
})(window);