/* =========================================================
Nombre completo: firebase.fichas.js
Ruta o ubicación: /Curriculo/firebase/firebase.fichas.js
Funciones:
- Guardar información estructurada de fichas sin almacenar el archivo final.
- Mantener inputs institucionales por carrera y nivel con historial.
- Guardar datos generales por carrera, nivel y período.
- Guardar tendencias con sus fuentes.
- Registrar cada generación de ficha como historial de información.
- Recuperar el último cambio curricular y la versión anterior de una materia.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  if (NS.Fichas && NS.Fichas.__instalada === true) return;

  var VERSION = "1.0.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var COLECCIONES = Object.freeze({
    INPUTS: "ficha_inputs",
    CONTEXTOS: "ficha_contextos",
    TENDENCIAS: "ficha_tendencias",
    GENERACIONES: "ficha_generaciones",
    VERSIONES: "materia_versiones"
  });
  var estado = { appSDK: null, firestoreSDK: null, app: null, db: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function arr(valor) {
    return Array.isArray(valor) ? valor : [];
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s_-]/g, " ")
      .replace(/[\s_-]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function slug(valor) {
    return normalizar(valor).replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
  }

  function limpiar(valor) {
    if (valor === null || typeof valor === "undefined") return null;
    if (valor instanceof Date) return valor.toISOString();
    if (Array.isArray(valor)) return valor.map(limpiar).filter(function (x) { return x !== null; });
    if (typeof valor === "object") {
      if (typeof valor.toDate === "function") return valor.toDate().toISOString();
      var salida = {};
      Object.keys(valor).forEach(function (clave) {
        var v = limpiar(valor[clave]);
        if (v === null || typeof v === "undefined") return;
        salida[clave] = v;
      });
      return salida;
    }
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    if (typeof valor === "boolean") return valor;
    return texto(valor);
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrirSDK() {
    if (estado.db) return estado;
    if (estado.promesa) return estado.promesa;
    if (!NS.CONFIG) throw new Error("Firebase no tiene configuración disponible.");
    estado.promesa = (async function () {
      var modulos = await Promise.all([
        importarModulo(SDK_BASE + "firebase-app.js"),
        importarModulo(SDK_BASE + "firebase-firestore.js")
      ]);
      estado.appSDK = modulos[0];
      estado.firestoreSDK = modulos[1];
      estado.app = estado.appSDK.getApps().length
        ? estado.appSDK.getApp()
        : estado.appSDK.initializeApp(NS.CONFIG);
      try {
        estado.db = estado.firestoreSDK.getFirestore(estado.app);
      } catch (error) {
        estado.db = estado.firestoreSDK.initializeFirestore(estado.app, { experimentalAutoDetectLongPolling: true });
      }
      return estado;
    })().catch(function (error) {
      estado.promesa = null;
      throw error;
    });
    return estado.promesa;
  }

  function F() {
    if (!estado.db || !estado.firestoreSDK) throw new Error("Firebase todavía no está inicializado.");
    return estado.firestoreSDK;
  }

  function col(nombre) {
    return F().collection(estado.db, nombre);
  }

  function doc(nombre, id) {
    return F().doc(estado.db, nombre, texto(id));
  }

  function lista(snapshot) {
    return snapshot.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
  }

  function plano(snapshot) {
    return snapshot && snapshot.exists() ? Object.assign({ id: snapshot.id }, snapshot.data()) : null;
  }

  async function consultarCampo(coleccion, campo, valor) {
    await abrirSDK();
    var q = F().query(col(coleccion), F().where(campo, "==", valor));
    return lista(await F().getDocs(q));
  }

  function fechaMs(valor) {
    if (!valor) return 0;
    if (typeof valor.toMillis === "function") return valor.toMillis();
    if (typeof valor.toDate === "function") return valor.toDate().getTime();
    var d = new Date(valor);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function fichaId(carreraId, nivelNumero, periodo) {
    return ["ficha", slug(carreraId), "n" + pad(nivelNumero, 2), slug(periodo)].join("_").slice(0, 700);
  }

  async function guardarInput(datos) {
    await abrirSDK();
    datos = limpiar(datos || {}) || {};
    var carreraId = texto(datos.carreraId);
    var nivelNumero = numero(datos.nivelNumero, 0);
    var tipo = texto(datos.tipo);
    if (!carreraId || nivelNumero < 1 || !tipo) throw new Error("Carrera, nivel y tipo de input son obligatorios.");
    var id = ["input", slug(carreraId), "n" + pad(nivelNumero, 2), slug(tipo), Date.now().toString(36)].join("_").slice(0, 800);
    var registro = Object.assign({}, datos, {
      id: id,
      carreraId: carreraId,
      nivelNumero: nivelNumero,
      tipo: tipo,
      creadoEn: F().serverTimestamp(),
      actualizadoEn: F().serverTimestamp()
    });
    await F().setDoc(doc(COLECCIONES.INPUTS, id), registro);
    return Object.assign({}, registro, { creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString() });
  }

  async function obtenerInputs(carreraId, nivelNumero) {
    var items = await consultarCampo(COLECCIONES.INPUTS, "carreraId", texto(carreraId));
    return items.filter(function (item) {
      return numero(item.nivelNumero, 0) === numero(nivelNumero, 0);
    }).sort(function (a, b) {
      return fechaMs(b.creadoEn || b.actualizadoEn) - fechaMs(a.creadoEn || a.actualizadoEn);
    });
  }

  async function obtenerInputsActuales(carreraId, nivelNumero) {
    var items = await obtenerInputs(carreraId, nivelNumero);
    var mapa = {};
    items.forEach(function (item) {
      if (!mapa[item.tipo]) mapa[item.tipo] = item;
    });
    return mapa;
  }

  async function guardarContexto(datos) {
    await abrirSDK();
    datos = limpiar(datos || {}) || {};
    var id = fichaId(datos.carreraId, datos.nivelNumero, datos.periodo);
    if (!texto(datos.carreraId) || numero(datos.nivelNumero, 0) < 1 || !texto(datos.periodo)) {
      throw new Error("Carrera, nivel y período son obligatorios para guardar los datos generales.");
    }
    var registro = Object.assign({}, datos, {
      id: id,
      fichaId: id,
      actualizadoEn: F().serverTimestamp()
    });
    var snap = await F().getDoc(doc(COLECCIONES.CONTEXTOS, id));
    if (!snap.exists()) registro.creadoEn = F().serverTimestamp();
    await F().setDoc(doc(COLECCIONES.CONTEXTOS, id), registro, { merge: true });
    return Object.assign({}, registro, { actualizadoEn: new Date().toISOString() });
  }

  async function obtenerContexto(carreraId, nivelNumero, periodo) {
    await abrirSDK();
    if (!texto(periodo)) return null;
    return plano(await F().getDoc(doc(COLECCIONES.CONTEXTOS, fichaId(carreraId, nivelNumero, periodo))));
  }

  async function guardarTendencia(datos) {
    await abrirSDK();
    datos = limpiar(datos || {}) || {};
    var baseFicha = fichaId(datos.carreraId, datos.nivelNumero, datos.periodo);
    var materiaId = texto(datos.materiaId);
    if (!materiaId) throw new Error("La tendencia debe estar vinculada a una materia.");
    var id = (baseFicha + "__" + slug(materiaId)).slice(0, 850);
    var registro = Object.assign({}, datos, {
      id: id,
      fichaId: baseFicha,
      actualizadoEn: F().serverTimestamp()
    });
    await F().setDoc(doc(COLECCIONES.TENDENCIAS, id), registro, { merge: true });
    return registro;
  }

  async function obtenerTendencias(carreraId, nivelNumero, periodo) {
    var idFicha = fichaId(carreraId, nivelNumero, periodo);
    return await consultarCampo(COLECCIONES.TENDENCIAS, "fichaId", idFicha);
  }

  async function guardarGeneracion(datos) {
    await abrirSDK();
    datos = limpiar(datos || {}) || {};
    var idFicha = fichaId(datos.carreraId, datos.nivelNumero, datos.periodo);
    var existentes = await consultarCampo(COLECCIONES.GENERACIONES, "fichaId", idFicha);
    var version = existentes.reduce(function (max, item) { return Math.max(max, numero(item.version, 0)); }, 0) + 1;
    var id = (idFicha + "__v" + pad(version, 3)).slice(0, 850);
    var registro = Object.assign({}, datos, {
      id: id,
      fichaId: idFicha,
      version: version,
      creadoEn: F().serverTimestamp()
    });
    await F().setDoc(doc(COLECCIONES.GENERACIONES, id), registro);
    return Object.assign({}, registro, { creadoEn: new Date().toISOString() });
  }

  async function obtenerHistorial(carreraId, nivelNumero, periodo) {
    var idFicha = fichaId(carreraId, nivelNumero, periodo);
    var items = await consultarCampo(COLECCIONES.GENERACIONES, "fichaId", idFicha);
    return items.sort(function (a, b) { return numero(b.version, 0) - numero(a.version, 0); });
  }

  async function obtenerCambioDetalladoMateria(materiaId) {
    if (typeof NS.obtenerCambiosMateria !== "function" || typeof NS.obtenerDetalleMateria !== "function") {
      throw new Error("Firebase Curriculo no tiene disponibles las consultas de materias y cambios.");
    }
    var cambios = await NS.obtenerCambiosMateria(materiaId);
    var cambio = cambios && cambios.length ? cambios[0] : null;
    var detalleActual = await NS.obtenerDetalleMateria(materiaId);
    if (!cambio || numero(cambio.versionAnterior, 0) < 1) {
      return { cambio: cambio, anterior: null, actual: detalleActual };
    }
    var fragmentos = await consultarCampo(COLECCIONES.VERSIONES, "materiaId", materiaId);
    var versionAnterior = numero(cambio.versionAnterior, 0);
    var previos = fragmentos.filter(function (item) { return numero(item.version, 0) === versionAnterior; });
    var anterior = { materia: {}, peaBase: {}, unidades: [], actividades: [] };
    previos.forEach(function (item) {
      if (item.tipo === "materia") anterior.materia = item.contenido || {};
      else if (item.tipo === "pea_base") anterior.peaBase = item.contenido || {};
      else if (item.tipo === "pea_unidad") anterior.unidades.push(item.contenido || {});
      else if (item.tipo === "pea_actividades") anterior.actividades = arr(item.contenido);
    });
    anterior.unidades.sort(function (a, b) { return numero(a.unidadNumero, 0) - numero(b.unidadNumero, 0); });
    return {
      cambio: cambio,
      anterior: anterior,
      actual: detalleActual
    };
  }

  NS.Fichas = {
    __instalada: true,
    VERSION: VERSION,
    COLECCIONES: COLECCIONES,
    fichaId: fichaId,
    guardarInput: guardarInput,
    obtenerInputs: obtenerInputs,
    obtenerInputsActuales: obtenerInputsActuales,
    guardarContexto: guardarContexto,
    obtenerContexto: obtenerContexto,
    guardarTendencia: guardarTendencia,
    obtenerTendencias: obtenerTendencias,
    guardarGeneracion: guardarGeneracion,
    obtenerHistorial: obtenerHistorial,
    obtenerCambioDetalladoMateria: obtenerCambioDetalladoMateria
  };
})(window);
