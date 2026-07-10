/* =========================================================
Nombre completo: bdlocal.importacion-orquestador.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.importacion-orquestador.js
Función o funciones:
- Ejecutar una sola importación controlada, sin validaciones duplicadas.
- Reemplazar carreras existentes mediante limpieza agrupada en IndexedDB.
- Evitar almacenar copias binarias innecesarias de los Excel.
- Crear respaldo temporal y restaurarlo si la importación falla.
- Emitir progreso real y contexto técnico para el modal de diagnóstico.
========================================================= */

(function (window) {
  "use strict";

  var Subir = window.SubirCCC;
  var BD = window.BDLocalCCC;
  var D = window.DiagnosticoFlujo;

  if (!Subir || !Subir.ConexionBDLocal || !BD || !BD.Core || !BD.Schema) {
    console.error("[BDLocalCCC.Orquestador] Faltan SubirCCC, ConexionBDLocal, Core o Schema.");
    return;
  }

  var Core = BD.Core;
  var Schema = BD.Schema;
  var STORES = Schema.STORES;
  var importarBase = BD.Importador && BD.Importador.importarPaqueteBase
    ? BD.Importador.importarPaqueteBase
    : BD.__importarPaqueteBase;
  var importacionActiva = null;
  var VERSION = 1;

  if (typeof importarBase !== "function") {
    console.error("[BDLocalCCC.Orquestador] No se preservó el importador base.");
    return;
  }

  if (D && typeof D.instrumentarBDLocal === "function") {
    D.instrumentarBDLocal(BD);
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function fecha() {
    return new Date().toISOString();
  }

  function emitir(nombre, detalle) {
    try {
      window.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} }));
    } catch (error) {
      console.warn("[BDLocalCCC.Orquestador] No se pudo emitir", nombre, error);
    }
  }

  function progreso(porcentaje, etapa, mensaje, contexto) {
    contexto = contexto || {};
    var detalle = Object.assign({
      porcentaje: Math.max(0, Math.min(100, Number(porcentaje || 0))),
      etapa: etapa || "importacion",
      mensaje: mensaje || "Procesando importación.",
      creadoEn: fecha()
    }, contexto);
    emitir("subirccc:importacion-progreso", detalle);
    if (D) {
      D.paso({
        etapa: detalle.etapa,
        subetapa: detalle.subetapa || "",
        archivo: detalle.archivo || "bdlocal/bdlocal.importacion-orquestador.js",
        funcion: detalle.funcion || "importarPaquete()",
        tabla: detalle.tabla || "",
        operacion: detalle.operacion || "",
        materia: detalle.materia || "",
        registro: detalle.registro || "",
        mensaje: detalle.mensaje,
        porcentaje: detalle.porcentaje,
        contexto: detalle.contexto || {}
      });
    }
  }

  function conTiempoLimite(promesa, timeoutMs, contexto) {
    return new Promise(function (resolve, reject) {
      var terminada = false;
      var timer = setTimeout(function () {
        if (terminada) return;
        terminada = true;
        var error = new Error("Tiempo agotado: " + contexto);
        error.diagnosticoContexto = {
          archivo: "bdlocal/bdlocal.importacion-orquestador.js",
          funcion: "conTiempoLimite()",
          operacion: contexto
        };
        reject(error);
      }, Number(timeoutMs || 30000));

      Promise.resolve(promesa).then(function (resultado) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        resolve(resultado);
      }).catch(function (error) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function idsCarrerasPaquete(paquete) {
    var ids = {};
    arr(paquete && paquete.carreras).forEach(function (carrera) {
      var nombre = texto(carrera && (carrera.nombre || carrera.carrera || carrera.nombreCarrera));
      var id = texto(carrera && carrera.id);
      if (!id && nombre && Schema.crearIdCarrera) id = Schema.crearIdCarrera(nombre);
      if (id) ids[id] = true;
    });
    arr(paquete && paquete.materias).forEach(function (materia) {
      var id = texto(materia && materia.carreraId);
      if (id) ids[id] = true;
    });
    return Object.keys(ids);
  }

  function validarPaquete(paquete, opciones) {
    opciones = opciones || {};
    var validado = paquete;
    if (Subir.Validador && typeof Subir.Validador.validarPaquete === "function") {
      validado = Subir.Validador.validarPaquete(paquete, { lanzarSiBloquea: false });
    }
    var resumen = validado && validado.resumenValidacion || {};
    if (opciones.bloquearCriticos !== false && resumen.bloqueaImportacion === true) {
      var criticos = arr(validado.validacionesSubida).filter(function (item) {
        return item && (item.bloqueaImportacion === true || item.severidad === "critico");
      });
      throw new Error("La importación está bloqueada: " + criticos.map(function (item) {
        return texto(item.mensaje);
      }).filter(Boolean).join(" | "));
    }
    return validado;
  }

  function quitarBinarios(paquete) {
    paquete = paquete || {};
    return Object.assign({}, paquete, {
      carga: Object.assign({}, paquete.carga || {}, {
        preparadoParaBDLocalEn: fecha(),
        binariosOmitidos: true
      }),
      carreras: arr(paquete.carreras).map(function (item) { return Object.assign({}, item); }),
      matrices: arr(paquete.matrices).map(function (item) { return Object.assign({}, item); }),
      niveles: arr(paquete.niveles).map(function (item) { return Object.assign({}, item); }),
      materias: arr(paquete.materias).map(function (item) { return Object.assign({}, item); }),
      archivos: arr(paquete.archivos).map(function (archivo) {
        return Object.assign({}, archivo, {
          contenidoBinario: null,
          tieneContenidoBinario: false
        });
      }),
      advertencias: arr(paquete.advertencias).map(function (item) { return Object.assign({}, item); }),
      validacionesSubida: arr(paquete.validacionesSubida).map(function (item) { return Object.assign({}, item); }),
      evaluacionesMaterias: arr(paquete.evaluacionesMaterias).map(function (item) { return Object.assign({}, item); }),
      resumenValidacion: Object.assign({}, paquete.resumenValidacion || {}),
      diagnostico: Object.assign({}, paquete.diagnostico || {}),
      diagnosticoExcel: Object.assign({}, paquete.diagnosticoExcel || {}),
      zip: Object.assign({}, paquete.zip || {}),
      origen: "subir_orquestado",
      preparadoEn: fecha()
    });
  }

  async function snapshotCarrera(carreraId) {
    var snapshot = {
      carreraId: carreraId,
      carreras: [],
      matrices: [],
      niveles: [],
      materias: [],
      archivos: [],
      bases: [],
      unidades: [],
      actividades: [],
      validaciones: []
    };
    var carrera = await Core.get(STORES.CARRERAS, carreraId);
    if (!carrera) return snapshot;
    snapshot.carreras = [carrera];
    snapshot.matrices = await Core.getAllByIndex(STORES.MATRICES, "carreraId", carreraId);
    snapshot.niveles = await Core.getAllByIndex(STORES.NIVELES, "carreraId", carreraId);
    snapshot.materias = await Core.getAllByIndex(STORES.MATERIAS, "carreraId", carreraId);

    for (var i = 0; i < snapshot.materias.length; i += 1) {
      var materiaId = snapshot.materias[i].id;
      var base = await Core.get(STORES.PEA_BASE, materiaId);
      if (base) snapshot.bases.push(base);
      snapshot.archivos = snapshot.archivos.concat(await Core.getAllByIndex(STORES.PEA_ARCHIVOS, "materiaId", materiaId));
      snapshot.unidades = snapshot.unidades.concat(await Core.getAllByIndex(STORES.PEA_UNIDADES, "materiaId", materiaId));
      snapshot.actividades = snapshot.actividades.concat(await Core.getAllByIndex(STORES.PEA_ACTIVIDADES, "materiaId", materiaId));
      snapshot.validaciones = snapshot.validaciones.concat(await Core.getAllByIndex(STORES.VALIDACIONES, "materiaId", materiaId));
    }
    return snapshot;
  }

  function borrarPorIndice(store, indice, valor) {
    return new Promise(function (resolve, reject) {
      if (!store.indexNames.contains(indice)) {
        resolve(0);
        return;
      }
      var eliminados = 0;
      var request = store.index(indice).openCursor(window.IDBKeyRange.only(valor));
      request.onerror = function () { reject(request.error || new Error("No se pudo recorrer " + indice)); };
      request.onsuccess = function () {
        var cursor = request.result;
        if (!cursor) {
          resolve(eliminados);
          return;
        }
        var borrar = cursor.delete();
        borrar.onerror = function () { reject(borrar.error || new Error("No se pudo eliminar un registro.")); };
        borrar.onsuccess = function () {
          eliminados += 1;
          cursor.continue();
        };
      };
    });
  }

  async function limpiarCarreraRapido(carreraId, materiaIds) {
    materiaIds = arr(materiaIds).filter(Boolean);
    var nombres = [
      STORES.PEA_ARCHIVOS,
      STORES.PEA_BASE,
      STORES.PEA_UNIDADES,
      STORES.PEA_ACTIVIDADES,
      STORES.VALIDACIONES,
      STORES.MATERIAS,
      STORES.NIVELES,
      STORES.MATRICES
    ];

    return await Core.runTransaction(nombres, "readwrite", function (stores) {
      var tareas = [];
      materiaIds.forEach(function (materiaId) {
        tareas.push(borrarPorIndice(stores[STORES.PEA_ARCHIVOS], "materiaId", materiaId));
        tareas.push(borrarPorIndice(stores[STORES.PEA_UNIDADES], "materiaId", materiaId));
        tareas.push(borrarPorIndice(stores[STORES.PEA_ACTIVIDADES], "materiaId", materiaId));
        tareas.push(borrarPorIndice(stores[STORES.VALIDACIONES], "materiaId", materiaId));
        stores[STORES.PEA_BASE].delete(materiaId);
      });
      tareas.push(borrarPorIndice(stores[STORES.MATERIAS], "carreraId", carreraId));
      tareas.push(borrarPorIndice(stores[STORES.NIVELES], "carreraId", carreraId));
      tareas.push(borrarPorIndice(stores[STORES.MATRICES], "carreraId", carreraId));
      return Promise.all(tareas);
    }, {
      contexto: "reemplazar carrera " + carreraId,
      timeoutMs: 90000
    });
  }

  async function restaurarSnapshot(snapshot) {
    if (!snapshot) return;
    var pares = [
      [STORES.CARRERAS, snapshot.carreras],
      [STORES.MATRICES, snapshot.matrices],
      [STORES.NIVELES, snapshot.niveles],
      [STORES.MATERIAS, snapshot.materias],
      [STORES.PEA_ARCHIVOS, snapshot.archivos],
      [STORES.PEA_BASE, snapshot.bases],
      [STORES.PEA_UNIDADES, snapshot.unidades],
      [STORES.PEA_ACTIVIDADES, snapshot.actividades],
      [STORES.VALIDACIONES, snapshot.validaciones]
    ];
    for (var i = 0; i < pares.length; i += 1) {
      if (arr(pares[i][1]).length) await Core.bulkPut(pares[i][0], pares[i][1]);
    }
  }

  function resumirEstados(materias) {
    var resumen = { completas: 0, revision: 0, incompletas: 0 };
    arr(materias).forEach(function (materia) {
      if (materia.estadoValidacion === "completo") resumen.completas += 1;
      else if (materia.estadoValidacion === "incompleto") resumen.incompletas += 1;
      else resumen.revision += 1;
    });
    return resumen;
  }

  async function ejecutarImportacion(paquete, opciones) {
    opciones = opciones || {};
    var zip = texto(paquete && paquete.carga && paquete.carga.nombreZip || paquete && paquete.zip && paquete.zip.nombre || "");
    var snapshots = [];
    var ids = [];
    var progresoCore = 42;
    var ultimoAvanceCore = 0;

    if (D) {
      D.iniciar({
        prefijo: "IMP",
        flujo: "Importación de ZIP a BDLocal",
        pantalla: "subir/subir.html",
        archivo: "bdlocal/bdlocal.importacion-orquestador.js",
        funcion: "importarPaquete()",
        zip: zip,
        etapa: "inicio",
        mensaje: "Preparando una importación controlada.",
        stallTimeoutMs: 30000,
        contexto: { versionOrquestador: VERSION }
      });
    }

    function escucharCore(event) {
      var dato = event.detail || {};
      if (dato.fase !== "inicio") return;
      if (Date.now() - ultimoAvanceCore < 160) return;
      ultimoAvanceCore = Date.now();
      progresoCore = Math.min(78, progresoCore + 1);
      emitir("subirccc:importacion-progreso", {
        porcentaje: progresoCore,
        etapa: "guardado_bdlocal",
        mensaje: "Procesando " + texto(dato.operacion) + (dato.tabla ? " en " + dato.tabla : "") + ".",
        archivo: dato.archivo,
        funcion: dato.funcion,
        tabla: dato.tabla,
        operacion: dato.operacion
      });
    }

    window.addEventListener("diagnostico:core-operacion", escucharCore);

    try {
      progreso(5, "inicializacion", "Conectando con IndexedDB.", {
        archivo: "bdlocal/bdlocal.core.js",
        funcion: "Core.ready()"
      });
      await conTiempoLimite(BD.inicializar ? BD.inicializar() : Core.ready(), 25000, "inicializar BDLocal");

      progreso(10, "validacion", "Validando la estructura del paquete.", {
        archivo: "subir/subir.validador.js",
        funcion: "validarPaquete()"
      });
      var validado = validarPaquete(paquete, opciones);
      ids = idsCarrerasPaquete(validado);

      progreso(16, "preparacion", "Eliminando copias binarias innecesarias de los Excel.", {
        archivo: "bdlocal/bdlocal.importacion-orquestador.js",
        funcion: "quitarBinarios()"
      });
      var limpio = quitarBinarios(validado);

      for (var i = 0; i < ids.length; i += 1) {
        progreso(18 + Math.floor((i / Math.max(1, ids.length)) * 8), "respaldo", "Creando respaldo temporal de la carrera " + (i + 1) + " de " + ids.length + ".", {
          archivo: "bdlocal/bdlocal.importacion-orquestador.js",
          funcion: "snapshotCarrera()",
          registro: ids[i]
        });
        snapshots.push(await conTiempoLimite(snapshotCarrera(ids[i]), 90000, "crear respaldo de " + ids[i]));
      }

      for (var j = 0; j < snapshots.length; j += 1) {
        var snap = snapshots[j];
        if (!snap.materias.length && !snap.matrices.length && !snap.niveles.length) continue;
        progreso(28 + Math.floor((j / Math.max(1, snapshots.length)) * 8), "reemplazo", "Retirando la versión anterior de la carrera.", {
          archivo: "bdlocal/bdlocal.importacion-orquestador.js",
          funcion: "limpiarCarreraRapido()",
          tabla: "varias tablas",
          operacion: "delete",
          registro: snap.carreraId
        });
        await conTiempoLimite(
          limpiarCarreraRapido(snap.carreraId, snap.materias.map(function (materia) { return materia.id; })),
          100000,
          "limpiar carrera " + snap.carreraId
        );
      }

      progreso(40, "guardado", "Guardando estructura, archivos y datos procesados.", {
        archivo: "bdlocal/bdlocal.importador.js",
        funcion: "importarPaqueteCCC()"
      });
      var resultado = await conTiempoLimite(importarBase(limpio), 180000, "guardar paquete completo en BDLocal");

      var materias = arr(resultado && resultado.materias);
      var validadas = [];
      for (var k = 0; k < materias.length; k += 1) {
        var porcentaje = 80 + Math.floor(((k + 1) / Math.max(1, materias.length)) * 17);
        progreso(porcentaje, "validacion_integral", "Validando materia " + (k + 1) + " de " + materias.length + ": " + texto(materias[k].nombre) + ".", {
          archivo: "bdlocal/bdlocal.inteligencia.js",
          funcion: "repararMateria()",
          materia: materias[k].nombre,
          registro: materias[k].id
        });
        if (BD.Inteligencia && typeof BD.Inteligencia.repararMateria === "function") {
          validadas.push(await conTiempoLimite(
            BD.Inteligencia.repararMateria(materias[k], { force: false, timeoutMs: 30000 }),
            35000,
            "validar " + texto(materias[k].nombre)
          ));
        } else if (BD.Integridad && typeof BD.Integridad.validarMateria === "function") {
          validadas.push(await conTiempoLimite(
            BD.Integridad.validarMateria(materias[k]),
            35000,
            "validar " + texto(materias[k].nombre)
          ));
        } else {
          validadas.push(materias[k]);
        }
      }

      resultado.materias = validadas;
      resultado.integridadValidada = true;
      resultado.orquestadorVersion = VERSION;
      resultado.binariosOmitidos = true;
      resultado.modoActualizacion = "reemplazo_controlado_con_rollback";
      resultado.estadosFinales = resumirEstados(validadas);

      progreso(100, "finalizado", "Importación completada y verificada.", {
        archivo: "bdlocal/bdlocal.importacion-orquestador.js",
        funcion: "ejecutarImportacion()"
      });
      emitir("subirccc:importacion-fin", {
        porcentaje: 100,
        etapa: "finalizado",
        mensaje: "Importación completada y verificada.",
        resultado: resultado
      });
      if (D) D.completar({ mensaje: "Importación completada y verificada.", porcentaje: 100 });
      return resultado;
    } catch (error) {
      var contextoError = error.diagnosticoContexto || {};
      try {
        progreso(96, "rollback", "La importación falló. Restaurando la información anterior.", {
          archivo: "bdlocal/bdlocal.importacion-orquestador.js",
          funcion: "restaurarSnapshot()"
        });
        for (var r = 0; r < ids.length; r += 1) {
          var materiaIdsActuales = [];
          try {
            var materiasActuales = await Core.getAllByIndex(STORES.MATERIAS, "carreraId", ids[r]);
            materiaIdsActuales = materiasActuales.map(function (materia) { return materia.id; });
          } catch (errorLectura) {
            materiaIdsActuales = [];
          }
          await limpiarCarreraRapido(ids[r], materiaIdsActuales);
        }
        for (var s = 0; s < snapshots.length; s += 1) {
          await restaurarSnapshot(snapshots[s]);
        }
        contextoError.rollback = "completado";
      } catch (errorRollback) {
        contextoError.rollback = "fallido: " + texto(errorRollback.message || errorRollback);
      }

      if (D) {
        D.fallar(error, Object.assign({
          titulo: "No se pudo importar el ZIP",
          flujo: "Importación de ZIP a BDLocal",
          zip: zip,
          sugerencia: "El sistema intentó restaurar la carrera anterior. Revisa el archivo, la función, la tabla y el último paso exitoso antes de reintentar."
        }, contextoError));
      }
      emitir("subirccc:importacion-error", {
        etapa: contextoError.etapa || "error",
        mensaje: error.message || texto(error),
        error: error,
        contexto: contextoError
      });
      throw error;
    } finally {
      window.removeEventListener("diagnostico:core-operacion", escucharCore);
    }
  }

  async function importarPaquete(paquete, opciones) {
    if (importacionActiva) {
      throw new Error("Ya existe una importación en curso. Espera a que termine o recarga la pantalla.");
    }
    importacionActiva = ejecutarImportacion(paquete, opciones).finally(function () {
      importacionActiva = null;
    });
    return await importacionActiva;
  }

  Subir.ConexionBDLocal.importarPaqueteOriginal = Subir.ConexionBDLocal.importarPaquete;
  Subir.ConexionBDLocal.importarPaquete = importarPaquete;
  Subir.ConexionBDLocal.__orquestadorVersion = VERSION;
  BD.ImportacionOrquestador = {
    version: VERSION,
    importarPaquete: importarPaquete,
    snapshotCarrera: snapshotCarrera,
    limpiarCarreraRapido: limpiarCarreraRapido,
    restaurarSnapshot: restaurarSnapshot
  };

  console.info("[BDLocalCCC.Orquestador] Importación única, progreso y rollback activados.");
})(window);
