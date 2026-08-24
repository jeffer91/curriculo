/* =========================================================
Nombre completo: fichas.periodos.js
Ruta o ubicación: /Curriculo/fichas/fichas.periodos.js
Funciones:
- Mostrar períodos institucionales ya creados en un selector.
- Crear un nuevo período mediante mes/año inicial y mes/año final.
- Guardar el período una sola vez en Firebase y reutilizarlo después.
- Mantener el periodoInput oculto para compatibilidad con la lógica actual de Fichas.
- Adjuntar periodoId y datos estructurados a contextos, tendencias y generaciones nuevas.
========================================================= */
(function (window, document) {
  "use strict";

  if (window.__fichasPeriodosInstalado === true) return;
  window.__fichasPeriodosInstalado = true;

  var FB = window.CurriculoFirebase;
  var Fichas = FB && FB.Fichas;
  var Periodos = Fichas && Fichas.Periodos;
  var listaPeriodos = [];
  var STORAGE_KEY = "curriculo.fichas.periodoSeleccionado";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function periodoSeleccionado() {
    var select = $("periodoSelect");
    var id = texto(select && select.value);
    return listaPeriodos.filter(function (item) { return texto(item.id || item.periodoId) === id; })[0] || null;
  }

  function periodoPorValor(valor) {
    var buscado = texto(valor);
    if (!buscado) return null;
    return listaPeriodos.filter(function (item) {
      return texto(item.periodo) === buscado || texto(item.nombre) === buscado;
    })[0] || null;
  }

  function metaPeriodo(periodo) {
    if (!periodo) return null;
    return {
      periodoId: texto(periodo.id || periodo.periodoId),
      periodoNombre: texto(periodo.nombre),
      periodoInicioMes: numero(periodo.mesInicio, 0),
      periodoInicioAnio: numero(periodo.anioInicio, 0),
      periodoFinMes: numero(periodo.mesFin, 0),
      periodoFinAnio: numero(periodo.anioFin, 0)
    };
  }

  function datosPeriodoActual() {
    return metaPeriodo(periodoSeleccionado());
  }

  function sincronizarPeriodoOculto() {
    var periodo = periodoSeleccionado();
    var input = $("periodoInput");
    if (!input) return;

    if (!periodo) {
      input.value = "";
      delete input.dataset.periodoId;
      return;
    }

    input.value = texto(periodo.periodo || periodo.nombre);
    input.dataset.periodoId = texto(periodo.id || periodo.periodoId);
    input.dataset.periodoNombre = texto(periodo.nombre);
    try { window.localStorage.setItem(STORAGE_KEY, texto(periodo.id || periodo.periodoId)); } catch (error) {}
  }

  function completarMeses() {
    var meses = Periodos && Array.isArray(Periodos.MESES) ? Periodos.MESES : [];
    ["periodoMesInicio", "periodoMesFin"].forEach(function (id) {
      var select = $(id);
      if (!select) return;
      select.innerHTML = '<option value="">Mes</option>' + meses.map(function (nombre, indice) {
        return '<option value="' + (indice + 1) + '">' + escapar(nombre) + '</option>';
      }).join("");
    });
  }

  function valoresIniciales() {
    var hoy = new Date();
    var mesInicio = hoy.getMonth() + 1;
    var anioInicio = hoy.getFullYear();
    var fechaFin = new Date(anioInicio, mesInicio - 1 + 5, 1);

    if ($("periodoMesInicio")) $("periodoMesInicio").value = String(mesInicio);
    if ($("periodoAnioInicio")) $("periodoAnioInicio").value = String(anioInicio);
    if ($("periodoMesFin")) $("periodoMesFin").value = String(fechaFin.getMonth() + 1);
    if ($("periodoAnioFin")) $("periodoAnioFin").value = String(fechaFin.getFullYear());
  }

  function mostrarMensaje(tipo, mensaje) {
    var el = $("periodoMensaje");
    if (!el) return;
    el.hidden = !mensaje;
    el.className = "period-message" + (tipo ? " period-message-" + tipo : "");
    el.textContent = mensaje || "";
  }

  function abrirNuevoPeriodo() {
    var panel = $("periodoNuevoPanel");
    if (!panel) return;
    panel.hidden = false;
    mostrarMensaje("", "");
    valoresIniciales();
    if ($("periodoMesInicio")) $("periodoMesInicio").focus();
  }

  function cerrarNuevoPeriodo() {
    var panel = $("periodoNuevoPanel");
    if (panel) panel.hidden = true;
    mostrarMensaje("", "");
  }

  function ordenarPeriodos() {
    listaPeriodos.sort(function (a, b) {
      var ia = numero(a.anioInicio, 0) * 12 + numero(a.mesInicio, 0);
      var ib = numero(b.anioInicio, 0) * 12 + numero(b.mesInicio, 0);
      if (ia !== ib) return ib - ia;
      var fa = numero(a.anioFin, 0) * 12 + numero(a.mesFin, 0);
      var fb = numero(b.anioFin, 0) * 12 + numero(b.mesFin, 0);
      return fb - fa;
    });
  }

  function renderPeriodos(idPreferido) {
    var select = $("periodoSelect");
    if (!select) return;

    ordenarPeriodos();
    if (!listaPeriodos.length) {
      select.innerHTML = '<option value="">No hay períodos creados</option>';
      select.disabled = true;
      sincronizarPeriodoOculto();
      return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">Seleccionar período</option>' + listaPeriodos.map(function (item) {
      var id = texto(item.id || item.periodoId);
      var nombre = texto(item.nombre || item.periodo || id);
      return '<option value="' + escapar(id) + '">' + escapar(nombre) + '</option>';
    }).join("");

    var guardado = "";
    try { guardado = texto(window.localStorage.getItem(STORAGE_KEY)); } catch (error) {}
    var deseado = texto(idPreferido || guardado);
    if (deseado && listaPeriodos.some(function (item) { return texto(item.id || item.periodoId) === deseado; })) {
      select.value = deseado;
    }
    sincronizarPeriodoOculto();
  }

  async function cargarPeriodos() {
    var select = $("periodoSelect");
    var revisar = $("btnRevisar");
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Cargando períodos...</option>';
    }
    if (revisar) revisar.disabled = true;

    try {
      if (!Periodos || typeof Periodos.obtenerPeriodos !== "function") {
        throw new Error("No está disponible el catálogo de períodos.");
      }
      listaPeriodos = await Periodos.obtenerPeriodos();
      renderPeriodos();
      if (!listaPeriodos.length) abrirNuevoPeriodo();
    } catch (error) {
      if (select) select.innerHTML = '<option value="">No se pudieron cargar los períodos</option>';
      mostrarMensaje("error", error && error.message ? error.message : "No se pudieron cargar los períodos.");
    } finally {
      if (revisar) revisar.disabled = false;
    }
  }

  async function guardarNuevoPeriodo() {
    var boton = $("btnGuardarPeriodo");
    var datos = {
      mesInicio: numero($("periodoMesInicio") && $("periodoMesInicio").value, 0),
      anioInicio: numero($("periodoAnioInicio") && $("periodoAnioInicio").value, 0),
      mesFin: numero($("periodoMesFin") && $("periodoMesFin").value, 0),
      anioFin: numero($("periodoAnioFin") && $("periodoAnioFin").value, 0)
    };

    if (!Periodos || typeof Periodos.guardarPeriodo !== "function") return;
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Guardando...";
    }
    mostrarMensaje("", "");

    try {
      var periodo = await Periodos.guardarPeriodo(datos);
      var id = texto(periodo.id || periodo.periodoId);
      var indice = listaPeriodos.findIndex(function (item) { return texto(item.id || item.periodoId) === id; });
      if (indice >= 0) listaPeriodos[indice] = periodo;
      else listaPeriodos.push(periodo);
      renderPeriodos(id);
      cerrarNuevoPeriodo();
      mostrarMensaje("ok", periodo.reutilizado === true
        ? "El período ya existía y fue seleccionado."
        : "Período guardado y seleccionado.");
      window.setTimeout(function () { mostrarMensaje("", ""); }, 2200);
    } catch (error) {
      mostrarMensaje("error", error && error.message ? error.message : "No se pudo guardar el período.");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = "Guardar período";
      }
    }
  }

  function enriquecerGuardados() {
    if (!Fichas || Fichas.__periodosEnriquecidos === true) return;
    Fichas.__periodosEnriquecidos = true;

    ["guardarContexto", "guardarTendencia", "guardarGeneracion"].forEach(function (nombre) {
      var original = Fichas[nombre];
      if (typeof original !== "function") return;
      Fichas[nombre] = function (datos) {
        var periodo = periodoPorValor(datos && datos.periodo) || periodoSeleccionado();
        var meta = metaPeriodo(periodo);
        return original.call(Fichas, meta ? Object.assign({}, datos || {}, meta) : datos);
      };
    });
  }

  function conectarEventos() {
    var select = $("periodoSelect");
    if (select) select.addEventListener("change", sincronizarPeriodoOculto);
    if ($("btnNuevoPeriodo")) $("btnNuevoPeriodo").addEventListener("click", abrirNuevoPeriodo);
    if ($("btnCancelarPeriodo")) $("btnCancelarPeriodo").addEventListener("click", cerrarNuevoPeriodo);
    if ($("btnGuardarPeriodo")) $("btnGuardarPeriodo").addEventListener("click", guardarNuevoPeriodo);
  }

  async function iniciar() {
    completarMeses();
    conectarEventos();
    enriquecerGuardados();
    await cargarPeriodos();
  }

  window.CurriculoFichasPeriodos = {
    cargar: cargarPeriodos,
    seleccionado: periodoSeleccionado,
    datosActuales: datosPeriodoActual
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
