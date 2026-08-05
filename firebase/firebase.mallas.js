/* =========================================================
Nombre completo: firebase.mallas.js
Ruta o ubicación: /Curriculo/firebase/firebase.mallas.js
Funciones:
- Guardar versiones automáticas de mallas curriculares en Firestore.
- Crear una nueva versión únicamente cuando existen cambios reales.
- Mantener una sola versión vigente por carrera.
- Corregir nombres oficiales de carreras y materias vinculadas en Firebase.
- Administrar equivalencias y resultados de comparación con ZIP.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  if (NS.Mallas && NS.Mallas.__instalada === true) return;

  var VERSION = "1.1.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var COLECCIONES = Object.freeze({
    MALLAS: "mallas_curriculares",
    MATERIAS: "malla_materias",
    REQUISITOS: "malla_requisitos",
    EQUIVALENCIAS: "malla_equivalencias",
    COMPARACIONES: "malla_comparaciones",
    CARRERAS: "carreras",
    MATERIAS_FIREBASE: "materias"
  });
  var estado = { appSDK: null, firestoreSDK: null, app: null, db: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    return Array.isArray(valor) ? valor : [];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-–—./]+/g, " ")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function slug(valor) {
    return normalizar(valor).replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
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

  function col(nombre) {
    return F().collection(estado.db, nombre);
  }

  function doc(nombre, id) {
    return F().doc(estado.db, nombre, texto(id));
  }

  function plano(snapshot) {
    return snapshot && snapshot.exists()
      ? Object.assign({ id: snapshot.id }, snapshot.data())
      : null;
  }

  function lista(snapshot) {
    return snapshot.docs.map(function (item) {
      return Object.assign({ id: item.id }, item.data());
    });
  }

  async function consultarCampo(nombreColeccion, campo, valor) {
    await abrirSDK();
    var q = F().query(col(nombreColeccion), F().where(campo, "==", valor));
    return lista(await F().getDocs(q));
  }

  function carreraIdDe(datos) {
    var id = texto(datos && datos.carreraId);
    if (id) return id;
    return "carrera_" + slug(datos && (datos.carreraNombre || datos.nombreCarrera));
  }

  function crearMallaId(carreraId, version) {
    return "malla_" + slug(carreraId) + "_v" + pad(version, 3);
  }

  function crearMateriaId(mallaId, materia, indice) {
    var nivel = Math.max(1, numero(materia && materia.nivelNumero, 1));
    var identidad = texto(materia && materia.materiaFirebaseId) || texto(materia && materia.nombreOficial) || "materia";
    return [mallaId, "n" + pad(nivel, 2), slug(identidad), pad(numero(materia && materia.orden, indice + 1), 3)].join("__").slice(0, 900);
  }

  function limpiarObjeto(valor) {
    if (valor === null || typeof valor === "undefined") return null;
    if (valor instanceof Date) return valor.toISOString();
    if (Array.isArray(valor)) return valor.map(limpiarObjeto).filter(function (item) { return item !== null; });
    if (typeof valor === "object") {
      var salida = {};
      Object.keys(valor).forEach(function (clave) {
        var limpio = limpiarObjeto(valor[clave]);
        if (limpio === null || typeof limpio === "undefined" || limpio === "") return;
        salida[clave] = limpio;
      });
      return salida;
    }
    if (typeof valor === "string") return texto(valor);
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    return valor;
  }

  async function ejecutarOperaciones(operaciones) {
    operaciones = arr(operaciones).filter(Boolean);
    for (var inicio = 0; inicio < operaciones.length; inicio += 400) {
      var tramo = operaciones.slice(inicio, inicio + 400);
      var batch = F().writeBatch(estado.db);
      tramo.forEach(function (op) {
        var ref = doc(op.coleccion, op.id);
        if (op.tipo === "delete") batch.delete(ref);
        else batch.set(ref, op.data, op.merge ? { merge: true } : undefined);
      });
      await batch.commit();
    }
    return operaciones.length;
  }

  function prepararMaterias(materias) {
    var salida = arr(materias).map(function (materia, indice) {
      return {
        id: texto(materia && materia.id),
        materiaFirebaseId: texto(materia && materia.materiaFirebaseId),
        nivelNumero: Math.max(1, numero(materia && materia.nivelNumero, 1)),
        nivelNombre: texto(materia && materia.nivelNombre),
        orden: Math.max(1, numero(materia && materia.orden, indice + 1)),
        nombreOficial: texto(materia && materia.nombreOficial),
        tipo: texto(materia && materia.tipo || "asignatura"),
        obligatoria: materia && materia.obligatoria !== false,
        activa: materia && materia.activa !== false
      };
    });

    salida.sort(function (a, b) {
      return a.nivelNumero - b.nivelNumero || a.orden - b.orden || a.nombreOficial.localeCompare(b.nombreOficial, "es");
    });

    var ordenes = {};
    salida.forEach(function (materia) {
      ordenes[materia.nivelNumero] = (ordenes[materia.nivelNumero] || 0) + 1;
      materia.orden = ordenes[materia.nivelNumero];
      materia.nivelNombre = materia.nivelNombre || "Nivel " + materia.nivelNumero;
    });
    return salida;
  }

  function validarMalla(datos) {
    var errores = [];
    var carreraNombre = texto(datos && (datos.carreraNombre || datos.nombreCarrera));
    var materias = prepararMaterias(datos && datos.materias);
    if (!carreraNombre) errores.push("El nombre oficial de la carrera es obligatorio.");
    if (!materias.length) errores.push("La malla debe contener al menos una materia.");
    var vistos = {};
    materias.forEach(function (materia, indice) {
      if (!materia.nombreOficial) errores.push("La materia de la fila " + (indice + 1) + " no tiene nombre.");
      var clave = materia.nivelNumero + "|" + normalizar(materia.nombreOficial);
      if (materia.nombreOficial && vistos[clave]) errores.push("Materia duplicada en el nivel " + materia.nivelNumero + ": " + materia.nombreOficial + ".");
      vistos[clave] = true;
    });
    if (errores.length) throw new Error(errores.join(" | "));
    return materias;
  }

  function firmaMalla(datos) {
    return JSON.stringify({
      carreraNombre: texto(datos && datos.carreraNombre),
      observaciones: texto(datos && datos.observaciones),
      materias: prepararMaterias(datos && datos.materias).map(function (materia) {
        return {
          materiaFirebaseId: materia.materiaFirebaseId,
          nivelNumero: materia.nivelNumero,
          orden: materia.orden,
          nombreOficial: materia.nombreOficial,
          tipo: materia.tipo,
          obligatoria: materia.obligatoria,
          activa: materia.activa
        };
      })
    });
  }

  async function actualizarNombreCarrera(carreraId, nombreOficial) {
    await abrirSDK();
    carreraId = texto(carreraId);
    nombreOficial = texto(nombreOficial);
    if (!carreraId || !nombreOficial) throw new Error("No se pudo actualizar el nombre de la carrera.");
    var ref = doc(COLECCIONES.CARRERAS, carreraId);
    var snap = await F().getDoc(ref);
    var actual = snap.exists() ? snap.data() : {};
    await F().setDoc(ref, {
      nombreOriginalImportado: texto(actual.nombreOriginalImportado || actual.nombre),
      nombre: nombreOficial,
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      actualizadoEn: F().serverTimestamp()
    }, { merge: true });
    return nombreOficial;
  }

  async function actualizarNombreMateria(materiaFirebaseId, nombreOficial) {
    await abrirSDK();
    materiaFirebaseId = texto(materiaFirebaseId);
    nombreOficial = texto(nombreOficial);
    if (!materiaFirebaseId || !nombreOficial) return false;
    await F().setDoc(doc(COLECCIONES.MATERIAS_FIREBASE, materiaFirebaseId), {
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      actualizadoEn: F().serverTimestamp()
    }, { merge: true });
    return true;
  }

  async function operacionesNombresBase(carreraId, carreraNombre, materias) {
    var operaciones = [];
    var carreraSnap = await F().getDoc(doc(COLECCIONES.CARRERAS, carreraId));
    var carreraActual = carreraSnap.exists() ? carreraSnap.data() : {};
    operaciones.push({
      tipo: "set",
      coleccion: COLECCIONES.CARRERAS,
      id: carreraId,
      merge: true,
      data: {
        nombreOriginalImportado: texto(carreraActual.nombreOriginalImportado || carreraActual.nombre),
        nombre: carreraNombre,
        nombreInstitucional: carreraNombre,
        nombreCorregido: carreraNombre,
        actualizadoEn: F().serverTimestamp()
      }
    });
    prepararMaterias(materias).forEach(function (materia) {
      if (!materia.materiaFirebaseId) return;
      operaciones.push({
        tipo: "set",
        coleccion: COLECCIONES.MATERIAS_FIREBASE,
        id: materia.materiaFirebaseId,
        merge: true,
        data: {
          nombreInstitucional: materia.nombreOficial,
          nombreCorregido: materia.nombreOficial,
          actualizadoEn: F().serverTimestamp()
        }
      });
    });
    return operaciones;
  }

  async function obtenerMallas(opciones) {
    opciones = opciones || {};
    await abrirSDK();
    var items = opciones.carreraId
      ? await consultarCampo(COLECCIONES.MALLAS, "carreraId", opciones.carreraId)
      : lista(await F().getDocs(col(COLECCIONES.MALLAS)));
    return items.sort(function (a, b) {
      if (texto(a.carreraNombre) !== texto(b.carreraNombre)) return texto(a.carreraNombre).localeCompare(texto(b.carreraNombre), "es");
      return numero(b.version, 0) - numero(a.version, 0);
    });
  }

  async function obtenerDetalleMalla(mallaId) {
    await abrirSDK();
    var resultados = await Promise.all([
      F().getDoc(doc(COLECCIONES.MALLAS, mallaId)),
      consultarCampo(COLECCIONES.MATERIAS, "mallaId", mallaId),
      consultarCampo(COLECCIONES.REQUISITOS, "mallaId", mallaId),
      consultarCampo(COLECCIONES.EQUIVALENCIAS, "mallaId", mallaId)
    ]);
    var malla = plano(resultados[0]);
    if (!malla) throw new Error("No se encontró la malla curricular.");
    return {
      malla: malla,
      materias: resultados[1].sort(function (a, b) {
        return numero(a.nivelNumero, 0) - numero(b.nivelNumero, 0) || numero(a.orden, 0) - numero(b.orden, 0);
      }),
      requisitos: resultados[2].sort(function (a, b) { return numero(a.orden, 0) - numero(b.orden, 0); }),
      equivalencias: resultados[3]
    };
  }

  async function obtenerMallaVigenteParaCarrera(carrera) {
    await abrirSDK();
    carrera = carrera || {};
    var id = texto(carrera.id || carrera.carreraId);
    var nombre = texto(carrera.nombre || carrera.carreraNombre || carrera.carrera);
    var candidatas = [];
    if (id) candidatas = await consultarCampo(COLECCIONES.MALLAS, "carreraId", id);
    if (!candidatas.length && nombre) {
      var todas = await obtenerMallas();
      var clave = normalizar(nombre);
      candidatas = todas.filter(function (item) { return normalizar(item.carreraNombre) === clave; });
    }
    var vigente = candidatas.filter(function (item) { return item.vigente === true || item.estado === "vigente"; })
      .sort(function (a, b) { return numero(b.version, 0) - numero(a.version, 0); })[0] || null;
    return vigente ? await obtenerDetalleMalla(vigente.id) : null;
  }

  async function guardarMalla(datos) {
    datos = datos || {};
    await abrirSDK();
    var materias = validarMalla(datos);
    var carreraId = carreraIdDe(datos);
    var carreraNombre = texto(datos.carreraNombre || datos.nombreCarrera);
    var observaciones = texto(datos.observaciones);
    var versiones = await consultarCampo(COLECCIONES.MALLAS, "carreraId", carreraId);
    var vigenteMeta = versiones.filter(function (item) { return item.vigente === true || item.estado === "vigente"; })
      .sort(function (a, b) { return numero(b.version, 0) - numero(a.version, 0); })[0] || null;
    var detalleVigente = vigenteMeta ? await obtenerDetalleMalla(vigenteMeta.id) : null;
    var propuesta = { carreraNombre: carreraNombre, observaciones: observaciones, materias: materias };

    if (detalleVigente && firmaMalla(propuesta) === firmaMalla({
      carreraNombre: detalleVigente.malla.carreraNombre,
      observaciones: detalleVigente.malla.observaciones,
      materias: detalleVigente.materias
    })) {
      await ejecutarOperaciones(await operacionesNombresBase(carreraId, carreraNombre, materias));
      detalleVigente.sinCambios = true;
      detalleVigente.versionCreada = false;
      return detalleVigente;
    }

    var version = versiones.reduce(function (max, item) { return Math.max(max, numero(item.version, 0)); }, 0) + 1;
    var mallaId = crearMallaId(carreraId, version);
    while ((await F().getDoc(doc(COLECCIONES.MALLAS, mallaId))).exists()) {
      version += 1;
      mallaId = crearMallaId(carreraId, version);
    }

    var niveles = {};
    materias.forEach(function (materia) { niveles[materia.nivelNumero] = true; });
    var operaciones = [];
    versiones.forEach(function (malla) {
      if (malla.vigente === true || malla.estado === "vigente") {
        operaciones.push({
          tipo: "set",
          coleccion: COLECCIONES.MALLAS,
          id: malla.id,
          merge: true,
          data: { vigente: false, estado: "historica", actualizadoEn: F().serverTimestamp() }
        });
      }
    });

    operaciones.push({
      tipo: "set",
      coleccion: COLECCIONES.MALLAS,
      id: mallaId,
      data: {
        carreraId: carreraId,
        carreraNombre: carreraNombre,
        carreraNombreNormalizado: normalizar(carreraNombre),
        nombre: "Malla curricular de " + carreraNombre,
        version: version,
        estado: "vigente",
        vigente: true,
        totalNiveles: Object.keys(niveles).length,
        totalMaterias: materias.length,
        totalRequisitos: 0,
        observaciones: observaciones,
        fuente: limpiarObjeto(datos.fuente || { tipo: "firebase" }),
        firmaEstructura: firmaMalla(propuesta),
        creadoEn: F().serverTimestamp(),
        actualizadoEn: F().serverTimestamp()
      }
    });

    materias.forEach(function (materia, indice) {
      operaciones.push({
        tipo: "set",
        coleccion: COLECCIONES.MATERIAS,
        id: crearMateriaId(mallaId, materia, indice),
        data: {
          mallaId: mallaId,
          carreraId: carreraId,
          carreraNombre: carreraNombre,
          mallaVersion: version,
          materiaFirebaseId: materia.materiaFirebaseId,
          nivelNumero: materia.nivelNumero,
          nivelNombre: materia.nivelNombre || "Nivel " + materia.nivelNumero,
          orden: materia.orden,
          nombreOficial: materia.nombreOficial,
          nombreNormalizado: normalizar(materia.nombreOficial),
          tipo: materia.tipo,
          obligatoria: materia.obligatoria,
          activa: materia.activa,
          creadoEn: F().serverTimestamp(),
          actualizadoEn: F().serverTimestamp()
        }
      });
    });

    operaciones = operaciones.concat(await operacionesNombresBase(carreraId, carreraNombre, materias));
    await ejecutarOperaciones(operaciones);
    var detalle = await obtenerDetalleMalla(mallaId);
    detalle.sinCambios = false;
    detalle.versionCreada = true;
    return detalle;
  }

  async function activarMalla(mallaId) {
    var detalle = await obtenerDetalleMalla(mallaId);
    var versiones = await consultarCampo(COLECCIONES.MALLAS, "carreraId", detalle.malla.carreraId);
    var operaciones = versiones.map(function (item) {
      var activa = item.id === mallaId;
      return {
        tipo: "set",
        coleccion: COLECCIONES.MALLAS,
        id: item.id,
        merge: true,
        data: { vigente: activa, estado: activa ? "vigente" : "historica", actualizadoEn: F().serverTimestamp() }
      };
    });
    await ejecutarOperaciones(operaciones);
    return await obtenerDetalleMalla(mallaId);
  }

  async function guardarEquivalencia(datos) {
    datos = datos || {};
    await abrirSDK();
    var mallaId = texto(datos.mallaId);
    var nombreDetectado = texto(datos.nombreDetectado);
    var nivelDetectado = numero(datos.nivelDetectado, 0);
    var mallaMateriaId = texto(datos.mallaMateriaId || datos.oficialId);
    if (!mallaId || !nombreDetectado || !mallaMateriaId) throw new Error("La equivalencia está incompleta.");
    var id = [mallaId, "n" + pad(nivelDetectado, 2), slug(nombreDetectado)].join("__").slice(0, 1000);
    var data = {
      mallaId: mallaId,
      carreraId: texto(datos.carreraId),
      mallaMateriaId: mallaMateriaId,
      nombreOficial: texto(datos.nombreOficial),
      nivelOficial: numero(datos.nivelOficial, 0),
      nombreDetectado: nombreDetectado,
      nombreDetectadoNormalizado: normalizar(nombreDetectado),
      nivelDetectado: nivelDetectado,
      criterio: texto(datos.criterio || "arrastre_manual"),
      activa: true,
      actualizadoEn: F().serverTimestamp()
    };
    var snap = await F().getDoc(doc(COLECCIONES.EQUIVALENCIAS, id));
    if (!snap.exists()) data.creadoEn = F().serverTimestamp();
    await F().setDoc(doc(COLECCIONES.EQUIVALENCIAS, id), data, { merge: true });
    return Object.assign({ id: id }, data);
  }

  async function eliminarEquivalencia(equivalenciaId) {
    await abrirSDK();
    await F().deleteDoc(doc(COLECCIONES.EQUIVALENCIAS, equivalenciaId));
    return true;
  }

  async function registrarComparacion(datos) {
    datos = datos || {};
    await abrirSDK();
    var id = "comparacion_" + new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17) + "_" + Math.random().toString(36).slice(2, 7);
    await F().setDoc(doc(COLECCIONES.COMPARACIONES, id), Object.assign({}, limpiarObjeto(datos), {
      creadoEn: F().serverTimestamp()
    }));
    return id;
  }

  NS.Mallas = {
    VERSION: VERSION,
    __instalada: true,
    COLECCIONES: COLECCIONES,
    normalizar: normalizar,
    guardarMalla: guardarMalla,
    obtenerMallas: obtenerMallas,
    obtenerDetalleMalla: obtenerDetalleMalla,
    obtenerMallaVigenteParaCarrera: obtenerMallaVigenteParaCarrera,
    activarMalla: activarMalla,
    actualizarNombreCarrera: actualizarNombreCarrera,
    actualizarNombreMateria: actualizarNombreMateria,
    guardarEquivalencia: guardarEquivalencia,
    eliminarEquivalencia: eliminarEquivalencia,
    registrarComparacion: registrarComparacion
  };
})(window);
