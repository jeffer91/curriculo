/* =========================================================
Nombre completo: subir.estados-ui.js
Ruta o ubicación: /Curriculo/subir/subir.estados-ui.js
Funciones:
- Mostrar contadores separados de materias completas, con advertencia y con error.
- Sustituir el estado técnico de la tabla por etiquetas comprensibles.
- Mantener los estados visibles después de búsquedas o repintados.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "4.0.0";
  var paqueteActual = null;
  var observerTabla = null;
  var actualizando = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setTexto(id, valor) {
    var elemento = $(id);
    if (elemento) elemento.textContent = texto(valor);
  }

  function obtenerMateria(paquete, materiaId) {
    return arr(paquete && paquete.materias).find(function (materia) {
      return materia && texto(materia.id) === texto(materiaId);
    }) || null;
  }

  function normalizarEstado(materia) {
    var estado = texto(
      materia && (
        materia.estadoClasificado ||
        materia.estadoValidacion ||
        materia.estado
      )
    ).toLowerCase();

    if (["completa", "completo", "ok", "validado"].indexOf(estado) !== -1) {
      return { codigo: "completa", etiqueta: "Completa", clase: "ok" };
    }

    if (["error", "incompleto", "critico", "bloqueado"].indexOf(estado) !== -1) {
      return { codigo: "error", etiqueta: "Error", clase: "error" };
    }

    return { codigo: "advertencia", etiqueta: "Advertencia", clase: "warn" };
  }

  function renderBadgeEstado(materia) {
    var estado = normalizarEstado(materia);
    return '<span class="subir-badge subir-badge-' + estado.clase + '" data-estado-clasificado="' + estado.codigo + '">' + estado.etiqueta + "</span>";
  }

  function actualizarContadores(paquete) {
    var resumen = paquete && paquete.resumenValidacion ? paquete.resumenValidacion : {};
    var completas = Number(resumen.materiasCompletas || 0);
    var advertencias = Number(resumen.materiasAdvertencia || resumen.materiasRevision || 0);
    var errores = Number(resumen.materiasError || resumen.materiasIncompletas || 0);

    setTexto("statCompletas", completas);
    setTexto("statAdvertencias", advertencias);
    setTexto("statErrores", errores);

    var total = completas + advertencias + errores;
    var totalMaterias = Number(resumen.totalMaterias || arr(paquete && paquete.materias).length || 0);
    var panel = $("resumenEstadosMaterias");

    if (panel) {
      panel.setAttribute("data-total-estados", String(total));
      panel.setAttribute("data-total-materias", String(totalMaterias));
      panel.classList.toggle("subir-state-summary-error", total !== totalMaterias);
      panel.title = total === totalMaterias
        ? "Los estados coinciden con el total de materias."
        : "Los contadores no coinciden con el total de materias.";
    }
  }

  function actualizarFilas(paquete) {
    var botones = document.querySelectorAll("#tablaPreview [data-detalle-materia]");

    Array.prototype.forEach.call(botones, function (boton) {
      var materiaId = boton.getAttribute("data-detalle-materia");
      var materia = obtenerMateria(paquete, materiaId);
      var fila = boton.closest ? boton.closest("tr") : null;

      if (!materia || !fila || !fila.children || fila.children.length < 8) return;

      var estado = normalizarEstado(materia);
      var celdaEstado = fila.children[7];

      celdaEstado.innerHTML = renderBadgeEstado(materia);
      fila.setAttribute("data-estado-materia", estado.codigo);
      fila.classList.remove(
        "subir-row-completa",
        "subir-row-advertencia",
        "subir-row-error"
      );
      fila.classList.add("subir-row-" + estado.codigo);
    });
  }

  function actualizar(paquete) {
    if (actualizando) return;
    actualizando = true;

    try {
      paqueteActual = paquete || paqueteActual;
      if (!paqueteActual) return;
      actualizarContadores(paqueteActual);
      actualizarFilas(paqueteActual);
    } finally {
      actualizando = false;
    }
  }

  function observarTabla() {
    var tabla = $("tablaPreview");

    if (!tabla || typeof window.MutationObserver !== "function") return;
    if (observerTabla) observerTabla.disconnect();

    observerTabla = new window.MutationObserver(function () {
      window.setTimeout(function () {
        actualizar(paqueteActual);
      }, 0);
    });

    observerTabla.observe(tabla, { childList: true, subtree: true });
  }

  function conectarEventos() {
    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "buscadorPreview") {
        window.setTimeout(function () {
          actualizar(paqueteActual);
        }, 0);
      }
    });
  }

  function instalar() {
    if (!NS.Preview || typeof NS.Preview.pintarPaquete !== "function") {
      throw new Error("subir.estados-ui.js requiere subir.preview.js cargado previamente.");
    }

    if (NS.Preview.__estadosUI === true) return;

    var pintarOriginal = NS.Preview.pintarPaquete;
    var limpiarOriginal = NS.Preview.limpiarPreview;

    NS.Preview.pintarPaquete = function (paquete) {
      paqueteActual = paquete;
      var resultado = pintarOriginal.apply(NS.Preview, arguments);
      actualizar(paquete);
      observarTabla();
      return resultado;
    };

    NS.Preview.limpiarPreview = function () {
      paqueteActual = null;
      if (observerTabla) observerTabla.disconnect();
      setTexto("statAdvertencias", 0);
      setTexto("statErrores", 0);
      return limpiarOriginal.apply(NS.Preview, arguments);
    };

    NS.Preview.__estadosUI = true;
    conectarEventos();
  }

  NS.EstadosUI = {
    VERSION: VERSION,
    instalar: instalar,
    actualizar: actualizar,
    actualizarContadores: actualizarContadores,
    actualizarFilas: actualizarFilas,
    normalizarEstado: normalizarEstado,
    renderBadgeEstado: renderBadgeEstado
  };

  instalar();
})(window, document);
