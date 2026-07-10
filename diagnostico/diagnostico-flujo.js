/* =========================================================
Nombre completo: diagnostico-flujo.js
Ruta o ubicación: /Curriculo/diagnostico/diagnostico-flujo.js
Función o funciones:
- Registrar el flujo, etapa, subetapa, archivo, función y tabla activa.
- Detectar procesos sin actividad mediante un vigilante de tiempo.
- Enriquecer errores JavaScript e IndexedDB con contexto técnico.
- Instrumentar las operaciones de BDLocal sin cambiar sus resultados.
- Mantener una línea de tiempo descargable para soporte y depuración.
========================================================= */

(function (window) {
  "use strict";

  if (window.DiagnosticoFlujo && window.DiagnosticoFlujo.version) return;

  var VERSION = 1;
  var MAX_HISTORIAL = 120;
  var DEFAULT_STALL_MS = 30000;
  var operacionActiva = null;
  var ultimoDiagnostico = null;
  var secuencia = 0;
  var watchdog = null;

  function ahoraISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function clonarSeguro(valor) {
    if (valor === null || typeof valor === "undefined") return valor;
    try {
      return JSON.parse(JSON.stringify(valor));
    } catch (error) {
      return texto(valor);
    }
  }

  function idOperacion(prefijo) {
    secuencia += 1;
    var fecha = new Date();
    var marca = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0"),
      "-",
      String(fecha.getHours()).padStart(2, "0"),
      String(fecha.getMinutes()).padStart(2, "0"),
      String(fecha.getSeconds()).padStart(2, "0")
    ].join("");
    return texto(prefijo || "OP") + "-" + marca + "-" + secuencia;
  }

  function emitir(nombre, detalle) {
    try {
      window.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} }));
    } catch (error) {
      console.warn("[DiagnosticoFlujo] No se pudo emitir", nombre, error);
    }
  }

  function extraerUbicacion(stack) {
    stack = texto(stack);
    var lineas = stack.split("\n");
    for (var i = 0; i < lineas.length; i += 1) {
      var linea = lineas[i];
      var match = linea.match(/(?:file:\/\/\/|https?:\/\/[^/]+\/)?([^\s()]+\.js):(\d+):(\d+)/i);
      if (match) {
        return {
          archivoStack: match[1],
          linea: Number(match[2] || 0),
          columna: Number(match[3] || 0)
        };
      }
    }
    return {};
  }

  function normalizarError(error, contexto) {
    contexto = contexto || {};
    var original = error instanceof Error ? error : new Error(texto(error) || "Error desconocido");
    var ubicacion = extraerUbicacion(original.stack);
    var ctxError = original.diagnosticoContexto || {};

    return Object.assign({
      nombre: original.name || "Error",
      mensaje: original.message || texto(error) || "Error desconocido",
      stack: original.stack || "",
      causa: original.cause ? texto(original.cause.message || original.cause) : ""
    }, ubicacion, ctxError, contexto);
  }

  function registrarHistorial(tipo, detalle) {
    if (!operacionActiva) return;
    var evento = Object.assign({
      fecha: ahoraISO(),
      tipo: tipo || "paso"
    }, clonarSeguro(detalle || {}));

    operacionActiva.historial.push(evento);
    if (operacionActiva.historial.length > MAX_HISTORIAL) {
      operacionActiva.historial.splice(0, operacionActiva.historial.length - MAX_HISTORIAL);
    }
  }

  function snapshot(tipo, extra) {
    var base = operacionActiva || ultimoDiagnostico || {};
    var inicioMs = Number(base.inicioMs || Date.now());
    var ultimoPulsoMs = Number(base.ultimoPulsoMs || inicioMs);
    return Object.assign({}, clonarSeguro(base), {
      tipoDiagnostico: tipo || base.tipoDiagnostico || "informacion",
      generadoEn: ahoraISO(),
      tiempoTranscurridoMs: Math.max(0, Date.now() - inicioMs),
      tiempoSinActividadMs: Math.max(0, Date.now() - ultimoPulsoMs)
    }, clonarSeguro(extra || {}));
  }

  function reiniciarWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(function () {
      if (!operacionActiva || operacionActiva.estado !== "ejecutando") return;
      var inactivo = Date.now() - Number(operacionActiva.ultimoPulsoMs || operacionActiva.inicioMs);
      var limite = Number(operacionActiva.stallTimeoutMs || DEFAULT_STALL_MS);
      if (inactivo < limite) return;
      if (operacionActiva.bloqueoReportadoEn) return;

      operacionActiva.bloqueoReportadoEn = ahoraISO();
      var detalle = snapshot("bloqueo", {
        titulo: "El flujo dejó de reportar actividad",
        mensaje: "No se recibió avance durante " + Math.round(inactivo / 1000) + " segundos.",
        sugerencia: "Revisa el archivo, función, tabla y último paso mostrados. Puedes copiar o descargar este diagnóstico."
      });
      ultimoDiagnostico = detalle;
      emitir("diagnostico:bloqueo", detalle);
      emitir("diagnostico:error", detalle);
    }, 1000);
  }

  function iniciar(config) {
    config = config || {};
    var inicio = Date.now();
    operacionActiva = {
      id: config.id || idOperacion(config.prefijo || "FLUJO"),
      versionDiagnostico: VERSION,
      estado: "ejecutando",
      flujo: texto(config.flujo || "Proceso de aplicación"),
      pantalla: texto(config.pantalla || window.location.pathname),
      archivoOrigen: texto(config.archivo || ""),
      funcionOrigen: texto(config.funcion || ""),
      zip: texto(config.zip || ""),
      etapa: texto(config.etapa || "inicio"),
      subetapa: texto(config.subetapa || ""),
      archivo: texto(config.archivo || ""),
      funcion: texto(config.funcion || ""),
      tabla: texto(config.tabla || ""),
      operacion: texto(config.operacion || ""),
      materia: texto(config.materia || ""),
      registro: texto(config.registro || ""),
      mensaje: texto(config.mensaje || "Iniciando proceso."),
      ultimoPasoExitoso: "",
      porcentaje: Number(config.porcentaje || 0),
      inicio: ahoraISO(),
      inicioMs: inicio,
      ultimoPulso: ahoraISO(),
      ultimoPulsoMs: inicio,
      stallTimeoutMs: Number(config.stallTimeoutMs || DEFAULT_STALL_MS),
      contexto: clonarSeguro(config.contexto || {}),
      historial: []
    };
    registrarHistorial("inicio", config);
    reiniciarWatchdog();
    emitir("diagnostico:iniciado", snapshot("inicio"));
    emitir("diagnostico:actualizado", snapshot("inicio"));
    return operacionActiva.id;
  }

  function paso(detalle) {
    detalle = detalle || {};
    if (!operacionActiva) {
      iniciar({
        flujo: detalle.flujo || "Proceso de aplicación",
        pantalla: detalle.pantalla,
        archivo: detalle.archivo,
        funcion: detalle.funcion,
        mensaje: detalle.mensaje
      });
    }

    ["flujo", "etapa", "subetapa", "archivo", "funcion", "tabla", "operacion", "materia", "registro", "mensaje"].forEach(function (campo) {
      if (typeof detalle[campo] !== "undefined") operacionActiva[campo] = texto(detalle[campo]);
    });
    if (typeof detalle.porcentaje !== "undefined") operacionActiva.porcentaje = Number(detalle.porcentaje || 0);
    if (detalle.contexto) operacionActiva.contexto = Object.assign({}, operacionActiva.contexto || {}, clonarSeguro(detalle.contexto));
    operacionActiva.ultimoPulso = ahoraISO();
    operacionActiva.ultimoPulsoMs = Date.now();
    operacionActiva.bloqueoReportadoEn = null;
    registrarHistorial("paso", detalle);
    var snap = snapshot("paso");
    emitir("diagnostico:actualizado", snap);
    return snap;
  }

  function exito(detalle) {
    detalle = detalle || {};
    if (!operacionActiva) return null;
    var descripcion = texto(detalle.mensaje || detalle.paso || operacionActiva.mensaje || operacionActiva.etapa);
    operacionActiva.ultimoPasoExitoso = descripcion;
    operacionActiva.ultimoPulso = ahoraISO();
    operacionActiva.ultimoPulsoMs = Date.now();
    operacionActiva.bloqueoReportadoEn = null;
    registrarHistorial("exito", detalle);
    var snap = snapshot("exito");
    emitir("diagnostico:actualizado", snap);
    return snap;
  }

  function completar(detalle) {
    detalle = detalle || {};
    if (!operacionActiva) return null;
    paso(detalle);
    operacionActiva.estado = "completado";
    operacionActiva.fin = ahoraISO();
    operacionActiva.finMs = Date.now();
    registrarHistorial("completado", detalle);
    ultimoDiagnostico = snapshot("completado");
    emitir("diagnostico:completado", ultimoDiagnostico);
    operacionActiva = null;
    return ultimoDiagnostico;
  }

  function fallar(error, contexto) {
    contexto = contexto || {};
    if (!operacionActiva) {
      iniciar({
        flujo: contexto.flujo || "Error de aplicación",
        pantalla: contexto.pantalla,
        archivo: contexto.archivo,
        funcion: contexto.funcion,
        mensaje: contexto.mensaje || (error && error.message)
      });
    }

    var normalizado = normalizarError(error, contexto);
    paso(normalizado);
    operacionActiva.estado = "error";
    operacionActiva.error = normalizado;
    operacionActiva.fin = ahoraISO();
    operacionActiva.finMs = Date.now();
    registrarHistorial("error", normalizado);
    ultimoDiagnostico = snapshot("error", {
      titulo: contexto.titulo || "Se produjo un error",
      mensaje: normalizado.mensaje,
      sugerencia: contexto.sugerencia || sugerenciaParaError(normalizado)
    });
    emitir("diagnostico:error", ultimoDiagnostico);
    operacionActiva = null;
    return ultimoDiagnostico;
  }

  function sugerenciaParaError(error) {
    var mensaje = texto(error && error.mensaje).toLowerCase();
    if (mensaje.indexOf("quota") !== -1 || mensaje.indexOf("cuota") !== -1) {
      return "No hay espacio suficiente en IndexedDB. Evita guardar binarios y elimina cargas antiguas innecesarias.";
    }
    if (mensaje.indexOf("bloque") !== -1 || mensaje.indexOf("blocked") !== -1) {
      return "Cierra todas las ventanas de Curriculo y vuelve a abrir la aplicación.";
    }
    if (mensaje.indexOf("tiempo agotado") !== -1) {
      return "La operación superó el tiempo permitido. Revisa la tabla y el último paso exitoso antes de reintentar.";
    }
    if (mensaje.indexOf("transactioninactive") !== -1) {
      return "Una transacción de IndexedDB se cerró antes de completar las operaciones. Reintenta con una sola ventana abierta.";
    }
    return "Copia o descarga el diagnóstico para revisar el archivo, la función y el último paso exitoso.";
  }

  function reportar(error, contexto) {
    return fallar(error, contexto || {});
  }

  function obtenerActual() {
    return operacionActiva ? snapshot("actual") : null;
  }

  function obtenerUltimo() {
    return ultimoDiagnostico ? clonarSeguro(ultimoDiagnostico) : null;
  }

  function descargar(diagnostico, nombre) {
    diagnostico = diagnostico || obtenerActual() || obtenerUltimo();
    if (!diagnostico) return false;
    var blob = new Blob([JSON.stringify(diagnostico, null, 2)], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre || ("diagnostico-" + texto(diagnostico.id || "flujo") + ".json");
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  }

  function contextoCore(nombre, args) {
    args = Array.prototype.slice.call(args || []);
    var tabla = texto(args[0]);
    var operacion = nombre;
    var registro = "";
    if (nombre === "get" || nombre === "remove") registro = texto(args[1]);
    if (nombre === "getAllByIndex" || nombre === "getOneByIndex") {
      registro = texto(args[1]) + "=" + texto(args[2]);
    }
    if (nombre === "bulkPut" || nombre === "bulkAdd") {
      registro = Array.isArray(args[1]) ? args[1].length + " registros" : "";
    }
    return {
      archivo: "bdlocal/bdlocal.core.js",
      funcion: "Core." + nombre + "()",
      tabla: tabla,
      operacion: operacion,
      registro: registro,
      mensaje: operacion + (tabla ? " en " + tabla : "")
    };
  }

  function instrumentarBDLocal(BD) {
    if (!BD || !BD.Core || BD.Core.__diagnosticoInstrumentado) return false;
    var Core = BD.Core;
    ["add", "put", "get", "remove", "clear", "count", "getAll", "getAllByIndex", "getOneByIndex", "bulkPut", "bulkAdd", "runTransaction"].forEach(function (nombre) {
      if (typeof Core[nombre] !== "function") return;
      var original = Core[nombre].bind(Core);
      Core[nombre] = function () {
        var args = arguments;
        var contexto = contextoCore(nombre, args);
        if (operacionActiva) paso(contexto);
        emitir("diagnostico:core-operacion", Object.assign({ fase: "inicio" }, contexto));
        return Promise.resolve().then(function () {
          return original.apply(null, args);
        }).then(function (resultado) {
          if (operacionActiva) exito({ mensaje: contexto.mensaje + " completado" });
          emitir("diagnostico:core-operacion", Object.assign({ fase: "fin" }, contexto));
          return resultado;
        }).catch(function (error) {
          error.diagnosticoContexto = Object.assign({}, error.diagnosticoContexto || {}, contexto);
          emitir("diagnostico:core-operacion", Object.assign({ fase: "error", error: error.message }, contexto));
          throw error;
        });
      };
    });
    Core.__diagnosticoInstrumentado = true;
    return true;
  }

  window.addEventListener("error", function (event) {
    var error = event.error || new Error(event.message || "Error global");
    reportar(error, {
      flujo: operacionActiva ? operacionActiva.flujo : "Error global de interfaz",
      archivo: event.filename || "",
      funcion: "window.onerror",
      registro: event.lineno ? "línea " + event.lineno : ""
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var razon = event.reason instanceof Error ? event.reason : new Error(texto(event.reason) || "Promesa rechazada sin control");
    reportar(razon, {
      flujo: operacionActiva ? operacionActiva.flujo : "Promesa no controlada",
      funcion: "unhandledrejection"
    });
  });

  window.DiagnosticoFlujo = {
    version: VERSION,
    iniciar: iniciar,
    paso: paso,
    pulso: paso,
    exito: exito,
    completar: completar,
    fallar: fallar,
    reportar: reportar,
    obtenerActual: obtenerActual,
    obtenerUltimo: obtenerUltimo,
    descargar: descargar,
    instrumentarBDLocal: instrumentarBDLocal
  };

  reiniciarWatchdog();
})(window);
