/* =========================================================
Nombre completo: bdlocal.api.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.api.js
Función o funciones:
- Exponer la API pública de BDLocalCCC para que otras pantallas puedan conectarse.
- Permitir guardar y consultar carreras, niveles, materias y archivos PEA.
- Consultar resumen general, materias incompletas y PEA completo por materia.
- Servir como puente oficial entre la carpeta subir y la base local.
- Evitar que futuras pantallas accedan directamente a IndexedDB sin control.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;
  var Core = NS.Core;

  if (!Schema) {
    console.error("[BDLocalCCC.API] Falta cargar primero bdlocal.schema.js");
    return;
  }

  if (!Core) {
    console.error("[BDLocalCCC.API] Falta cargar primero bdlocal.core.js");
    return;
  }

  function ordenarPorNombre(a, b) {
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
      sensitivity: "base"
    });
  }

  function ordenarPorNumero(a, b) {
    var na = Number(a.numero || 0);
    var nb = Number(b.numero || 0);

    if (na !== nb) return na - nb;

    return ordenarPorNombre(a, b);
  }

  function prepararCarrera(data) {
    var nombre = String(data && data.nombre ? data.nombre : "").trim();
    var id = data && data.id ? data.id : Schema.crearIdCarrera(nombre);

    return Object.assign({
      id: id,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      estado: "activo",
      origen: "bdlocal",
      creadoEn: Schema.fechaISO(),
      actualizadoEn: Schema.fechaISO()
    }, data || {}, {
      id: id,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      actualizadoEn: Schema.fechaISO()
    });
  }

  function prepararMatriz(data) {
    var carreraId = data && data.carreraId ? data.carreraId : "";
    var nombre = String(data && data.nombre ? data.nombre : "Matriz CCC").trim();
    var id = data && data.id ? data.id : Schema.crearIdMatriz(carreraId, nombre);

    return Object.assign({
      id: id,
      carreraId: carreraId,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      tipo: "ccc",
      estado: "activo",
      origen: "bdlocal",
      creadoEn: Schema.fechaISO(),
      actualizadoEn: Schema.fechaISO()
    }, data || {}, {
      id: id,
      carreraId: carreraId,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      actualizadoEn: Schema.fechaISO()
    });
  }

  function prepararNivel(data) {
    var carreraId = data && data.carreraId ? data.carreraId : "";
    var numero = Number(data && data.numero ? data.numero : 0);
    var nombre = String(data && data.nombre ? data.nombre : numero + ". Nivel").trim();
    var id = data && data.id ? data.id : Schema.crearIdNivel(carreraId, numero);

    return Object.assign({
      id: id,
      carreraId: carreraId,
      matrizId: data && data.matrizId ? data.matrizId : "",
      numero: numero,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      estado: "activo",
      origen: "bdlocal",
      creadoEn: Schema.fechaISO(),
      actualizadoEn: Schema.fechaISO()
    }, data || {}, {
      id: id,
      carreraId: carreraId,
      numero: numero,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      actualizadoEn: Schema.fechaISO()
    });
  }

  function prepararMateria(data) {
    var carreraId = data && data.carreraId ? data.carreraId : "";
    var nivelId = data && data.nivelId ? data.nivelId : "";
    var codigo = Schema.normalizarCodigo(data && data.codigo ? data.codigo : "");
    var nombre = String(data && data.nombre ? data.nombre : "Materia sin nombre").trim();
    var id = data && data.id ? data.id : Schema.crearIdMateria(carreraId, nivelId, codigo, nombre);

    return Object.assign({
      id: id,
      carreraId: carreraId,
      matrizId: data && data.matrizId ? data.matrizId : "",
      nivelId: nivelId,
      codigo: codigo,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      estadoValidacion: Schema.ESTADOS_VALIDACION.PENDIENTE,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: 0,
      origen: "bdlocal",
      creadoEn: Schema.fechaISO(),
      actualizadoEn: Schema.fechaISO()
    }, data || {}, {
      id: id,
      carreraId: carreraId,
      nivelId: nivelId,
      codigo: codigo,
      nombre: nombre,
      nombreNormalizado: Schema.normalizarTexto(nombre),
      actualizadoEn: Schema.fechaISO()
    });
  }

  function prepararArchivoPEA(data) {
    var materiaId = data && data.materiaId ? data.materiaId : "";
    var tipo = data && data.tipo ? data.tipo : "";
    var rutaOriginal = data && data.rutaOriginal ? data.rutaOriginal : data && data.nombreArchivo ? data.nombreArchivo : "";
    var id = data && data.id ? data.id : Schema.crearIdArchivo(materiaId, tipo, rutaOriginal);

    return Object.assign({
      id: id,
      cargaId: data && data.cargaId ? data.cargaId : null,
      carreraId: data && data.carreraId ? data.carreraId : "",
      matrizId: data && data.matrizId ? data.matrizId : "",
      nivelId: data && data.nivelId ? data.nivelId : "",
      materiaId: materiaId,
      tipo: tipo,
      nombreArchivo: data && data.nombreArchivo ? data.nombreArchivo : "",
      rutaOriginal: rutaOriginal,
      extension: data && data.extension ? data.extension : "xlsx",
      estado: "detectado",
      confianza: typeof data.confianza === "number" ? data.confianza : 100,
      tieneContenidoBinario: !!(data && data.contenidoBinario),
      contenidoBinario: data && data.contenidoBinario ? data.contenidoBinario : null,
      creadoEn: Schema.fechaISO(),
      actualizadoEn: Schema.fechaISO()
    }, data || {}, {
      id: id,
      materiaId: materiaId,
      tipo: tipo,
      rutaOriginal: rutaOriginal,
      actualizadoEn: Schema.fechaISO()
    });
  }

  async function inicializar() {
    await Core.ready();
    return await Core.diagnostico();
  }

  async function guardarCarrera(data) {
    var carrera = prepararCarrera(data);
    await Core.put(Schema.STORES.CARRERAS, carrera);
    return carrera;
  }

  async function guardarMatriz(data) {
    var matriz = prepararMatriz(data);
    await Core.put(Schema.STORES.MATRICES, matriz);
    return matriz;
  }

  async function guardarNivel(data) {
    var nivel = prepararNivel(data);
    await Core.put(Schema.STORES.NIVELES, nivel);
    return nivel;
  }

  async function guardarMateria(data) {
    var materia = prepararMateria(data);
    await Core.put(Schema.STORES.MATERIAS, materia);
    return materia;
  }

  async function guardarArchivoPEA(data) {
    var archivo = prepararArchivoPEA(data);
    await Core.put(Schema.STORES.PEA_ARCHIVOS, archivo);
    return archivo;
  }

  async function obtenerCarreras() {
    var carreras = await Core.getAll(Schema.STORES.CARRERAS);
    return carreras.sort(ordenarPorNombre);
  }

  async function obtenerCarreraPorId(carreraId) {
    return await Core.get(Schema.STORES.CARRERAS, carreraId);
  }

  async function obtenerMatricesPorCarrera(carreraId) {
    var matrices = await Core.getAllByIndex(Schema.STORES.MATRICES, "carreraId", carreraId);
    return matrices.sort(ordenarPorNombre);
  }

  async function obtenerNivelesPorCarrera(carreraId) {
    var niveles = await Core.getAllByIndex(Schema.STORES.NIVELES, "carreraId", carreraId);
    return niveles.sort(ordenarPorNumero);
  }

  async function obtenerNivelPorId(nivelId) {
    return await Core.get(Schema.STORES.NIVELES, nivelId);
  }

  async function obtenerMateriasPorNivel(nivelId) {
    var materias = await Core.getAllByIndex(Schema.STORES.MATERIAS, "nivelId", nivelId);
    return materias.sort(ordenarPorNombre);
  }

  async function obtenerMateriasPorCarrera(carreraId) {
    var materias = await Core.getAllByIndex(Schema.STORES.MATERIAS, "carreraId", carreraId);
    return materias.sort(ordenarPorNombre);
  }

  async function obtenerMateriaPorId(materiaId) {
    return await Core.get(Schema.STORES.MATERIAS, materiaId);
  }

  async function obtenerArchivosPorMateria(materiaId) {
    var archivos = await Core.getAllByIndex(Schema.STORES.PEA_ARCHIVOS, "materiaId", materiaId);

    var orden = {};
    orden[Schema.TIPOS_PEA.BASE] = 1;
    orden[Schema.TIPOS_PEA.UNIDADES] = 2;
    orden[Schema.TIPOS_PEA.ACTIVIDADES] = 3;

    return archivos.sort(function (a, b) {
      return (orden[a.tipo] || 99) - (orden[b.tipo] || 99);
    });
  }

  async function obtenerPEACompleto(materiaId) {
    var materia = await obtenerMateriaPorId(materiaId);
    var archivos = await obtenerArchivosPorMateria(materiaId);
    var peaBase = await Core.get(Schema.STORES.PEA_BASE, materiaId);
    var peaUnidades = await Core.getAllByIndex(Schema.STORES.PEA_UNIDADES, "materiaId", materiaId);
    var peaActividades = await Core.getAllByIndex(Schema.STORES.PEA_ACTIVIDADES, "materiaId", materiaId);
    var validaciones = await Core.getAllByIndex(Schema.STORES.VALIDACIONES, "materiaId", materiaId);

    return {
      materia: materia || null,
      archivos: archivos || [],
      base: peaBase || null,
      unidades: peaUnidades || [],
      actividades: peaActividades || [],
      validaciones: validaciones || []
    };
  }

  async function obtenerMateriasIncompletas() {
    var materias = await Core.getAll(Schema.STORES.MATERIAS);

    return materias
      .filter(function (materia) {
        return materia.estadoValidacion !== Schema.ESTADOS_VALIDACION.COMPLETO;
      })
      .sort(ordenarPorNombre);
  }

  async function obtenerResumenGeneral() {
    var carreras = await Core.getAll(Schema.STORES.CARRERAS);
    var niveles = await Core.getAll(Schema.STORES.NIVELES);
    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var archivos = await Core.getAll(Schema.STORES.PEA_ARCHIVOS);
    var validaciones = await Core.getAll(Schema.STORES.VALIDACIONES);

    var completas = materias.filter(function (m) {
      return m.estadoValidacion === Schema.ESTADOS_VALIDACION.COMPLETO;
    }).length;

    var incompletas = materias.filter(function (m) {
      return m.estadoValidacion !== Schema.ESTADOS_VALIDACION.COMPLETO;
    }).length;

    return {
      generadoEn: Schema.fechaISO(),
      totalCarreras: carreras.length,
      totalNiveles: niveles.length,
      totalMaterias: materias.length,
      materiasCompletas: completas,
      materiasIncompletas: incompletas,
      totalArchivosPEA: archivos.length,
      totalValidaciones: validaciones.length,
      archivosBase: archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.BASE; }).length,
      archivosUnidades: archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.UNIDADES; }).length,
      archivosActividades: archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.ACTIVIDADES; }).length
    };
  }

  async function obtenerResumenPorCarrera() {
    var carreras = await Core.getAll(Schema.STORES.CARRERAS);
    var niveles = await Core.getAll(Schema.STORES.NIVELES);
    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var archivos = await Core.getAll(Schema.STORES.PEA_ARCHIVOS);

    return carreras.sort(ordenarPorNombre).map(function (carrera) {
      var nivelesCarrera = niveles.filter(function (nivel) {
        return nivel.carreraId === carrera.id;
      });

      var materiasCarrera = materias.filter(function (materia) {
        return materia.carreraId === carrera.id;
      });

      var archivosCarrera = archivos.filter(function (archivo) {
        return archivo.carreraId === carrera.id;
      });

      return {
        carreraId: carrera.id,
        carrera: carrera.nombre,
        totalNiveles: nivelesCarrera.length,
        totalMaterias: materiasCarrera.length,
        materiasCompletas: materiasCarrera.filter(function (m) {
          return m.estadoValidacion === Schema.ESTADOS_VALIDACION.COMPLETO;
        }).length,
        materiasIncompletas: materiasCarrera.filter(function (m) {
          return m.estadoValidacion !== Schema.ESTADOS_VALIDACION.COMPLETO;
        }).length,
        totalArchivosPEA: archivosCarrera.length
      };
    });
  }

  async function registrarValidacion(data) {
    var payload = Object.assign({
      cargaId: data && data.cargaId ? data.cargaId : null,
      carreraId: data && data.carreraId ? data.carreraId : "",
      nivelId: data && data.nivelId ? data.nivelId : "",
      materiaId: data && data.materiaId ? data.materiaId : "",
      tipo: data && data.tipo ? data.tipo : "general",
      severidad: data && data.severidad ? data.severidad : Schema.SEVERIDADES.ADVERTENCIA,
      estado: data && data.estado ? data.estado : "activo",
      mensaje: data && data.mensaje ? data.mensaje : "",
      detalle: data && data.detalle ? data.detalle : null,
      creadoEn: Schema.fechaISO()
    }, data || {});

    return await Core.add(Schema.STORES.VALIDACIONES, payload);
  }

  async function buscarMaterias(texto) {
    var consulta = Schema.normalizarTexto(texto);

    if (!consulta) {
      return [];
    }

    var materias = await Core.getAll(Schema.STORES.MATERIAS);

    return materias.filter(function (materia) {
      var codigo = Schema.normalizarTexto(materia.codigo || "");
      var nombre = Schema.normalizarTexto(materia.nombre || "");

      return codigo.includes(consulta) || nombre.includes(consulta);
    }).sort(ordenarPorNombre);
  }

  async function importarPaqueteCCC(paqueteNormalizado) {
    if (NS.Importador && typeof NS.Importador.importarPaqueteCCC === "function") {
      return await NS.Importador.importarPaqueteCCC(paqueteNormalizado);
    }

    throw new Error("El importador todavía no está cargado. Falta bdlocal.importador.js.");
  }

  async function diagnostico() {
    return await Core.diagnostico();
  }

  async function exportarJSON() {
    return await Core.exportarJSON();
  }

  NS.inicializar = inicializar;
  NS.guardarCarrera = guardarCarrera;
  NS.guardarMatriz = guardarMatriz;
  NS.guardarNivel = guardarNivel;
  NS.guardarMateria = guardarMateria;
  NS.guardarArchivoPEA = guardarArchivoPEA;

  NS.obtenerCarreras = obtenerCarreras;
  NS.obtenerCarreraPorId = obtenerCarreraPorId;
  NS.obtenerMatricesPorCarrera = obtenerMatricesPorCarrera;
  NS.obtenerNivelesPorCarrera = obtenerNivelesPorCarrera;
  NS.obtenerNivelPorId = obtenerNivelPorId;
  NS.obtenerMateriasPorNivel = obtenerMateriasPorNivel;
  NS.obtenerMateriasPorCarrera = obtenerMateriasPorCarrera;
  NS.obtenerMateriaPorId = obtenerMateriaPorId;
  NS.obtenerArchivosPorMateria = obtenerArchivosPorMateria;
  NS.obtenerPEACompleto = obtenerPEACompleto;
  NS.obtenerMateriasIncompletas = obtenerMateriasIncompletas;
  NS.obtenerResumenGeneral = obtenerResumenGeneral;
  NS.obtenerResumenPorCarrera = obtenerResumenPorCarrera;
  NS.registrarValidacion = registrarValidacion;
  NS.buscarMaterias = buscarMaterias;
  NS.importarPaqueteCCC = importarPaqueteCCC;
  NS.diagnostico = diagnostico;
  NS.exportarJSON = exportarJSON;

  NS.API = {
    inicializar: inicializar,
    guardarCarrera: guardarCarrera,
    guardarMatriz: guardarMatriz,
    guardarNivel: guardarNivel,
    guardarMateria: guardarMateria,
    guardarArchivoPEA: guardarArchivoPEA,
    obtenerCarreras: obtenerCarreras,
    obtenerCarreraPorId: obtenerCarreraPorId,
    obtenerMatricesPorCarrera: obtenerMatricesPorCarrera,
    obtenerNivelesPorCarrera: obtenerNivelesPorCarrera,
    obtenerNivelPorId: obtenerNivelPorId,
    obtenerMateriasPorNivel: obtenerMateriasPorNivel,
    obtenerMateriasPorCarrera: obtenerMateriasPorCarrera,
    obtenerMateriaPorId: obtenerMateriaPorId,
    obtenerArchivosPorMateria: obtenerArchivosPorMateria,
    obtenerPEACompleto: obtenerPEACompleto,
    obtenerMateriasIncompletas: obtenerMateriasIncompletas,
    obtenerResumenGeneral: obtenerResumenGeneral,
    obtenerResumenPorCarrera: obtenerResumenPorCarrera,
    registrarValidacion: registrarValidacion,
    buscarMaterias: buscarMaterias,
    importarPaqueteCCC: importarPaqueteCCC,
    diagnostico: diagnostico,
    exportarJSON: exportarJSON
  };
})(window);