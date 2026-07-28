/* =========================================================
Nombre completo: firebase.robustez.js
Ruta o ubicación: /Curriculo/firebase/firebase.robustez.js
Funciones:
- Importar cada materia mediante una operación atómica independiente.
- Bloquear temporalmente una materia para evitar versiones concurrentes.
- Relacionar materias existentes aunque cambie el código o el nombre.
- Desactivar por defecto la retirada automática de materias ausentes.
- Validar tamaño y cantidad de operaciones antes de escribir.
- Reservar bloques de números de comunicado mediante transacciones.
- Usar agregaciones de Firestore en el tablero.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;

  if (NS.__robustezInstalada === true) return;

  var VERSION = "2.0.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" +
    String(NS.SDK_VERSION || "12.16.0") + "/";
  var MAX_OPERACIONES_MATERIA = 450;
  var MAX_BYTES_DOCUMENTO = 850 * 1024;
  var LOCK_MS = 2 * 60 * 1000;
  var estadoSDK = {
    appSDK: null,
    firestoreSDK: null,
    app: null,
    db: null,
    promesa: null
  };

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

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
  }

  function ahoraISO() {
    return new Date().toISOString();
  }

  function token(prefijo) {
    return [
      texto(prefijo || "token"),
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 12)
    ].join("_");
  }

  function I() {
    if (!NS.Inteligencia || NS.Inteligencia.__v2Instalada !== true) {
      throw new Error(
        "Falta cargar firebase.inteligencia-v2.js antes de firebase.robustez.js."
      );
    }
    return NS.Inteligencia;
  }

  function C() {
    return NS.COLECCIONES || {
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
    };
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrirSDK() {
    if (estadoSDK.db) return estadoSDK;
    if (estadoSDK.promesa) return estadoSDK.promesa;

    estadoSDK.promesa = (async function () {
      var modulos = await Promise.all([
        importarModulo(SDK_BASE + "firebase-app.js"),
        importarModulo(SDK_BASE + "firebase-firestore.js")
      ]);
      estadoSDK.appSDK = modulos[0];
      estadoSDK.firestoreSDK = modulos[1];
      estadoSDK.app = estadoSDK.appSDK.getApps().length
        ? estadoSDK.appSDK.getApp()
        : estadoSDK.appSDK.initializeApp(NS.CONFIG);

      try {
        estadoSDK.db = estadoSDK.firestoreSDK.getFirestore(estadoSDK.app);
      } catch (error) {
        estadoSDK.db = estadoSDK.firestoreSDK.initializeFirestore(
          estadoSDK.app,
          { experimentalAutoDetectLongPolling: true }
        );
      }

      return estadoSDK;
    })().catch(function (error) {
      estadoSDK.promesa = null;
      throw error;
    });

    return estadoSDK.promesa;
  }

  function F() {
    if (!estadoSDK.firestoreSDK || !estadoSDK.db) {
      throw new Error("Firebase todavía no está inicializado.");
    }
    return estadoSDK.firestoreSDK;
  }

  function docRef(coleccion, id) {
    return F().doc(estadoSDK.db, coleccion, texto(id));
  }

  function colRef(coleccion) {
    return F().collection(estadoSDK.db, coleccion);
  }

  function plano(snapshot) {
    return snapshot && snapshot.exists()
      ? Object.assign({ id: snapshot.id }, snapshot.data())
      : null;
  }

  function listaPlana(snapshot) {
    return snapshot.docs.map(function (docSnap) {
      return Object.assign({ id: docSnap.id }, docSnap.data());
    });
  }

  async function consultarCampo(coleccion, campo, valor) {
    var q = F().query(
      colRef(coleccion),
      F().where(campo, "==", valor)
    );
    return listaPlana(await F().getDocs(q));
  }

  function normalizarCodigo(valor) {
    return I().normalizarCodigo(valor);
  }

  function normalizarNombre(valor) {
    return I().normalizarTexto(valor);
  }

  function mapaPorId(lista) {
    var salida = {};
    arr(lista).forEach(function (item) {
      if (item && texto(item.id)) salida[texto(item.id)] = item;
    });
    return salida;
  }

  function nivelDe(materia) {
    return numero(materia && materia.nivelNumero, 0);
  }

  function codigoDe(materia) {
    return normalizarCodigo(
      materia && (
        materia.codigoNormalizado ||
        materia.codigo ||
        materia.codigoMateria
      )
    );
  }

  function nombreDe(materia) {
    return normalizarNombre(
      materia && (
        materia.nombreNormalizado ||
        materia.nombre ||
        materia.nombreMateria
      )
    );
  }

  function elegirUnico(candidatos, descripcion, materia) {
    candidatos = arr(candidatos);
    if (candidatos.length === 1) return candidatos[0];
    if (candidatos.length > 1) {
      throw new Error(
        "No se puede relacionar de forma segura " +
        texto(materia && materia.nombre) + ": " + descripcion +
        " coincide con " + candidatos.length + " materias existentes."
      );
    }
    return null;
  }

  function encontrarCoincidencia(item, existentes) {
    var nueva = item.materia;
    var exacta = arr(existentes).find(function (actual) {
      return actual.id === nueva.id;
    });
    if (exacta) return { materia: exacta, criterio: "id_exacto", confianza: 1 };

    var mismoNivel = arr(existentes).filter(function (actual) {
      return nivelDe(actual) === nivelDe(nueva);
    });
    var codigo = codigoDe(nueva);

    if (codigo) {
      var porCodigo = mismoNivel.filter(function (actual) {
        return codigoDe(actual) === codigo;
      });
      var coincidenciaCodigo = elegirUnico(
        porCodigo,
        "el código " + codigo,
        nueva
      );
      if (coincidenciaCodigo) {
        return {
          materia: coincidenciaCodigo,
          criterio: "codigo_y_nivel",
          confianza: 0.99
        };
      }
    }

    var nombre = nombreDe(nueva);
    var porNombre = mismoNivel.filter(function (actual) {
      return nombreDe(actual) === nombre;
    });
    var coincidenciaNombre = elegirUnico(
      porNombre,
      "el nombre y el nivel",
      nueva
    );
    if (coincidenciaNombre) {
      return {
        materia: coincidenciaNombre,
        criterio: "nombre_y_nivel",
        confianza: 0.97
      };
    }

    var similares = mismoNivel.map(function (actual) {
      return {
        materia: actual,
        similitud: I().similitudNombres(nombre, nombreDe(actual))
      };
    }).filter(function (entrada) {
      return entrada.similitud >= 0.86;
    }).sort(function (a, b) {
      return b.similitud - a.similitud;
    });

    if (
      similares.length === 1 ||
      (
        similares.length > 1 &&
        similares[0].similitud - similares[1].similitud >= 0.12
      )
    ) {
      return {
        materia: similares[0].materia,
        criterio: "similitud_nombre_y_nivel",
        confianza: similares[0].similitud
      };
    }

    if (similares.length > 1) {
      throw new Error(
        "La materia " + nueva.nombre +
        " se parece a varias materias existentes. Corrige el código o el nombre antes de continuar."
      );
    }

    return null;
  }

  function recalcularItemConId(item, materiaId) {
    I().reasignarMateriaId(item, materiaId);
    item.snapshot = I().crearSnapshot(
      item.materia,
      item.peaBase,
      item.unidades,
      item.actividades
    );
    item.materia.hashContenido = I().hashContenido(item.snapshot);
    item.materia.hashSecciones = {
      materia: I().hashContenido(item.snapshot.materia),
      peaBase: I().hashContenido(item.snapshot.peaBase),
      unidades: I().hashContenido(item.snapshot.unidades),
      actividades: I().hashContenido(item.snapshot.actividades)
    };
    return item;
  }

  function detectarColisionesDeRelacion(items, existentes) {
    var usados = {};
    return arr(items).map(function (item) {
      var coincidencia = encontrarCoincidencia(item, existentes);
      if (!coincidencia) return item;

      var idExistente = coincidencia.materia.id;
      if (usados[idExistente]) {
        throw new Error(
          "Dos materias del nuevo ZIP se relacionan con la misma materia existente: " +
          usados[idExistente] + " y " + item.materia.nombre + "."
        );
      }
      usados[idExistente] = item.materia.nombre;
      item.coincidenciaFirebase = {
        materiaId: idExistente,
        criterio: coincidencia.criterio,
        confianza: coincidencia.confianza
      };
      return recalcularItemConId(item, idExistente);
    });
  }

  function lockId(materiaId) {
    return "lock_importacion_" + texto(materiaId).slice(0, 1000);
  }

  async function adquirirLock(item, cargaId) {
    var materiaId = item.materia.id;
    var referenciaLock = docRef(C().CONFIGURACION, lockId(materiaId));
    var referenciaMateria = docRef(C().MATERIAS, materiaId);
    var lockToken = token("lock");
    var ahora = Date.now();

    return await F().runTransaction(estadoSDK.db, async function (tx) {
      var snapshots = await Promise.all([
        tx.get(referenciaLock),
        tx.get(referenciaMateria)
      ]);
      var lockActual = snapshots[0].exists() ? snapshots[0].data() : null;
      var materiaActual = plano(snapshots[1]);

      if (
        lockActual &&
        numero(lockActual.expiraEnMs, 0) > ahora &&
        texto(lockActual.token) !== lockToken
      ) {
        throw new Error(
          "La materia " + item.materia.nombre +
          " está siendo actualizada en otra ventana. Intenta nuevamente."
        );
      }

      if (
        materiaActual &&
        texto(materiaActual.hashContenido) ===
          texto(item.materia.hashContenido) &&
        materiaActual.activo !== false
      ) {
        if (snapshots[0].exists()) tx.delete(referenciaLock);
        return {
          sinCambios: true,
          token: "",
          materiaActual: materiaActual
        };
      }

      tx.set(referenciaLock, {
        tipo: "lock_importacion_materia",
        materiaId: materiaId,
        cargaId: cargaId,
        token: lockToken,
        iniciadoEnMs: ahora,
        expiraEnMs: ahora + LOCK_MS,
        creadoEn: F().serverTimestamp()
      });

      return {
        sinCambios: false,
        token: lockToken,
        materiaActual: materiaActual
      };
    });
  }

  async function liberarLock(materiaId, lockToken) {
    if (!lockToken) return;
    var referenciaLock = docRef(C().CONFIGURACION, lockId(materiaId));

    try {
      await F().runTransaction(estadoSDK.db, async function (tx) {
        var snap = await tx.get(referenciaLock);
        if (!snap.exists()) return;
        if (texto(snap.data().token) === texto(lockToken)) {
          tx.delete(referenciaLock);
        }
      });
    } catch (error) {
      console.warn(
        "[FirebaseRobustez] No se pudo liberar el lock de " + materiaId,
        error
      );
    }
  }

  async function cargarDetalleActual(materia) {
    var resultados = await Promise.all([
      F().getDoc(docRef(C().PEA_BASE, materia.id)),
      consultarCampo(C().PEA_UNIDADES, "materiaId", materia.id),
      F().getDoc(docRef(C().PEA_ACTIVIDADES, materia.id))
    ]);

    return {
      materia: materia,
      peaBase: plano(resultados[0]) || {},
      unidades: resultados[1].filter(function (unidad) {
        return unidad.tipoDocumento !== "fragmento";
      }).sort(function (a, b) {
        return numero(a.unidadNumero, 0) - numero(b.unidadNumero, 0);
      }),
      actividades: plano(resultados[2]) || { actividades: [] }
    };
  }

  function limpiarFirestore(valor) {
    if (I().limpiarProfundo) {
      return I().limpiarProfundo(valor, { conservarVolatiles: true });
    }
    return JSON.parse(JSON.stringify(valor || {}));
  }

  function datosConMarcas(data, cargaId, esNuevo) {
    var salida = limpiarFirestore(data);
    salida.cargaId = cargaId;
    salida.ultimaCargaId = cargaId;
    salida.actualizadoEn = F().serverTimestamp();
    if (esNuevo) salida.creadoEn = F().serverTimestamp();
    return salida;
  }

  function opSet(coleccion, id, data, merge) {
    return {
      tipo: "set",
      coleccion: coleccion,
      id: texto(id),
      data: data,
      merge: merge === true
    };
  }

  function opDelete(coleccion, id) {
    return {
      tipo: "delete",
      coleccion: coleccion,
      id: texto(id)
    };
  }

  function validarDocumento(op) {
    if (op.tipo !== "set") return;
    var bytes = I().estimarBytes(op.data);
    if (bytes > MAX_BYTES_DOCUMENTO) {
      throw new Error(
        "El documento " + op.coleccion + "/" + op.id +
        " pesa aproximadamente " + Math.ceil(bytes / 1024) +
        " KB. Reduce el contenido del Excel antes de subirlo."
      );
    }
  }

  function validarOperaciones(operaciones, materiaNombre) {
    if (operaciones.length > MAX_OPERACIONES_MATERIA) {
      throw new Error(
        "La materia " + materiaNombre + " requiere " +
        operaciones.length + " operaciones. El máximo seguro es " +
        MAX_OPERACIONES_MATERIA + "."
      );
    }
    operaciones.forEach(validarDocumento);
  }

  async function confirmarOperacionesMateria(
    operaciones,
    materiaNombre
  ) {
    validarOperaciones(operaciones, materiaNombre);
    var batch = F().writeBatch(estadoSDK.db);

    operaciones.forEach(function (op) {
      var ref = docRef(op.coleccion, op.id);
      if (op.tipo === "delete") {
        batch.delete(ref);
      } else if (op.merge) {
        batch.set(ref, op.data, { merge: true });
      } else {
        batch.set(ref, op.data);
      }
    });

    await batch.commit();
    return operaciones.length;
  }

  function operacionesVersionAnterior(
    materiaAnterior,
    snapshotAnterior,
    version,
    cargaId
  ) {
    var materiaId = materiaAnterior.id;
    var baseId = materiaId + "__v" + pad(version, 4);
    var unidades = arr(snapshotAnterior.unidades);
    var idsFragmentos = [
      baseId + "__materia",
      baseId + "__base",
      baseId + "__actividades"
    ];
    var comunes = {
      materiaId: materiaId,
      carreraId: materiaAnterior.carreraId,
      version: version,
      hashContenido: I().hashContenido(snapshotAnterior),
      cargaQueReemplazaId: cargaId,
      guardadoEn: F().serverTimestamp()
    };
    var operaciones = [];

    unidades.forEach(function (unidad) {
      idsFragmentos.push(
        baseId + "__unidad_" + pad(unidad.unidadNumero, 3)
      );
    });

    operaciones.push(
      opSet(C().VERSIONES, baseId, Object.assign({}, comunes, {
        tipo: "resumen",
        nombreMateria: materiaAnterior.nombre,
        codigoMateria: materiaAnterior.codigo,
        nivelNumero: materiaAnterior.nivelNumero,
        fragmentos: idsFragmentos,
        totalFragmentos: idsFragmentos.length,
        resumen: {
          totalUnidades: unidades.length,
          totalContenidos: unidades.reduce(function (total, unidad) {
            return total + arr(unidad.contenidos).length;
          }, 0),
          totalActividades: arr(snapshotAnterior.actividades).length
        }
      })),
      opSet(
        C().VERSIONES,
        baseId + "__materia",
        Object.assign({}, comunes, {
          tipo: "materia",
          contenido: snapshotAnterior.materia || {}
        })
      ),
      opSet(
        C().VERSIONES,
        baseId + "__base",
        Object.assign({}, comunes, {
          tipo: "pea_base",
          contenido: snapshotAnterior.peaBase || {}
        })
      ),
      opSet(
        C().VERSIONES,
        baseId + "__actividades",
        Object.assign({}, comunes, {
          tipo: "pea_actividades",
          contenido: snapshotAnterior.actividades || []
        })
      )
    );

    unidades.forEach(function (unidad) {
      operaciones.push(
        opSet(
          C().VERSIONES,
          baseId + "__unidad_" + pad(unidad.unidadNumero, 3),
          Object.assign({}, comunes, {
            tipo: "pea_unidad",
            unidadNumero: unidad.unidadNumero,
            contenido: unidad
          })
        )
      );
    });

    return operaciones;
  }

  function operacionCambio(
    item,
    versionAnterior,
    versionNueva,
    tipoCambio,
    diff,
    cargaId
  ) {
    return opSet(
      C().CAMBIOS,
      item.materia.id + "__v" + pad(versionNueva, 4),
      {
        materiaId: item.materia.id,
        carreraId: item.materia.carreraId,
        nombreMateria: item.materia.nombre,
        versionAnterior: versionAnterior,
        versionNueva: versionNueva,
        tipoCambio: tipoCambio,
        seccionesCambiadas: diff.seccionesCambiadas || [],
        resumen: diff.resumen || "",
        detalle: diff.detalle || {},
        hashAnterior: diff.hashAnterior || "",
        hashNuevo: diff.hashNuevo || "",
        cargaId: cargaId,
        creadoEn: F().serverTimestamp()
      }
    );
  }

  function mapaUnidades(lista) {
    var salida = {};
    arr(lista).forEach(function (unidad) {
      salida[texto(unidad.id)] = unidad;
    });
    return salida;
  }

  function operacionesNueva(item, cargaId, lockToken) {
    var materia = Object.assign({}, item.materia, {
      versionActual: 1,
      inteligenciaVersion: I().VERSION,
      activo: true
    });
    var diff = I().compararSnapshots({}, item.snapshot);
    diff.resumen = "Materia creada por primera vez en Firebase.";
    diff.seccionesCambiadas = [
      "materia",
      "pea_base",
      "pea_unidades",
      "pea_actividades"
    ];

    var operaciones = [
      opSet(
        C().MATERIAS,
        materia.id,
        datosConMarcas(materia, cargaId, true),
        true
      ),
      opSet(
        C().PEA_BASE,
        materia.id,
        datosConMarcas(item.peaBase, cargaId, true)
      ),
      opSet(
        C().PEA_ACTIVIDADES,
        materia.id,
        datosConMarcas(item.actividades, cargaId, true)
      )
    ];

    item.unidades.forEach(function (unidad) {
      operaciones.push(
        opSet(
          C().PEA_UNIDADES,
          unidad.id,
          datosConMarcas(unidad, cargaId, true)
        )
      );
    });

    operaciones.push(
      operacionCambio(item, 0, 1, "creacion", diff, cargaId),
      opDelete(C().CONFIGURACION, lockId(materia.id))
    );

    return {
      operaciones: operaciones,
      versionNueva: 1,
      diff: diff,
      tipo: "creacion",
      lockToken: lockToken
    };
  }

  function operacionesMigracionHash(
    item,
    materiaAnterior,
    cargaId
  ) {
    return {
      operaciones: [
        opSet(C().MATERIAS, materiaAnterior.id, {
          hashContenido: item.materia.hashContenido,
          hashSecciones: item.materia.hashSecciones,
          inteligenciaVersion: I().VERSION,
          activo: true,
          estadoValidacion: item.materia.estadoValidacion,
          actualizadoEn: F().serverTimestamp(),
          ultimaCargaId: cargaId
        }, true),
        opDelete(C().CONFIGURACION, lockId(materiaAnterior.id))
      ],
      versionNueva: Math.max(
        1,
        numero(materiaAnterior.versionActual, 1)
      ),
      diff: {
        cambioReal: false,
        resumen: "Contenido equivalente; se actualizó la huella semántica.",
        seccionesCambiadas: []
      },
      tipo: "sin_cambios"
    };
  }

  function operacionesActualizacion(
    item,
    detalleAnterior,
    cargaId,
    lockToken
  ) {
    var materiaAnterior = detalleAnterior.materia;
    var snapshotAnterior = I().crearSnapshot(
      materiaAnterior,
      detalleAnterior.peaBase,
      detalleAnterior.unidades,
      detalleAnterior.actividades
    );
    var diff = I().compararSnapshots(
      snapshotAnterior,
      item.snapshot
    );

    if (!diff.cambioReal) {
      return operacionesMigracionHash(
        item,
        materiaAnterior,
        cargaId
      );
    }

    var versionAnterior = Math.max(
      1,
      numero(materiaAnterior.versionActual, 1)
    );
    var versionNueva = versionAnterior + 1;
    var operaciones = operacionesVersionAnterior(
      materiaAnterior,
      snapshotAnterior,
      versionAnterior,
      cargaId
    );
    var materiaNueva = Object.assign({}, item.materia, {
      versionActual: versionNueva,
      inteligenciaVersion: I().VERSION,
      activo: true
    });
    var hashAnteriorSecciones = {
      materia: I().hashContenido(snapshotAnterior.materia),
      peaBase: I().hashContenido(snapshotAnterior.peaBase),
      unidades: I().hashContenido(snapshotAnterior.unidades),
      actividades: I().hashContenido(snapshotAnterior.actividades)
    };

    operaciones.push(
      opSet(
        C().MATERIAS,
        materiaNueva.id,
        datosConMarcas(materiaNueva, cargaId, false),
        true
      )
    );

    if (
      hashAnteriorSecciones.peaBase !==
      item.materia.hashSecciones.peaBase
    ) {
      operaciones.push(
        opSet(
          C().PEA_BASE,
          materiaNueva.id,
          datosConMarcas(item.peaBase, cargaId, false)
        )
      );
    }

    if (
      hashAnteriorSecciones.actividades !==
      item.materia.hashSecciones.actividades
    ) {
      operaciones.push(
        opSet(
          C().PEA_ACTIVIDADES,
          materiaNueva.id,
          datosConMarcas(item.actividades, cargaId, false)
        )
      );
    }

    if (
      hashAnteriorSecciones.unidades !==
      item.materia.hashSecciones.unidades
    ) {
      var anteriores = mapaUnidades(detalleAnterior.unidades);
      var nuevas = mapaUnidades(item.unidades);

      item.unidades.forEach(function (unidad) {
        if (
          !anteriores[unidad.id] ||
          I().hashContenido(anteriores[unidad.id]) !==
            I().hashContenido(unidad)
        ) {
          operaciones.push(
            opSet(
              C().PEA_UNIDADES,
              unidad.id,
              datosConMarcas(
                unidad,
                cargaId,
                !anteriores[unidad.id]
              )
            )
          );
        }
      });

      Object.keys(anteriores).forEach(function (unidadId) {
        if (!nuevas[unidadId]) {
          operaciones.push(
            opDelete(C().PEA_UNIDADES, unidadId)
          );
        }
      });
    }

    operaciones.push(
      operacionCambio(
        item,
        versionAnterior,
        versionNueva,
        "actualizacion",
        diff,
        cargaId
      ),
      opDelete(C().CONFIGURACION, lockId(materiaNueva.id))
    );

    return {
      operaciones: operaciones,
      versionNueva: versionNueva,
      diff: diff,
      tipo: "actualizacion",
      lockToken: lockToken
    };
  }

  async function procesarMateria(item, cargaId) {
    var lock = await adquirirLock(item, cargaId);

    if (lock.sinCambios) {
      return {
        tipo: "sin_cambios",
        versionNueva: Math.max(
          1,
          numero(lock.materiaActual && lock.materiaActual.versionActual, 1)
        ),
        operaciones: 0,
        resumen: "Sin cambios curriculares."
      };
    }

    try {
      var plan;

      if (!lock.materiaActual) {
        plan = operacionesNueva(item, cargaId, lock.token);
      } else {
        var detalleAnterior = await cargarDetalleActual(
          lock.materiaActual
        );
        plan = operacionesActualizacion(
          item,
          detalleAnterior,
          cargaId,
          lock.token
        );
      }

      var totalOperaciones = await confirmarOperacionesMateria(
        plan.operaciones,
        item.materia.nombre
      );

      return {
        tipo: plan.tipo,
        versionNueva: plan.versionNueva,
        operaciones: totalOperaciones,
        resumen: plan.diff && plan.diff.resumen
          ? plan.diff.resumen
          : ""
      };
    } catch (error) {
      await liberarLock(item.materia.id, lock.token);
      throw error;
    }
  }

  function cargaPermiteRetiros(preparado, opciones) {
    opciones = opciones || {};
    var resumen = preparado.resumenOriginal || {};
    var errores = numero(
      resumen.materiasError,
      resumen.materiasIncompletas
    );
    var advertencias = numero(
      resumen.materiasAdvertencia,
      resumen.materiasRevision
    );
    var bloquea = resumen.bloqueaImportacion === true;

    return (
      opciones.detectarEliminadas === true &&
      opciones.cargaCompleta === true &&
      errores === 0 &&
      advertencias === 0 &&
      !bloquea
    );
  }

  async function procesarRetiro(
    materiaAnterior,
    cargaId
  ) {
    var itemFicticio = {
      materia: Object.assign({}, materiaAnterior)
    };
    var lock = await adquirirLock(itemFicticio, cargaId);

    if (lock.sinCambios || !lock.materiaActual) {
      return { tipo: "sin_cambios", operaciones: 0 };
    }

    try {
      var detalle = await cargarDetalleActual(
        lock.materiaActual
      );
      var snapshotAnterior = I().crearSnapshot(
        detalle.materia,
        detalle.peaBase,
        detalle.unidades,
        detalle.actividades
      );
      var snapshotRetirado = JSON.parse(
        JSON.stringify(snapshotAnterior)
      );
      snapshotRetirado.materia.activo = false;
      snapshotRetirado.materia.estadoValidacion = "retirado";

      var diff = I().compararSnapshots(
        snapshotAnterior,
        snapshotRetirado
      );
      diff.resumen =
        "La carga fue confirmada como completa y la materia ya no aparece; quedó marcada como retirada.";
      var versionAnterior = Math.max(
        1,
        numero(materiaAnterior.versionActual, 1)
      );
      var versionNueva = versionAnterior + 1;
      var operaciones = operacionesVersionAnterior(
        materiaAnterior,
        snapshotAnterior,
        versionAnterior,
        cargaId
      );
      var itemCambio = {
        materia: materiaAnterior
      };

      operaciones.push(
        opSet(C().MATERIAS, materiaAnterior.id, {
          activo: false,
          estadoValidacion: "retirado",
          versionActual: versionNueva,
          inteligenciaVersion: I().VERSION,
          hashContenido: I().hashContenido(snapshotRetirado),
          hashSecciones: {
            materia: I().hashContenido(snapshotRetirado.materia),
            peaBase: I().hashContenido(snapshotRetirado.peaBase),
            unidades: I().hashContenido(snapshotRetirado.unidades),
            actividades: I().hashContenido(snapshotRetirado.actividades)
          },
          ultimaCargaId: cargaId,
          retiradoEn: F().serverTimestamp(),
          actualizadoEn: F().serverTimestamp()
        }, true),
        operacionCambio(
          itemCambio,
          versionAnterior,
          versionNueva,
          "retiro",
          diff,
          cargaId
        ),
        opDelete(C().CONFIGURACION, lockId(materiaAnterior.id))
      );

      var total = await confirmarOperacionesMateria(
        operaciones,
        materiaAnterior.nombre
      );

      return {
        tipo: "retiro",
        versionNueva: versionNueva,
        operaciones: total,
        resumen: diff.resumen
      };
    } catch (error) {
      await liberarLock(materiaAnterior.id, lock.token);
      throw error;
    }
  }

  async function guardarCarrera(carrera, cargaId) {
    var materias = await consultarCampo(
      C().MATERIAS,
      "carreraId",
      carrera.id
    );
    var activas = materias.filter(function (materia) {
      return materia.activo !== false;
    });
    var niveles = {};
    activas.forEach(function (materia) {
      if (nivelDe(materia) > 0) niveles[nivelDe(materia)] = true;
    });

    await F().setDoc(
      docRef(C().CARRERAS, carrera.id),
      datosConMarcas(Object.assign({}, carrera, {
        niveles: Object.keys(niveles)
          .map(Number)
          .sort(function (a, b) { return a - b; }),
        totalNiveles: Object.keys(niveles).length,
        totalMaterias: activas.length,
        totalMateriasActivas: activas.length,
        ultimaCargaId: cargaId
      }), cargaId, false),
      { merge: true }
    );
  }

  function nombreZip(paquete) {
    return texto(
      paquete && paquete.carga && paquete.carga.nombreZip ||
      paquete && paquete.zip &&
        (paquete.zip.nombre || paquete.zip.nombreZip) ||
      paquete && paquete.nombreZip ||
      "carga-curricular.zip"
    );
  }

  function crearCargaId() {
    return "carga_" +
      ahoraISO().replace(/[^0-9]/g, "").slice(0, 17) +
      "_" + Math.random().toString(36).slice(2, 7);
  }

  async function importarPaquete(paquete, opciones) {
    opciones = opciones || {};
    await abrirSDK();

    var cargaId = crearCargaId();
    var preparado = I().prepararPaquete(paquete, cargaId);

    if (
      !preparado.contadoresConsistentes ||
      preparado.totalMateriasEntrada !==
        preparado.totalMateriasPreparadas
    ) {
      throw new Error(
        "La importación fue detenida porque el número de materias preparadas no coincide con el ZIP."
      );
    }

    var cargaRef = docRef(C().CARGAS, cargaId);
    var resumen = {
      totalCarreras: preparado.carreras.length,
      totalMaterias: preparado.materias.length,
      nuevas: 0,
      actualizadas: 0,
      sinCambios: 0,
      retiradas: 0,
      versionesCreadas: 0,
      migracionesHash: 0,
      operacionesFirestore: 0,
      retirosHabilitados: cargaPermiteRetiros(
        preparado,
        opciones
      )
    };
    var cambiosCarga = [];

    await F().setDoc(cargaRef, {
      nombreZip: nombreZip(paquete),
      estado: "procesando",
      origen: "subir_zip",
      inteligenciaVersion: I().VERSION,
      totalCarreras: resumen.totalCarreras,
      totalMaterias: resumen.totalMaterias,
      resumenValidacion: preparado.resumenOriginal,
      observaciones: preparado.observaciones,
      retirosHabilitados: resumen.retirosHabilitados,
      iniciadoEn: F().serverTimestamp(),
      creadoEn: F().serverTimestamp()
    });

    try {
      for (
        var carreraIndice = 0;
        carreraIndice < preparado.carreras.length;
        carreraIndice += 1
      ) {
        var carrera = preparado.carreras[carreraIndice];
        var existentes = await consultarCampo(
          C().MATERIAS,
          "carreraId",
          carrera.id
        );
        var itemsCarrera = preparado.materias.filter(
          function (item) {
            return item.materia.carreraId === carrera.id;
          }
        );

        itemsCarrera = detectarColisionesDeRelacion(
          itemsCarrera,
          existentes
        );

        var idsPresentes = {};
        itemsCarrera.forEach(function (item) {
          idsPresentes[item.materia.id] = true;
        });

        for (
          var materiaIndice = 0;
          materiaIndice < itemsCarrera.length;
          materiaIndice += 1
        ) {
          var item = itemsCarrera[materiaIndice];

          if (typeof opciones.onProgress === "function") {
            opciones.onProgress({
              etapa: "comparacion",
              porcentaje: 20 + Math.round(
                (
                  (
                    carreraIndice +
                    (materiaIndice + 1) /
                      Math.max(1, itemsCarrera.length)
                  ) /
                  Math.max(1, preparado.carreras.length)
                ) * 65
              ),
              mensaje:
                "Comparando " + item.materia.nombre +
                " con Firebase..."
            });
          }

          var resultado = await procesarMateria(
            item,
            cargaId
          );
          resumen.operacionesFirestore +=
            numero(resultado.operaciones, 0);

          if (resultado.tipo === "creacion") {
            resumen.nuevas += 1;
            cambiosCarga.push({
              materiaId: item.materia.id,
              nombre: item.materia.nombre,
              tipo: "creacion",
              version: resultado.versionNueva
            });
          } else if (resultado.tipo === "actualizacion") {
            resumen.actualizadas += 1;
            resumen.versionesCreadas += 1;
            cambiosCarga.push({
              materiaId: item.materia.id,
              nombre: item.materia.nombre,
              tipo: "actualizacion",
              version: resultado.versionNueva,
              resumen: resultado.resumen
            });
          } else {
            resumen.sinCambios += 1;
            if (
              resultado.resumen &&
              /huella semántica/i.test(resultado.resumen)
            ) {
              resumen.migracionesHash += 1;
            }
          }
        }

        if (resumen.retirosHabilitados) {
          for (
            var existenteIndice = 0;
            existenteIndice < existentes.length;
            existenteIndice += 1
          ) {
            var materiaExistente = existentes[existenteIndice];
            if (
              idsPresentes[materiaExistente.id] ||
              materiaExistente.activo === false
            ) {
              continue;
            }
            var retiro = await procesarRetiro(
              materiaExistente,
              cargaId
            );
            if (retiro.tipo === "retiro") {
              resumen.retiradas += 1;
              resumen.versionesCreadas += 1;
              resumen.operacionesFirestore +=
                numero(retiro.operaciones, 0);
              cambiosCarga.push({
                materiaId: materiaExistente.id,
                nombre: materiaExistente.nombre,
                tipo: "retiro",
                version: retiro.versionNueva,
                resumen: retiro.resumen
              });
            }
          }
        }

        await guardarCarrera(carrera, cargaId);
      }

      await F().updateDoc(cargaRef, {
        estado: cambiosCarga.length
          ? "completado_con_cambios"
          : "completado_sin_cambios",
        resumen: resumen,
        cambios: cambiosCarga.slice(0, 200),
        totalCambios: cambiosCarga.length,
        finalizadoEn: F().serverTimestamp(),
        actualizadoEn: F().serverTimestamp()
      });

      return {
        ok: true,
        estado: cambiosCarga.length
          ? "actualizado"
          : "sin_cambios",
        cargaId: cargaId,
        resumen: resumen,
        cambios: cambiosCarga,
        mensaje: cambiosCarga.length
          ? "Firebase fue actualizado de forma atómica por materia."
          : "El contenido ya estaba actualizado. No se creó ninguna versión nueva."
      };
    } catch (error) {
      try {
        await F().updateDoc(cargaRef, {
          estado: (
            resumen.nuevas ||
            resumen.actualizadas ||
            resumen.retiradas
          ) ? "error_parcial" : "error",
          resumen: resumen,
          error: error && error.message
            ? error.message
            : texto(error),
          finalizadoEn: F().serverTimestamp(),
          actualizadoEn: F().serverTimestamp()
        });
      } catch (errorRegistro) {
        console.warn(
          "[FirebaseRobustez] No se pudo registrar el error.",
          errorRegistro
        );
      }
      throw error;
    }
  }

  async function obtenerDashboard() {
    await abrirSDK();

    async function contar(coleccion, restricciones) {
      var referencia = colRef(coleccion);
      var q = restricciones && restricciones.length
        ? F().query.apply(
            null,
            [referencia].concat(restricciones)
          )
        : referencia;
      var snap = await F().getCountFromServer(q);
      return snap.data().count;
    }

    var resultados = await Promise.all([
      contar(C().CARRERAS),
      contar(C().MATERIAS, [
        F().where("activo", "==", true)
      ]),
      contar(C().CARGAS),
      contar(C().VERSIONES, [
        F().where("tipo", "==", "resumen")
      ]),
      contar(C().CAMBIOS)
    ]);

    return {
      carreras: resultados[0],
      materias: resultados[1],
      cargas: resultados[2],
      versiones: resultados[3],
      cambios: resultados[4]
    };
  }

  function fechaBase(fechaInput) {
    if (
      fechaInput instanceof Date &&
      !Number.isNaN(fechaInput.getTime())
    ) {
      return fechaInput;
    }
    var fecha = new Date(fechaInput || Date.now());
    return Number.isNaN(fecha.getTime())
      ? new Date()
      : fecha;
  }

  function mesKey(fechaInput) {
    var fecha = fechaBase(fechaInput);
    return fecha.getFullYear() + "-" +
      pad(fecha.getMonth() + 1, 2);
  }

  function numeroComunicado(secuencia, fechaInput, prefijo) {
    var fecha = fechaBase(fechaInput);
    return [
      texto(prefijo || "COM-ITSQMET-UGPA"),
      fecha.getFullYear(),
      pad(fecha.getMonth() + 1, 2),
      secuencia < 100 ? pad(secuencia, 2) : secuencia
    ].join("-");
  }

  async function reservarBloqueComunicados(
    fechaInput,
    cantidad,
    metadatos
  ) {
    await abrirSDK();
    cantidad = numero(cantidad, 0);
    metadatos = metadatos || {};

    if (cantidad < 1 || cantidad > 300) {
      throw new Error(
        "La cantidad de comunicados debe estar entre 1 y 300."
      );
    }

    var key = mesKey(fechaInput);
    var contadorId =
      "contador_comunicados_" + key.replace("-", "_");
    var contadorRef = docRef(
      C().CONFIGURACION,
      contadorId
    );
    var fecha = fechaBase(fechaInput);
    var prefijo = texto(
      metadatos.prefijo || "COM-ITSQMET-UGPA"
    );
    var reservaToken = token("reserva");

    return await F().runTransaction(
      estadoSDK.db,
      async function (tx) {
        var contadorSnap = await tx.get(contadorRef);
        var actual = contadorSnap.exists()
          ? contadorSnap.data()
          : { ultimo: 0 };
        var inicio = numero(actual.ultimo, 0) + 1;
        var fin = inicio + cantidad - 1;
        var reservas = [];

        tx.set(contadorRef, {
          tipo: "contador_comunicados",
          mesKey: key,
          ultimo: fin,
          actualizadoEn: F().serverTimestamp()
        }, { merge: true });

        for (var i = 0; i < cantidad; i += 1) {
          var secuencia = inicio + i;
          var numeroFinal = numeroComunicado(
            secuencia,
            fecha,
            prefijo
          );
          var comunicadoId = I().slug(numeroFinal);
          var comunicadoRef = docRef(
            C().COMUNICADOS,
            comunicadoId
          );
          var reserva = {
            secuencia: secuencia,
            numero: numeroFinal,
            mesKey: key,
            fecha: fecha.toISOString(),
            comunicadoId: comunicadoId,
            reservaToken: reservaToken + "_" + i,
            estado: "reservado"
          };

          tx.set(comunicadoRef, Object.assign({}, reserva, {
            origenReserva: metadatos.origen || "comunicados",
            reservadoEn: F().serverTimestamp(),
            reservaExpiraEnMs:
              Date.now() + 24 * 60 * 60 * 1000
          }));

          reservas.push(reserva);
        }

        return reservas;
      }
    );
  }

  async function confirmarReservaComunicado(
    reserva,
    datos
  ) {
    await abrirSDK();
    reserva = reserva || {};
    var comunicadoId = texto(
      reserva.comunicadoId ||
      I().slug(reserva.numero)
    );
    var referencia = docRef(
      C().COMUNICADOS,
      comunicadoId
    );

    return await F().runTransaction(
      estadoSDK.db,
      async function (tx) {
        var snap = await tx.get(referencia);
        if (!snap.exists()) {
          throw new Error(
            "No existe la reserva del comunicado " +
            texto(reserva.numero) + "."
          );
        }
        var actual = snap.data();
        if (
          texto(actual.reservaToken) !==
          texto(reserva.reservaToken)
        ) {
          throw new Error(
            "La reserva del comunicado " +
            texto(reserva.numero) +
            " pertenece a otra operación."
          );
        }
        if (actual.estado === "confirmado") {
          return Object.assign(
            { id: comunicadoId },
            actual
          );
        }

        var confirmado = Object.assign(
          {},
          limpiarFirestore(datos || {}),
          {
            estado: "confirmado",
            confirmadoEn: F().serverTimestamp(),
            actualizadoEn: F().serverTimestamp()
          }
        );
        tx.set(referencia, confirmado, { merge: true });

        return Object.assign({}, reserva, confirmado);
      }
    );
  }

  async function cancelarReservasComunicados(
    reservas,
    motivo
  ) {
    await abrirSDK();
    var resultados = [];

    for (var i = 0; i < arr(reservas).length; i += 1) {
      var reserva = arr(reservas)[i];
      var referencia = docRef(
        C().COMUNICADOS,
        texto(
          reserva.comunicadoId ||
          I().slug(reserva.numero)
        )
      );

      try {
        var resultado = await F().runTransaction(
          estadoSDK.db,
          async function (tx) {
            var snap = await tx.get(referencia);
            if (!snap.exists()) return false;
            var actual = snap.data();
            if (
              actual.estado !== "reservado" ||
              texto(actual.reservaToken) !==
                texto(reserva.reservaToken)
            ) {
              return false;
            }
            tx.set(referencia, {
              estado: "cancelado",
              motivoCancelacion: texto(
                motivo || "Generación no completada"
              ),
              canceladoEn: F().serverTimestamp(),
              actualizadoEn: F().serverTimestamp()
            }, { merge: true });
            return true;
          }
        );
        resultados.push(resultado);
      } catch (error) {
        resultados.push(false);
      }
    }

    return resultados;
  }

  NS.VERSION_ROBUSTEZ = VERSION;
  NS.__robustezInstalada = true;
  NS.importarPaquete = importarPaquete;
  NS.obtenerDashboard = obtenerDashboard;
  NS.reservarBloqueComunicados =
    reservarBloqueComunicados;
  NS.confirmarReservaComunicado =
    confirmarReservaComunicado;
  NS.cancelarReservasComunicados =
    cancelarReservasComunicados;
  NS.Robustez = {
    VERSION: VERSION,
    encontrarCoincidencia: encontrarCoincidencia,
    detectarColisionesDeRelacion:
      detectarColisionesDeRelacion,
    recalcularItemConId: recalcularItemConId,
    cargaPermiteRetiros: cargaPermiteRetiros,
    limites: {
      operacionesMateria: MAX_OPERACIONES_MATERIA,
      bytesDocumento: MAX_BYTES_DOCUMENTO,
      lockMs: LOCK_MS
    }
  };
})(window);
