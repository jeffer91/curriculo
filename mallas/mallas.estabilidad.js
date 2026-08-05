/* =========================================================
Nombre completo: mallas.estabilidad.js
Ruta o ubicación: /Curriculo/mallas/mallas.estabilidad.js
Funciones:
- Evitar que una lectura o escritura de Firebase deje la pantalla bloqueada indefinidamente.
- Liberar la interfaz cuando Firebase, la red o el SDK no responden.
- Reutilizar un guardado todavía activo para evitar versiones duplicadas por reintentos.
========================================================= */
(function (window) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  if (!Firebase || window.CurriculoMallasEstabilidad) return;

  var VERSION = "1.0.0";
  var TIEMPOS = Object.freeze({
    INICIO: 18000,
    LECTURA: 22000,
    GUARDADO: 60000
  });
  var guardadoActivo = null;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function errorTiempo(etiqueta, milisegundos) {
    var segundos = Math.round(Number(milisegundos || 0) / 1000);
    var error = new Error(
      texto(etiqueta || "La operación") + " tardó más de " + segundos +
      " segundos. Revisa la conexión y vuelve a intentarlo."
    );
    error.code = "MALLAS_TIMEOUT";
    error.esTimeoutMallas = true;
    return error;
  }

  function conTiempo(promesa, milisegundos, etiqueta) {
    return new Promise(function (resolve, reject) {
      var terminado = false;
      var temporizador = window.setTimeout(function () {
        if (terminado) return;
        terminado = true;
        reject(errorTiempo(etiqueta, milisegundos));
      }, milisegundos);

      Promise.resolve(promesa).then(function (resultado) {
        if (terminado) return;
        terminado = true;
        window.clearTimeout(temporizador);
        resolve(resultado);
      }).catch(function (error) {
        if (terminado) return;
        terminado = true;
        window.clearTimeout(temporizador);
        reject(error);
      });
    });
  }

  function comprobarConexion(etiqueta) {
    if (typeof window.navigator !== "undefined" && window.navigator.onLine === false) {
      var error = new Error("No hay conexión a internet. Conéctate y vuelve a intentar " + texto(etiqueta || "la operación") + ".");
      error.code = "MALLAS_OFFLINE";
      throw error;
    }
  }

  function envolver(objeto, nombre, milisegundos, etiqueta) {
    if (!objeto || typeof objeto[nombre] !== "function") return false;
    var original = objeto[nombre];
    if (original.__mallasEstabilidad === true) return true;

    var envuelta = function () {
      comprobarConexion(etiqueta);
      var contexto = this;
      var argumentos = arguments;
      var ejecucion = Promise.resolve().then(function () {
        return original.apply(contexto, argumentos);
      });
      return conTiempo(ejecucion, milisegundos, etiqueta);
    };
    envuelta.__mallasEstabilidad = true;
    envuelta.__original = original;
    objeto[nombre] = envuelta;
    return true;
  }

  function envolverGuardado() {
    if (!Firebase.Mallas || typeof Firebase.Mallas.guardarMalla !== "function") return false;
    var original = Firebase.Mallas.guardarMalla;
    if (original.__mallasEstabilidad === true) return true;

    var envuelta = function () {
      comprobarConexion("guardar la malla");
      var contexto = this;
      var argumentos = arguments;

      if (!guardadoActivo) {
        guardadoActivo = Promise.resolve().then(function () {
          return original.apply(contexto, argumentos);
        });
        guardadoActivo.then(function () {
          guardadoActivo = null;
        }).catch(function () {
          guardadoActivo = null;
        });
      }

      return conTiempo(
        guardadoActivo,
        TIEMPOS.GUARDADO,
        "Guardar la malla"
      );
    };

    envuelta.__mallasEstabilidad = true;
    envuelta.__original = original;
    Firebase.Mallas.guardarMalla = envuelta;
    return true;
  }

  envolver(Firebase, "ready", TIEMPOS.INICIO, "Conectar con Firebase");
  envolver(Firebase, "obtenerCarreras", TIEMPOS.LECTURA, "Cargar las carreras");
  envolver(Firebase, "obtenerMateriasPorCarrera", TIEMPOS.LECTURA, "Cargar las materias");

  if (Firebase.Mallas) {
    envolver(Firebase.Mallas, "obtenerMallas", TIEMPOS.LECTURA, "Cargar el historial");
    envolver(Firebase.Mallas, "obtenerDetalleMalla", TIEMPOS.LECTURA, "Abrir la versión de la malla");
    envolver(Firebase.Mallas, "obtenerMallaVigenteParaCarrera", TIEMPOS.LECTURA, "Cargar la malla vigente");
    envolverGuardado();
  }

  window.CurriculoMallasEstabilidad = {
    VERSION: VERSION,
    TIEMPOS: TIEMPOS,
    conTiempo: conTiempo,
    errorTiempo: errorTiempo,
    hayGuardadoActivo: function () { return !!guardadoActivo; }
  };
})(window);
