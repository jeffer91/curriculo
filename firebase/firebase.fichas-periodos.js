/* =========================================================
Nombre completo: firebase.fichas-periodos.js
Ruta o ubicación: /Curriculo/firebase/firebase.fichas-periodos.js
Funciones:
- Administrar un catálogo institucional de períodos reutilizables para Fichas.
- Evitar períodos duplicados mediante una clave determinística año-mes.
- Guardar mes/año inicial y final, nombre visible y valor compatible con fichas existentes.
- Reutilizar un período ya creado sin generar una nueva escritura en Firebase.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase = window.CurriculoFirebase || {};
  NS.Fichas = NS.Fichas || {};
  if (NS.Fichas.Periodos && NS.Fichas.Periodos.__instalada === true) return;

  var VERSION = "1.0.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var COLECCION = "ficha_periodos";
  var MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  var estado = { appSDK: null, firestoreSDK: null, app: null, db: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function pad(valor) {
    return String(Math.max(0, numero(valor, 0))).padStart(2, "0");
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
        estado.db = estado.firestoreSDK.initializeFirestore(estado.app, {
          experimentalAutoDetectLongPolling: true
        });
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

  function doc(id) {
    return F().doc(estado.db, COLECCION, texto(id));
  }

  function periodoId(mesInicio, anioInicio, mesFin, anioFin) {
    return [
      String(numero(anioInicio, 0)) + "-" + pad(mesInicio),
      String(numero(anioFin, 0)) + "-" + pad(mesFin)
    ].join("__");
  }

  function validar(datos) {
    datos = datos || {};
    var mesInicio = numero(datos.mesInicio, 0);
    var anioInicio = numero(datos.anioInicio, 0);
    var mesFin = numero(datos.mesFin, 0);
    var anioFin = numero(datos.anioFin, 0);

    if (mesInicio < 1 || mesInicio > 12 || mesFin < 1 || mesFin > 12) {
      throw new Error("Selecciona un mes inicial y un mes final válidos.");
    }
    if (anioInicio < 2000 || anioInicio > 2100 || anioFin < 2000 || anioFin > 2100) {
      throw new Error("Los años del período deben estar entre 2000 y 2100.");
    }

    var inicio = anioInicio * 12 + mesInicio;
    var fin = anioFin * 12 + mesFin;
    if (fin < inicio) throw new Error("El final del período no puede ser anterior al inicio.");

    return {
      mesInicio: mesInicio,
      anioInicio: anioInicio,
      mesFin: mesFin,
      anioFin: anioFin
    };
  }

  function construir(datos) {
    var limpio = validar(datos);
    var mismoAnio = limpio.anioInicio === limpio.anioFin;
    var inicioNombre = MESES[limpio.mesInicio - 1];
    var finNombre = MESES[limpio.mesFin - 1];
    var id = periodoId(limpio.mesInicio, limpio.anioInicio, limpio.mesFin, limpio.anioFin);

    return {
      id: id,
      periodoId: id,
      mesInicio: limpio.mesInicio,
      anioInicio: limpio.anioInicio,
      mesFin: limpio.mesFin,
      anioFin: limpio.anioFin,
      nombre: inicioNombre + " " + limpio.anioInicio + " - " + finNombre + " " + limpio.anioFin,
      periodo: mismoAnio
        ? inicioNombre + " - " + finNombre + " " + limpio.anioInicio
        : inicioNombre + " " + limpio.anioInicio + " - " + finNombre + " " + limpio.anioFin,
      clave: id,
      activo: true
    };
  }

  function plano(snapshot) {
    return snapshot && snapshot.exists()
      ? Object.assign({ id: snapshot.id }, snapshot.data())
      : null;
  }

  async function obtenerPeriodos() {
    await abrirSDK();
    var snap = await F().getDocs(F().collection(estado.db, COLECCION));
    return snap.docs.map(function (item) {
      return Object.assign({ id: item.id }, item.data());
    }).filter(function (item) {
      return item.activo !== false;
    }).sort(function (a, b) {
      var ia = numero(a.anioInicio, 0) * 12 + numero(a.mesInicio, 0);
      var ib = numero(b.anioInicio, 0) * 12 + numero(b.mesInicio, 0);
      if (ia !== ib) return ib - ia;
      var fa = numero(a.anioFin, 0) * 12 + numero(a.mesFin, 0);
      var fb = numero(b.anioFin, 0) * 12 + numero(b.mesFin, 0);
      return fb - fa;
    });
  }

  async function obtenerPeriodo(id) {
    await abrirSDK();
    return plano(await F().getDoc(doc(id)));
  }

  async function guardarPeriodo(datos) {
    await abrirSDK();
    var periodo = construir(datos);
    var ref = doc(periodo.id);
    var snap = await F().getDoc(ref);

    if (snap.exists()) {
      return Object.assign({ id: snap.id, reutilizado: true }, snap.data());
    }

    var registro = Object.assign({}, periodo, {
      creadoEn: F().serverTimestamp(),
      actualizadoEn: F().serverTimestamp()
    });
    await F().setDoc(ref, registro);

    return Object.assign({}, periodo, {
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      reutilizado: false
    });
  }

  NS.Fichas.Periodos = {
    __instalada: true,
    VERSION: VERSION,
    COLECCION: COLECCION,
    MESES: MESES.slice(),
    periodoId: periodoId,
    construir: construir,
    obtenerPeriodos: obtenerPeriodos,
    obtenerPeriodo: obtenerPeriodo,
    guardarPeriodo: guardarPeriodo
  };
})(window);
