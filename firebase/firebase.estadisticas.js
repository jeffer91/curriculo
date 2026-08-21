/* =========================================================
Nombre completo: firebase.estadisticas.js
Ruta o ubicación: /Curriculo/firebase/firebase.estadisticas.js
Funciones:
- Leer materias pendientes de corrección para el tablero de estadísticas.
- Recuperar pendientes actuales guardadas por la importación parcial.
- Usar la auditoría histórica de cargas como respaldo para datos anteriores.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase = window.CurriculoFirebase || {};
  if (NS.Estadisticas && NS.Estadisticas.__instalada === true) return;

  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var estado = { db: null, firestoreSDK: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrir() {
    if (estado.db && estado.firestoreSDK) return estado;
    if (estado.promesa) return estado.promesa;
    if (!NS.CONFIG) throw new Error("Firebase no tiene configuración disponible.");

    estado.promesa = (async function () {
      var modulos = await Promise.all([
        importarModulo(SDK_BASE + "firebase-app.js"),
        importarModulo(SDK_BASE + "firebase-firestore.js")
      ]);
      var appSDK = modulos[0];
      estado.firestoreSDK = modulos[1];
      var app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(NS.CONFIG);
      estado.db = estado.firestoreSDK.getFirestore(app);
      return estado;
    })().catch(function (error) {
      estado.promesa = null;
      throw error;
    });

    return estado.promesa;
  }

  function lista(snapshot) {
    return snapshot.docs.map(function (docSnap) {
      return Object.assign({ id: docSnap.id }, docSnap.data());
    });
  }

  function marcaPendiente(item, origen) {
    item = Object.assign({}, item || {});
    item.materiaId = texto(item.materiaId || item.id);
    item.id = item.materiaId || texto(item.id);
    item.origenPendiente = origen;
    item.esPendienteCurricular = true;
    item.estadoValidacion = texto(item.estadoValidacion || item.estado || "incompleto");
    return item;
  }

  async function obtenerPersistentes() {
    await abrir();
    var F = estado.firestoreSDK;
    var nombre = (NS.COLECCIONES && NS.COLECCIONES.MATERIAS_PENDIENTES) || "materias_pendientes";
    var snap = await F.getDocs(F.collection(estado.db, nombre));
    return lista(snap).filter(function (item) {
      return item.activo !== false;
    }).map(function (item) {
      return marcaPendiente(item, "registro_actual");
    });
  }

  async function obtenerCargasRecientes() {
    await abrir();
    var F = estado.firestoreSDK;
    var nombre = (NS.COLECCIONES && NS.COLECCIONES.CARGAS) || "cargas";
    var coleccion = F.collection(estado.db, nombre);

    try {
      var q = F.query(coleccion, F.orderBy("creadoEn", "desc"), F.limit(100));
      return lista(await F.getDocs(q));
    } catch (error) {
      return lista(await F.getDocs(coleccion)).slice(-100).reverse();
    }
  }

  async function obtenerHistoricos() {
    var cargas = await obtenerCargasRecientes();
    var mapa = {};

    cargas.forEach(function (carga) {
      arr(carga && carga.materiasOmitidas).forEach(function (item) {
        var materiaId = texto(item && item.materiaId);
        if (!materiaId || mapa[materiaId]) return;
        mapa[materiaId] = marcaPendiente(Object.assign({}, item, {
          cargaId: texto(carga.id),
          origenAuditoria: "cargas.materiasOmitidas"
        }), "auditoria_historica");
      });
    });

    return Object.keys(mapa).map(function (id) { return mapa[id]; });
  }

  async function obtenerPendientes() {
    var resultados = await Promise.all([
      obtenerPersistentes().catch(function () { return []; }),
      obtenerHistoricos().catch(function () { return []; })
    ]);
    var actuales = resultados[0];
    var historicos = resultados[1];
    var mapa = {};

    actuales.forEach(function (item) {
      if (item.materiaId) mapa[item.materiaId] = item;
    });
    historicos.forEach(function (item) {
      if (item.materiaId && !mapa[item.materiaId]) mapa[item.materiaId] = item;
    });

    return Object.keys(mapa).map(function (id) { return mapa[id]; });
  }

  async function obtenerPendientesPorCarrera(carreraId) {
    carreraId = texto(carreraId);
    return (await obtenerPendientes()).filter(function (item) {
      return texto(item.carreraId) === carreraId;
    });
  }

  NS.Estadisticas = {
    __instalada: true,
    VERSION: "1.0.0",
    obtenerPendientes: obtenerPendientes,
    obtenerPendientesPorCarrera: obtenerPendientesPorCarrera
  };
})(window);
