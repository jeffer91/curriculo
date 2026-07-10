/* =========================================================
Nombre completo: comunicados.contador.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.contador.js
Función o funciones:
- Generar numeración institucional mensual para comunicados.
- Usar formato COM-ITSQMET-UGPA-AÑO-MES-0X.
- Reiniciar automáticamente la secuencia cuando cambia el mes.
- Reservar números individuales o en lote para comunicados por materia.
- Guardar el contador en localStorage y, si existe, también en BDLocal meta.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  var STORAGE_KEY = "COMUNICADOS_CCC_CONTADOR_MENSUAL_V1";
  var PREFIJO_DEFAULT = "COM-ITSQMET-UGPA";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function pad2(valor) {
    return String(valor).padStart(2, "0");
  }

  function fechaBase(fechaInput) {
    if (fechaInput instanceof Date && !Number.isNaN(fechaInput.getTime())) {
      return fechaInput;
    }

    if (typeof fechaInput === "string" && fechaInput.trim()) {
      var parsed = new Date(fechaInput);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
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
    var d = fechaBase(fechaInput);

    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }

  function obtenerFechaLarga(fechaInput) {
    var d = fechaBase(fechaInput);

    var meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre"
    ];

    return d.getDate() + " de " + meses[d.getMonth()] + " del " + d.getFullYear();
  }

  function leerEstadoLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return {
          version: 1,
          meses: {}
        };
      }

      var data = JSON.parse(raw);

      if (!data || typeof data !== "object") {
        return {
          version: 1,
          meses: {}
        };
      }

      data.meses = data.meses || {};

      return data;
    } catch (error) {
      console.warn("[ComunicadosCCC.Contador] No se pudo leer localStorage:", error);

      return {
        version: 1,
        meses: {}
      };
    }
  }

  function guardarEstadoLocal(estado) {
    estado = estado || {
      version: 1,
      meses: {}
    };

    estado.actualizadoEn = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado, null, 2));

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

    if (numero < 100) return pad2(numero);

    return String(numero);
  }

  function formatearNumeroComunicado(secuencia, fechaInput, opciones) {
    opciones = opciones || {};

    var prefijo = texto(opciones.prefijo || PREFIJO_DEFAULT);
    var anio = obtenerAnio(fechaInput);
    var mes = pad2(obtenerMes(fechaInput));

    return prefijo + "-" + anio + "-" + mes + "-" + formatearSecuencia(secuencia);
  }

  async function guardarEnBDLocalMeta(fechaInput, registro) {
    try {
      if (!window.BDLocalCCC || !window.BDLocalCCC.Core || !window.BDLocalCCC.Schema) {
        return null;
      }

      var Core = window.BDLocalCCC.Core;
      var Schema = window.BDLocalCCC.Schema;
      var storeMeta = Schema.STORES && Schema.STORES.META ? Schema.STORES.META : "meta";
      var key = "contador_comunicados_" + obtenerMesKey(fechaInput).replace("-", "_");

      if (typeof Core.ready === "function") {
        await Core.ready();
      }

      if (typeof Core.put === "function") {
        return await Core.put(storeMeta, {
          key: key,
          tipo: "contador_comunicados",
          mesKey: obtenerMesKey(fechaInput),
          data: registro,
          actualizadoEn: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn("[ComunicadosCCC.Contador] No se pudo sincronizar con BDLocal meta:", error);
    }

    return null;
  }

  async function obtenerSiguienteNumero(fechaInput, opciones) {
    opciones = opciones || {};

    var registro = obtenerRegistroMes(fechaInput);
    var siguiente = Number(registro.ultimo || 0) + 1;

    return {
      secuencia: siguiente,
      numero: formatearNumeroComunicado(siguiente, fechaInput, opciones),
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput)
    };
  }

  async function reservarNumero(fechaInput, datos, opciones) {
    opciones = opciones || {};

    var registro = obtenerRegistroMes(fechaInput);
    var siguiente = Number(registro.ultimo || 0) + 1;

    var numero = formatearNumeroComunicado(siguiente, fechaInput, opciones);

    var item = Object.assign({
      secuencia: siguiente,
      numero: numero,
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput),
      reservadoEn: new Date().toISOString()
    }, datos || {});

    registro.ultimo = siguiente;
    registro.generados = Array.isArray(registro.generados) ? registro.generados : [];
    registro.generados.push(item);

    var actualizado = actualizarRegistroMes(fechaInput, registro);

    await guardarEnBDLocalMeta(fechaInput, actualizado);

    return item;
  }

  async function reservarNumeros(fechaInput, items, opciones) {
    items = Array.isArray(items) ? items : [];
    opciones = opciones || {};

    var resultados = [];

    for (var i = 0; i < items.length; i += 1) {
      var reservado = await reservarNumero(fechaInput, items[i], opciones);
      resultados.push(reservado);
    }

    return resultados;
  }

  async function registrarNumeroManual(fechaInput, secuencia, datos, opciones) {
    opciones = opciones || {};

    secuencia = Number(secuencia || 0);

    if (!secuencia || secuencia < 1) {
      throw new Error("La secuencia manual debe ser mayor a cero.");
    }

    var registro = obtenerRegistroMes(fechaInput);
    var numero = formatearNumeroComunicado(secuencia, fechaInput, opciones);

    var yaExiste = (registro.generados || []).some(function (item) {
      return item.numero === numero || Number(item.secuencia) === secuencia;
    });

    if (yaExiste && opciones.permitirDuplicado !== true) {
      throw new Error("Ese número de comunicado ya está registrado para este mes: " + numero);
    }

    var item = Object.assign({
      secuencia: secuencia,
      numero: numero,
      mesKey: obtenerMesKey(fechaInput),
      fechaTexto: obtenerFechaLarga(fechaInput),
      registradoManual: true,
      reservadoEn: new Date().toISOString()
    }, datos || {});

    registro.ultimo = Math.max(Number(registro.ultimo || 0), secuencia);
    registro.generados = Array.isArray(registro.generados) ? registro.generados : [];
    registro.generados.push(item);

    var actualizado = actualizarRegistroMes(fechaInput, registro);

    await guardarEnBDLocalMeta(fechaInput, actualizado);

    return item;
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