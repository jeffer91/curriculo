(function (window) {
  "use strict";

  window.PEA = window.PEA || {};
  var PEA = window.PEA;

  var ROOT_COLLECTION = "pea_documentos";
  var LOCAL_KEY = "pea_local_cache_v1";
  var META_KEY = "pea_sync_meta_v1";

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function cloneDeep(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function cleanText(value) {
    if (PEA.parser && typeof PEA.parser.cleanText === "function") {
      return PEA.parser.cleanText(value);
    }

    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureFirebase() {
    if (!PEA.firebase || typeof PEA.firebase.init !== "function") {
      throw new Error("PEA.firebase no está disponible.");
    }

    if (!PEA.firebase.init()) {
      throw new Error("No se pudo inicializar Firebase.");
    }
  }

  function getDb() {
    ensureFirebase();

    if (typeof PEA.firebase.getDb !== "function") {
      throw new Error("PEA.firebase.getDb no está disponible.");
    }

    return PEA.firebase.getDb();
  }

  function getStorage() {
    ensureFirebase();

    if (typeof PEA.firebase.getStorage !== "function") {
      throw new Error("PEA.firebase.getStorage no está disponible.");
    }

    return PEA.firebase.getStorage();
  }

  function getServerTimestamp() {
    if (PEA.firebase && typeof PEA.firebase.getServerTimestamp === "function") {
      return PEA.firebase.getServerTimestamp();
    }
    return new Date();
  }

  function materiaDocRef(materiaId) {
    return getDb().collection(ROOT_COLLECTION).doc(String(materiaId || "").trim());
  }

  function versionesRef(materiaId) {
    return materiaDocRef(materiaId).collection("versiones");
  }

  function getLocalCache() {
    var cache = safeJsonParse(localStorage.getItem(LOCAL_KEY), null);

    if (!cache || typeof cache !== "object") {
      cache = { materias: {} };
    }

    if (!cache.materias || typeof cache.materias !== "object") {
      cache.materias = {};
    }

    return cache;
  }

  function saveLocalCache(cache) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cache || { materias: {} }));
  }

  function getSyncMeta() {
    var meta = safeJsonParse(localStorage.getItem(META_KEY), null);

    if (!meta || typeof meta !== "object") {
      meta = {
        lastPushDate: "",
        lastPullDate: ""
      };
    }

    meta.lastPushDate = String(meta.lastPushDate || "");
    meta.lastPullDate = String(meta.lastPullDate || "");

    return meta;
  }

  function saveSyncMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify({
      lastPushDate: String(meta && meta.lastPushDate || ""),
      lastPullDate: String(meta && meta.lastPullDate || "")
    }));
  }

  function todayKey() {
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function currentHour() {
    return new Date().getHours();
  }

  function canRunPushNow() {
    return currentHour() >= 16;
  }

  function canRunPullNow() {
    return currentHour() >= 8;
  }

  function ensureMateriaContainer(cache, materiaId, meta) {
    var id = String(materiaId || "").trim();

    if (!id) {
      throw new Error("El id de materia es obligatorio.");
    }

    if (!cache.materias[id]) {
      cache.materias[id] = {
        materiaId: id,
        materiaNombre: "",
        materiaCodigo: "",
        carreraId: "",
        carreraNombre: "",
        versions: []
      };
    }

    if (!Array.isArray(cache.materias[id].versions)) {
      cache.materias[id].versions = [];
    }

    if (meta && typeof meta === "object") {
      cache.materias[id].materiaId = id;
      cache.materias[id].materiaNombre = String(meta.materiaNombre || cache.materias[id].materiaNombre || "");
      cache.materias[id].materiaCodigo = String(meta.materiaCodigo || cache.materias[id].materiaCodigo || "");
      cache.materias[id].carreraId = String(meta.carreraId || cache.materias[id].carreraId || "");
      cache.materias[id].carreraNombre = String(meta.carreraNombre || cache.materias[id].carreraNombre || "");
    }

    return cache.materias[id];
  }

  function getNextLocalVersionNumber(materiaBucket) {
    if (!materiaBucket || !Array.isArray(materiaBucket.versions) || !materiaBucket.versions.length) {
      return 1;
    }

    var max = materiaBucket.versions.reduce(function (acc, item) {
      var n = Number(item && item.meta && item.meta.versionNumber || 0);
      return n > acc ? n : acc;
    }, 0);

    return max + 1;
  }

  async function getNextRemoteVersionNumber(materiaId) {
    var snap = await versionesRef(materiaId)
      .orderBy("versionNumber", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return 1;
    }

    return Number((snap.docs[0].data() || {}).versionNumber || 0) + 1;
  }

  async function uploadJsonToStorage(materiaId, versionId, payload) {
    var storage = getStorage();
    var path = [
      "pea_documentos",
      String(materiaId || "").trim(),
      "versiones",
      String(versionId || "").trim() + ".json"
    ].join("/");

    var ref = storage.ref(path);
    var json = JSON.stringify(payload, null, 2);

    await ref.putString(json, "raw", {
      contentType: "application/json"
    });

    var downloadURL = await ref.getDownloadURL();

    return {
      path: path,
      downloadURL: downloadURL
    };
  }

  async function pushOneLocalVersionToRemote(materiaId, localVersion) {
    if (!localVersion || !localVersion.meta || !localVersion.payload) {
      throw new Error("La versión local no es válida para sincronizar.");
    }

    var nextRemoteNumber = await getNextRemoteVersionNumber(materiaId);
    var remoteVersionId = "v" + nextRemoteNumber;
    var payload = cloneDeep(localVersion.payload);

    payload.carreraId = String(payload.carreraId || localVersion.meta.carreraId || "");
    payload.carreraNombre = String(payload.carreraNombre || localVersion.meta.carreraNombre || "");
    payload.materiaId = String(payload.materiaId || localVersion.meta.materiaId || materiaId);
    payload.materiaNombre = String(payload.materiaNombre || localVersion.meta.materiaNombre || "");
    payload.materiaCodigo = String(payload.materiaCodigo || localVersion.meta.materiaCodigo || "");

    var uploadResult = await uploadJsonToStorage(materiaId, remoteVersionId, payload);

    await materiaDocRef(materiaId).set({
      materiaId: String(localVersion.meta.materiaId || materiaId),
      materiaNombre: String(localVersion.meta.materiaNombre || ""),
      materiaCodigo: String(localVersion.meta.materiaCodigo || ""),
      carreraId: String(localVersion.meta.carreraId || ""),
      carreraNombre: String(localVersion.meta.carreraNombre || ""),
      updatedAt: getServerTimestamp(),
      updatedAtClient: new Date().toISOString()
    }, { merge: true });

    await versionesRef(materiaId).doc(remoteVersionId).set({
      versionId: remoteVersionId,
      versionNumber: nextRemoteNumber,
      materiaId: String(localVersion.meta.materiaId || materiaId),
      materiaNombre: String(localVersion.meta.materiaNombre || ""),
      materiaCodigo: String(localVersion.meta.materiaCodigo || ""),
      carreraId: String(localVersion.meta.carreraId || ""),
      carreraNombre: String(localVersion.meta.carreraNombre || ""),
      versionNota: String(localVersion.meta.versionNota || ""),
      origenTipo: String(localVersion.meta.origenTipo || ""),
      createdAt: getServerTimestamp(),
      createdAtClient: String(localVersion.meta.createdAtClient || new Date().toISOString()),
      resumen: cloneDeep(localVersion.meta.resumen || {}),
      jsonPath: uploadResult.path,
      jsonUrl: uploadResult.downloadURL
    });

    localVersion.meta.synced = true;
    localVersion.meta.syncedAtClient = new Date().toISOString();
    localVersion.meta.remoteVersionId = remoteVersionId;

    return {
      ok: true,
      remoteVersionId: remoteVersionId
    };
  }

  function buildLocalImportedVersion(remoteMeta, remotePayload, currentLength) {
    return {
      meta: {
        versionId: "local_import_" + String(remoteMeta.versionId || ""),
        versionNumber: Number(currentLength || 0) + 1,
        materiaId: String(remoteMeta.materiaId || remotePayload.materiaId || ""),
        materiaNombre: String(remoteMeta.materiaNombre || remotePayload.materiaNombre || ""),
        materiaCodigo: String(remoteMeta.materiaCodigo || remotePayload.materiaCodigo || ""),
        carreraId: String(remoteMeta.carreraId || remotePayload.carreraId || ""),
        carreraNombre: String(remoteMeta.carreraNombre || remotePayload.carreraNombre || ""),
        versionNota: String(remoteMeta.versionNota || ""),
        origenTipo: String(remoteMeta.origenTipo || remotePayload.origenTipo || ""),
        createdAtClient: String(remoteMeta.createdAtClient || ""),
        resumen: cloneDeep(remoteMeta.resumen || remotePayload.resumen || {}),
        synced: true,
        syncedAtClient: new Date().toISOString(),
        remoteVersionId: String(remoteMeta.versionId || "")
      },
      payload: cloneDeep(remotePayload)
    };
  }

  function listVersionsFromBucket(materiaBucket) {
    if (!materiaBucket || !Array.isArray(materiaBucket.versions)) {
      return [];
    }

    return materiaBucket.versions
      .map(function (item) {
        return cloneDeep(item.meta);
      })
      .sort(function (a, b) {
        return Number(b.versionNumber || 0) - Number(a.versionNumber || 0);
      });
  }

  PEA.store = {
    saveVersionLocal: function (parsedData) {
      var data = parsedData || {};
      var materiaId = cleanText(data.materiaId);
      var cache = getLocalCache();
      var bucket;
      var nextNumber;
      var localVersionId;
      var localVersion;

      if (!materiaId) {
        throw new Error("No se recibió el id de la materia.");
      }

      bucket = ensureMateriaContainer(cache, materiaId, {
        materiaNombre: String(data.materiaNombre || ""),
        materiaCodigo: String(data.materiaCodigo || ""),
        carreraId: String(data.carreraId || ""),
        carreraNombre: String(data.carreraNombre || "")
      });

      nextNumber = getNextLocalVersionNumber(bucket);
      localVersionId = "local_v" + nextNumber;

      localVersion = {
        meta: {
          versionId: localVersionId,
          versionNumber: nextNumber,
          materiaId: materiaId,
          materiaNombre: String(data.materiaNombre || ""),
          materiaCodigo: String(data.materiaCodigo || ""),
          carreraId: String(data.carreraId || ""),
          carreraNombre: String(data.carreraNombre || ""),
          versionNota: String(data.versionNota || ""),
          origenTipo: String(data.origenTipo || ""),
          createdAtClient: String(data.createdAtClient || new Date().toISOString()),
          resumen: cloneDeep(data.resumen || {}),
          synced: false,
          syncedAtClient: "",
          remoteVersionId: ""
        },
        payload: cloneDeep(data)
      };

      bucket.versions.push(localVersion);
      saveLocalCache(cache);

      return {
        ok: true,
        materiaId: materiaId,
        versionId: localVersionId,
        versionNumber: nextNumber
      };
    },

    listVersionsLocal: function (materiaId) {
      var cache = getLocalCache();
      var bucket = cache.materias[String(materiaId || "").trim()];
      return listVersionsFromBucket(bucket);
    },

    readVersionLocal: function (materiaId, versionId) {
      var cache = getLocalCache();
      var bucket = cache.materias[String(materiaId || "").trim()];
      var found;

      if (!bucket || !Array.isArray(bucket.versions)) {
        throw new Error("No existe información local para esa materia.");
      }

      found = bucket.versions.find(function (item) {
        return String(item && item.meta && item.meta.versionId || "") === String(versionId || "");
      });

      if (!found) {
        throw new Error("No existe la versión local solicitada.");
      }

      return {
        meta: cloneDeep(found.meta),
        data: cloneDeep(found.payload)
      };
    },

    getLocalCacheSnapshot: function () {
      return cloneDeep(getLocalCache());
    },

    pushPendingToFirebaseIfDue: async function (force) {
      var meta = getSyncMeta();
      var cache = getLocalCache();
      var today = todayKey();
      var materiaIds = Object.keys(cache.materias || {});
      var pushed = 0;

      if (!force && !canRunPushNow()) {
        return {
          ok: true,
          pushed: 0,
          skipped: true,
          reason: "Aún no es la hora de subida."
        };
      }

      if (!force && meta.lastPushDate === today) {
        return {
          ok: true,
          pushed: 0,
          skipped: true,
          reason: "La subida del día ya se ejecutó."
        };
      }

      for (var i = 0; i < materiaIds.length; i += 1) {
        var materiaId = materiaIds[i];
        var bucket = cache.materias[materiaId];

        if (!bucket || !Array.isArray(bucket.versions)) {
          continue;
        }

        for (var j = 0; j < bucket.versions.length; j += 1) {
          var localVersion = bucket.versions[j];

          if (!localVersion || !localVersion.meta) {
            continue;
          }

          if (localVersion.meta.synced === true) {
            continue;
          }

          await pushOneLocalVersionToRemote(materiaId, localVersion);
          pushed += 1;
        }
      }

      saveLocalCache(cache);
      meta.lastPushDate = today;
      saveSyncMeta(meta);

      return {
        ok: true,
        pushed: pushed,
        skipped: false
      };
    },

    pullFromFirebaseIfDue: async function (force) {
      var meta = getSyncMeta();
      var today = todayKey();
      var cache = getLocalCache();
      var pulled = 0;

      if (!force && !canRunPullNow()) {
        return {
          ok: true,
          pulled: 0,
          skipped: true,
          reason: "Aún no es la hora de descarga."
        };
      }

      if (!force && meta.lastPullDate === today) {
        return {
          ok: true,
          pulled: 0,
          skipped: true,
          reason: "La descarga del día ya se ejecutó."
        };
      }

      ensureFirebase();

      var materiasSnap = await getDb().collection(ROOT_COLLECTION).get();

      for (var i = 0; i < materiasSnap.docs.length; i += 1) {
        var materiaDoc = materiasSnap.docs[i];
        var materiaData = materiaDoc.data() || {};
        var materiaId = String(materiaDoc.id || "");

        var bucket = ensureMateriaContainer(cache, materiaId, {
          materiaNombre: String(materiaData.materiaNombre || ""),
          materiaCodigo: String(materiaData.materiaCodigo || ""),
          carreraId: String(materiaData.carreraId || ""),
          carreraNombre: String(materiaData.carreraNombre || "")
        });

        var versionesSnap = await versionesRef(materiaId)
          .orderBy("versionNumber", "asc")
          .get();

        for (var j = 0; j < versionesSnap.docs.length; j += 1) {
          var remoteMeta = versionesSnap.docs[j].data() || {};
          var remoteVersionId = String(remoteMeta.versionId || "");
          var alreadyExists = bucket.versions.some(function (item) {
            return String(item && item.meta && item.meta.remoteVersionId || "") === remoteVersionId;
          });

          if (alreadyExists) {
            continue;
          }

          if (!remoteMeta.jsonUrl) {
            continue;
          }

          var response = await fetch(String(remoteMeta.jsonUrl));
          if (!response.ok) {
            continue;
          }

          var remotePayload = await response.json();
          var localImported = buildLocalImportedVersion(remoteMeta, remotePayload, bucket.versions.length);

          bucket.versions.push(localImported);
          pulled += 1;
        }
      }

      saveLocalCache(cache);
      meta.lastPullDate = today;
      saveSyncMeta(meta);

      return {
        ok: true,
        pulled: pulled,
        skipped: false
      };
    }
  };
})(window);