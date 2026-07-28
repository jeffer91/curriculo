/* =========================================================
Nombre completo: comunicados.contador.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.contador.js
Funciones:
- Reservar números y bloques mensuales mediante transacciones de Firestore.
- Evitar que dos ventanas generen el mismo número.
- Confirmar la reserva después de crear el PDF.
- Cancelar reservas no utilizadas conservando la trazabilidad.
========================================================= */
(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var NS = window.ComunicadosCCC;
  var VERSION = "4.0.0";
  var PREFIJO_DEFAULT = "COM-ITSQMET-UGPA";
  var reservasActivas = [];

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
    var fecha = new Date(fechaInput || Date.now());
    return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
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
    return fecha.getDate() + " de " + meses[fecha.getMonth()] +
      " del " + fecha.getFullYear();
  }

  function formatearSecuencia(numero) {
    return Number(numero || 0) < 100
      ? pad2(numero)
      : String(Number(numero || 0));
  }

  function formatearNumeroComunicado(secuencia, fechaInput, opciones) {
    opciones = opciones || {};
    var fecha = fechaBase(fechaInput);
    return [
      texto(opciones.prefijo || PREFIJO_DEFAULT),
      fecha.getFullYear(),
      pad2(fecha.getMonth() + 1),
      formatearSecuencia(secuencia)
    ].join("-");
  }

  function Firebase() {
    if (!window.CurriculoFirebase) {
      throw new Error("CurriculoFirebase no está cargado.");
    }
    return window.CurriculoFirebase;
  }

  function reservaPendiente(reserva) {
    return reserva && reserva.estado !== "confirmado" &&
      reserva.estado !== "cancelado";
  }

  function buscarReserva(fechaInput, secuencia) {
    var key = obtenerMesKey(fechaInput);
    return reservasActivas.find(function (reserva) {
      return reservaPendiente(reserva) &&
        reserva.mesKey === key &&
        Number(reserva.secuencia) === Number(secuencia);
    }) || null;
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

  async function cancelarReservasPendientes(motivo) {
    var pendientes = reservasActivas.filter(reservaPendiente);
    if (!pendientes.length) return [];

    if (typeof Firebase().cancelarReservasComunicados === "function") {
      await Firebase().cancelarReservasComunicados(
        pendientes,
        motivo || "Reserva reemplazada por una nueva generación."
      );
    }

    pendientes.forEach(function (reserva) {
      reserva.estado = "cancelado";
    });
    reservasActivas = [];
    return pendientes;
  }

  async function preReservarBloque(fechaInput, cantidad, opciones) {
    opciones = opciones || {};
    cantidad = Number(cantidad || 0);

    if (cantidad < 1) {
      throw new Error("Debes reservar al menos un comunicado.");
    }

    await cancelarReservasPendientes(
      "Reserva anterior no utilizada antes de iniciar otro lote."
    );

    if (typeof Firebase().reservarBloqueComunicados !== "function") {
      throw new Error(
        "La versión actual de Firebase no admite reservas transaccionales."
      );
    }

    var reservas = await Firebase().reservarBloqueComunicados(
      fechaInput,
      cantidad,
      {
        prefijo: opciones.prefijo || PREFIJO_DEFAULT,
        origen: opciones.origen || "comunicados"
      }
    );

    reservasActivas = arr(reservas).map(function (reserva) {
      return Object.assign({}, reserva, {
        fechaTexto: obtenerFechaLarga(fechaInput),
        reservadoEn: new Date().toISOString(),
        estado: "reservado"
      });
    });

    return reservasActivas.slice();
  }

  async function obtenerSiguienteNumero(fechaInput, opciones) {
    var key = obtenerMesKey(fechaInput);
    var primera = reservasActivas.find(function (reserva) {
      return reservaPendiente(reserva) && reserva.mesKey === key;
    });

    if (!primera) {
      primera = (await preReservarBloque(
        fechaInput,
        1,
        opciones
      ))[0];
    }

    return Object.assign({}, primera, {
      fechaTexto: obtenerFechaLarga(fechaInput)
    });
  }

  async function registrarNumeroManual(
    fechaInput,
    secuencia,
    datos,
    opciones
  ) {
    opciones = opciones || {};
    secuencia = Number(secuencia || 0);

    if (secuencia < 1) {
      throw new Error("La secuencia debe ser mayor a cero.");
    }

    var reserva = buscarReserva(fechaInput, secuencia);

    if (
      reserva &&
      typeof Firebase().confirmarReservaComunicado === "function"
    ) {
      var confirmada = await Firebase().confirmarReservaComunicado(
        reserva,
        Object.assign({}, datos || {}, {
          numero: reserva.numero,
          secuencia: reserva.secuencia,
          mesKey: reserva.mesKey,
          fecha: reserva.fecha
        })
      );
      reserva.estado = "confirmado";
      return Object.assign({}, reserva, confirmada, {
        fechaTexto: obtenerFechaLarga(fechaInput),
        registradoEn: new Date().toISOString()
      });
    }

    var item = await Firebase().registrarNumeroComunicado(
      fechaInput,
      secuencia,
      datos || {},
      opciones
    );

    return Object.assign({}, item, {
      fechaTexto: obtenerFechaLarga(fechaInput),
      registradoEn: new Date().toISOString()
    });
  }

  async function reservarNumero(fechaInput, datos, opciones) {
    var reserva = (await preReservarBloque(
      fechaInput,
      1,
      opciones
    ))[0];

    if (datos && opciones && opciones.confirmarInmediatamente === true) {
      return await registrarNumeroManual(
        fechaInput,
        reserva.secuencia,
        datos,
        opciones
      );
    }

    return reserva;
  }

  async function reservarNumeros(fechaInput, items, opciones) {
    var lista = arr(items);
    var reservas = await preReservarBloque(
      fechaInput,
      lista.length,
      opciones
    );

    return reservas.map(function (reserva, indice) {
      return Object.assign({}, reserva, {
        datos: lista[indice] || {}
      });
    });
  }

  async function obtenerHistorialMes(fechaInput) {
    return await obtenerRegistroMes(fechaInput);
  }

  async function reiniciarMes() {
    throw new Error(
      "El reinicio del contador debe realizarse desde la colección configuracion de Firebase."
    );
  }

  NS.Contador = {
    VERSION: VERSION,
    PREFIJO_DEFAULT: PREFIJO_DEFAULT,
    obtenerMesKey: obtenerMesKey,
    obtenerFechaLarga: obtenerFechaLarga,
    obtenerRegistroMes: obtenerRegistroMes,
    obtenerSiguienteNumero: obtenerSiguienteNumero,
    formatearNumeroComunicado: formatearNumeroComunicado,
    preReservarBloque: preReservarBloque,
    cancelarReservasPendientes: cancelarReservasPendientes,
    reservarNumero: reservarNumero,
    reservarNumeros: reservarNumeros,
    registrarNumeroManual: registrarNumeroManual,
    obtenerHistorialMes: obtenerHistorialMes,
    reiniciarMes: reiniciarMes,
    getReservasActivas: function () {
      return reservasActivas.map(function (reserva) {
        return Object.assign({}, reserva);
      });
    }
  };
})(window);
