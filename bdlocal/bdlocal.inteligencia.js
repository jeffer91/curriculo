/* =========================================================
Nombre completo: bdlocal.inteligencia.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.inteligencia.js
Función o funciones:
- Reconstruir PEA Base heredados a partir de filas, hojas y campos ya guardados.
- Recuperar descripción, objetivo, nombres de unidades, competencias, resultados y bibliografía.
- Reparar automáticamente materias en revisión sin volver a leer el ZIP.
- Revalidar una carrera antes de mostrarla en Comunicados.
- Aplicar la misma reparación después de futuras importaciones.
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
      firma = JSON.stringify(fila);
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

      if (codigo === 1 && descripcion1 && !canonico.descripcion) {
        canonico.descripcion = descripcion1;
      }

      if (codigo === 2 && descripcion1 && !canonico.objetivo) {
        canonico.objetivo = descripcion1;
      }

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

  async function repararBaseMateria(materiaId) {
    if (!materiaId) return null;

    var base = await Core.get(STORES.PEA_BASE, materiaId);
    if (!base) return null;

    var canonico = extraerCanonico(base);
    var datosAnteriores = base.datos || base.datosProcesados || {};
    var datosNuevos = Object.assign({}, datosAnteriores, canonico, {
      tipo: "pea_base",
      versionEstructura: 3,
      reparadoInteligentemente: true,
      reparadoEn: fecha()
    });

    var reparada = Object.assign({}, base, canonico, {
      datos: datosNuevos,
      actualizadoEn: fecha(),
      reparadoInteligentemente: true
    });

    await Core.put(STORES.PEA_BASE, reparada);
    return reparada;
  }

  async function obtenerMateria(materiaOrId) {
    if (materiaOrId && typeof materiaOrId === "object") return materiaOrId;
    if (!materiaOrId) return null;
    return await Core.get(STORES.MATERIAS, materiaOrId);
  }

  var validarOriginal = BD.Integridad && typeof BD.Integridad.validarMateria === "function"
    ? BD.Integridad.validarMateria.bind(BD.Integridad)
    : null;

  async function repararMateria(materiaOrId) {
    await Core.ready();

    var materia = await obtenerMateria(materiaOrId);
    if (!materia) throw new Error("No se encontró la materia para reparar.");

    await repararBaseMateria(materia.id);

    if (validarOriginal) {
      return await validarOriginal(materia);
    }

    return materia;
  }

  async function repararCarrera(carreraId) {
    await Core.ready();
    if (!carreraId) return { carreraId: carreraId, total: 0, reparadas: 0, errores: [] };

    var materias = await Core.getAllByIndex(STORES.MATERIAS, "carreraId", carreraId);
    var reparadas = 0;
    var errores = [];

    for (var i = 0; i < materias.length; i += 1) {
      try {
        await repararMateria(materias[i]);
        reparadas += 1;
      } catch (error) {
        errores.push({
          materiaId: materias[i].id,
          materia: materias[i].nombre,
          error: error.message || String(error)
        });
      }
    }

    return {
      carreraId: carreraId,
      total: materias.length,
      reparadas: reparadas,
      errores: errores
    };
  }

  async function repararTodas() {
    await Core.ready();
    var materias = await Core.getAll(STORES.MATERIAS);
    var reparadas = 0;
    var errores = [];

    for (var i = 0; i < materias.length; i += 1) {
      try {
        await repararMateria(materias[i]);
        reparadas += 1;
      } catch (error) {
        errores.push({
          materiaId: materias[i].id,
          materia: materias[i].nombre,
          error: error.message || String(error)
        });
      }
    }

    return { total: materias.length, reparadas: reparadas, errores: errores };
  }

  function parchearIntegridad() {
    if (!BD.Integridad || BD.Integridad.__inteligenciaAplicada) return;

    BD.Integridad.validarMateria = repararMateria;
    BD.Integridad.repararBaseMateria = repararBaseMateria;
    BD.Integridad.repararCarrera = repararCarrera;
    BD.Integridad.repararTodas = repararTodas;
    BD.Integridad.__inteligenciaAplicada = true;
  }

  function parchearImportador() {
    if (!BD.Importador || typeof BD.Importador.importarPaqueteCCC !== "function") return;
    if (BD.Importador.__inteligenciaAplicada) return;

    var importarOriginal = BD.Importador.importarPaqueteCCC.bind(BD.Importador);

    BD.Importador.importarPaqueteCCC = async function (paquete) {
      var resultado = await importarOriginal(paquete);
      var materias = arr(resultado && resultado.materias);
      var reparadas = [];

      for (var i = 0; i < materias.length; i += 1) {
        reparadas.push(await repararMateria(materias[i]));
      }

      if (resultado) {
        resultado.materias = reparadas;
        resultado.reparacionInteligente = true;
      }

      return resultado;
    };

    BD.importarPaqueteCCC = BD.Importador.importarPaqueteCCC;
    BD.Importador.__inteligenciaAplicada = true;
  }

  function parchearComunicados() {
    var Comunicados = window.ComunicadosCCC;
    if (!Comunicados || !Comunicados.BDLocal || Comunicados.BDLocal.__inteligenciaAplicada) return;

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
    var promesasCarrera = {};

    async function asegurarCarrera(carreraId) {
      if (!carreraId) return null;
      if (!promesasCarrera[carreraId]) {
        promesasCarrera[carreraId] = repararCarrera(carreraId)
          .catch(function (error) {
            console.error("[BDLocalCCC.Inteligencia] No se pudo reparar la carrera:", error);
            return null;
          });
      }
      return await promesasCarrera[carreraId];
    }

    if (resumenOriginal) {
      modulo.obtenerResumenCarrera = async function (carreraId) {
        await asegurarCarrera(carreraId);
        return await resumenOriginal(carreraId);
      };
    }

    if (materiasOriginal) {
      modulo.obtenerMateriasPorCarrera = async function (carreraId, opciones) {
        await asegurarCarrera(carreraId);
        return await materiasOriginal(carreraId, opciones);
      };
    }

    if (detalleOriginal) {
      modulo.obtenerDetalleMateriaComunicado = async function (materiaId) {
        await repararMateria(materiaId);
        return await detalleOriginal(materiaId);
      };
    }

    modulo.__inteligenciaAplicada = true;
  }

  BD.Inteligencia = {
    extraerCanonico: extraerCanonico,
    repararBaseMateria: repararBaseMateria,
    repararMateria: repararMateria,
    repararCarrera: repararCarrera,
    repararTodas: repararTodas,
    parchearComunicados: parchearComunicados
  };

  parchearIntegridad();
  parchearImportador();
  parchearComunicados();

  console.info("[BDLocalCCC.Inteligencia] Reparación semántica y validación automática activas.");
})(window);
