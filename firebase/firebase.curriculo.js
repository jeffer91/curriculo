/* =========================================================
Nombre completo: firebase.curriculo.js
Ruta o ubicación: /Curriculo/firebase/firebase.curriculo.js
Funciones:
- Inicializar Firebase y Cloud Firestore para el proyecto curriculo-ddfcd.
- Guardar la estructura curricular en colecciones planas.
- Comparar cada carga contra la versión vigente y escribir solo diferencias.
- Crear historial de versiones y cambios sin subcolecciones.
- Proveer consultas para Subir ZIP, Firebase y Comunicados.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  var VERSION = "1.0.0";
  var SDK_VERSION = "12.16.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/";
  var CONFIG = Object.freeze({
    apiKey: "AIzaSyB56KzqQmNesXuoQLgLEMrK9H-NOwuqEh8",
    authDomain: "curriculo-ddfcd.firebaseapp.com",
    projectId: "curriculo-ddfcd",
    storageBucket: "curriculo-ddfcd.firebasestorage.app",
    messagingSenderId: "895337192000",
    appId: "1:895337192000:web:20e456628871ce83679da5"
  });
  var COLECCIONES = Object.freeze({
    CARRERAS: "carreras",
    MATERIAS: "materias",
    PEA_BASE: "pea_base",
    PEA_UNIDADES: "pea_unidades",
    PEA_ACTIVIDADES: "pea_actividades",
    CARGAS: "cargas",
    VERSIONES: "materia_versiones",
    CAMBIOS: "materia_cambios",
    COMUNICADOS: "comunicados",
    CONFIGURACION: "configuracion"
  });
  var MAX_OPERACIONES_LOTE = 400;
  var estado = {
    app: null,
    db: null,
    appSDK: null,
    firestoreSDK: null,
    inicializado: false,
    error: null
  };
  var promesaInicializacion = null;

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

  function fechaISO() {
    return new Date().toISOString();
  }

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
  }

  function normalizarCarrera(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-–—./]+/g, " ")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function nombreOficialCarrera(carrera) {
    return texto(carrera && (
      carrera.nombreInstitucional ||
      carrera.nombreCorregido ||
      carrera.nombreMostrar ||
      carrera.nombre
    ));
  }

  function textosUnicos(valores) {
    var vistos = {};
    return arr(valores).map(texto).filter(function (valor) {
      if (!valor) return false;
      var clave = normalizarCarrera(valor);
      if (!clave || vistos[clave]) return false;
      vistos[clave] = true;
      return true;
    });
  }

  function inteligencia() {
    if (!NS.Inteligencia) {
      throw new Error("Falta cargar firebase.inteligencia.js antes de firebase.curriculo.js.");
    }
    return NS.Inteligencia;
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function inicializar() {
    if (estado.inicializado && estado.db) return estado.db;
    if (promesaInicializacion) return promesaInicializacion;

    promesaInicializacion = (async function () {
      try {
        var modulos = await Promise.all([
          importarModulo(SDK_BASE + "firebase-app.js"),
          importarModulo(SDK_BASE + "firebase-firestore.js")
        ]);
        estado.appSDK = modulos[0];
        estado.firestoreSDK = modulos[1];
        estado.app = estado.appSDK.getApps().length
          ? estado.appSDK.getApp()
          : estado.appSDK.initializeApp(CONFIG);

        try {
          estado.db = estado.firestoreSDK.initializeFirestore(estado.app, {
            experimentalAutoDetectLongPolling: true
          });
        } catch (errorInicializacion) {
          estado.db = estado.firestoreSDK.getFirestore(estado.app);
        }

        estado.inicializado = true;
        estado.error = null;
        return estado.db;
      } catch (error) {
        estado.error = error;
        estado.inicializado = false;
        promesaInicializacion = null;
        throw new Error("No se pudo conectar con Firebase: " + (error && error.message ? error.message : error));
      }
    })();

    return promesaInicializacion;
  }

  function sdk() {
    if (!estado.firestoreSDK || !estado.db) {
      throw new Error("Firebase todavía no está inicializado.");
    }
    return estado.firestoreSDK;
  }

  function referencia(coleccion, id) {
    return sdk().doc(estado.db, coleccion, texto(id));
  }

  function coleccion(nombre) {
    return sdk().collection(estado.db, nombre);
  }

  function plano(snapshot) {
    return snapshot && snapshot.exists()
      ? Object.assign({ id: snapshot.id }, snapshot.data())
      : null;
  }

  function listaPlana(querySnapshot) {
    return querySnapshot.docs.map(function (docSnap) {
      return Object.assign({ id: docSnap.id }, docSnap.data());
    });
  }

  async function probarConexion() {
    try {
      await inicializar();
      var q = sdk().query(coleccion(COLECCIONES.CARRERAS), sdk().limit(1));
      await sdk().getDocs(q);
      return {
        ok: true,
        estado: "conectado",
        proyectoId: CONFIG.projectId,
        mensaje: "Firebase Firestore está conectado."
      };
    } catch (error) {
      return {
        ok: false,
        estado: "error",
        proyectoId: CONFIG.projectId,
        mensaje: error && error.message ? error.message : "No se pudo conectar con Firebase."
      };
    }
  }

  function opSet(coleccionNombre, id, data, merge) {
    return { tipo: "set", coleccion: coleccionNombre, id: texto(id), data: data || {}, merge: merge === true };
  }

  function opDelete(coleccionNombre, id) {
    return { tipo: "delete", coleccion: coleccionNombre, id: texto(id) };
  }

  async function ejecutarOperaciones(operaciones, onProgress) {
    operaciones = arr(operaciones).filter(function (op) { return op && op.id && op.coleccion; });
    if (!operaciones.length) return { lotes: 0, operaciones: 0 };
    await inicializar();

    var totalLotes = Math.ceil(operaciones.length / MAX_OPERACIONES_LOTE);
    var ejecutadas = 0;

    for (var inicio = 0, loteNumero = 1; inicio < operaciones.length; inicio += MAX_OPERACIONES_LOTE, loteNumero += 1) {
      var tramo = operaciones.slice(inicio, inicio + MAX_OPERACIONES_LOTE);
      var batch = sdk().writeBatch(estado.db);

      tramo.forEach(function (op) {
        var ref = referencia(op.coleccion, op.id);
        if (op.tipo === "delete") batch.delete(ref);
        else if (op.merge) batch.set(ref, op.data, { merge: true });
        else batch.set(ref, op.data);
      });

      if (typeof onProgress === "function") {
        onProgress({
          etapa: "firebase",
          porcentaje: 55 + Math.round((loteNumero / totalLotes) * 35),
          mensaje: "Guardando lote " + loteNumero + " de " + totalLotes + " en Firebase..."
        });
      }

      await batch.commit();
      ejecutadas += tramo.length;
    }

    return { lotes: totalLotes, operaciones: ejecutadas };
  }

  async function consultarPorCampo(nombreColeccion, campo, valor) {
    await inicializar();
    var q = sdk().query(coleccion(nombreColeccion), sdk().where(campo, "==", valor));
    return listaPlana(await sdk().getDocs(q));
  }

  function mapaPorId(lista) {
    var mapa = {};
    arr(lista).forEach(function (item) {
      if (item && texto(item.id)) mapa[texto(item.id)] = item;
    });
    return mapa;
  }

  function agruparPorMateria(lista) {
    var mapa = {};
    arr(lista).forEach(function (item) {
      var materiaId = texto(item && item.materiaId);
      if (!mapa[materiaId]) mapa[materiaId] = [];
      mapa[materiaId].push(item);
    });
    Object.keys(mapa).forEach(function (materiaId) {
      mapa[materiaId].sort(function (a, b) {
        return numero(a.unidadNumero, 0) - numero(b.unidadNumero, 0);
      });
    });
    return mapa;
  }

  async function cargarEstadoCarrera(carreraId) {
    var resultados = await Promise.all([
      consultarPorCampo(COLECCIONES.MATERIAS, "carreraId", carreraId),
      consultarPorCampo(COLECCIONES.PEA_BASE, "carreraId", carreraId),
      consultarPorCampo(COLECCIONES.PEA_UNIDADES, "carreraId", carreraId),
      consultarPorCampo(COLECCIONES.PEA_ACTIVIDADES, "carreraId", carreraId)
    ]);

    return {
      materias: resultados[0],
      materiasPorId: mapaPorId(resultados[0]),
      basePorMateria: mapaPorId(resultados[1]),
      unidadesPorMateria: agruparPorMateria(resultados[2]),
      actividadesPorMateria: mapaPorId(resultados[3])
    };
  }

  function snapshotExistente(materia, peaBase, unidades, peaActividades) {
    return inteligencia().crearSnapshot(
      materia || {},
      peaBase || {},
      unidades || [],
      peaActividades || { actividades: [] }
    );
  }

  function datosConMarcas(data, cargaId, esNuevo) {
    var limpio = inteligencia().limpiarProfundo(data, { conservarVolatiles: true });
    limpio.cargaId = cargaId;
    limpio.actualizadoEn = sdk().serverTimestamp();
    if (esNuevo) limpio.creadoEn = sdk().serverTimestamp();
    return limpio;
  }

  function operacionesVersion(materiaAnterior, snapshotAnterior, version, cargaId) {
    var materiaId = materiaAnterior.id;
    var baseId = materiaId + "__v" + pad(version, 4);
    var unidades = arr(snapshotAnterior.unidades);
    var idsFragmentos = [baseId + "__materia", baseId + "__base", baseId + "__actividades"];
    unidades.forEach(function (unidad) {
      idsFragmentos.push(baseId + "__unidad_" + pad(unidad.unidadNumero, 3));
    });

    var comunes = {
      materiaId: materiaId,
      carreraId: materiaAnterior.carreraId,
      version: version,
      hashContenido: inteligencia().hashContenido(snapshotAnterior),
      cargaQueReemplazaId: cargaId,
      guardadoEn: sdk().serverTimestamp()
    };
    var operaciones = [
      opSet(COLECCIONES.VERSIONES, baseId, Object.assign({}, comunes, {
        tipo: "resumen",
        nombreMateria: materiaAnterior.nombre,
        codigoMateria: materiaAnterior.codigo,
        nivelNumero: materiaAnterior.nivelNumero,
        fragmentos: idsFragmentos,
        totalFragmentos: idsFragmentos.length,
        resumen: {
          totalUnidades: unidades.length,
          totalContenidos: unidades.reduce(function (t, u) { return t + arr(u.contenidos).length; }, 0),
          totalActividades: arr(snapshotAnterior.actividades).length
        }
      })),
      opSet(COLECCIONES.VERSIONES, baseId + "__materia", Object.assign({}, comunes, {
        tipo: "materia",
        contenido: snapshotAnterior.materia || {}
      })),
      opSet(COLECCIONES.VERSIONES, baseId + "__base", Object.assign({}, comunes, {
        tipo: "pea_base",
        contenido: snapshotAnterior.peaBase || {}
      })),
      opSet(COLECCIONES.VERSIONES, baseId + "__actividades", Object.assign({}, comunes, {
        tipo: "pea_actividades",
        contenido: snapshotAnterior.actividades || []
      }))
    ];

    unidades.forEach(function (unidad) {
      operaciones.push(opSet(COLECCIONES.VERSIONES, baseId + "__unidad_" + pad(unidad.unidadNumero, 3), Object.assign({}, comunes, {
        tipo: "pea_unidad",
        unidadNumero: unidad.unidadNumero,
        contenido: unidad
      })));
    });

    return operaciones;
  }

  function operacionCambio(materiaId, carreraId, versionAnterior, versionNueva, tipoCambio, diff, cargaId) {
    return opSet(COLECCIONES.CAMBIOS, materiaId + "__v" + pad(versionNueva, 4), {
      materiaId: materiaId,
      carreraId: carreraId,
      versionAnterior: versionAnterior,
      versionNueva: versionNueva,
      tipoCambio: tipoCambio,
      seccionesCambiadas: diff.seccionesCambiadas || [],
      resumen: diff.resumen || "",
      detalle: diff.detalle || {},
      hashAnterior: diff.hashAnterior || "",
      hashNuevo: diff.hashNuevo || "",
      cargaId: cargaId,
      creadoEn: sdk().serverTimestamp()
    });
  }

  function operacionesNuevaMateria(item, cargaId) {
    var materia = Object.assign({}, item.materia, {
      versionActual: 1,
      cargaId: cargaId,
      ultimaCargaId: cargaId
    });
    var operaciones = [
      opSet(COLECCIONES.MATERIAS, materia.id, datosConMarcas(materia, cargaId, true), true),
      opSet(COLECCIONES.PEA_BASE, materia.id, datosConMarcas(item.peaBase, cargaId, true)),
      opSet(COLECCIONES.PEA_ACTIVIDADES, materia.id, datosConMarcas(item.actividades, cargaId, true))
    ];
    item.unidades.forEach(function (unidad) {
      operaciones.push(opSet(COLECCIONES.PEA_UNIDADES, unidad.id, datosConMarcas(unidad, cargaId, true)));
    });
    var diff = inteligencia().compararSnapshots({}, item.snapshot);
    diff.resumen = "Materia creada por primera vez en Firebase.";
    diff.seccionesCambiadas = ["materia", "pea_base", "pea_unidades", "pea_actividades"];
    operaciones.push(operacionCambio(materia.id, materia.carreraId, 0, 1, "creacion", diff, cargaId));
    return operaciones;
  }

  function operacionesMateriaModificada(item, anterior, estadoCarrera, cargaId) {
    var materiaAnterior = anterior;
    var baseAnterior = estadoCarrera.basePorMateria[materiaAnterior.id] || {};
    var unidadesAnteriores = estadoCarrera.unidadesPorMateria[materiaAnterior.id] || [];
    var actividadesAnteriores = estadoCarrera.actividadesPorMateria[materiaAnterior.id] || { actividades: [] };
    var snapshotAnterior = snapshotExistente(materiaAnterior, baseAnterior, unidadesAnteriores, actividadesAnteriores);
    var diff = inteligencia().compararSnapshots(snapshotAnterior, item.snapshot);
    if (!diff.cambioReal) return { operaciones: [], diff: diff, versionNueva: numero(materiaAnterior.versionActual, 1) };

    var versionAnterior = Math.max(1, numero(materiaAnterior.versionActual, 1));
    var versionNueva = versionAnterior + 1;
    var operaciones = operacionesVersion(materiaAnterior, snapshotAnterior, versionAnterior, cargaId);
    var materiaNueva = Object.assign({}, item.materia, {
      versionActual: versionNueva,
      ultimaCargaId: cargaId
    });

    operaciones.push(opSet(COLECCIONES.MATERIAS, materiaNueva.id, datosConMarcas(materiaNueva, cargaId, false), true));

    if (!materiaAnterior.hashSecciones || materiaAnterior.hashSecciones.peaBase !== item.materia.hashSecciones.peaBase) {
      operaciones.push(opSet(COLECCIONES.PEA_BASE, materiaNueva.id, datosConMarcas(item.peaBase, cargaId, false)));
    }

    if (!materiaAnterior.hashSecciones || materiaAnterior.hashSecciones.actividades !== item.materia.hashSecciones.actividades) {
      operaciones.push(opSet(COLECCIONES.PEA_ACTIVIDADES, materiaNueva.id, datosConMarcas(item.actividades, cargaId, false)));
    }

    if (!materiaAnterior.hashSecciones || materiaAnterior.hashSecciones.unidades !== item.materia.hashSecciones.unidades) {
      var previasPorId = mapaPorId(unidadesAnteriores);
      var nuevasPorId = mapaPorId(item.unidades);
      item.unidades.forEach(function (unidad) {
        if (!previasPorId[unidad.id] || inteligencia().hashContenido(previasPorId[unidad.id]) !== inteligencia().hashContenido(unidad)) {
          operaciones.push(opSet(COLECCIONES.PEA_UNIDADES, unidad.id, datosConMarcas(unidad, cargaId, !previasPorId[unidad.id])));
        }
      });
      Object.keys(previasPorId).forEach(function (unidadId) {
        if (!nuevasPorId[unidadId]) operaciones.push(opDelete(COLECCIONES.PEA_UNIDADES, unidadId));
      });
    }

    operaciones.push(operacionCambio(materiaNueva.id, materiaNueva.carreraId, versionAnterior, versionNueva, "actualizacion", diff, cargaId));
    return { operaciones: operaciones, diff: diff, versionNueva: versionNueva };
  }

  function operacionesMateriaRetirada(materiaAnterior, estadoCarrera, cargaId) {
    if (materiaAnterior.activo === false || materiaAnterior.estadoValidacion === "retirado") {
      return { operaciones: [], versionNueva: numero(materiaAnterior.versionActual, 1), diff: null };
    }
    var baseAnterior = estadoCarrera.basePorMateria[materiaAnterior.id] || {};
    var unidadesAnteriores = estadoCarrera.unidadesPorMateria[materiaAnterior.id] || [];
    var actividadesAnteriores = estadoCarrera.actividadesPorMateria[materiaAnterior.id] || { actividades: [] };
    var snapshotAnterior = snapshotExistente(materiaAnterior, baseAnterior, unidadesAnteriores, actividadesAnteriores);
    var snapshotRetirado = JSON.parse(JSON.stringify(snapshotAnterior));
    snapshotRetirado.materia.activo = false;
    snapshotRetirado.materia.estadoValidacion = "retirado";
    var diff = inteligencia().compararSnapshots(snapshotAnterior, snapshotRetirado);
    diff.resumen = "La materia ya no aparece en la nueva carga completa de la carrera y quedó marcada como retirada.";
    var versionAnterior = Math.max(1, numero(materiaAnterior.versionActual, 1));
    var versionNueva = versionAnterior + 1;
    var operaciones = operacionesVersion(materiaAnterior, snapshotAnterior, versionAnterior, cargaId);
    operaciones.push(opSet(COLECCIONES.MATERIAS, materiaAnterior.id, {
      activo: false,
      estadoValidacion: "retirado",
      versionActual: versionNueva,
      hashContenido: inteligencia().hashContenido(snapshotRetirado),
      hashSecciones: Object.assign({}, materiaAnterior.hashSecciones || {}, {
        materia: inteligencia().hashContenido(snapshotRetirado.materia)
      }),
      ultimaCargaId: cargaId,
      retiradoEn: sdk().serverTimestamp(),
      actualizadoEn: sdk().serverTimestamp()
    }, true));
    operaciones.push(operacionCambio(materiaAnterior.id, materiaAnterior.carreraId, versionAnterior, versionNueva, "retiro", diff, cargaId));
    return { operaciones: operaciones, versionNueva: versionNueva, diff: diff };
  }

  function nombreZip(paquete) {
    return texto(
      paquete && paquete.carga && paquete.carga.nombreZip ||
      paquete && paquete.zip && (paquete.zip.nombre || paquete.zip.nombreZip) ||
      paquete && paquete.nombreZip ||
      "carga-curricular.zip"
    );
  }

  function crearCargaId() {
    return "carga_" + fechaISO().replace(/[^0-9]/g, "").slice(0, 17) + "_" + Math.random().toString(36).slice(2, 7);
  }

  async function importarPaquete(paquete, opciones) {
    opciones = opciones || {};
    await inicializar();
    var I = inteligencia();
    var cargaId = crearCargaId();
    var paqueteCanonico = await resolverCarrerasCanonicasPaquete(paquete);
    var preparado = I.prepararPaquete(paqueteCanonico, cargaId);
    var cargaRef = referencia(COLECCIONES.CARGAS, cargaId);
    var resumen = {
      totalCarreras: preparado.carreras.length,
      totalMaterias: preparado.materias.length,
      materiasCompletas: preparado.materias.filter(function (item) {
        return item.materia.estadoValidacion === "completo" || item.materia.estadoValidacion === "completa";
      }).length,
      nuevas: 0,
      actualizadas: 0,
      sinCambios: 0,
      retiradas: 0,
      versionesCreadas: 0,
      operacionesFirestore: 0
    };
    var cambiosCarga = [];

    await sdk().setDoc(cargaRef, {
      nombreZip: nombreZip(paquete),
      estado: "procesando",
      origen: "subir_zip",
      totalCarreras: resumen.totalCarreras,
      totalMaterias: resumen.totalMaterias,
      resumenValidacion: preparado.resumenOriginal,
      observaciones: preparado.observaciones,
      iniciadoEn: sdk().serverTimestamp(),
      creadoEn: sdk().serverTimestamp()
    });

    try {
      var todasOperaciones = [];

      for (var c = 0; c < preparado.carreras.length; c += 1) {
        var carrera = preparado.carreras[c];
        if (typeof opciones.onProgress === "function") {
          opciones.onProgress({
            etapa: "comparacion",
            porcentaje: 20 + Math.round(((c + 1) / preparado.carreras.length) * 25),
            mensaje: "Comparando " + carrera.nombre + " con la versión guardada..."
          });
        }

        var estadoCarrera = await cargarEstadoCarrera(carrera.id);
        var nuevasCarrera = preparado.materias.filter(function (item) {
          return item.materia.carreraId === carrera.id;
        });
        var idsNuevos = {};
        nuevasCarrera.forEach(function (item) { idsNuevos[item.materia.id] = true; });
        var cambiosCarrera = 0;

        for (var m = 0; m < nuevasCarrera.length; m += 1) {
          var item = nuevasCarrera[m];
          var anterior = estadoCarrera.materiasPorId[item.materia.id] || null;

          if (!anterior) {
            todasOperaciones = todasOperaciones.concat(operacionesNuevaMateria(item, cargaId));
            resumen.nuevas += 1;
            cambiosCarrera += 1;
            cambiosCarga.push({ materiaId: item.materia.id, nombre: item.materia.nombre, tipo: "creacion", version: 1 });
            continue;
          }

          if (texto(anterior.hashContenido) === texto(item.materia.hashContenido) && anterior.activo !== false) {
            resumen.sinCambios += 1;
            continue;
          }

          var modificacion = operacionesMateriaModificada(item, anterior, estadoCarrera, cargaId);
          if (!modificacion.operaciones.length) {
            resumen.sinCambios += 1;
          } else {
            todasOperaciones = todasOperaciones.concat(modificacion.operaciones);
            resumen.actualizadas += 1;
            resumen.versionesCreadas += 1;
            cambiosCarrera += 1;
            cambiosCarga.push({
              materiaId: item.materia.id,
              nombre: item.materia.nombre,
              tipo: "actualizacion",
              version: modificacion.versionNueva,
              resumen: modificacion.diff.resumen
            });
          }
        }

        if (opciones.detectarEliminadas !== false) {
          estadoCarrera.materias.forEach(function (materiaAnterior) {
            if (idsNuevos[materiaAnterior.id]) return;
            var retiro = operacionesMateriaRetirada(materiaAnterior, estadoCarrera, cargaId);
            if (!retiro.operaciones.length) return;
            todasOperaciones = todasOperaciones.concat(retiro.operaciones);
            resumen.retiradas += 1;
            resumen.versionesCreadas += 1;
            cambiosCarrera += 1;
            cambiosCarga.push({
              materiaId: materiaAnterior.id,
              nombre: materiaAnterior.nombre,
              tipo: "retiro",
              version: retiro.versionNueva,
              resumen: retiro.diff.resumen
            });
          });
        }

        var carreraExistente = await sdk().getDoc(referencia(COLECCIONES.CARRERAS, carrera.id));
        if (!carreraExistente.exists() || cambiosCarrera > 0) {
          todasOperaciones.push(opSet(COLECCIONES.CARRERAS, carrera.id, datosConMarcas(Object.assign({}, carrera, {
            ultimaCargaId: cargaId,
            totalMateriasActivas: nuevasCarrera.length
          }), cargaId, !carreraExistente.exists()), true));
        }
      }

      var resultadoLotes = await ejecutarOperaciones(todasOperaciones, opciones.onProgress);
      resumen.operacionesFirestore = resultadoLotes.operaciones;

      await sdk().updateDoc(cargaRef, {
        estado: cambiosCarga.length ? "completado_con_cambios" : "completado_sin_cambios",
        resumen: resumen,
        cambios: cambiosCarga.slice(0, 200),
        totalCambios: cambiosCarga.length,
        finalizadoEn: sdk().serverTimestamp(),
        actualizadoEn: sdk().serverTimestamp()
      });

      return {
        ok: true,
        estado: cambiosCarga.length ? "actualizado" : "sin_cambios",
        cargaId: cargaId,
        resumen: resumen,
        cambios: cambiosCarga,
        mensaje: cambiosCarga.length
          ? "Firebase fue actualizado y se crearon versiones únicamente para las materias modificadas."
          : "El contenido ya estaba actualizado. No se creó ninguna versión nueva."
      };
    } catch (error) {
      try {
        await sdk().updateDoc(cargaRef, {
          estado: "error",
          error: error && error.message ? error.message : texto(error),
          finalizadoEn: sdk().serverTimestamp(),
          actualizadoEn: sdk().serverTimestamp()
        });
      } catch (errorRegistro) {
        console.warn("[CurriculoFirebase] No se pudo registrar el error de carga:", errorRegistro);
      }
      throw error;
    }
  }

  async function obtenerCarreraCanonica(carreraId) {
    await inicializar();
    carreraId = texto(carreraId);
    if (!carreraId) return { id: "", carrera: null, solicitada: null };

    var solicitada = plano(await sdk().getDoc(referencia(COLECCIONES.CARRERAS, carreraId)));
    if (!solicitada) return { id: carreraId, carrera: null, solicitada: null };

    var destinoId = texto(solicitada.fusionadaConCarreraId);
    if (solicitada.estado === "fusionada" && destinoId && destinoId !== carreraId) {
      var destino = plano(await sdk().getDoc(referencia(COLECCIONES.CARRERAS, destinoId)));
      if (destino) return { id: destino.id, carrera: destino, solicitada: solicitada };
    }
    return { id: solicitada.id, carrera: solicitada, solicitada: solicitada };
  }

  async function obtenerCarreras() {
    await inicializar();
    var resultado = listaPlana(await sdk().getDocs(coleccion(COLECCIONES.CARRERAS)));
    return resultado.filter(function (item) {
      return item.estado !== "eliminado" && item.estado !== "fusionada" && item.activo !== false;
    }).map(function (item) {
      return Object.assign({}, item, { nombreMostrar: nombreOficialCarrera(item) || texto(item.nombre) });
    }).sort(function (a, b) {
      return nombreOficialCarrera(a).localeCompare(nombreOficialCarrera(b), "es");
    });
  }

  async function corregirNombreCarrera(carreraId, nombreOficial) {
    await inicializar();
    carreraId = texto(carreraId);
    nombreOficial = texto(nombreOficial);
    if (!carreraId || !nombreOficial) throw new Error("La carrera y el nombre oficial son obligatorios.");

    var ref = referencia(COLECCIONES.CARRERAS, carreraId);
    var snap = await sdk().getDoc(ref);
    if (!snap.exists()) throw new Error("No se encontró la carrera que deseas corregir.");
    var actual = Object.assign({ id: snap.id }, snap.data());
    if (actual.estado === "fusionada" && texto(actual.fusionadaConCarreraId)) {
      throw new Error("Esta carrera ya fue fusionada con otra carrera oficial.");
    }

    var anterior = nombreOficialCarrera(actual) || texto(actual.nombre);
    var alias = textosUnicos(arr(actual.aliasNombres).concat([
      actual.nombreOriginalImportado, actual.nombre, actual.nombreInstitucional, actual.nombreCorregido
    ])).filter(function (item) {
      return normalizarCarrera(item) !== normalizarCarrera(nombreOficial);
    });

    await sdk().setDoc(ref, {
      nombreOriginalImportado: texto(actual.nombreOriginalImportado || actual.nombre || anterior),
      nombre: nombreOficial,
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      aliasNombres: alias,
      activo: true,
      estado: actual.estado === "eliminado" ? "activo" : (actual.estado || "activo"),
      actualizadoEn: sdk().serverTimestamp()
    }, { merge: true });

    return Object.assign({}, actual, {
      nombre: nombreOficial,
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      nombreMostrar: nombreOficial,
      aliasNombres: alias,
      activo: true
    });
  }

  async function fusionarCarreras(carreraOrigenId, carreraDestinoId, opciones) {
    opciones = opciones || {};
    await inicializar();
    carreraOrigenId = texto(carreraOrigenId);
    carreraDestinoId = texto(carreraDestinoId);
    if (!carreraOrigenId || !carreraDestinoId || carreraOrigenId === carreraDestinoId) {
      throw new Error("Selecciona dos carreras diferentes para realizar la fusión.");
    }

    var snaps = await Promise.all([
      sdk().getDoc(referencia(COLECCIONES.CARRERAS, carreraOrigenId)),
      sdk().getDoc(referencia(COLECCIONES.CARRERAS, carreraDestinoId))
    ]);
    if (!snaps[0].exists()) throw new Error("No se encontró la carrera que deseas fusionar.");
    if (!snaps[1].exists()) throw new Error("No se encontró la carrera oficial de destino.");

    var origen = Object.assign({ id: snaps[0].id }, snaps[0].data());
    var destino = Object.assign({ id: snaps[1].id }, snaps[1].data());
    if (destino.estado === "fusionada" && texto(destino.fusionadaConCarreraId)) {
      var canonica = await obtenerCarreraCanonica(destino.id);
      if (canonica.carrera) {
        carreraDestinoId = canonica.id;
        destino = canonica.carrera;
      }
    }

    var nombreOficial = texto(opciones.nombreOficial) || nombreOficialCarrera(destino);
    if (!nombreOficial) throw new Error("La carrera de destino no tiene un nombre oficial.");

    var aliasIds = textosUnicos(arr(destino.aliasCarreraIds).concat(arr(origen.aliasCarreraIds)).concat([carreraOrigenId]))
      .filter(function (id) { return id !== carreraDestinoId; });
    var aliasNombres = textosUnicos(arr(destino.aliasNombres).concat(arr(origen.aliasNombres)).concat([
      origen.nombreOriginalImportado, origen.nombre, origen.nombreInstitucional, origen.nombreCorregido
    ])).filter(function (item) {
      return normalizarCarrera(item) !== normalizarCarrera(nombreOficial);
    });

    var batch = sdk().writeBatch(estado.db);
    batch.set(referencia(COLECCIONES.CARRERAS, carreraDestinoId), {
      nombre: nombreOficial,
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      aliasCarreraIds: aliasIds,
      aliasNombres: aliasNombres,
      activo: true,
      estado: destino.estado === "eliminado" ? "activo" : (destino.estado || "activo"),
      actualizadoEn: sdk().serverTimestamp()
    }, { merge: true });
    batch.set(referencia(COLECCIONES.CARRERAS, carreraOrigenId), {
      nombreOriginalImportado: texto(origen.nombreOriginalImportado || origen.nombre),
      nombre: nombreOficial,
      nombreInstitucional: nombreOficial,
      nombreCorregido: nombreOficial,
      estado: "fusionada",
      activo: false,
      fusionadaConCarreraId: carreraDestinoId,
      fusionadaConCarreraNombre: nombreOficial,
      fusionadaEn: sdk().serverTimestamp(),
      actualizadoEn: sdk().serverTimestamp()
    }, { merge: true });
    await batch.commit();

    return {
      ok: true,
      carreraId: carreraDestinoId,
      carreraNombre: nombreOficial,
      carreraOrigenId: carreraOrigenId,
      aliasCarreraIds: aliasIds,
      aliasNombres: aliasNombres
    };
  }

  async function resolverCarrerasCanonicasPaquete(paquete) {
    paquete = paquete || {};
    await inicializar();
    var todas = listaPlana(await sdk().getDocs(coleccion(COLECCIONES.CARRERAS)));
    if (!todas.length || !arr(paquete.carreras).length) return paquete;

    var porId = {};
    todas.forEach(function (item) { porId[texto(item.id)] = item; });

    function destinoDe(item) {
      var actual = item;
      var vistos = {};
      while (actual && actual.estado === "fusionada" && texto(actual.fusionadaConCarreraId) && !vistos[actual.id]) {
        vistos[actual.id] = true;
        actual = porId[texto(actual.fusionadaConCarreraId)] || actual;
        if (actual.id === item.id) break;
      }
      return actual;
    }
    function coincideNombre(item, clave) {
      if (!item || !clave) return false;
      return [nombreOficialCarrera(item), item.nombreOriginalImportado].concat(arr(item.aliasNombres))
        .some(function (nombre) { return normalizarCarrera(nombre) === clave; });
    }

    var mapaIds = {};
    var carrerasCanonicas = [];
    var vistosCanonicos = {};
    arr(paquete.carreras).forEach(function (carrera) {
      var originalId = texto(carrera && carrera.id);
      var clave = normalizarCarrera(carrera && (carrera.nombre || carrera.carrera));
      var encontrada = porId[originalId] || todas.find(function (item) { return coincideNombre(item, clave); }) || null;
      var destino = encontrada ? destinoDe(encontrada) : null;
      if (!destino) {
        carrerasCanonicas.push(carrera);
        if (originalId) mapaIds[originalId] = originalId;
        return;
      }
      var destinoId = texto(destino.id);
      if (originalId) mapaIds[originalId] = destinoId;
      if (vistosCanonicos[destinoId]) return;
      vistosCanonicos[destinoId] = true;
      carrerasCanonicas.push(Object.assign({}, carrera, {
        id: destinoId,
        nombre: nombreOficialCarrera(destino) || texto(carrera && (carrera.nombre || carrera.carrera)),
        carrera: nombreOficialCarrera(destino) || texto(carrera && (carrera.carrera || carrera.nombre)),
        carreraIdCanonico: destinoId
      }));
    });

    return Object.assign({}, paquete, {
      carreras: carrerasCanonicas,
      materias: arr(paquete.materias).map(function (materia) {
        var originalId = texto(materia && materia.carreraId);
        return Object.assign({}, materia, { carreraId: mapaIds[originalId] || originalId });
      })
    });
  }

  async function obtenerMateriasPorCarrera(carreraId, opciones) {
    opciones = opciones || {};
    var canonica = await obtenerCarreraCanonica(carreraId);
    var idCanonico = texto(canonica.id || carreraId);
    var carrera = canonica.carrera || {};
    var ids = textosUnicos([idCanonico].concat(arr(carrera.aliasCarreraIds)));
    var grupos = await Promise.all(ids.map(function (id) {
      return consultarPorCampo(COLECCIONES.MATERIAS, "carreraId", id);
    }));
    var mapa = {};
    grupos.forEach(function (lista) {
      arr(lista).forEach(function (materia) { mapa[texto(materia.id)] = materia; });
    });

    return Object.keys(mapa).map(function (id) { return mapa[id]; }).filter(function (materia) {
      if (opciones.incluirRetiradas !== true && materia.activo === false) return false;
      if (opciones.soloCompletas !== false && !["completo", "completa"].includes(texto(materia.estadoValidacion).toLowerCase())) return false;
      return true;
    }).map(function (materia) {
      return Object.assign({}, materia, {
        carreraIdCanonico: idCanonico,
        carreraNombreCanonico: nombreOficialCarrera(carrera),
        nombreMostrar: texto(materia.nombreInstitucional || materia.nombreCorregido || materia.nombre),
        totalArchivosEncontrados: numero(materia.totalArchivosEncontrados, 3)
      });
    }).sort(function (a, b) {
      if (numero(a.nivelNumero, 0) !== numero(b.nivelNumero, 0)) return numero(a.nivelNumero, 0) - numero(b.nivelNumero, 0);
      return texto(a.nombreMostrar).localeCompare(texto(b.nombreMostrar), "es");
    });
  }

  async function obtenerMateria(materiaId) {
    await inicializar();
    return plano(await sdk().getDoc(referencia(COLECCIONES.MATERIAS, materiaId)));
  }

  async function obtenerDetalleMateria(materiaId) {
    await inicializar();
    var materia = await obtenerMateria(materiaId);
    if (!materia) throw new Error("No se encontró la materia en Firebase.");
    var resultados = await Promise.all([
      obtenerCarreraCanonica(materia.carreraId),
      sdk().getDoc(referencia(COLECCIONES.PEA_BASE, materiaId)),
      consultarPorCampo(COLECCIONES.PEA_UNIDADES, "materiaId", materiaId),
      sdk().getDoc(referencia(COLECCIONES.PEA_ACTIVIDADES, materiaId))
    ]);
    var carrera = resultados[0] && resultados[0].carrera ? resultados[0].carrera : null;
    var peaBase = plano(resultados[1]);
    var unidades = resultados[2].sort(function (a, b) { return numero(a.unidadNumero, 0) - numero(b.unidadNumero, 0); });
    var actividadDoc = plano(resultados[3]) || { actividades: [] };
    var archivos = Object.keys(materia.archivos || {}).map(function (tipo) {
      var item = materia.archivos[tipo];
      return item ? Object.assign({ tipo: tipo === "base" ? "pea_base" : (tipo === "unidades" ? "pea_unidades" : "pea_actividades") }, item) : null;
    }).filter(Boolean);

    return {
      materia: Object.assign({}, materia, {
        nombreMostrar: texto(materia.nombreInstitucional || materia.nombreCorregido || materia.nombre)
      }),
      carrera: carrera,
      nivel: {
        id: "nivel_" + materia.carreraId + "_" + materia.nivelNumero,
        carreraId: materia.carreraId,
        numero: materia.nivelNumero,
        nombre: materia.nivelNombre
      },
      peaBase: peaBase,
      unidades: unidades,
      actividades: arr(actividadDoc.actividades),
      archivos: archivos
    };
  }

  async function guardarNombreInstitucionalMateria(materiaId, nombreInstitucional) {
    await inicializar();
    nombreInstitucional = texto(nombreInstitucional);
    if (!nombreInstitucional) throw new Error("El nombre institucional no puede estar vacío.");
    var materia = await obtenerMateria(materiaId);
    if (!materia) throw new Error("No se encontró la materia para actualizar.");
    await sdk().updateDoc(referencia(COLECCIONES.MATERIAS, materiaId), {
      nombreOriginalImportado: materia.nombreOriginalImportado || materia.nombre,
      nombreInstitucional: nombreInstitucional,
      nombreCorregido: nombreInstitucional,
      actualizadoEn: sdk().serverTimestamp()
    });
    return Object.assign({}, materia, {
      nombreOriginalImportado: materia.nombreOriginalImportado || materia.nombre,
      nombreInstitucional: nombreInstitucional,
      nombreCorregido: nombreInstitucional,
      nombreMostrar: nombreInstitucional
    });
  }

  async function obtenerResumenCarrera(carreraId) {
    var materias = await obtenerMateriasPorCarrera(carreraId, { soloCompletas: false, incluirRetiradas: false });
    return {
      totalMaterias: materias.length,
      completas: materias.filter(function (m) { return ["completo", "completa"].includes(texto(m.estadoValidacion).toLowerCase()); }).length,
      incompletas: materias.filter(function (m) { return ["incompleto", "error"].includes(texto(m.estadoValidacion).toLowerCase()); }).length,
      revision: materias.filter(function (m) { return ["revision", "advertencia"].includes(texto(m.estadoValidacion).toLowerCase()); }).length
    };
  }

  async function obtenerVersionesMateria(materiaId) {
    var versiones = await consultarPorCampo(COLECCIONES.VERSIONES, "materiaId", materiaId);
    return versiones.filter(function (item) { return item.tipo === "resumen"; }).sort(function (a, b) {
      return numero(b.version, 0) - numero(a.version, 0);
    });
  }

  async function obtenerCambiosMateria(materiaId) {
    var cambios = await consultarPorCampo(COLECCIONES.CAMBIOS, "materiaId", materiaId);
    return cambios.sort(function (a, b) {
      return numero(b.versionNueva, 0) - numero(a.versionNueva, 0);
    });
  }

  async function obtenerDashboard() {
    await inicializar();
    var nombres = [
      COLECCIONES.CARRERAS,
      COLECCIONES.MATERIAS,
      COLECCIONES.CARGAS,
      COLECCIONES.VERSIONES,
      COLECCIONES.CAMBIOS
    ];
    var resultados = await Promise.all(nombres.map(function (nombre) {
      return sdk().getDocs(coleccion(nombre));
    }));
    return {
      carreras: resultados[0].size,
      materias: resultados[1].docs.filter(function (d) { return d.data().activo !== false; }).length,
      cargas: resultados[2].size,
      versiones: resultados[3].docs.filter(function (d) { return d.data().tipo === "resumen"; }).length,
      cambios: resultados[4].size
    };
  }

  function fechaBase(fechaInput) {
    if (fechaInput instanceof Date && !Number.isNaN(fechaInput.getTime())) return fechaInput;
    var d = new Date(fechaInput || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function mesKey(fechaInput) {
    var d = fechaBase(fechaInput);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2);
  }

  async function obtenerContadorComunicados(fechaInput) {
    await inicializar();
    var id = "contador_comunicados_" + mesKey(fechaInput).replace("-", "_");
    var snap = await sdk().getDoc(referencia(COLECCIONES.CONFIGURACION, id));
    return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : { id: id, mesKey: mesKey(fechaInput), ultimo: 0 };
  }

  async function registrarNumeroComunicado(fechaInput, secuencia, datos, opciones) {
    await inicializar();
    opciones = opciones || {};
    secuencia = numero(secuencia, 0);
    if (secuencia < 1) throw new Error("La secuencia debe ser mayor a cero.");
    var key = mesKey(fechaInput);
    var contadorId = "contador_comunicados_" + key.replace("-", "_");
    var prefijo = texto(opciones.prefijo || "COM-ITSQMET-UGPA");
    var d = fechaBase(fechaInput);
    var numeroComunicado = [prefijo, d.getFullYear(), pad(d.getMonth() + 1, 2), secuencia < 100 ? pad(secuencia, 2) : secuencia].join("-");
    var comunicacionId = inteligencia().slug(numeroComunicado);

    return await sdk().runTransaction(estado.db, async function (transaction) {
      var contadorRef = referencia(COLECCIONES.CONFIGURACION, contadorId);
      var comunicadoRef = referencia(COLECCIONES.COMUNICADOS, comunicacionId);
      var snapshots = await Promise.all([transaction.get(contadorRef), transaction.get(comunicadoRef)]);
      var contadorActual = snapshots[0].exists() ? snapshots[0].data() : { ultimo: 0 };
      if (snapshots[1].exists() && opciones.permitirDuplicado !== true) {
        throw new Error("Ese número ya está registrado: " + numeroComunicado);
      }
      transaction.set(contadorRef, {
        tipo: "contador_comunicados",
        mesKey: key,
        ultimo: Math.max(numero(contadorActual.ultimo, 0), secuencia),
        actualizadoEn: sdk().serverTimestamp()
      }, { merge: true });
      transaction.set(comunicadoRef, Object.assign({
        numero: numeroComunicado,
        secuencia: secuencia,
        mesKey: key,
        fecha: d.toISOString(),
        creadoEn: sdk().serverTimestamp()
      }, inteligencia().limpiarProfundo(datos || {})), { merge: true });
      return {
        secuencia: secuencia,
        numero: numeroComunicado,
        mesKey: key,
        comunicadoId: comunicacionId
      };
    });
  }

  NS.VERSION = VERSION;
  NS.SDK_VERSION = SDK_VERSION;
  NS.CONFIG = CONFIG;
  NS.COLECCIONES = COLECCIONES;
  NS.inicializar = inicializar;
  NS.ready = inicializar;
  NS.probarConexion = probarConexion;
  NS.importarPaquete = importarPaquete;
  NS.obtenerCarreras = obtenerCarreras;
  NS.nombreOficialCarrera = nombreOficialCarrera;
  NS.normalizarCarrera = normalizarCarrera;
  NS.obtenerCarreraCanonica = obtenerCarreraCanonica;
  NS.corregirNombreCarrera = corregirNombreCarrera;
  NS.fusionarCarreras = fusionarCarreras;
  NS.resolverCarrerasCanonicasPaquete = resolverCarrerasCanonicasPaquete;
  NS.obtenerMateriasPorCarrera = obtenerMateriasPorCarrera;
  NS.obtenerMateria = obtenerMateria;
  NS.obtenerDetalleMateria = obtenerDetalleMateria;
  NS.guardarNombreInstitucionalMateria = guardarNombreInstitucionalMateria;
  NS.obtenerResumenCarrera = obtenerResumenCarrera;
  NS.obtenerVersionesMateria = obtenerVersionesMateria;
  NS.obtenerCambiosMateria = obtenerCambiosMateria;
  NS.obtenerDashboard = obtenerDashboard;
  NS.obtenerContadorComunicados = obtenerContadorComunicados;
  NS.registrarNumeroComunicado = registrarNumeroComunicado;
  NS.getEstado = function () {
    return {
      inicializado: estado.inicializado,
      proyectoId: CONFIG.projectId,
      sdkVersion: SDK_VERSION,
      error: estado.error ? estado.error.message : ""
    };
  };

  window.CurriculoFirebaseReady = inicializar().catch(function (error) {
    console.error("[CurriculoFirebase] Inicialización diferida:", error);
    return null;
  });
})(window);
