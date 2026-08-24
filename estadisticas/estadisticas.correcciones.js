/* =========================================================
Nombre completo: estadisticas.correcciones.js
Ruta o ubicación: /Curriculo/estadisticas/estadisticas.correcciones.js
Funciones:
- Permitir corregir vínculos entre materias detectadas y la malla desde Estadísticas.
- Proponer automáticamente la materia oficial más probable cuando existe una sugerencia segura.
- Permitir elegir manualmente otra materia oficial antes de guardar.
- Guardar únicamente una equivalencia puntual en Firebase.
- Recalcular las estadísticas en memoria sin volver a descargar toda la información.
========================================================= */
(function (window, document) {
  "use strict";

  if (window.__estadisticasCorreccionesInstaladas === true) return;
  window.__estadisticasCorreccionesInstaladas = true;

  var Stats = window.CurriculoEstadisticas;
  var Firebase = window.CurriculoFirebase;
  var Comparador = window.MallasComparador;
  var accionesActivas = [];
  var sugerencias = {};
  var accionSeleccionada = null;
  var decoracionProgramada = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    if (Comparador && typeof Comparador.normalizar === "function") return Comparador.normalizar(valor);
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
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

  function idMateria(item) {
    return texto(item && (item.id || item.materiaId));
  }

  function nombreDetectado(item) {
    return texto(item && (
      item.nombreOriginalDetectado ||
      item.nombreOriginalImportado ||
      item.nombre ||
      item.nombreMateria ||
      item.materia ||
      item.nombreInstitucional ||
      item.nombreCorregido
    ));
  }

  function nombreOficial(item) {
    return texto(item && (item.nombreOficial || item.__nombre || item.nombre || item.nombreMateria));
  }

  function nivelDe(item) {
    if (Comparador && typeof Comparador.nivel === "function") return Comparador.nivel(item);
    var candidatos = [item && item.nivelNumero, item && item.numeroNivel, item && item.nivel, item && item.nivelNombre];
    for (var i = 0; i < candidatos.length; i += 1) {
      var coincidencia = texto(candidatos[i]).match(/\d+/);
      if (coincidencia) return Number(coincidencia[0]) || 0;
    }
    return 0;
  }

  function etiquetaNivel(item) {
    var n = nivelDe(item);
    return n > 0 ? "Nivel " + n : "Sin nivel";
  }

  function claveSugerencia(carreraId, item) {
    var id = idMateria(item);
    if (id) return texto(carreraId) + "|id|" + id;
    return texto(carreraId) + "|nombre|" + normalizar(nombreDetectado(item)) + "|n" + nivelDe(item);
  }

  function estadoActual() {
    return Stats && typeof Stats.getEstado === "function" ? Stats.getEstado() : null;
  }

  function detalleCarrera(carreraId) {
    var est = estadoActual();
    return arr(est && est.carrerasDetalle).filter(function (detalle) {
      return texto(detalle && detalle.carrera && detalle.carrera.id) === texto(carreraId);
    })[0] || null;
  }

  function reconstruirSugerencias() {
    sugerencias = {};
    var est = estadoActual();
    if (!est || !Stats || !Comparador || typeof Comparador.comparar !== "function") return;

    arr(est.carrerasDetalle).forEach(function (detalle) {
      if (!detalle || !detalle.detalleMalla || !detalle.detalleMalla.malla) return;

      var detectadas = typeof Stats.fusionarMaterias === "function"
        ? Stats.fusionarMaterias(detalle.materias, detalle.pendientes)
        : arr(detalle.materias).concat(arr(detalle.pendientes));

      detectadas = detectadas.filter(function (item) {
        return !Stats.tipoElemento || Stats.tipoElemento(item) !== "transversal";
      });

      var resultado = Comparador.comparar(
        detectadas,
        arr(detalle.detalleMalla.materias),
        arr(detalle.detalleMalla.equivalencias)
      );

      arr(resultado && resultado.noVinculadas).forEach(function (item) {
        var actual = item && (item.detectada || item.referencia);
        if (!actual) return;
        sugerencias[claveSugerencia(detalle.carrera.id, actual)] = {
          detalle: detalle,
          resultado: item,
          actual: actual,
          sugerencia: item.sugerencia || null
        };
      });
    });
  }

  function estadoEfectivo(fila, pea) {
    if (fila.estado === "no_vinculado") return "no_vinculado";
    if (!pea) return fila.estado;
    return fila.pea && fila.pea[pea] ? fila.pea[pea] : fila.estado;
  }

  function filasVisibles() {
    var est = estadoActual();
    if (!est) return [];

    var carreraId = texto($("filtroCarrera") && $("filtroCarrera").value);
    var tipo = texto($("filtroTipo") && $("filtroTipo").value);
    var estructura = texto($("filtroEstructura") && $("filtroEstructura").value);
    var estadoFiltro = texto($("filtroEstado") && $("filtroEstado").value);
    var pea = texto($("filtroPEA") && $("filtroPEA").value);
    var buscar = normalizar($("filtroBuscar") && $("filtroBuscar").value);
    var soloProblemas = !!($("soloProblemas") && $("soloProblemas").checked);

    return arr(est.filas).filter(function (fila) {
      if (carreraId && fila.carreraId !== carreraId) return false;
      if (tipo && fila.tipo !== tipo) return false;
      if (estructura && fila.estructura !== estructura) return false;

      var vista = estadoEfectivo(fila, pea);
      if (estadoFiltro && vista !== estadoFiltro) return false;
      if (soloProblemas && vista === "completo") return false;

      if (buscar) {
        var bolsa = normalizar([
          fila.carrera,
          fila.estructura,
          fila.codigo,
          fila.materia,
          fila.estado,
          fila.referencia
        ].join(" "));
        if (bolsa.indexOf(buscar) === -1) return false;
      }
      return true;
    }).slice(0, 500);
  }

  function sugerenciaParaFila(fila) {
    if (!fila || !fila.actual) return null;
    return sugerencias[claveSugerencia(fila.carreraId, fila.actual)] || null;
  }

  function puedeCorregirVinculo(fila) {
    if (!fila || !fila.actual || fila.esperada || fila.tipo === "transversal") return false;
    var detalle = detalleCarrera(fila.carreraId);
    return !!(detalle && detalle.detalleMalla && detalle.detalleMalla.malla && arr(detalle.detalleMalla.materias).length);
  }

  function contenidoAccion(fila) {
    if (puedeCorregirVinculo(fila)) {
      var sugerida = sugerenciaParaFila(fila);
      var indice = accionesActivas.length;
      accionesActivas.push({
        fila: fila,
        detalle: detalleCarrera(fila.carreraId),
        sugerencia: sugerida
      });
      return '<button type="button" class="est-fix-btn" data-est-corregir="' + indice + '">' +
        (sugerida && sugerida.sugerencia ? "Corregir" : "Vincular") +
      '</button>';
    }

    if (fila && fila.estado === "incompleto") {
      return '<span class="est-action-note est-action-warn">Revisar PEA</span>';
    }

    if (fila && fila.estado === "faltante") {
      return '<span class="est-action-note">Falta carga</span>';
    }

    return '<span class="est-action-empty">—</span>';
  }

  function asegurarCabeceraAccion() {
    var tabla = $("tablaDetalle");
    if (!tabla) return;
    var table = tabla.closest("table");
    var filaHead = table && table.querySelector("thead tr");
    if (!filaHead) return;
    var ultimo = filaHead.lastElementChild;
    if (!ultimo || texto(ultimo.textContent).toLowerCase() !== "acción") {
      var th = document.createElement("th");
      th.textContent = "Acción";
      th.className = "est-action-head";
      filaHead.appendChild(th);
    }
  }

  function decorarTabla() {
    decoracionProgramada = false;
    var tbody = $("tablaDetalle");
    if (!tbody) return;

    asegurarCabeceraAccion();

    var filasDom = Array.prototype.slice.call(tbody.querySelectorAll(":scope > tr"));
    var filas = filasVisibles();

    if (filasDom.length === 1 && filasDom[0].children.length === 1) {
      filasDom[0].firstElementChild.colSpan = 10;
      return;
    }

    var yaDecoradas = filasDom.length === filas.length && filasDom.every(function (tr) {
      return !!tr.querySelector("td[data-est-accion]");
    });
    if (yaDecoradas) return;

    reconstruirSugerencias();
    accionesActivas = [];

    filasDom.forEach(function (tr, indice) {
      var anterior = tr.querySelector("td[data-est-accion]");
      if (anterior) anterior.remove();
      var td = document.createElement("td");
      td.setAttribute("data-est-accion", "true");
      td.className = "est-action-cell";
      td.innerHTML = contenidoAccion(filas[indice] || null);
      tr.appendChild(td);
    });
  }

  function programarDecoracion() {
    if (decoracionProgramada) return;
    decoracionProgramada = true;
    window.setTimeout(decorarTabla, 0);
  }

  function asegurarModal() {
    var modal = $("estCorreccionModal");
    if (modal) return modal;

    modal = document.createElement("dialog");
    modal.id = "estCorreccionModal";
    modal.className = "est-fix-modal";
    modal.innerHTML =
      '<div class="est-fix-modal-head">' +
        '<div><strong>Corregir vinculación</strong><span>Relaciona la materia detectada con la materia oficial de la malla.</span></div>' +
        '<button type="button" class="est-fix-close" data-est-cerrar aria-label="Cerrar">×</button>' +
      '</div>' +
      '<div class="est-fix-modal-body">' +
        '<div id="estFixMensaje" class="est-fix-message" hidden></div>' +
        '<div class="est-fix-grid">' +
          '<section class="est-fix-box"><span>Materia detectada</span><strong id="estFixDetectada">—</strong><small id="estFixDetectadaMeta">—</small></section>' +
          '<section class="est-fix-box est-fix-box-official"><span>Materia oficial</span><label for="estFixOficial">Selecciona la coincidencia correcta</label><select id="estFixOficial"></select></section>' +
        '</div>' +
        '<div class="est-fix-reason"><strong id="estFixMotivoTitulo">Revisión manual</strong><span id="estFixMotivo">Confirma la relación antes de guardar.</span></div>' +
        '<p class="est-fix-help">Esta acción guarda únicamente una equivalencia. No modifica el contenido de los PEA ni vuelve a cargar toda la carrera.</p>' +
      '</div>' +
      '<div class="est-fix-modal-actions">' +
        '<button type="button" class="est-fix-secondary" data-est-cerrar>Cancelar</button>' +
        '<button type="button" class="est-fix-primary" id="estFixGuardar">Vincular materia</button>' +
      '</div>';

    document.body.appendChild(modal);
    return modal;
  }

  function motivoTexto(registro) {
    var resultado = registro && registro.sugerencia && registro.sugerencia.resultado;
    var motivo = texto(resultado && resultado.motivo);
    if (motivo === "nivel_diferente") {
      return {
        titulo: "Mismo nombre, nivel diferente",
        detalle: "La aplicación encontró la misma materia en la malla, pero el nivel detectado no coincide o no pudo identificarse."
      };
    }
    if (motivo === "posible_coincidencia") {
      var porcentaje = Math.round(Number(resultado.similitud || 0) * 100);
      return {
        titulo: "Posible coincidencia",
        detalle: "Se encontró una materia muy similar" + (porcentaje ? " (" + porcentaje + "% de similitud)" : "") + ". Confirma si corresponde."
      };
    }
    if (motivo === "varias_coincidencias") {
      return {
        titulo: "Hay varias posibilidades",
        detalle: "Selecciona manualmente la materia oficial correcta."
      };
    }
    return {
      titulo: "Sin vínculo con la malla",
      detalle: "Selecciona la materia oficial que corresponde a la materia detectada."
    };
  }

  function materiasOficiales(registro) {
    return arr(registro && registro.detalle && registro.detalle.detalleMalla && registro.detalle.detalleMalla.materias)
      .filter(function (item) { return item && item.activa !== false; })
      .slice()
      .sort(function (a, b) {
        return nivelDe(a) - nivelDe(b) || Number(a.orden || 0) - Number(b.orden || 0) || nombreOficial(a).localeCompare(nombreOficial(b), "es");
      });
  }

  function abrirModal(registro) {
    if (!registro || !registro.fila || !registro.fila.actual) return;
    accionSeleccionada = registro;

    var modal = asegurarModal();
    var actual = registro.fila.actual;
    var select = $("estFixOficial");
    var oficiales = materiasOficiales(registro);
    var sugerida = registro.sugerencia && registro.sugerencia.sugerencia;
    var sugeridaId = texto(sugerida && (sugerida.__id || sugerida.id || sugerida.mallaMateriaId));

    $("estFixDetectada").textContent = nombreDetectado(actual) || registro.fila.materia || "Sin nombre";
    $("estFixDetectadaMeta").textContent = [
      etiquetaNivel(actual),
      texto(actual.codigo || actual.codigoMateria || registro.fila.codigo)
    ].filter(Boolean).join(" · ");

    select.innerHTML = oficiales.map(function (item) {
      var id = texto(item.id || item.mallaMateriaId);
      return '<option value="' + escapar(id) + '">' + escapar(etiquetaNivel(item) + " · " + nombreOficial(item)) + '</option>';
    }).join("");

    if (sugeridaId && Array.prototype.some.call(select.options, function (opcion) { return opcion.value === sugeridaId; })) {
      select.value = sugeridaId;
    } else {
      var mismoNivel = oficiales.filter(function (item) { return nivelDe(item) === nivelDe(actual) && nivelDe(actual) > 0; })[0];
      if (mismoNivel) select.value = texto(mismoNivel.id || mismoNivel.mallaMateriaId);
    }

    var motivo = motivoTexto(registro);
    $("estFixMotivoTitulo").textContent = motivo.titulo;
    $("estFixMotivo").textContent = motivo.detalle;
    var mensaje = $("estFixMensaje");
    mensaje.hidden = true;
    mensaje.textContent = "";
    mensaje.className = "est-fix-message";
    $("estFixGuardar").disabled = false;
    $("estFixGuardar").textContent = "Vincular materia";

    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "open");
  }

  function cerrarModal() {
    var modal = $("estCorreccionModal");
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
    accionSeleccionada = null;
  }

  function reemplazarEquivalencia(lista, nueva) {
    var salida = arr(lista).filter(function (item) {
      return texto(item && item.id) !== texto(nueva && nueva.id);
    });
    salida.push(nueva);
    return salida;
  }

  function recalcularCarreraEnMemoria(detalle) {
    if (!detalle || !Stats || typeof Stats.construirFilasCarrera !== "function") return;
    detalle.filas = Stats.construirFilasCarrera(
      detalle.carrera,
      detalle.materias,
      detalle.detalleMalla,
      detalle.pendientes
    );

    var est = estadoActual();
    if (!est) return;
    est.filas = [];
    arr(est.carrerasDetalle).forEach(function (item) {
      est.filas = est.filas.concat(arr(item && item.filas));
    });
    if (typeof Stats.render === "function") Stats.render();
  }

  async function guardarCorreccion() {
    var registro = accionSeleccionada;
    if (!registro || !registro.fila || !registro.fila.actual) return;

    var boton = $("estFixGuardar");
    var mensaje = $("estFixMensaje");
    var select = $("estFixOficial");
    var oficiales = materiasOficiales(registro);
    var oficial = oficiales.filter(function (item) {
      return texto(item.id || item.mallaMateriaId) === texto(select && select.value);
    })[0] || null;

    if (!oficial) {
      mensaje.hidden = false;
      mensaje.className = "est-fix-message est-fix-message-error";
      mensaje.textContent = "Selecciona una materia oficial.";
      return;
    }

    if (!Firebase || !Firebase.Mallas || typeof Firebase.Mallas.guardarEquivalencia !== "function") {
      mensaje.hidden = false;
      mensaje.className = "est-fix-message est-fix-message-error";
      mensaje.textContent = "No está disponible el guardado de equivalencias en Firebase.";
      return;
    }

    var actual = registro.fila.actual;
    var malla = registro.detalle && registro.detalle.detalleMalla && registro.detalle.detalleMalla.malla;
    if (!malla || !malla.id) return;

    boton.disabled = true;
    boton.textContent = "Guardando...";
    mensaje.hidden = false;
    mensaje.className = "est-fix-message";
    mensaje.textContent = "Guardando únicamente esta corrección...";

    try {
      var equivalencia = await Firebase.Mallas.guardarEquivalencia({
        mallaId: malla.id,
        carreraId: texto(registro.fila.carreraId),
        mallaMateriaId: texto(oficial.id || oficial.mallaMateriaId),
        nombreOficial: nombreOficial(oficial),
        nivelOficial: nivelDe(oficial),
        nombreDetectado: nombreDetectado(actual) || registro.fila.materia,
        nivelDetectado: nivelDe(actual),
        criterio: "correccion_estadisticas"
      });

      registro.detalle.detalleMalla.equivalencias = reemplazarEquivalencia(
        registro.detalle.detalleMalla.equivalencias,
        equivalencia
      );

      recalcularCarreraEnMemoria(registro.detalle);
      reconstruirSugerencias();
      programarDecoracion();

      mensaje.className = "est-fix-message est-fix-message-ok";
      mensaje.textContent = "Corrección guardada. Las estadísticas ya fueron recalculadas.";
      boton.textContent = "Guardado";
      window.setTimeout(cerrarModal, 650);
    } catch (error) {
      console.error("[Estadisticas Correcciones]", error);
      boton.disabled = false;
      boton.textContent = "Vincular materia";
      mensaje.className = "est-fix-message est-fix-message-error";
      mensaje.textContent = error && error.message ? error.message : "No se pudo guardar la corrección.";
    }
  }

  function conectarEventos() {
    document.addEventListener("click", function (event) {
      var boton = event.target.closest("[data-est-corregir]");
      if (boton) {
        var indice = Number(boton.getAttribute("data-est-corregir"));
        abrirModal(accionesActivas[indice] || null);
        return;
      }

      if (event.target.closest("[data-est-cerrar]")) {
        cerrarModal();
      }
    });

    document.addEventListener("click", function (event) {
      if (event.target && event.target.id === "estFixGuardar") guardarCorreccion();
    });

    var tbody = $("tablaDetalle");
    if (tbody && typeof MutationObserver !== "undefined") {
      new MutationObserver(programarDecoracion).observe(tbody, { childList: true, subtree: true });
    }

    ["filtroCarrera", "filtroTipo", "filtroEstructura", "filtroEstado", "filtroPEA", "soloProblemas", "soloFaltantes", "soloCompletos"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", programarDecoracion);
    });
    var buscar = $("filtroBuscar");
    if (buscar) buscar.addEventListener("input", programarDecoracion);
  }

  function iniciar() {
    if (!Stats) return;
    asegurarModal();
    conectarEventos();
    reconstruirSugerencias();
    programarDecoracion();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
