/* =========================================================
Nombre completo: comunicados.contador.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.contador.js
Función o funciones:
- Generar numeración mensual COM-ITSQMET-UGPA-AÑO-MES-0X.
- Reiniciar la secuencia con una nueva versión de almacenamiento.
- Mantener el texto fijo "Comunicado No. 01" separado del código institucional.
- Registrar números individuales y por lote después de generar el PDF.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;
  var STORAGE_KEY = "COMUNICADOS_CCC_CONTADOR_MENSUAL_V2";
  var PREFIJO_DEFAULT = "COM-ITSQMET-UGPA";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function pad2(valor) {
    return String(Number(valor || 0)).padStart(2, "0");
  }

  function fechaBase(fechaInput) {
    if (fechaInput instanceof Date && !Number.isNaN(fechaInput.getTime())) {
      return fechaInput;
    }

    if (typeof fechaInput === "string" && fechaInput.trim()) {
      var parsed = new Date(fechaInput);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return new Date();
  }

  function obtenerAnio(fechaInput) {
    return fechaBase(fechaInput).getFullYear();
  }

  function obtenerMes(fechaInput) {
    return fechaBase(fechaInput).getMonth() + 1;
  }

  function obtenerMesKey(fechaInput) {
    var fecha = fechaBase(fechaInput);
    return fecha.getFullYear() + "-" + pad2(fecha.getMonth() + 1);
  }

  function obtenerFechaLarga(fechaInput) {
    var fecha = fechaBase(fechaInput);
    var meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];

    return fecha.getDate() + " de " + meses[fecha.getMonth()] + " del " + fecha.getFullYear();
  }

  function estadoVacio() {
    return { version: 2, meses: {} };
  }

  function leerEstadoLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return estadoVacio();

      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return estadoVacio();

      data.version = 2;
      data.meses = data.meses || {};
      return data;
    } catch (error) {
      console.warn("[ComunicadosCCC.Contador] No se pudo leer el contador:", error);
      return estadoVacio();
    }
  }

  function guardarEstadoLocal(estado) {
    estado = estado || estadoVacio();
    estado.version = 2;
    estado.meses = estado.meses || {};
    estado.actualizadoEn = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    return estado;
  }

  function obtenerRegistroMes(fechaInput) {
    var estado = leerEstadoLocal();
    var key = obtenerMesKey(fechaInput);

    if (!estado.meses[key]) {
      estado.meses[key] = {
        key: key,
        anio: obtenerAnio(fechaInput),
        mes: obtenerMes(fechaInput),
        ultimo: 0,
        generados: [],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };
      guardarEstadoLocal(estado);
    }

    return estado.meses[key];
  }

  function actualizarRegistroMes(fechaInput, registro) {
    var estado = leerEstadoLocal();
    var key = obtenerMesKey(fechaInput);

    estado.meses[key] = Object.assign({}, registro, {
      key: key,
      anio: obtenerAnio(fechaInput),
      mes: obtenerMes(fechaInput),
      actualizadoEn: new Date().toISOString()
    });

    guardarEstadoLocal(estado);
    return estado.meses[key];
  }

  function formatearSecuencia(numero) {
    numero = Number(numero || 0);
    return numero < 100 ? pad2(numero) : String(numero);
  }

  function formatearNumeroComunicado(secuencia, fechaInput, opciones) {
    opciones = opciones || {};
    var prefijo = texto(opciones.prefijo || PREFIJO_DEFAULT);

    return [
      prefijo,
      obtenerAnio(fechaInput),
      pad2(obtenerMes(fechaInput)),
      formatearSecuencia(secuencia)
    ].join("-");
  }

  async function guardarEnBDLocalMeta(fechaInput, registro) {
    try {
      if (!window.BDLocalCCC || !window.BDLocalCCC.Core || !window.BDLocalCCC.Schema) {
        return null;
      }

      var Core = window.BDLocalCCC.Core;
      var Schema = window.BDLocalCCC.Schema;
      var storeMeta = Schema.STORES && Schema.STORES.META ? Schema.STORES.META : "meta";
      var key = "contador_comunicados_v2_" + obtenerMesKey(fechaInput).replace("-", "_");

      if (typeof Core.ready === "function") await Core.ready();

      if (typeof Core.put === "function") {
        return await Core.put(storeMeta, {
          key: key,
          tipo: "contador_comunicados",
          version: 2,
          mesKey: obtenerMesKey(fechaInput),
          data: registro,
          actualizadoEn: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn("[ComunicadosCCC.Contador] No se pudo sincronizar el contador:", error);
    }

    return null;
  }

  async function obtenerSiguienteNumero(fechaInput, opciones) {
    var registro = obtenerRegistroMes(fechaInput);
    var siguiente = Number(registro.ultimo || 0) + 1;

    return {
      secuencia: siguiente,
      numero: formatearNumeroComunicado(siguiente, fechaInput, opciones),
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput)
    };
  }

  async function registrarNumeroManual(fechaInput, secuencia, datos, opciones) {
    opciones = opciones || {};
    secuencia = Number(secuencia || 0);

    if (!secuencia || secuencia < 1) {
      throw new Error("La secuencia debe ser mayor a cero.");
    }

    var registro = obtenerRegistroMes(fechaInput);
    var numero = formatearNumeroComunicado(secuencia, fechaInput, opciones);
    var existente = (registro.generados || []).some(function (item) {
      return item.numero === numero || Number(item.secuencia) === secuencia;
    });

    if (existente && opciones.permitirDuplicado !== true) {
      throw new Error("Ese número ya está registrado: " + numero);
    }

    var item = Object.assign({
      secuencia: secuencia,
      numero: numero,
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput),
      registradoEn: new Date().toISOString()
    }, datos || {});

    registro.ultimo = Math.max(Number(registro.ultimo || 0), secuencia);
    registro.generados = Array.isArray(registro.generados) ? registro.generados : [];
    registro.generados.push(item);

    var actualizado = actualizarRegistroMes(fechaInput, registro);
    await guardarEnBDLocalMeta(fechaInput, actualizado);
    return item;
  }

  async function reservarNumero(fechaInput, datos, opciones) {
    var siguiente = await obtenerSiguienteNumero(fechaInput, opciones);
    return await registrarNumeroManual(fechaInput, siguiente.secuencia, datos, opciones);
  }

  async function reservarNumeros(fechaInput, items, opciones) {
    items = arr(items);
    var resultados = [];

    for (var i = 0; i < items.length; i += 1) {
      resultados.push(await reservarNumero(fechaInput, items[i], opciones));
    }

    return resultados;
  }

  function obtenerHistorialMes(fechaInput) {
    var registro = obtenerRegistroMes(fechaInput);

    return {
      mesKey: registro.key,
      anio: registro.anio,
      mes: registro.mes,
      ultimo: registro.ultimo,
      generados: Array.isArray(registro.generados) ? registro.generados.slice() : []
    };
  }

  function reiniciarMes(fechaInput) {
    var estado = leerEstadoLocal();
    var key = obtenerMesKey(fechaInput);

    estado.meses[key] = {
      key: key,
      anio: obtenerAnio(fechaInput),
      mes: obtenerMes(fechaInput),
      ultimo: 0,
      generados: [],
      reiniciadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };

    guardarEstadoLocal(estado);
    return estado.meses[key];
  }

  NS.Contador = {
    PREFIJO_DEFAULT: PREFIJO_DEFAULT,
    STORAGE_KEY: STORAGE_KEY,
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
