/* =========================================================
Nombre completo: bdlocal.inteligencia.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.inteligencia.js
Función o funciones:
- Reconstruir PEA Base heredados desde filas, hojas y campos guardados.
- Recuperar descripción, objetivo, unidades, competencias, resultados y bibliografía.
- Validar materias con límites de tiempo y continuar ante errores individuales.
- Ejecutar reparaciones en segundo plano sin bloquear la pantalla BDLocal.
- Revalidar carreras antes de mostrar o generar comunicados.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var BD = window.BDLocalCCC;
  var Core = BD.Core;
  var Schema = BD.Schema;

  if (!Core || !Schema) {
    console.error("[BDLocalCCC.Inteligencia] Faltan Core o Schema.");
    return;
  }

  var STORES = Schema.STORES;
  var VERSION_INTELIGENCIA = 3;
  var VERSION_ESTRUCTURA_BASE = 5;
  var TIMEOUT_MATERIA_MS = 25000;
  var TIMEOUT_PASO_MS = 12000;

  var reparacionesMateria = {};
  var reparacionesCarrera = {};
  var reparacionGlobal = null;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function fecha() {
    return Schema.fechaISO ? Schema.fechaISO() : new Date().toISOString();
  }

  function esperarTurnoUI() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  function conTiempoLimite(promesa, timeoutMs, contexto) {
    timeoutMs = Number(timeoutMs || TIMEOUT_PASO_MS);

    return new Promise(function (resolve, reject) {
      var terminada = false;
      var timer = setTimeout(function () {
        if (terminada) return;
        terminada = true;
        reject(new Error("Tiempo agotado: " + contexto));
      }, timeoutMs);

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

  function normalizarClave(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function valorCampo(obj, aliases) {
    obj = obj || {};
    var buscadas = arr(aliases).map(normalizarClave);
    var claves = Object.keys(obj);

    for (var i = 0; i < claves.length; i += 1) {
      var clave = claves[i];
      if (buscadas.indexOf(normalizarClave(clave)) !== -1 && texto(obj[clave])) {
        return texto(obj[clave]);
      }
    }

    return "";
  }

  function numeroCampo(obj, aliases, defecto) {
    var valor = valorCampo(obj, aliases);
    var match = valor.match(/-?\d+/);
    return match ? Number(match[0]) : Number(defecto || 0);
  }

  function crearMapaUnidades() {
    return {
      1: { unidadNumero: 1, nombre: "", competencia: "", resultadoAprendizaje: "" },
      2: { unidadNumero: 2, nombre: "", competencia: "", resultadoAprendizaje: "" },
      3: { unidadNumero: 3, nombre: "", competencia: "", resultadoAprendizaje: "" },
      4: { unidadNumero: 4, nombre: "", competencia: "", resultadoAprendizaje: "" }
    };
  }

  function agregarFila(destino, fila, vistos) {
    if (!fila || typeof fila !== "object") return;

    var firma = [
      numeroCampo(fila, ["codigoComponente", "codigo_componente"], 0),
      numeroCampo(fila, ["ordenComponente", "orden_componente"], 0),
      valorCampo(fila, ["descripcionComponente", "descripcion_componente"]),
      valorCampo(fila, ["descripcionComponente2", "descripcion_componente_2"]),
      valorCampo(fila, ["descripcionComponente3", "descripcion_componente_3"])
    ].join("||");

    if (firma === "0||0||||||") {
      try {
        firma = JSON.stringify(fila);
      } catch (errorFirma) {
        firma = String(destino.length) + "_" + fecha();
      }
    }

    if (vistos[firma]) return;
    vistos[firma] = true;
    destino.push(fila);
  }

  function agregarFilasRaiz(destino, raiz, vistos) {
    if (!raiz || typeof raiz !== "object") return;

    arr(raiz.filas).forEach(function (fila) {
      agregarFila(destino, fila, vistos);
    });

    arr(raiz.registros).forEach(function (fila) {
      agregarFila(destino, fila, vistos);
    });

    if (raiz.hojas && typeof raiz.hojas === "object") {
      Object.keys(raiz.hojas).forEach(function (nombreHoja) {
        var hoja = raiz.hojas[nombreHoja] || {};
        arr(hoja.filas).forEach(function (fila) {
          agregarFila(destino, fila, vistos);
        });
        arr(hoja.registros).forEach(function (fila) {
          agregarFila(destino, fila, vistos);
        });
      });
    }
  }

  function obtenerFilasBase(base) {
    base = base || {};
    var filas = [];
    var vistos = {};

    agregarFilasRaiz(filas, base, vistos);
    agregarFilasRaiz(filas, base.datos, vistos);
    agregarFilasRaiz(filas, base.datosProcesados, vistos);

    return filas;
  }

  function quitarPrefijoOrden(valor, ordenEsperado) {
    var limpio = texto(valor);
    var match = limpio.match(/^\s*([1-9]\d*)\s+([\s\S]+)$/);

    if (match && (!ordenEsperado || Number(match[1]) === Number(ordenEsperado))) {
      return texto(match[2]);
    }

    return limpio;
  }

  function agregarBibliografia(lista, item) {
    item = item || {};
    var referencia = texto(item.referencia || item.bibliografia || item.descripcion);
    if (!referencia) return;

    var existe = lista.some(function (actual) {
      return normalizarClave(actual.referencia) === normalizarClave(referencia);
    });
    if (existe) return;

    lista.push({
      orden: Number(item.orden || lista.length + 1),
      referencia: referencia,
      codigoReferencia: texto(item.codigoReferencia || item.codigo || ""),
      justificacion: texto(item.justificacion || item.descripcionComponente3 || "")
    });
  }

  function aplicarFilas(canonico, filas) {
    arr(filas).forEach(function (fila) {
      var codigo = numeroCampo(fila, ["codigoComponente", "codigo_componente"], 0);
      var orden = numeroCampo(fila, ["ordenComponente", "orden_componente"], 0);
      var descripcion1 = valorCampo(fila, ["descripcionComponente", "descripcion_componente"]);
      var descripcion2 = valorCampo(fila, ["descripcionComponente2", "descripcion_componente_2"]);
      var descripcion3 = valorCampo(fila, ["descripcionComponente3", "descripcion_componente_3"]);

      if (codigo === 1 && descripcion1 && !canonico.descripcion) canonico.descripcion = descripcion1;
      if (codigo === 2 && descripcion1 && !canonico.objetivo) canonico.objetivo = descripcion1;

      if (orden >= 1 && orden <= 4 && descripcion1) {
        if (codigo === 3 && !canonico.mapaUnidades[orden].nombre) {
          canonico.mapaUnidades[orden].nombre = descripcion1;
        }
        if (codigo === 4 && !canonico.mapaUnidades[orden].competencia) {
          canonico.mapaUnidades[orden].competencia = descripcion1;
        }
        if (codigo === 5 && !canonico.mapaUnidades[orden].resultadoAprendizaje) {
          canonico.mapaUnidades[orden].resultadoAprendizaje = descripcion1;
        }
      }

      if (codigo === 8 && descripcion1) {
        agregarBibliografia(canonico.bibliografia, {
          orden: orden || canonico.bibliografia.length + 1,
          referencia: descripcion1,
          codigoReferencia: descripcion2,
          justificacion: descripcion3
        });
      }
    });
  }

  function aplicarCamposHeredados(canonico, campos) {
    campos = campos || {};

    Object.keys(campos).forEach(function (clave) {
      var match = texto(clave).match(/^([1-8])(?:_(\d+))?$/);
      if (!match) return;

      var codigo = Number(match[1]);
      var secuencia = match[2] ? Number(match[2]) : 1;
      var valorOriginal = texto(campos[clave]);
      if (!valorOriginal) return;

      var prefijo = valorOriginal.match(/^\s*([1-9]\d*)\s+/);
      var orden = prefijo ? Number(prefijo[1]) : secuencia;
      var valor = quitarPrefijoOrden(valorOriginal, orden);

      if (codigo === 1 && !canonico.descripcion) canonico.descripcion = valor;
      if (codigo === 2 && !canonico.objetivo) canonico.objetivo = valor;

      if (orden >= 1 && orden <= 4) {
        if (codigo === 3 && !canonico.mapaUnidades[orden].nombre) {
          canonico.mapaUnidades[orden].nombre = valor;
        }
        if (codigo === 4 && !canonico.mapaUnidades[orden].competencia) {
          canonico.mapaUnidades[orden].competencia = valor;
        }
        if (codigo === 5 && !canonico.mapaUnidades[orden].resultadoAprendizaje) {
          canonico.mapaUnidades[orden].resultadoAprendizaje = valor;
        }
      }
    });
  }

  function extraerCanonico(base) {
    base = base || {};
    var datos = base.datos || base.datosProcesados || {};
    var campos = Object.assign({}, datos.campos || {}, base.campos || {});
    var canonico = {
      descripcion: texto(datos.descripcion || base.descripcion || campos.descripcion_asignatura || campos.descripcion),
      objetivo: texto(datos.objetivo || base.objetivo || campos.objetivo_asignatura || campos.objetivo),
      mapaUnidades: crearMapaUnidades(),
      bibliografia: []
    };

    arr(datos.unidadesBase || base.unidadesBase).forEach(function (unidad) {
      var numero = Number(unidad && (unidad.unidadNumero || unidad.orden) || 0);
      if (!canonico.mapaUnidades[numero]) return;

      canonico.mapaUnidades[numero].nombre = texto(unidad.nombre || unidad.tituloUnidad);
      canonico.mapaUnidades[numero].competencia = texto(unidad.competencia);
      canonico.mapaUnidades[numero].resultadoAprendizaje = texto(
        unidad.resultadoAprendizaje || unidad.resultado
      );
    });

    arr(datos.bibliografia || base.bibliografia).forEach(function (item) {
      agregarBibliografia(canonico.bibliografia, item);
    });

    aplicarFilas(canonico, obtenerFilasBase(base));
    aplicarCamposHeredados(canonico, campos);

    return {
      descripcion: canonico.descripcion,
      objetivo: canonico.objetivo,
      unidadesBase: [
        canonico.mapaUnidades[1],
        canonico.mapaUnidades[2],
        canonico.mapaUnidades[3],
        canonico.mapaUnidades[4]
      ],
      bibliografia: canonico.bibliografia.sort(function (a, b) {
        return Number(a.orden || 0) - Number(b.orden || 0);
      })
    };
  }

  async function repararBaseMateria(materiaId, opciones) {
    opciones = opciones || {};
    if (!materiaId) return null;

    var base = await conTiempoLimite(
      Core.get(STORES.PEA_BASE, materiaId),
      TIMEOUT_PASO_MS,
      "leer PEA Base de " + materiaId
    );
    if (!base) return null;

    var versionActual = Number(
      base.versionEstructura ||
      (base.datos && base.datos.versionEstructura) ||
      0
    );

    if (!opciones.force && base.reparadoInteligentemente && versionActual >= VERSION_ESTRUCTURA_BASE) {
      return base;
    }

    var canonico = extraerCanonico(base);
    var datosAnteriores = base.datos || base.datosProcesados || {};
    var datosNuevos = Object.assign({}, datosAnteriores, canonico, {
      tipo: "pea_base",
      versionEstructura: VERSION_ESTRUCTURA_BASE,
      reparadoInteligentemente: true,
      reparadoEn: fecha()
    });

    var reparada = Object.assign({}, base, canonico, {
      datos: datosNuevos,
      versionEstructura: VERSION_ESTRUCTURA_BASE,
      actualizadoEn: fecha(),
      reparadoInteligentemente: true
    });

    await conTiempoLimite(
      Core.put(STORES.PEA_BASE, reparada),
      TIMEOUT_PASO_MS,
      "guardar PEA Base reparado de " + materiaId
    );

    return reparada;
  }

  function unidadesYaAgrupadas(unidades) {
    unidades = arr(unidades);
    if (unidades.length !== 4) return false;

    var numeros = {};
    for (var i = 0; i < unidades.length; i += 1) {
      var unidad = unidades[i] || {};
      var numero = Number(unidad.unidadNumero || 0);
      if (numero < 1 || numero > 4 || numeros[numero]) return false;
      if (!Array.isArray(unidad.contenidos)) return false;
      numeros[numero] = true;
    }

    return !!(numeros[1] && numeros[2] && numeros[3] && numeros[4]);
  }

  async function eliminarValidacionesContenido(materiaId) {
    var validaciones = await conTiempoLimite(
      Core.getAllByIndex(STORES.VALIDACIONES, "materiaId", materiaId),
      TIMEOUT_PASO_MS,
      "consultar validaciones de " + materiaId
    );

    var eliminar = arr(validaciones).filter(function (item) {
      return item && item.tipo === "contenido_pea_incompleto" && item.id;
    });

    for (var i = 0; i < eliminar.length; i += 1) {
      await conTiempoLimite(
        Core.remove(STORES.VALIDACIONES, eliminar[i].id),
        TIMEOUT_PASO_MS,
        "eliminar validación antigua de " + materiaId
      );
    }
  }

  async function obtenerMateria(materiaOrId) {
    if (materiaOrId && typeof materiaOrId === "object") return materiaOrId;
    if (!materiaOrId) return null;
    return await conTiempoLimite(
      Core.get(STORES.MATERIAS, materiaOrId),
      TIMEOUT_PASO_MS,
      "leer materia " + materiaOrId
    );
  }

  function evaluarArchivos(archivos) {
    var conteos = {};
    arr(archivos).forEach(function (archivo) {
      var tipo = texto(archivo && archivo.tipo);
      if (!tipo) return;
      conteos[tipo] = Number(conteos[tipo] || 0) + 1;
    });

    var requeridos = [Schema.TIPOS_PEA.BASE, Schema.TIPOS_PEA.UNIDADES, Schema.TIPOS_PEA.ACTIVIDADES];
    var faltantes = requeridos.filter(function (tipo) { return !conteos[tipo]; });
    var duplicados = requeridos.filter(function (tipo) { return Number(conteos[tipo] || 0) > 1; });

    return {
      completo: faltantes.length === 0 && duplicados.length === 0,
      totalEncontrados: requeridos.filter(function (tipo) { return !!conteos[tipo]; }).length,
      faltantes: faltantes,
      duplicados: duplicados
    };
  }

  function emitirProgreso(detalle) {
    try {
      window.dispatchEvent(new CustomEvent("bdlocal:inteligencia-progreso", { detail: detalle }));
    } catch (error) {
      console.warn("[BDLocalCCC.Inteligencia] No se pudo emitir progreso:", error);
    }
  }

  function emitirFinal(detalle) {
    try {
      window.dispatchEvent(new CustomEvent("bdlocal:inteligencia-finalizada", { detail: detalle }));
    } catch (error) {
      console.warn("[BDLocalCCC.Inteligencia] No se pudo emitir finalización:", error);
    }
  }

  function emitirPaso(materia, paso, mensaje) {
    emitirProgreso({
      materiaId: materia && materia.id,
      materia: materia && materia.nombre,
      paso: paso,
      titulo: "Revisando " + texto(materia && (materia.nombre || materia.codigo) || "materia"),
      mensaje: mensaje
    });
  }

  async function validarMateriaInterno(materiaOrId, opciones) {
    opciones = opciones || {};
    await conTiempoLimite(Core.ready(), TIMEOUT_PASO_MS, "preparar BDLocal");

    var materia = await obtenerMateria(materiaOrId);
    if (!materia) throw new Error("No se encontró la materia para reparar.");

    emitirPaso(materia, "pea_base", "Interpretando descripción, objetivo, unidades y bibliografía.");
    var base = await repararBaseMateria(materia.id, opciones);

    emitirPaso(materia, "unidades", "Comprobando las cuatro unidades y todos sus contenidos.");
    var unidades = await conTiempoLimite(
      Core.getAllByIndex(STORES.PEA_UNIDADES, "materiaId", materia.id),
      TIMEOUT_PASO_MS,
      "leer unidades de " + materia.nombre
    );

    if (!unidadesYaAgrupadas(unidades)) {
      if (!BD.Integridad || typeof BD.Integridad.repararUnidadesMateria !== "function") {
        throw new Error("No está disponible el reparador de unidades.");
      }
      unidades = await conTiempoLimite(
        BD.Integridad.repararUnidadesMateria(materia, unidades),
        TIMEOUT_MATERIA_MS,
        "agrupar contenidos de " + materia.nombre
      );
    }

    emitirPaso(materia, "actividades", "Comprobando actividades y archivos PEA.");
    var actividades = await conTiempoLimite(
      Core.getAllByIndex(STORES.PEA_ACTIVIDADES, "materiaId", materia.id),
      TIMEOUT_PASO_MS,
      "leer actividades de " + materia.nombre
    );
    var archivos = await conTiempoLimite(
      Core.getAllByIndex(STORES.PEA_ARCHIVOS, "materiaId", materia.id),
      TIMEOUT_PASO_MS,
      "leer archivos de " + materia.nombre
    );

    if (!BD.Integridad || typeof BD.Integridad.resumenIntegridad !== "function") {
      throw new Error("No está disponible el validador de integridad curricular.");
    }

    var integridad = BD.Integridad.resumenIntegridad(base, unidades, actividades);
    integridad.inteligenciaVersion = VERSION_INTELIGENCIA;

    var evaluacionArchivos = evaluarArchivos(archivos);
    var actualizada = Object.assign({}, materia, {
      integridadContenido: integridad,
      inteligenciaVersion: VERSION_INTELIGENCIA,
      estadoValidacion: evaluacionArchivos.completo && integridad.completo ? "completo" : "revision",
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: evaluacionArchivos.totalEncontrados,
      archivosFaltantes: evaluacionArchivos.faltantes,
      archivosDuplicados: evaluacionArchivos.duplicados,
      actualizadoEn: fecha()
    });

    emitirPaso(materia, "guardar", "Guardando el estado validado de la materia.");
    await conTiempoLimite(
      Core.put(STORES.MATERIAS, actualizada),
      TIMEOUT_PASO_MS,
      "guardar estado de " + materia.nombre
    );

    await eliminarValidacionesContenido(materia.id);

    if (!integridad.completo) {
      await conTiempoLimite(
        Core.add(STORES.VALIDACIONES, {
          cargaId: materia.cargaId || null,
          carreraId: materia.carreraId || "",
          matrizId: materia.matrizId || "",
          nivelId: materia.nivelId || "",
          materiaId: materia.id,
          archivoId: "",
          tipo: "contenido_pea_incompleto",
          severidad: "error",
          estado: "activo",
          mensaje: "Los tres archivos existen, pero falta contenido curricular obligatorio.",
          detalle: integridad,
          creadoEn: fecha()
        }),
        TIMEOUT_PASO_MS,
        "guardar validación de " + materia.nombre
      );
    }

    return actualizada;
  }

  async function repararMateria(materiaOrId, opciones) {
    opciones = opciones || {};
    var materia = await obtenerMateria(materiaOrId);
    if (!materia) throw new Error("No se encontró la materia para reparar.");

    if (!reparacionesMateria[materia.id]) {
      reparacionesMateria[materia.id] = conTiempoLimite(
        validarMateriaInterno(materia, opciones),
        opciones.timeoutMs || TIMEOUT_MATERIA_MS,
        "reparar " + texto(materia.nombre || materia.codigo)
      ).finally(function () {
        delete reparacionesMateria[materia.id];
      });
    }

    return await reparacionesMateria[materia.id];
  }

  async function necesitaReparacion(materia, opciones) {
    opciones = opciones || {};
    if (opciones.force) return true;
    if (!materia) return false;
    if (Number(materia.inteligenciaVersion || 0) < VERSION_INTELIGENCIA) return true;

    var base = await conTiempoLimite(
      Core.get(STORES.PEA_BASE, materia.id),
      TIMEOUT_PASO_MS,
      "comprobar PEA Base de " + materia.nombre
    );
    var versionBase = Number(
      base && (base.versionEstructura || (base.datos && base.datos.versionEstructura)) || 0
    );

    if (!base || !base.reparadoInteligentemente || versionBase < VERSION_ESTRUCTURA_BASE) return true;

    var unidades = await conTiempoLimite(
      Core.getAllByIndex(STORES.PEA_UNIDADES, "materiaId", materia.id),
      TIMEOUT_PASO_MS,
      "comprobar unidades de " + materia.nombre
    );

    return !unidadesYaAgrupadas(unidades);
  }

  async function repararLista(materias, opciones) {
    opciones = opciones || {};
    materias = arr(materias);

    var resultado = {
      total: materias.length,
      procesadas: 0,
      reparadas: 0,
      omitidas: 0,
      errores: []
    };

    for (var i = 0; i < materias.length; i += 1) {
      var materia = materias[i];
      var progreso = {
        indice: i + 1,
        total: materias.length,
        materiaId: materia.id,
        materia: materia.nombre,
        titulo: "Analizando base local " + (i + 1) + " de " + materias.length,
        mensaje: "Revisando " + texto(materia.nombre || materia.codigo || "materia") + "."
      };
      emitirProgreso(progreso);

      try {
        var debeReparar = await necesitaReparacion(materia, opciones);
        if (debeReparar) {
          await repararMateria(materia, opciones);
          resultado.reparadas += 1;
        } else {
          resultado.omitidas += 1;
        }
      } catch (errorMateria) {
        resultado.errores.push({
          materiaId: materia.id,
          materia: materia.nombre,
          error: errorMateria.message || String(errorMateria)
        });
        console.error("[BDLocalCCC.Inteligencia] Error reparando materia:", materia.id, errorMateria);
      }

      resultado.procesadas += 1;
      await esperarTurnoUI();
    }

    return resultado;
  }

  async function ejecutarReparacionGlobal(opciones) {
    opciones = opciones || {};
    await conTiempoLimite(Core.ready(), TIMEOUT_PASO_MS, "preparar la reparación global");
    var materias = await conTiempoLimite(
      Core.getAll(STORES.MATERIAS),
      TIMEOUT_PASO_MS,
      "listar materias para reparación"
    );

    var resultado = await repararLista(materias, opciones);
    emitirFinal(resultado);
    return resultado;
  }

  async function repararTodas(opciones) {
    opciones = opciones || {};

    if (opciones.segundoPlano === true || opciones.background === true) {
      if (!reparacionGlobal) {
        reparacionGlobal = ejecutarReparacionGlobal(Object.assign({}, opciones, {
          segundoPlano: false,
          background: false
        })).catch(function (error) {
          var resultadoError = {
            total: 0,
            procesadas: 0,
            reparadas: 0,
            omitidas: 0,
            errores: [{ error: error.message || String(error) }]
          };
          emitirFinal(resultadoError);
          return resultadoError;
        }).finally(function () {
          reparacionGlobal = null;
        });
      }

      return {
        enSegundoPlano: true,
        mensaje: "La reparación se ejecuta sin bloquear la consulta de la base."
      };
    }

    if (reparacionGlobal) return await reparacionGlobal;
    return await ejecutarReparacionGlobal(opciones);
  }

  async function repararCarrera(carreraId, opciones) {
    opciones = opciones || {};
    if (!carreraId) return { carreraId: carreraId, total: 0, reparadas: 0, omitidas: 0, errores: [] };

    if (!reparacionesCarrera[carreraId]) {
      reparacionesCarrera[carreraId] = conTiempoLimite(
        Core.getAllByIndex(STORES.MATERIAS, "carreraId", carreraId)
          .then(function (materias) {
            return repararLista(materias, Object.assign({}, opciones, { actualizarPantalla: false }));
          })
          .then(function (resultado) {
            resultado.carreraId = carreraId;
            return resultado;
          }),
        Math.max(TIMEOUT_MATERIA_MS, 120000),
        "reparar carrera " + carreraId
      ).finally(function () {
        delete reparacionesCarrera[carreraId];
      });
    }

    return await reparacionesCarrera[carreraId];
  }

  function parchearImportador() {
    if (!BD.Importador || typeof BD.Importador.importarPaqueteCCC !== "function") return;
    if (BD.Importador.__inteligenciaAplicadaV3) return;

    var importarOriginal = BD.Importador.importarPaqueteCCC.bind(BD.Importador);

    BD.Importador.importarPaqueteCCC = async function (paquete) {
      var resultado = await importarOriginal(paquete);
      var materias = arr(resultado && resultado.materias);
      var reparadas = [];

      for (var i = 0; i < materias.length; i += 1) {
        try {
          reparadas.push(await repararMateria(materias[i], { force: true }));
        } catch (errorMateria) {
          console.error("[BDLocalCCC.Inteligencia] No se pudo validar la materia importada:", errorMateria);
          reparadas.push(materias[i]);
        }
      }

      if (resultado) {
        resultado.materias = reparadas;
        resultado.reparacionInteligente = true;
        resultado.inteligenciaVersion = VERSION_INTELIGENCIA;
      }

      return resultado;
    };

    BD.importarPaqueteCCC = BD.Importador.importarPaqueteCCC;
    BD.Importador.__inteligenciaAplicadaV3 = true;
  }

  function parchearComunicados() {
    var Comunicados = window.ComunicadosCCC;
    if (!Comunicados || !Comunicados.BDLocal || Comunicados.BDLocal.__inteligenciaAplicadaV3) return;

    var modulo = Comunicados.BDLocal;
    var resumenOriginal = typeof modulo.obtenerResumenCarrera === "function"
      ? modulo.obtenerResumenCarrera.bind(modulo)
      : null;
    var materiasOriginal = typeof modulo.obtenerMateriasPorCarrera === "function"
      ? modulo.obtenerMateriasPorCarrera.bind(modulo)
      : null;
    var detalleOriginal = typeof modulo.obtenerDetalleMateriaComunicado === "function"
      ? modulo.obtenerDetalleMateriaComunicado.bind(modulo)
      : null;

    if (resumenOriginal) {
      modulo.obtenerResumenCarrera = async function (carreraId) {
        await repararCarrera(carreraId);
        return await resumenOriginal(carreraId);
      };
    }

    if (materiasOriginal) {
      modulo.obtenerMateriasPorCarrera = async function (carreraId, opciones) {
        await repararCarrera(carreraId);
        return await materiasOriginal(carreraId, opciones);
      };
    }

    if (detalleOriginal) {
      modulo.obtenerDetalleMateriaComunicado = async function (materiaId) {
        await repararMateria(materiaId);
        return await detalleOriginal(materiaId);
      };
    }

    modulo.__inteligenciaAplicadaV3 = true;
  }

  BD.Inteligencia = {
    VERSION: VERSION_INTELIGENCIA,
    extraerCanonico: extraerCanonico,
    repararBaseMateria: repararBaseMateria,
    repararMateria: repararMateria,
    repararCarrera: repararCarrera,
    repararTodas: repararTodas,
    unidadesYaAgrupadas: unidadesYaAgrupadas,
    parchearComunicados: parchearComunicados,
    conTiempoLimite: conTiempoLimite
  };

  if (BD.Integridad) {
    BD.Integridad.repararBaseMateriaInteligente = repararBaseMateria;
    BD.Integridad.repararCarreraInteligente = repararCarrera;
    BD.Integridad.repararTodasInteligente = repararTodas;
  }

  parchearImportador();
  parchearComunicados();

  console.info("[BDLocalCCC.Inteligencia] Reparación V3 estable, con timeouts y segundo plano activada.");
})(window);
