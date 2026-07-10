/* =========================================================
Nombre completo: bdlocal.inteligencia.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.inteligencia.js
Función o funciones:
- Reconstruir PEA Base heredados desde filas, hojas y campos guardados.
- Recuperar descripción, objetivo, unidades, competencias, resultados y bibliografía.
- Validar materias sin reescribir innecesariamente las cuatro unidades ya agrupadas.
- Ejecutar la reparación inicial en segundo plano para no bloquear la pantalla.
- Mostrar progreso, evitar reparaciones duplicadas y revalidar antes de generar PDF.
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
  var VERSION_INTELIGENCIA = 2;
  var VERSION_ESTRUCTURA_BASE = 4;
  var reparacionesMateria = {};
  var reparacionGlobal = null;
  var reparacionesCarrera = {};

  var validarIntegridadBase = BD.Integridad && typeof BD.Integridad.validarMateria === "function"
    ? BD.Integridad.validarMateria.bind(BD.Integridad)
    : null;

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

  function canonicoCompleto(canonico) {
    canonico = canonico || {};
    var unidades = arr(canonico.unidadesBase);
    return !!(
      texto(canonico.descripcion) &&
      texto(canonico.objetivo) &&
      unidades.filter(function (u) { return texto(u && u.nombre); }).length >= 4 &&
      unidades.filter(function (u) { return texto(u && u.competencia); }).length >= 4 &&
      unidades.filter(function (u) { return texto(u && u.resultadoAprendizaje); }).length >= 4 &&
      arr(canonico.bibliografia).length > 0
    );
  }

  async function repararBaseMateria(materiaId, opciones) {
    opciones = opciones || {};
    if (!materiaId) return null;

    var base = await Core.get(STORES.PEA_BASE, materiaId);
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

    await Core.put(STORES.PEA_BASE, reparada);
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
    var validaciones = await Core.getAllByIndex(STORES.VALIDACIONES, "materiaId", materiaId);
    var eliminar = arr(validaciones).filter(function (item) {
      return item && item.tipo === "contenido_pea_incompleto" && item.id;
    });

    if (!eliminar.length) return;

    if (typeof Core.runTransaction === "function") {
      await Core.runTransaction(STORES.VALIDACIONES, "readwrite", function (stores) {
        eliminar.forEach(function (item) {
          stores[STORES.VALIDACIONES].delete(item.id);
        });
        return true;
      });
      return;
    }

    for (var i = 0; i < eliminar.length; i += 1) {
      await Core.remove(STORES.VALIDACIONES, eliminar[i].id);
    }
  }

  async function obtenerMateria(materiaOrId) {
    if (materiaOrId && typeof materiaOrId === "object") return materiaOrId;
    if (!materiaOrId) return null;
    return await Core.get(STORES.MATERIAS, materiaOrId);
  }

  async function validarMateriaInterno(materiaOrId, opciones) {
    opciones = opciones || {};
    await Core.ready();

    var materia = await obtenerMateria(materiaOrId);
    if (!materia) throw new Error("No se encontró la materia para reparar.");

    var base = await repararBaseMateria(materia.id, opciones);
    var unidades = await Core.getAllByIndex(STORES.PEA_UNIDADES, "materiaId", materia.id);
    var actividades = await Core.getAllByIndex(STORES.PEA_ACTIVIDADES, "materiaId", materia.id);

    if (!unidadesYaAgrupadas(unidades)) {
      if (BD.Integridad && typeof BD.Integridad.repararUnidadesMateria === "function") {
        unidades = await BD.Integridad.repararUnidadesMateria(materia, unidades);
      } else if (validarIntegridadBase) {
        return await validarIntegridadBase(materia);
      }
    }

    if (!BD.Integridad || typeof BD.Integridad.resumenIntegridad !== "function") {
      if (validarIntegridadBase) return await validarIntegridadBase(materia);
      throw new Error("No está disponible el validador de integridad curricular.");
    }

    var integridad = BD.Integridad.resumenIntegridad(base, unidades, actividades);
    integridad.inteligenciaVersion = VERSION_INTELIGENCIA;

    var archivosCompletos = !!(
      Number(materia.totalArchivosEncontrados || 0) >= 3 &&
      !arr(materia.archivosFaltantes).length &&
      !arr(materia.archivosDuplicados).length
    );

    var actualizada = Object.assign({}, materia, {
      integridadContenido: integridad,
      inteligenciaVersion: VERSION_INTELIGENCIA,
      estadoValidacion: archivosCompletos && integridad.completo ? "completo" : "revision",
      actualizadoEn: fecha()
    });

    await Core.put(STORES.MATERIAS, actualizada);
    await eliminarValidacionesContenido(materia.id);

    if (!integridad.completo) {
      await Core.add(STORES.VALIDACIONES, {
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
      });
    }

    return actualizada;
  }

  async function repararMateria(materiaOrId, opciones) {
    opciones = opciones || {};
    var materia = await obtenerMateria(materiaOrId);
    if (!materia) throw new Error("No se encontró la materia para reparar.");

    if (!reparacionesMateria[materia.id]) {
      reparacionesMateria[materia.id] = validarMateriaInterno(materia, opciones)
        .finally(function () {
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

    var base = await Core.get(STORES.PEA_BASE, materia.id);
    var versionBase = Number(
      base && (base.versionEstructura || (base.datos && base.datos.versionEstructura)) || 0
    );

    if (!base || !base.reparadoInteligentemente || versionBase < VERSION_ESTRUCTURA_BASE) return true;

    var unidades = await Core.getAllByIndex(STORES.PEA_UNIDADES, "materiaId", materia.id);
    return !unidadesYaAgrupadas(unidades);
  }

  function emitirProgreso(detalle) {
    try {
      window.dispatchEvent(new CustomEvent("bdlocal:inteligencia-progreso", { detail: detalle }));
    } catch (error) {
      console.warn("[BDLocalCCC.Inteligencia] No se pudo emitir progreso:", error);
    }
  }

  function actualizarEstadoPantalla(detalle) {
    var tarjeta = document.getElementById("estadoSistema");
    if (!tarjeta || !detalle) return;

    var titulo = tarjeta.querySelector("strong");
    var mensaje = tarjeta.querySelector("span");

    if (titulo) titulo.textContent = detalle.titulo || "Reparando base local...";
    if (mensaje) mensaje.textContent = detalle.mensaje || "Procesando información curricular.";
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
      var debeReparar = await necesitaReparacion(materia, opciones);

      var progreso = {
        indice: i + 1,
        total: materias.length,
        materiaId: materia.id,
        materia: materia.nombre,
        titulo: "Analizando base local " + (i + 1) + " de " + materias.length,
        mensaje: "Revisando " + texto(materia.nombre || materia.codigo || "materia") + "."
      };

      emitirProgreso(progreso);
      if (opciones.actualizarPantalla !== false) actualizarEstadoPantalla(progreso);

      try {
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

  function esSolicitudManual() {
    var tarjeta = document.getElementById("estadoSistema");
    var titulo = tarjeta && tarjeta.querySelector("strong");
    return !!(titulo && /reparando contenido|reparar y validar/i.test(texto(titulo.textContent)));
  }

  function refrescarPantallaAlFinalizar() {
    setTimeout(function () {
      var boton = document.getElementById("btnRecargar");
      if (boton && !boton.disabled) boton.click();
    }, 50);
  }

  async function repararTodas(opciones) {
    opciones = opciones || {};
    await Core.ready();

    var materias = await Core.getAll(STORES.MATERIAS);
    var bloqueante = opciones.bloqueante === true || opciones.force === true || esSolicitudManual();

    if (bloqueante) {
      var resultadoBloqueante = await repararLista(materias, Object.assign({}, opciones, {
        actualizarPantalla: true
      }));
      actualizarEstadoPantalla({
        titulo: "Reparación finalizada",
        mensaje: resultadoBloqueante.errores.length
          ? "Se completó con " + resultadoBloqueante.errores.length + " observaciones."
          : "La información curricular fue reconstruida y validada."
      });
      return resultadoBloqueante;
    }

    if (!reparacionGlobal) {
      reparacionGlobal = repararLista(materias, {
        force: false,
        actualizarPantalla: true
      }).then(function (resultado) {
        refrescarPantallaAlFinalizar();
        return resultado;
      }).catch(function (error) {
        console.error("[BDLocalCCC.Inteligencia] Falló la reparación en segundo plano:", error);
        return { total: materias.length, procesadas: 0, reparadas: 0, omitidas: 0, errores: [error] };
      }).finally(function () {
        reparacionGlobal = null;
      });
    }

    return {
      total: materias.length,
      enSegundoPlano: true,
      mensaje: "La base se mostrará inmediatamente mientras la reparación continúa en segundo plano."
    };
  }

  async function repararCarrera(carreraId, opciones) {
    opciones = opciones || {};
    await Core.ready();
    if (!carreraId) return { carreraId: carreraId, total: 0, reparadas: 0, omitidas: 0, errores: [] };

    if (!reparacionesCarrera[carreraId]) {
      reparacionesCarrera[carreraId] = Core.getAllByIndex(STORES.MATERIAS, "carreraId", carreraId)
        .then(function (materias) {
          return repararLista(materias, Object.assign({}, opciones, {
            actualizarPantalla: false
          }));
        })
        .then(function (resultado) {
          resultado.carreraId = carreraId;
          return resultado;
        })
        .finally(function () {
          delete reparacionesCarrera[carreraId];
        });
    }

    return await reparacionesCarrera[carreraId];
  }

  function parchearIntegridad() {
    if (!BD.Integridad) return;
    BD.Integridad.validarMateria = repararMateria;
    BD.Integridad.repararBaseMateria = repararBaseMateria;
    BD.Integridad.repararCarrera = repararCarrera;
    BD.Integridad.repararTodas = repararTodas;
    BD.Integridad.__inteligenciaAplicada = true;
  }

  function parchearImportador() {
    if (!BD.Importador || typeof BD.Importador.importarPaqueteCCC !== "function") return;
    if (BD.Importador.__inteligenciaAplicadaV2) return;

    var importarOriginal = BD.Importador.importarPaqueteCCC.bind(BD.Importador);

    BD.Importador.importarPaqueteCCC = async function (paquete) {
      var resultado = await importarOriginal(paquete);
      var materias = arr(resultado && resultado.materias);
      var reparadas = [];

      for (var i = 0; i < materias.length; i += 1) {
        reparadas.push(await repararMateria(materias[i], { force: true }));
      }

      if (resultado) {
        resultado.materias = reparadas;
        resultado.reparacionInteligente = true;
        resultado.inteligenciaVersion = VERSION_INTELIGENCIA;
      }

      return resultado;
    };

    BD.importarPaqueteCCC = BD.Importador.importarPaqueteCCC;
    BD.Importador.__inteligenciaAplicadaV2 = true;
  }

  function parchearComunicados() {
    var Comunicados = window.ComunicadosCCC;
    if (!Comunicados || !Comunicados.BDLocal || Comunicados.BDLocal.__inteligenciaAplicadaV2) return;

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

    modulo.__inteligenciaAplicadaV2 = true;
  }

  BD.Inteligencia = {
    VERSION: VERSION_INTELIGENCIA,
    extraerCanonico: extraerCanonico,
    canonicoCompleto: canonicoCompleto,
    repararBaseMateria: repararBaseMateria,
    repararMateria: repararMateria,
    repararCarrera: repararCarrera,
    repararTodas: repararTodas,
    unidadesYaAgrupadas: unidadesYaAgrupadas,
    parchearComunicados: parchearComunicados
  };

  parchearIntegridad();
  parchearImportador();
  parchearComunicados();

  console.info("[BDLocalCCC.Inteligencia] Reparación estable, progresiva y no bloqueante activada.");
})(window);
