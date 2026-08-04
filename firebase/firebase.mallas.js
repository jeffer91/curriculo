/* =========================================================
Nombre completo: firebase.mallas.js
Ruta o ubicación: /Curriculo/firebase/firebase.mallas.js
Funciones:
- Guardar versiones de mallas curriculares en colecciones planas de Firestore.
- Consultar y activar la malla vigente de cada carrera.
- Administrar materias oficiales, requisitos y equivalencias de nombres.
- Registrar resultados de comparación entre una malla y un ZIP curricular.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  if (NS.Mallas && NS.Mallas.__instalada === true) return;

  var VERSION = "1.0.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var COLECCIONES = Object.freeze({
    MALLAS: "mallas_curriculares",
    MATERIAS: "malla_materias",
    REQUISITOS: "malla_requisitos",
    EQUIVALENCIAS: "malla_equivalencias",
    COMPARACIONES: "malla_comparaciones"
  });
  var estado = { appSDK: null, firestoreSDK: null, app: null, db: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
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
    if (/^carrera_[a-z0-9_]+$/i.test(id)) return id.toLowerCase();
    return "carrera_" + slug(datos && (datos.carreraNombre || datos.nombreCarrera || id));
  }

  function crearMallaId(datos) {
    if (texto(datos && datos.id)) return texto(datos.id);
    var carreraId = carreraIdDe(datos);
    var version = Math.max(1, numero(datos && datos.version, 1));
    return "malla_" + slug(carreraId) + "_v" + pad(version, 3);
  }

  function crearMateriaId(mallaId, materia, indice) {
    var nivel = Math.max(0, numero(materia && materia.nivelNumero, 0));
    var identidad = texto(materia && materia.codigo) || texto(materia && materia.nombreOficial) || "materia";
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

  async function operacionesEliminarPorMalla(nombreColeccion, mallaId) {
    var existentes = await consultarCampo(nombreColeccion, "mallaId", mallaId);
    return existentes.map(function (item) {
      return { tipo: "delete", coleccion: nombreColeccion, id: item.id };
    });
  }

  function validarMalla(datos) {
    var errores = [];
    if (!texto(datos && (datos.carreraNombre || datos.nombreCarrera))) errores.push("La carrera es obligatoria.");
    if (!arr(datos && datos.materias).length) errores.push("La malla debe contener al menos una materia.");
    var vistos = {};
    arr(datos && datos.materias).forEach(function (materia, indice) {
      var nombre = texto(materia && materia.nombreOficial);
      var nivel = numero(materia && materia.nivelNumero, 0);
      if (!nombre) errores.push("La materia de la fila " + (indice + 1) + " no tiene nombre.");
      if (nivel < 1) errores.push("La materia " + (nombre || indice + 1) + " no tiene nivel válido.");
      var clave = nivel + "|" + normalizar(nombre);
      if (nombre && vistos[clave]) errores.push("Materia duplicada en el nivel " + nivel + ": " + nombre + ".");
      vistos[clave] = true;
    });
    if (errores.length) throw new Error(errores.join(" | "));
  }

  async function guardarMalla(datos) {
    datos = datos || {};
    validarMalla(datos);
    await abrirSDK();

    var mallaId = crearMallaId(datos);
    var carreraId = carreraIdDe(datos);
    var carreraNombre = texto(datos.carreraNombre || datos.nombreCarrera);
    var version = Math.max(1, numero(datos.version, 1));
    var vigente = datos.vigente !== false;
    var materias = arr(datos.materias);
    var requisitos = arr(datos.requisitos);
    var niveles = {};
    materias.forEach(function (materia) { niveles[numero(materia.nivelNumero, 0)] = true; });

    var operaciones = [];
    operaciones = operaciones.concat(await operacionesEliminarPorMalla(COLECCIONES.MATERIAS, mallaId));
    operaciones = operaciones.concat(await operacionesEliminarPorMalla(COLECCIONES.REQUISITOS, mallaId));

    if (vigente) {
      var versionesCarrera = await consultarCampo(COLECCIONES.MALLAS, "carreraId", carreraId);
      versionesCarrera.forEach(function (malla) {
        if (malla.id !== mallaId && malla.estado === "vigente") {
          operaciones.push({
            tipo: "set",
            coleccion: COLECCIONES.MALLAS,
            id: malla.id,
            merge: true,
            data: { estado: "historica", vigente: false, actualizadoEn: F().serverTimestamp() }
          });
        }
      });
    }

    var mallaDoc = {
      carreraId: carreraId,
      carreraNombre: carreraNombre,
      carreraNombreNormalizado: normalizar(carreraNombre),
      nombre: texto(datos.nombre) || "Malla curricular de " + carreraNombre,
      version: version,
      periodoInicio: texto(datos.periodoInicio),
      periodoFin: texto(datos.periodoFin),
      estado: vigente ? "vigente" : texto(datos.estado || "borrador"),
      vigente: vigente,
      totalNiveles: Object.keys(niveles).filter(function (n) { return Number(n) > 0; }).length,
      totalMaterias: materias.length,
      totalRequisitos: requisitos.length,
      fuente: limpiarObjeto(datos.fuente || { tipo: "manual" }),
      observaciones: texto(datos.observaciones),
      actualizadoEn: F().serverTimestamp()
    };

    var existente = await F().getDoc(doc(COLECCIONES.MALLAS, mallaId));
    if (!existente.exists()) mallaDoc.creadoEn = F().serverTimestamp();
    operaciones.push({ tipo: "set", coleccion: COLECCIONES.MALLAS, id: mallaId, data: mallaDoc, merge: true });

    materias.forEach(function (materia, indice) {
      var materiaId = texto(materia.id) || crearMateriaId(mallaId, materia, indice);
      operaciones.push({
        tipo: "set",
        coleccion: COLECCIONES.MATERIAS,
        id: materiaId,
        data: {
          mallaId: mallaId,
          carreraId: carreraId,
          carreraNombre: carreraNombre,
          mallaVersion: version,
          nivelNumero: numero(materia.nivelNumero, 0),
          nivelNombre: texto(materia.nivelNombre) || numero(materia.nivelNumero, 0) + ". Nivel",
          orden: numero(materia.orden, indice + 1),
          codigo: texto(materia.codigo),
          nombreOficial: texto(materia.nombreOficial),
          nombreNormalizado: normalizar(materia.nombreOficial),
          tipo: texto(materia.tipo || "asignatura"),
          obligatoria: materia.obligatoria !== false,
          activa: materia.activa !== false,
          actualizadoEn: F().serverTimestamp(),
          creadoEn: F().serverTimestamp()
        }
      });
    });

    requisitos.forEach(function (requisito, indice) {
      operaciones.push({
        tipo: "set",
        coleccion: COLECCIONES.REQUISITOS,
        id: mallaId + "__req_" + pad(indice + 1, 3),
        data: {
          mallaId: mallaId,
          carreraId: carreraId,
          orden: numero(requisito.orden, indice + 1),
          tipo: texto(requisito.tipo || "otro"),
          nombre: texto(requisito.nombre || requisito),
          activo: requisito.activo !== false,
          actualizadoEn: F().serverTimestamp()
        }
      });
    });

    await ejecutarOperaciones(operaciones);
    return await obtenerDetalleMalla(mallaId);
  }

  async function obtenerMallas(opciones) {
    opciones = opciones || {};
    await abrirSDK();
    var items = opciones.carreraId
      ? await consultarCampo(COLECCIONES.MALLAS, "carreraId", opciones.carreraId)
      : lista(await F().getDocs(col(COLECCIONES.MALLAS)));
    return items.sort(function (a, b) {
      if (a.carreraNombre !== b.carreraNombre) return texto(a.carreraNombre).localeCompare(texto(b.carreraNombre), "es");
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
      materias: resultados[1].sort(function (a, b) { return numero(a.nivelNumero, 0) - numero(b.nivelNumero, 0) || numero(a.orden, 0) - numero(b.orden, 0); }),
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
    guardarEquivalencia: guardarEquivalencia,
    eliminarEquivalencia: eliminarEquivalencia,
    registrarComparacion: registrarComparacion
  };
})(window);
