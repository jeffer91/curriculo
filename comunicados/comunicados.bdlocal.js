/* =========================================================
Nombre completo: comunicados.bdlocal.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.bdlocal.js
Función o funciones:
- Conectar la pantalla Comunicados con BDLocalCCC.
- Obtener carreras guardadas en la base local.
- Obtener materias completas por carrera.
- Obtener detalle completo de una materia: PEA Base, PEA Unidades, PEA Actividades y archivos.
- Permitir editar y guardar el nombre institucional de una materia sin perder el nombre original.
- Entregar datos limpios para generar comunicados institucionales por materia.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  var FALLBACK_STORES = {
    CARRERAS: "carreras",
    MATRICES: "matrices",
    NIVELES: "niveles",
    MATERIAS: "materias",
    PEA_ARCHIVOS: "pea_archivos",
    PEA_BASE: "pea_base",
    PEA_UNIDADES: "pea_unidades",
    PEA_ACTIVIDADES: "pea_actividades",
    META: "meta"
  };

  function fechaISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-–—]+/g, " ")
      .replace(/[^\w\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function obtenerBDLocal() {
    if (!window.BDLocalCCC) {
      throw new Error("BDLocalCCC no está cargado. Revisa que comunicados.html cargue los scripts de /bdlocal.");
    }

    if (!window.BDLocalCCC.Core) {
      throw new Error("BDLocalCCC.Core no está cargado. Falta bdlocal.core.js.");
    }

    return window.BDLocalCCC;
  }

  function obtenerCore() {
    return obtenerBDLocal().Core;
  }

  function obtenerSchema() {
    return obtenerBDLocal().Schema || {};
  }

  function stores() {
    var Schema = obtenerSchema();

    return Schema.STORES || FALLBACK_STORES;
  }

  async function inicializar() {
    var BD = obtenerBDLocal();

    if (typeof BD.inicializar === "function") {
      await BD.inicializar();
      return true;
    }

    if (BD.Core && typeof BD.Core.ready === "function") {
      await BD.Core.ready();
      return true;
    }

    throw new Error("No se pudo inicializar BDLocalCCC.");
  }

  async function getAll(storeName) {
    var Core = obtenerCore();
    await inicializar();

    if (typeof Core.getAll !== "function") {
      throw new Error("BDLocalCCC.Core.getAll no está disponible.");
    }

    return await Core.getAll(storeName);
  }

  async function getById(storeName, id) {
    var Core = obtenerCore();
    await inicializar();

    if (!id) return null;

    if (typeof Core.get !== "function") {
      throw new Error("BDLocalCCC.Core.get no está disponible.");
    }

    return await Core.get(storeName, id);
  }

  async function getAllByIndexSeguro(storeName, indexName, value) {
    var Core = obtenerCore();
    await inicializar();

    if (typeof Core.getAllByIndex === "function") {
      try {
        return await Core.getAllByIndex(storeName, indexName, value);
      } catch (error) {
        console.warn("[ComunicadosCCC.BDLocal] Fallback por índice:", storeName, indexName, error);
      }
    }

    var todos = await getAll(storeName);

    return todos.filter(function (item) {
      return item && item[indexName] === value;
    });
  }

  async function put(storeName, data) {
    var Core = obtenerCore();
    await inicializar();

    if (typeof Core.put !== "function") {
      throw new Error("BDLocalCCC.Core.put no está disponible.");
    }

    return await Core.put(storeName, data);
  }

  async function obtenerCarreras() {
    var S = stores();
    var carreras = await getAll(S.CARRERAS);

    return arr(carreras)
      .filter(function (carrera) {
        return carrera && carrera.id && carrera.estado !== "eliminado";
      })
      .sort(function (a, b) {
        return texto(a.nombre).localeCompare(texto(b.nombre), "es");
      });
  }

  async function obtenerNivelesPorCarrera(carreraId) {
    var S = stores();

    if (!carreraId) return [];

    var niveles = await getAllByIndexSeguro(S.NIVELES, "carreraId", carreraId);

    return arr(niveles).sort(function (a, b) {
      return Number(a.numero || 0) - Number(b.numero || 0);
    });
  }

  async function obtenerMateriasPorCarrera(carreraId, opciones) {
    opciones = opciones || {};

    var S = stores();

    if (!carreraId) return [];

    var materias = await getAllByIndexSeguro(S.MATERIAS, "carreraId", carreraId);
    var niveles = await obtenerNivelesPorCarrera(carreraId);

    var mapaNiveles = {};
    niveles.forEach(function (nivel) {
      mapaNiveles[nivel.id] = nivel;
    });

    var soloCompletas = opciones.soloCompletas !== false;

    var materiasFinales = arr(materias)
      .filter(function (materia) {
        if (!materia || !materia.id) return false;
        if (soloCompletas && materia.estadoValidacion !== "completo") return false;
        return true;
      })
      .map(function (materia) {
        var nivel = mapaNiveles[materia.nivelId] || null;

        return Object.assign({}, materia, {
          nivelNombre: nivel ? nivel.nombre : "",
          nivelNumero: nivel ? Number(nivel.numero || 0) : 0,
          nombreMostrar: texto(materia.nombreInstitucional || materia.nombreCorregido || materia.nombre)
        });
      })
      .sort(function (a, b) {
        var nivelA = Number(a.nivelNumero || 0);
        var nivelB = Number(b.nivelNumero || 0);

        if (nivelA !== nivelB) return nivelA - nivelB;

        return texto(a.nombreMostrar).localeCompare(texto(b.nombreMostrar), "es");
      });

    return materiasFinales;
  }

  async function obtenerCarreraPorId(carreraId) {
    var S = stores();

    if (!carreraId) return null;

    return await getById(S.CARRERAS, carreraId);
  }

  async function obtenerNivelPorId(nivelId) {
    var S = stores();

    if (!nivelId) return null;

    return await getById(S.NIVELES, nivelId);
  }

  async function obtenerMateriaPorId(materiaId) {
    var S = stores();

    if (!materiaId) return null;

    return await getById(S.MATERIAS, materiaId);
  }

  async function obtenerPEABase(materiaId) {
    var S = stores();

    if (!materiaId) return null;

    try {
      return await getById(S.PEA_BASE, materiaId);
    } catch (error) {
      console.warn("[ComunicadosCCC.BDLocal] No se pudo leer PEA Base:", error);
      return null;
    }
  }

  async function obtenerPEAUnidades(materiaId) {
    var S = stores();

    if (!materiaId) return [];

    return await getAllByIndexSeguro(S.PEA_UNIDADES, "materiaId", materiaId);
  }

  async function obtenerPEAActividades(materiaId) {
    var S = stores();

    if (!materiaId) return [];

    return await getAllByIndexSeguro(S.PEA_ACTIVIDADES, "materiaId", materiaId);
  }

  async function obtenerArchivosMateria(materiaId) {
    var S = stores();

    if (!materiaId) return [];

    return await getAllByIndexSeguro(S.PEA_ARCHIVOS, "materiaId", materiaId);
  }

  function validarMateriaCompleta(detalle) {
    var materia = detalle.materia;
    var peaBase = detalle.peaBase;
    var unidades = arr(detalle.unidades);
    var actividades = arr(detalle.actividades);
    var archivos = arr(detalle.archivos);

    var tieneBase = !!peaBase || archivos.some(function (archivo) {
      return archivo.tipo === "pea_base";
    });

    var tieneUnidades = unidades.length > 0 || archivos.some(function (archivo) {
      return archivo.tipo === "pea_unidades";
    });

    var tieneActividades = actividades.length > 0 || archivos.some(function (archivo) {
      return archivo.tipo === "pea_actividades";
    });

    var completaPorEstado = materia && materia.estadoValidacion === "completo";

    return {
      puedeGenerar: completaPorEstado && tieneBase && tieneUnidades && tieneActividades,
      completaPorEstado: completaPorEstado,
      tieneBase: tieneBase,
      tieneUnidades: tieneUnidades,
      tieneActividades: tieneActividades,
      faltantes: [
        !tieneBase ? "PEA Base" : "",
        !tieneUnidades ? "PEA Unidades" : "",
        !tieneActividades ? "PEA Actividades" : ""
      ].filter(Boolean)
    };
  }

  async function obtenerDetalleMateriaComunicado(materiaId) {
    if (!materiaId) {
      throw new Error("No se recibió materiaId.");
    }

    var materia = await obtenerMateriaPorId(materiaId);

    if (!materia) {
      throw new Error("No se encontró la materia en BDLocal.");
    }

    var carrera = await obtenerCarreraPorId(materia.carreraId);
    var nivel = await obtenerNivelPorId(materia.nivelId);
    var peaBase = await obtenerPEABase(materiaId);
    var unidades = await obtenerPEAUnidades(materiaId);
    var actividades = await obtenerPEAActividades(materiaId);
    var archivos = await obtenerArchivosMateria(materiaId);

    var detalle = {
      materia: Object.assign({}, materia, {
        nombreMostrar: texto(materia.nombreInstitucional || materia.nombreCorregido || materia.nombre)
      }),
      carrera: carrera,
      nivel: nivel,
      peaBase: peaBase,
      unidades: unidades,
      actividades: actividades,
      archivos: archivos
    };

    detalle.estadoGeneracion = validarMateriaCompleta(detalle);

    return detalle;
  }

  async function guardarNombreInstitucionalMateria(materiaId, nombreInstitucional) {
    var S = stores();

    nombreInstitucional = texto(nombreInstitucional);

    if (!materiaId) {
      throw new Error("No se recibió materiaId.");
    }

    if (!nombreInstitucional) {
      throw new Error("El nombre institucional no puede estar vacío.");
    }

    var materia = await obtenerMateriaPorId(materiaId);

    if (!materia) {
      throw new Error("No se encontró la materia para actualizar.");
    }

    var actualizada = Object.assign({}, materia, {
      nombreOriginalImportado: materia.nombreOriginalImportado || materia.nombre,
      nombreInstitucional: nombreInstitucional,
      nombreCorregido: nombreInstitucional,
      nombreMostrar: nombreInstitucional,
      actualizadoEn: fechaISO()
    });

    await put(S.MATERIAS, actualizada);

    return actualizada;
  }

  async function obtenerResumenCarrera(carreraId) {
    if (!carreraId) {
      return {
        totalMaterias: 0,
        completas: 0,
        incompletas: 0,
        revision: 0
      };
    }

    var S = stores();
    var materias = await getAllByIndexSeguro(S.MATERIAS, "carreraId", carreraId);

    return {
      totalMaterias: materias.length,
      completas: materias.filter(function (m) { return m.estadoValidacion === "completo"; }).length,
      incompletas: materias.filter(function (m) { return m.estadoValidacion === "incompleto"; }).length,
      revision: materias.filter(function (m) { return m.estadoValidacion === "revision"; }).length
    };
  }

  NS.BDLocal = {
    inicializar: inicializar,
    obtenerCarreras: obtenerCarreras,
    obtenerCarreraPorId: obtenerCarreraPorId,
    obtenerNivelesPorCarrera: obtenerNivelesPorCarrera,
    obtenerMateriasPorCarrera: obtenerMateriasPorCarrera,
    obtenerMateriaPorId: obtenerMateriaPorId,
    obtenerNivelPorId: obtenerNivelPorId,
    obtenerPEABase: obtenerPEABase,
    obtenerPEAUnidades: obtenerPEAUnidades,
    obtenerPEAActividades: obtenerPEAActividades,
    obtenerArchivosMateria: obtenerArchivosMateria,
    obtenerDetalleMateriaComunicado: obtenerDetalleMateriaComunicado,
    guardarNombreInstitucionalMateria: guardarNombreInstitucionalMateria,
    obtenerResumenCarrera: obtenerResumenCarrera,
    validarMateriaCompleta: validarMateriaCompleta
  };
})(window);