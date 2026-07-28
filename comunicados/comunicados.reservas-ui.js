/* =========================================================
Nombre completo: comunicados.reservas-ui.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.reservas-ui.js
Funciones:
- Reservar todos los números antes de generar uno o varios PDF.
- Interceptar los botones antiguos para evitar numeración concurrente.
- Cancelar las reservas que no fueron confirmadas.
========================================================= */
(function (window, document) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var NS = window.ComunicadosCCC;
  var ocupado = false;

  function $(id) {
    return document.getElementById(id);
  }

  function fechaSeleccionada() {
    var input = $("inputFecha");
    return input && input.value ? input.value : new Date();
  }

  function estadoMain() {
    return NS.Main && typeof NS.Main.getEstado === "function"
      ? NS.Main.getEstado()
      : {};
  }

  function materiasSeleccionadas() {
    var estado = estadoMain();
    var seleccionadas = estado.seleccionadas || {};
    return (estado.materias || []).filter(function (materia) {
      return seleccionadas[materia.id] === true;
    });
  }

  function mostrarError(error) {
    var panel = $("comEstado");
    if (!panel) return;
    panel.className = "com-status com-status-error";
    panel.innerHTML =
      '<div class="com-status-dot"></div><div><strong>No se pudo reservar la numeración</strong><span>' +
      String(error && error.message ? error.message : error) +
      "</span></div>";
  }

  async function ejecutarConReserva(materias, tipo, materiaId) {
    materias = Array.isArray(materias) ? materias : [];
    if (ocupado || !materias.length) return false;

    ocupado = true;
    try {
      await NS.Contador.preReservarBloque(
        fechaSeleccionada(),
        materias.length,
        { origen: "comunicados_" + tipo }
      );

      if (tipo === "individual") {
        await NS.Main.generarMateria(materiaId);
      } else {
        await NS.Main.generarLoteZIP(materias, tipo);
      }

      return true;
    } catch (error) {
      console.error("[ComunicadosReservas] Error:", error);
      mostrarError(error);
      return false;
    } finally {
      try {
        await NS.Contador.cancelarReservasPendientes(
          "La generación no confirmó todos los PDF reservados."
        );
      } catch (errorCancelacion) {
        console.warn(
          "[ComunicadosReservas] No se pudieron cancelar reservas pendientes:",
          errorCancelacion
        );
      }
      ocupado = false;
    }
  }

  function interceptar(event) {
    if (!NS.Main || !NS.Contador) return;

    var botonIndividual = event.target.closest &&
      event.target.closest(".btnGenerarMateria");
    var botonSeleccionadas = event.target.closest &&
      event.target.closest("#btnGenerarSeleccionadas");
    var botonTodas = event.target.closest &&
      event.target.closest("#btnGenerarTodas");

    if (!botonIndividual && !botonSeleccionadas && !botonTodas) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (botonIndividual) {
      var materiaId = botonIndividual.getAttribute("data-materia-id");
      var materia = (estadoMain().materias || []).find(function (item) {
        return item.id === materiaId;
      });
      if (materia) {
        ejecutarConReserva([materia], "individual", materiaId);
      }
      return;
    }

    if (botonSeleccionadas) {
      var seleccionadas = materiasSeleccionadas();
      if (!seleccionadas.length) {
        mostrarError(new Error("Selecciona al menos una materia."));
        return;
      }
      ejecutarConReserva(seleccionadas, "seleccionadas");
      return;
    }

    var todas = estadoMain().materias || [];
    if (!todas.length) {
      mostrarError(new Error("No hay materias completas para generar."));
      return;
    }

    var confirmar = window.confirm(
      "Se reservarán " + todas.length +
      " números y se generará un PDF independiente por materia.\n\n¿Deseas continuar?"
    );
    if (confirmar) {
      ejecutarConReserva(todas, "todas");
    }
  }

  function instalar() {
    document.addEventListener("click", interceptar, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }
})(window, document);
