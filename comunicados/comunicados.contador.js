/* =========================================================
Nombre completo: comunicados.contador.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.contador.js
Funciones:
- Obtener y registrar la numeración mensual en Firebase Firestore.
- Reservar números mediante transacciones para evitar duplicados.
- Mantener la API usada por comunicados.main.js.
========================================================= */
(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var NS = window.ComunicadosCCC;
  var PREFIJO_DEFAULT = "COM-ITSQMET-UGPA";

  function texto(valor) { return String(valor === null || typeof valor === "undefined" ? "" : valor).trim(); }
  function arr(valor) { return Array.isArray(valor) ? valor : (valor === null || typeof valor === "undefined" ? [] : [valor]); }
  function pad2(valor) { return String(Number(valor || 0)).padStart(2, "0"); }
  function fechaBase(fechaInput) {
    if (fechaInput instanceof Date && !Number.isNaN(fechaInput.getTime())) return fechaInput;
    var d = new Date(fechaInput || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  function obtenerMesKey(fechaInput) {
    var d = fechaBase(fechaInput);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  function obtenerFechaLarga(fechaInput) {
    var d = fechaBase(fechaInput);
    var meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return d.getDate() + " de " + meses[d.getMonth()] + " del " + d.getFullYear();
  }
  function formatearSecuencia(numero) { return Number(numero || 0) < 100 ? pad2(numero) : String(Number(numero || 0)); }
  function formatearNumeroComunicado(secuencia, fechaInput, opciones) {
    opciones = opciones || {};
    var d = fechaBase(fechaInput);
    return [texto(opciones.prefijo || PREFIJO_DEFAULT), d.getFullYear(), pad2(d.getMonth() + 1), formatearSecuencia(secuencia)].join("-");
  }
  function Firebase() {
    if (!window.CurriculoFirebase) throw new Error("CurriculoFirebase no está cargado.");
    return window.CurriculoFirebase;
  }

  async function obtenerRegistroMes(fechaInput) {
    await Firebase().ready();
    var registro = await Firebase().obtenerContadorComunicados(fechaInput);
    return Object.assign({
      key: obtenerMesKey(fechaInput),
      anio: fechaBase(fechaInput).getFullYear(),
      mes: fechaBase(fechaInput).getMonth() + 1,
      ultimo: 0,
      generados: []
    }, registro || {});
  }

  async function obtenerSiguienteNumero(fechaInput, opciones) {
    var registro = await obtenerRegistroMes(fechaInput);
    var siguiente = Number(registro.ultimo || 0) + 1;
    return {
      secuencia: siguiente,
      numero: formatearNumeroComunicado(siguiente, fechaInput, opciones),
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput)
    };
  }

  async function registrarNumeroManual(fechaInput, secuencia, datos, opciones) {
    secuencia = Number(secuencia || 0);
    if (secuencia < 1) throw new Error("La secuencia debe ser mayor a cero.");
    var item = await Firebase().registrarNumeroComunicado(fechaInput, secuencia, datos || {}, opciones || {});
    return Object.assign({}, item, {
      fechaTexto: obtenerFechaLarga(fechaInput),
      registradoEn: new Date().toISOString()
    });
  }

  async function reservarNumero(fechaInput, datos, opciones) {
    var siguiente = await obtenerSiguienteNumero(fechaInput, opciones);
    return await registrarNumeroManual(fechaInput, siguiente.secuencia, datos, opciones);
  }

  async function reservarNumeros(fechaInput, items, opciones) {
    var resultados = [];
    for (var i = 0; i < arr(items).length; i += 1) {
      resultados.push(await reservarNumero(fechaInput, arr(items)[i], opciones));
    }
    return resultados;
  }

  async function obtenerHistorialMes(fechaInput) {
    return await obtenerRegistroMes(fechaInput);
  }

  async function reiniciarMes() {
    throw new Error("El reinicio del contador debe realizarse desde la colección configuracion de Firebase.");
  }

  NS.Contador = {
    VERSION: "3.0.0",
    PREFIJO_DEFAULT: PREFIJO_DEFAULT,
    obtenerMesKey: obtenerMesKey,
    obtenerFechaLarga: obtenerFechaLarga,
    obtenerRegistroMes: obtenerRegistroMes,
    obtenerSiguienteNumero: obtenerSiguienteNumero,
    formatearNumeroComunicado: formatearNumeroComunicado,
    reservarNumero: reservarNumero,
    reservarNumeros: reservarNumeros,
    registrarNumeroManual: registrarNumeroManual,
    obtenerHistorialMes: obtenerHistorialMes,
    reiniciarMes: reiniciarMes
  };
})(window);
