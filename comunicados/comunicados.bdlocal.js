/* =========================================================
Nombre completo: comunicados.bdlocal.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.bdlocal.js
Funciones:
- Mantener la API histórica de ComunicadosCCC.BDLocal.
- Leer carreras, materias y PEA exclusivamente desde Firebase Firestore.
- Guardar el nombre institucional directamente en Firebase.
========================================================= */
(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var NS = window.ComunicadosCCC;
  var VERSION = "4.0.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function Firebase() {
    if (!window.CurriculoFirebase) {
      throw new Error("CurriculoFirebase no está cargado.");
    }
    return window.CurriculoFirebase;
  }

  async function inicializar() {
    await Firebase().ready();
    return true;
  }

  async function obtenerCarreras() {
    await inicializar();
    return await Firebase().obtenerCarreras();
  }

  async function obtenerMateriasPorCarrera(carreraId, opciones) {
    await inicializar();
    return await Firebase().obtenerMateriasPorCarrera(carreraId, opciones || { soloCompletas: true });
  }

  async function obtenerCarreraPorId(carreraId) {
    var carreras = await obtenerCarreras();
    return carreras.find(function (carrera) { return carrera.id === carreraId; }) || null;
  }

  async function obtenerNivelPorId(nivelId) {
    var partes = texto(nivelId).split("_");
    var numero = Number(partes[partes.length - 1] || 0);
    return { id: nivelId, numero: numero, nombre: numero ? numero + ". Nivel" : "" };
  }

  async function obtenerMateriaPorId(materiaId) {
    await inicializar();
    return await Firebase().obtenerMateria(materiaId);
  }

  async function obtenerPEABase(materiaId) {
    return (await Firebase().obtenerDetalleMateria(materiaId)).peaBase;
  }

  async function obtenerPEAUnidades(materiaId) {
    return (await Firebase().obtenerDetalleMateria(materiaId)).unidades;
  }

  async function obtenerPEAActividades(materiaId) {
    return (await Firebase().obtenerDetalleMateria(materiaId)).actividades;
  }

  async function obtenerArchivosMateria(materiaId) {
    return (await Firebase().obtenerDetalleMateria(materiaId)).archivos;
  }

  function validarMateriaCompleta(detalle) {
    detalle = detalle || {};
    var materia = detalle.materia || {};
    var peaBase = detalle.peaBase;
    var unidades = arr(detalle.unidades);
    var actividades = arr(detalle.actividades);
    var tieneBase = !!peaBase && (texto(peaBase.descripcion) || texto(peaBase.objetivo) || Object.keys(peaBase.campos || {}).length > 0);
    var tieneUnidades = unidades.length > 0;
    var tieneActividades = actividades.length > 0;
    var estado = texto(materia.estadoValidacion).toLowerCase();
    var completaPorEstado = estado === "completo" || estado === "completa";

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
    if (!materiaId) throw new Error("No se recibió materiaId.");
    await inicializar();
    var detalle = await Firebase().obtenerDetalleMateria(materiaId);
    detalle.estadoGeneracion = validarMateriaCompleta(detalle);
    return detalle;
  }

  async function guardarNombreInstitucionalMateria(materiaId, nombreInstitucional) {
    await inicializar();
    return await Firebase().guardarNombreInstitucionalMateria(materiaId, nombreInstitucional);
  }

  async function obtenerResumenCarrera(carreraId) {
    await inicializar();
    return await Firebase().obtenerResumenCarrera(carreraId);
  }

  NS.BDLocal = {
    VERSION: VERSION,
    FUENTE: "firebase",
    inicializar: inicializar,
    obtenerCarreras: obtenerCarreras,
    obtenerMateriasPorCarrera: obtenerMateriasPorCarrera,
    obtenerCarreraPorId: obtenerCarreraPorId,
    obtenerNivelPorId: obtenerNivelPorId,
    obtenerMateriaPorId: obtenerMateriaPorId,
    obtenerPEABase: obtenerPEABase,
    obtenerPEAUnidades: obtenerPEAUnidades,
    obtenerPEAActividades: obtenerPEAActividades,
    obtenerArchivosMateria: obtenerArchivosMateria,
    validarMateriaCompleta: validarMateriaCompleta,
    obtenerDetalleMateriaComunicado: obtenerDetalleMateriaComunicado,
    guardarNombreInstitucionalMateria: guardarNombreInstitucionalMateria,
    obtenerResumenCarrera: obtenerResumenCarrera
  };
  NS.Firebase = NS.BDLocal;
})(window);
