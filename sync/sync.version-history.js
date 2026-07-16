/* =========================================================
Nombre completo: sync.version-history.js
Ruta: /Curriculo/sync/sync.version-history.js
Funciones:
- Conservar snapshots de cada versión de los registros de prueba.
- Usar una base IndexedDB separada del historial visible y de BDLocal.
- Registrar versiones creadas, reemplazadas o recibidas desde Google Sheets.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoSync = window.CurriculoSync || {};
  var NS = window.CurriculoSync;

  if (NS.VersionHistory && NS.VersionHistory.activo) return;
  if (!NS.Storage || !NS.Versiones) {
    console.error("[Sync.VersionHistory] Faltan Storage o Versiones.");
    return;
  }

  var Storage = NS.Storage;
  var Versiones = NS.Versiones;
  var STORES = Storage.STORES;
  var DB_NAME = "BD_SYNC_VERSIONES_CURRICULO_CCC";
  var DB_VERSION = 1;
  var STORE_NAME = "versiones";
  var dbPromise = null;
  var originalPut = Storage.put.bind(Storage);

  function fechaISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function abrir() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("registroId", "registroId", { unique: false });
          store.createIndex("version", "version", { unique: false });
          store.createIndex("actualizadoEn", "actualizadoEn", { unique: false });
          store.createIndex("guardadoEn", "guardadoEn", { unique: false });
        }
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
        reject(request.error || new Error("No se pudo abrir el historial de versiones."));
      };

      request.onblocked = function () {
        dbPromise = null;
        reject(new Error("El historial de versiones está bloqueado por otra ventana."));
      };
    });

    return dbPromise;
  }

  async function guardarSnapshot(registro, motivo) {
    if (!registro || !texto(registro.id)) return null;

    var normalizado = Versiones.normalizar(registro);
    var marca = texto(normalizado.actualizadoEn) || fechaISO();
    var snapshot = {
      id: normalizado.id + "__v" + normalizado.version + "__" + normalizado.hash + "__" + marca.replace(/[^0-9]/g, ""),
      registroId: normalizado.id,
      version: Number(normalizado.version || 0),
      actualizadoEn: marca,
      hash: normalizado.hash,
      origen: texto(registro.origen || "desconocido"),
      motivo: texto(motivo || "version_registrada"),
      snapshot: JSON.parse(JSON.stringify(registro)),
      guardadoEn: fechaISO()
    };

    var db = await abrir();
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(snapshot);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error("No se pudo guardar la versión.")); };
      tx.onabort = function () { reject(tx.error || new Error("Se canceló el guardado de la versión.")); };
    });

    return snapshot;
  }

  async function listar(registroId) {
    var db = await abrir();

    return await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, "readonly");
      var store = tx.objectStore(STORE_NAME);
      var request = registroId
        ? store.index("registroId").getAll(texto(registroId))
        : store.getAll();

      request.onsuccess = function () {
        var resultado = request.result || [];
        resultado.sort(function (a, b) {
          return texto(b.actualizadoEn || b.guardadoEn).localeCompare(texto(a.actualizadoEn || a.guardadoEn));
        });
        resolve(resultado);
      };
      request.onerror = function () { reject(request.error || new Error("No se pudo leer el historial de versiones.")); };
    });
  }

  function cambioReal(anterior, nuevo) {
    if (!anterior) return true;
    var a = Versiones.normalizar(anterior);
    var n = Versiones.normalizar(nuevo);
    return a.version !== n.version || a.actualizadoEn !== n.actualizadoEn || a.hash !== n.hash;
  }

  Storage.put = async function (storeName, record) {
    if (storeName !== STORES.TEST || !record || !texto(record.id)) {
      return await originalPut(storeName, record);
    }

    var anterior = await Storage.get(STORES.TEST, record.id);

    if (anterior && cambioReal(anterior, record)) {
      await guardarSnapshot(anterior, "version_reemplazada");
    }

    var resultado = await originalPut(storeName, record);

    if (!anterior || cambioReal(anterior, record)) {
      await guardarSnapshot(record, anterior ? "version_actualizada" : "version_creada");
    }

    return resultado;
  };

  NS.VersionHistory = {
    activo: true,
    DB_NAME: DB_NAME,
    STORE_NAME: STORE_NAME,
    abrir: abrir,
    guardarSnapshot: guardarSnapshot,
    listar: listar
  };

  console.info("[Sync.VersionHistory] Historial independiente de versiones activado.");
})(window);