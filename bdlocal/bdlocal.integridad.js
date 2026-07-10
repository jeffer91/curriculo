/* =========================================================
Nombre completo: bdlocal.integridad.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.integridad.js
Función o funciones:
- Reemplazar completamente una carrera cuando vuelve a importarse.
- Normalizar PEA Unidades aunque lleguen como 4 grupos o como muchas filas.
- Reparar registros antiguos agrupando por ordenComponente o por la numeración del contenido.
- Validar descripción, objetivo, 4 unidades, contenidos, actividades y bibliografía.
- Guardar conteos por unidad para BDLocal y Comunicados.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Core = NS.Core;
  var Schema = NS.Schema;

  if (!Core || !Schema || !NS.Importador || typeof NS.Importador.importarPaqueteCCC !== "function") {
    console.error("[BDLocalCCC.Integridad] Faltan Core, Schema o Importador.");
    return;
  }

  var STORES = Schema.STORES;
  var originalImportar = NS.Importador.importarPaqueteCCC.bind(NS.Importador);

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function fecha() {
    return Schema.fechaISO ? Schema.fechaISO() : new Date().toISOString();
  }

  function normalizarCampo(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function obtenerValor(obj, aliases) {
    obj = obj || {};
    aliases = arr(aliases).map(normalizarCampo);
    var keys = Object.keys(obj);

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (aliases.indexOf(normalizarCampo(key)) !== -1 && texto(obj[key])) {
        return texto(obj[key]);
      }
    }

    return "";
  }

  function obtenerNumero(obj, aliases, defecto) {
    var valor = obtenerValor(obj, aliases);
    var match = valor.match(/-?\d+/);
    return match ? Number(match[0]) : Number(defecto || 0);
  }

  function inferirUnidadPorContenido(contenido) {
    var match = texto(contenido).match(/^\s*([1-4])(?:\s*[.\-:]|\s|$)/);
    return match ? Number(match[1]) : 0;
  }

  function crearMapaUnidades() {
    return {
      1: { unidadNumero: 1, contenidos: [], filasOriginales: [] },
      2: { unidadNumero: 2, contenidos: [], filasOriginales: [] },
      3: { unidadNumero: 3, contenidos: [], filasOriginales: [] },
      4: { unidadNumero: 4, contenidos: [], filasOriginales: [] }
    };
  }

  function agregarContenido(mapa, numero, contenido, filaOriginal) {
    numero = Number(numero || 0);
    contenido = texto(contenido);

    if (!mapa[numero] || !contenido) return;

    if (mapa[numero].contenidos.indexOf(contenido) === -1) {
      mapa[numero].contenidos.push(contenido);
      if (filaOriginal && typeof filaOriginal === "object") {
        mapa[numero].filasOriginales.push(filaOriginal);
      }
    }
  }

  function procesarRegistroUnidad(mapa, registro) {
    if (!registro || typeof registro !== "object") return;

    var codigo = obtenerNumero(registro, ["codigoComponente", "codigo_componente"], 0);
    if (codigo && codigo !== 3) return;

    var numeroOrden = obtenerNumero(registro, ["ordenComponente", "orden_componente"], 0);
    var numeroGuardado = obtenerNumero(registro, [
      "unidadNumero",
      "unidad_numero",
      "numeroUnidad",
      "numero_unidad",
      "unidad",
      "n_unidad"
    ], 0);

    var contenidos = arr(registro.contenidos).filter(function (item) {
      return texto(item);
    });

    contenidos.forEach(function (contenido) {
      var numero = numeroOrden || inferirUnidadPorContenido(contenido) || numeroGuardado;
      agregarContenido(mapa, numero, contenido, registro);
    });

    arr(registro.filasOriginales).forEach(function (fila) {
      procesarRegistroUnidad(mapa, fila);
    });

    var contenidoDirecto = obtenerValor(registro, [
      "descripcionComponente",
      "descripcion_componente",
      "contenido",
      "temaDetectado",
      "tema",
      "titulo",
      "descripcion"
    ]);

    if (!contenidoDirecto && Array.isArray(registro.valores)) {
      contenidoDirecto = texto(registro.valores[2] || registro.valores[1] || "");
      if (!numeroOrden) {
        numeroOrden = Number(registro.valores[1] || 0);
      }
    }

    if (contenidoDirecto) {
      var numeroDirecto =
        numeroOrden ||
        inferirUnidadPorContenido(contenidoDirecto) ||
        numeroGuardado;

      agregarContenido(mapa, numeroDirecto, contenidoDirecto, registro);
    }

    arr(registro.filas).forEach(function (fila) {
      procesarRegistroUnidad(mapa, fila);
    });

    arr(registro.registros).forEach(function (fila) {
      procesarRegistroUnidad(mapa, fila);
    });

    if (registro.hojas && typeof registro.hojas === "object") {
      Object.keys(registro.hojas).forEach(function (nombreHoja) {
        var hoja = registro.hojas[nombreHoja] || {};
        arr(hoja.filas).forEach(function (fila) {
          procesarRegistroUnidad(mapa, fila);
        });
      });
    }
  }

  function agruparUnidades(datos) {
    var mapa = crearMapaUnidades();

    arr(datos).forEach(function (registro) {
      procesarRegistroUnidad(mapa, registro);
    });

    return [1, 2, 3, 4].map(function (numero) {
      var unidad = mapa[numero];
      return {
        unidadNumero: numero,
        contenidos: unidad.contenidos,
        totalContenidos: unidad.contenidos.length,
        filasOriginales: unidad.filasOriginales,
        temaDetectado: unidad.contenidos[0] || "",
        subtemaDetectado: "",
        resultadoDetectado: ""
      };
    });
  }

  function normalizarArchivoUnidades(archivo) {
    if (!archivo || archivo.tipo !== "pea_unidades") return archivo;

    var agrupadas = agruparUnidades(archivo.datosProcesados || archivo.datos || []);

    return Object.assign({}, archivo, {
      datosProcesados: agrupadas,
      resumenContenidos: {
        totalUnidades: 4,
        totalContenidos: agrupadas.reduce(function (total, unidad) {
          return total + unidad.totalContenidos;
        }, 0),
        contenidosPorUnidad: agrupadas.map(function (unidad) {
          return {
            unidadNumero: unidad.unidadNumero,
            totalContenidos: unidad.totalContenidos
          };
        })
      },
      actualizadoEn: fecha()
    });
  }

  function normalizarPaquete(paquete) {
    paquete = paquete || {};

    return Object.assign({}, paquete, {
      archivos: arr(paquete.archivos).map(function (archivo) {
        return normalizarArchivoUnidades(archivo);
      })
    });
  }

  async function obtenerPorIndice(storeName, indexName, value) {
    try {
      return await Core.getAllByIndex(storeName, indexName, value);
    } catch (error) {
      console.warn("[BDLocalCCC.Integridad] No se pudo consultar", storeName, indexName, error);
      return [];
    }
  }

  async function eliminarRegistros(storeName, registros) {
    registros = arr(registros);

    for (var i = 0; i < registros.length; i += 1) {
      var registro = registros[i];
      if (!registro) continue;

      var key = storeName === STORES.PEA_BASE ? registro.materiaId : registro.id;
      if (!key) continue;

      try {
        await Core.remove(storeName, key);
      } catch (error) {
        console.warn("[BDLocalCCC.Integridad] No se pudo eliminar", storeName, key, error);
      }
    }
  }

  function idsCarrerasPaquete(paquete) {
    var ids = {};

    arr(paquete && paquete.carreras).forEach(function (carrera) {
      var nombre = texto(carrera && (carrera.nombre || carrera.carrera || carrera.nombreCarrera));
      var id = texto(carrera && carrera.id);

      if (!id && nombre && Schema.crearIdCarrera) {
        id = Schema.crearIdCarrera(nombre);
      }

      if (id) ids[id] = true;
    });

    arr(paquete && paquete.materias).forEach(function (materia) {
      var id = texto(materia && materia.carreraId);
      if (id) ids[id] = true;
    });

    return Object.keys(ids);
  }

  async function limpiarCarreraCompleta(carreraId) {
    if (!carreraId) return { carreraId: carreraId, materiasEliminadas: 0 };

    var materias = await obtenerPorIndice(STORES.MATERIAS, "carreraId", carreraId);
    var niveles = await obtenerPorIndice(STORES.NIVELES, "carreraId", carreraId);
    var matrices = await obtenerPorIndice(STORES.MATRICES, "carreraId", carreraId);

    for (var i = 0; i < materias.length; i += 1) {
      var materiaId = materias[i].id;
      var archivos = await obtenerPorIndice(STORES.PEA_ARCHIVOS, "materiaId", materiaId);
      var unidades = await obtenerPorIndice(STORES.PEA_UNIDADES, "materiaId", materiaId);
      var actividades = await obtenerPorIndice(STORES.PEA_ACTIVIDADES, "materiaId", materiaId);
      var validaciones = await obtenerPorIndice(STORES.VALIDACIONES, "materiaId", materiaId);

      await eliminarRegistros(STORES.PEA_ARCHIVOS, archivos);
      await eliminarRegistros(STORES.PEA_UNIDADES, unidades);
      await eliminarRegistros(STORES.PEA_ACTIVIDADES, actividades);
      await eliminarRegistros(STORES.VALIDACIONES, validaciones);

      try {
        await Core.remove(STORES.PEA_BASE, materiaId);
      } catch (errorBase) {
        console.warn("[BDLocalCCC.Integridad] No se pudo limpiar PEA Base", materiaId, errorBase);
      }
    }

    await eliminarRegistros(STORES.MATERIAS, materias);
    await eliminarRegistros(STORES.NIVELES, niveles);
    await eliminarRegistros(STORES.MATRICES, matrices);

    return {
      carreraId: carreraId,
      materiasEliminadas: materias.length,
      nivelesEliminados: niveles.length,
      matricesEliminadas: matrices.length
    };
  }

  function baseDatos(base) {
    base = base || {};
    return base.datos || base;
  }

  function resumenIntegridad(base, unidades, actividades) {
    var datos = baseDatos(base);
    var campos = (base && base.campos) || datos.campos || {};
    var unidadesBase = arr(datos.unidadesBase || (base && base.unidadesBase));
    var bibliografia = arr(datos.bibliografia || (base && base.bibliografia));
    var unidadesAgrupadas = agruparUnidades(unidades);

    var descripcion = texto(
      datos.descripcion ||
      (base && base.descripcion) ||
      campos.descripcion_asignatura ||
      campos.descripcion
    );

    var objetivo = texto(
      datos.objetivo ||
      (base && base.objetivo) ||
      campos.objetivo_asignatura ||
      campos.objetivo
    );

    var nombresUnidades = unidadesBase.filter(function (unidad) {
      return texto(unidad && (unidad.nombre || unidad.tituloUnidad));
    }).length;

    var competencias = unidadesBase.filter(function (unidad) {
      return texto(unidad && unidad.competencia);
    }).length;

    var resultados = unidadesBase.filter(function (unidad) {
      return texto(unidad && (unidad.resultadoAprendizaje || unidad.resultado));
    }).length;

    var justificaciones = bibliografia.filter(function (item) {
      return texto(item && (item.justificacion || item.descripcionComponente3));
    }).length;

    var contenidosPorUnidad = unidadesAgrupadas.map(function (unidad) {
      return {
        unidadNumero: unidad.unidadNumero,
        totalContenidos: unidad.totalContenidos
      };
    });

    var totalContenidos = contenidosPorUnidad.reduce(function (total, unidad) {
      return total + unidad.totalContenidos;
    }, 0);

    var resumen = {
      version: 4,
      descripcion: !!descripcion,
      objetivo: !!objetivo,
      unidadesBase: unidadesBase.length,
      nombresUnidades: nombresUnidades,
      competencias: competencias,
      resultadosAprendizaje: resultados,
      unidadesGuardadas: unidadesAgrupadas.filter(function (unidad) {
        return unidad.totalContenidos > 0;
      }).length,
      contenidos: totalContenidos,
      contenidosPorUnidad: contenidosPorUnidad,
      actividades: arr(actividades).length,
      bibliografias: bibliografia.length,
      justificacionesBibliografia: justificaciones,
      actualizadoEn: fecha()
    };

    resumen.completo = !!(
      resumen.descripcion &&
      resumen.objetivo &&
      resumen.nombresUnidades >= 4 &&
      resumen.competencias >= 4 &&
      resumen.resultadosAprendizaje >= 4 &&
      resumen.unidadesGuardadas === 4 &&
      contenidosPorUnidad.every(function (unidad) {
        return unidad.totalContenidos > 0;
      }) &&
      resumen.actividades > 0 &&
      resumen.bibliografias > 0 &&
      resumen.justificacionesBibliografia === resumen.bibliografias
    );

    resumen.faltantes = [];

    if (!resumen.descripcion) resumen.faltantes.push("Descripción de la asignatura");
    if (!resumen.objetivo) resumen.faltantes.push("Objetivo de la asignatura");
    if (resumen.nombresUnidades < 4) resumen.faltantes.push("Nombres de las 4 unidades");
    if (resumen.competencias < 4) resumen.faltantes.push("Competencias de las 4 unidades");
    if (resumen.resultadosAprendizaje < 4) resumen.faltantes.push("Resultados de aprendizaje de las 4 unidades");

    contenidosPorUnidad.forEach(function (unidad) {
      if (unidad.totalContenidos < 1) {
        resumen.faltantes.push("Contenidos de la unidad " + unidad.unidadNumero);
      }
    });

    if (resumen.actividades < 1) resumen.faltantes.push("Actividades");
    if (resumen.bibliografias < 1) resumen.faltantes.push("Bibliografía");

    if (
      resumen.bibliografias &&
      resumen.justificacionesBibliografia !== resumen.bibliografias
    ) {
      resumen.faltantes.push("Justificación de cada bibliografía");
    }

    return resumen;
  }

  async function repararUnidadesMateria(materia, unidadesCrudas) {
    var agrupadas = agruparUnidades(unidadesCrudas);
    var primera = arr(unidadesCrudas)[0] || {};
    var existentesPorNumero = {};

    arr(unidadesCrudas).forEach(function (unidad) {
      var numero = Number(unidad && unidad.unidadNumero || 0);
      if (numero >= 1 && numero <= 4 && !existentesPorNumero[numero]) {
        existentesPorNumero[numero] = unidad;
      }
    });

    await eliminarRegistros(STORES.PEA_UNIDADES, unidadesCrudas);

    var guardadas = [];

    for (var i = 0; i < agrupadas.length; i += 1) {
      var agrupada = agrupadas[i];
      var existente = existentesPorNumero[agrupada.unidadNumero] || {};
      var id = existente.id || (Schema.uid ? Schema.uid("unidad") : (
        "unidad_" + materia.id + "_" + agrupada.unidadNumero + "_" + Date.now()
      ));

      var registro = {
        id: id,
        cargaId: primera.cargaId || materia.cargaId || null,
        carreraId: materia.carreraId || primera.carreraId || "",
        matrizId: materia.matrizId || primera.matrizId || "",
        nivelId: materia.nivelId || primera.nivelId || "",
        materiaId: materia.id,
        codigoMateria: materia.codigo || primera.codigoMateria || "",
        nombreMateria: materia.nombre || primera.nombreMateria || "",
        archivoId: primera.archivoId || "",
        nombreArchivo: primera.nombreArchivo || "",
        rutaOriginal: primera.rutaOriginal || "",
        unidadNumero: agrupada.unidadNumero,
        contenidos: agrupada.contenidos,
        totalContenidos: agrupada.totalContenidos,
        filasOriginales: agrupada.filasOriginales,
        temaDetectado: agrupada.temaDetectado,
        subtemaDetectado: "",
        resultadoDetectado: "",
        creadoEn: existente.creadoEn || fecha(),
        actualizadoEn: fecha()
      };

      await Core.put(STORES.PEA_UNIDADES, registro);
      guardadas.push(registro);
    }

    return guardadas;
  }

  async function limpiarValidacionesContenido(materiaId) {
    var validaciones = await obtenerPorIndice(STORES.VALIDACIONES, "materiaId", materiaId);

    for (var i = 0; i < validaciones.length; i += 1) {
      if (validaciones[i].tipo === "contenido_pea_incompleto") {
        try {
          await Core.remove(STORES.VALIDACIONES, validaciones[i].id);
        } catch (error) {
          console.warn("[BDLocalCCC.Integridad] No se pudo limpiar validación anterior.", error);
        }
      }
    }
  }

  async function validarMateria(materia) {
    var base = await Core.get(STORES.PEA_BASE, materia.id);
    var unidadesCrudas = await obtenerPorIndice(STORES.PEA_UNIDADES, "materiaId", materia.id);
    var actividades = await obtenerPorIndice(STORES.PEA_ACTIVIDADES, "materiaId", materia.id);
    var unidades = await repararUnidadesMateria(materia, unidadesCrudas);
    var integridad = resumenIntegridad(base, unidades, actividades);

    var archivosCompletos = !!(
      Number(materia.totalArchivosEncontrados || 0) >= 3 &&
      !arr(materia.archivosFaltantes).length &&
      !arr(materia.archivosDuplicados).length
    );

    var actualizada = Object.assign({}, materia, {
      integridadContenido: integridad,
      estadoValidacion: archivosCompletos && integridad.completo ? "completo" : "revision",
      actualizadoEn: fecha()
    });

    await Core.put(STORES.MATERIAS, actualizada);
    await limpiarValidacionesContenido(materia.id);

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

  async function importarConReemplazo(paquete) {
    await Core.ready();

    var paqueteNormalizado = normalizarPaquete(paquete);
    var ids = idsCarrerasPaquete(paqueteNormalizado);
    var reemplazos = [];

    for (var i = 0; i < ids.length; i += 1) {
      var carreraExistente = await Core.get(STORES.CARRERAS, ids[i]);

      if (carreraExistente) {
        reemplazos.push(await limpiarCarreraCompleta(ids[i]));
      }
    }

    var resultado = await originalImportar(paqueteNormalizado);
    var materiasValidadas = [];

    for (var j = 0; j < arr(resultado.materias).length; j += 1) {
      materiasValidadas.push(await validarMateria(resultado.materias[j]));
    }

    resultado.materias = materiasValidadas;
    resultado.reemplazos = reemplazos;
    resultado.modoActualizacion = "reemplazo_completo_por_carrera";
    resultado.integridadValidada = true;

    return resultado;
  }

  NS.Importador.importarPaqueteCCC = importarConReemplazo;
  NS.importarPaqueteCCC = importarConReemplazo;

  NS.Integridad = {
    limpiarCarreraCompleta: limpiarCarreraCompleta,
    agruparUnidades: agruparUnidades,
    normalizarArchivoUnidades: normalizarArchivoUnidades,
    normalizarPaquete: normalizarPaquete,
    resumenIntegridad: resumenIntegridad,
    repararUnidadesMateria: repararUnidadesMateria,
    validarMateria: validarMateria
  };

  console.info("[BDLocalCCC.Integridad] Agrupación completa de contenidos y reemplazo de carrera activos.");
})(window);
