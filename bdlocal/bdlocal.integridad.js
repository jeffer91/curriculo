/* =========================================================
Nombre completo: bdlocal.integridad.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.integridad.js
Función o funciones:
- Reemplazar por completo la información de una carrera cuando vuelve a importarse.
- Evitar materias, niveles, archivos y datos PEA obsoletos o duplicados.
- Validar que PEA Base, PEA Unidades y PEA Actividades tengan contenido real.
- Guardar un resumen de integridad por materia para BDLocal y Comunicados.
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

  function normalizar(valor) {
    if (Schema.normalizarTexto) return Schema.normalizarTexto(valor);
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function fecha() {
    return Schema.fechaISO ? Schema.fechaISO() : new Date().toISOString();
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
      var key = registro.id;
      if (storeName === STORES.PEA_BASE) key = registro.materiaId;
      if (key === null || typeof key === "undefined" || key === "") continue;
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
      if (!id && nombre && Schema.crearIdCarrera) id = Schema.crearIdCarrera(nombre);
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

  function contarContenidos(unidades) {
    return arr(unidades).reduce(function (total, unidad) {
      var contenidos = arr(unidad && unidad.contenidos);
      if (contenidos.length) return total + contenidos.filter(function (item) { return texto(item); }).length;
      return total + (texto(unidad && (unidad.temaDetectado || unidad.contenido || unidad.tema)) ? 1 : 0);
    }, 0);
  }

  function resumenIntegridad(base, unidades, actividades) {
    var datos = baseDatos(base);
    var campos = (base && base.campos) || datos.campos || {};
    var unidadesBase = arr(datos.unidadesBase || (base && base.unidadesBase));
    var bibliografia = arr(datos.bibliografia || (base && base.bibliografia));

    var descripcion = texto(datos.descripcion || (base && base.descripcion) || campos.descripcion_asignatura || campos.descripcion);
    var objetivo = texto(datos.objetivo || (base && base.objetivo) || campos.objetivo_asignatura || campos.objetivo);

    var unidadesConNumero = arr(unidades).filter(function (unidad) {
      var numero = Number(unidad && unidad.unidadNumero || 0);
      return numero >= 1 && numero <= 4;
    });

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

    var resumen = {
      version: 3,
      descripcion: !!descripcion,
      objetivo: !!objetivo,
      unidadesBase: unidadesBase.length,
      nombresUnidades: nombresUnidades,
      competencias: competencias,
      resultadosAprendizaje: resultados,
      unidadesGuardadas: unidadesConNumero.length,
      contenidos: contarContenidos(unidadesConNumero),
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
      resumen.contenidos > 0 &&
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
    if (resumen.unidadesGuardadas !== 4) resumen.faltantes.push("4 unidades agrupadas");
    if (resumen.contenidos < 1) resumen.faltantes.push("Contenidos");
    if (resumen.actividades < 1) resumen.faltantes.push("Actividades");
    if (resumen.bibliografias < 1) resumen.faltantes.push("Bibliografía");
    if (resumen.bibliografias && resumen.justificacionesBibliografia !== resumen.bibliografias) {
      resumen.faltantes.push("Justificación de cada bibliografía");
    }

    return resumen;
  }

  async function validarMateria(materia) {
    var base = await Core.get(STORES.PEA_BASE, materia.id);
    var unidades = await obtenerPorIndice(STORES.PEA_UNIDADES, "materiaId", materia.id);
    var actividades = await obtenerPorIndice(STORES.PEA_ACTIVIDADES, "materiaId", materia.id);
    var integridad = resumenIntegridad(base, unidades, actividades);

    var archivosCompletos = materia.estadoValidacion === "completo";
    var actualizada = Object.assign({}, materia, {
      integridadContenido: integridad,
      estadoValidacion: archivosCompletos && integridad.completo ? "completo" : "revision",
      actualizadoEn: fecha()
    });

    await Core.put(STORES.MATERIAS, actualizada);

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

    var ids = idsCarrerasPaquete(paquete);
    var reemplazos = [];

    for (var i = 0; i < ids.length; i += 1) {
      var carreraExistente = await Core.get(STORES.CARRERAS, ids[i]);
      if (carreraExistente) {
        reemplazos.push(await limpiarCarreraCompleta(ids[i]));
      }
    }

    var resultado = await originalImportar(paquete);
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
    resumenIntegridad: resumenIntegridad,
    validarMateria: validarMateria
  };

  console.info("[BDLocalCCC.Integridad] Reemplazo de carrera y validación semántica activos.");
})(window);
