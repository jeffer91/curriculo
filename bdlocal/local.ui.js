/* =========================================================
Nombre completo: local.ui.js
Ruta o ubicación: /Curriculo/bdlocal/local.ui.js
Funciones:
- Mostrar el contenido vigente de IndexedDB.
- Filtrar por carrera, estado y búsqueda.
- Abrir el detalle PEA de una materia.
- Exportar una copia JSON de la base local.
========================================================= */
(function (window, document) {
  "use strict";

  var Local = window.BDLocalCCC;
  var estado = { carreras: [], niveles: [], materias: [], filtroCarrera: "", filtroEstado: "", buscar: "" };

  function $(id) { return document.getElementById(id); }
  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function escapar(v) { return texto(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
  function normalizar(v) { return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function setTexto(id, valor) { var el = $(id); if (el) el.textContent = texto(valor); }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("localEstado");
    if (!el) return;
    el.className = "loc-status loc-status-" + tipo;
    el.innerHTML = "<strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span>";
  }

  function carreraPorId(id) {
    return estado.carreras.find(function (c) { return texto(c.id) === texto(id); }) || null;
  }

  function nivelPorId(id) {
    return estado.niveles.find(function (n) { return texto(n.id) === texto(id); }) || null;
  }

  function badge(valor) {
    var e = normalizar(valor || "pendiente");
    var clase = e === "completo" ? "ok" : (["revision", "pendiente"].indexOf(e) !== -1 ? "warn" : "error");
    return '<span class="loc-badge loc-badge-' + clase + '">' + escapar(e || "pendiente") + "</span>";
  }

  function filasFiltradas() {
    var q = normalizar(estado.buscar);
    return estado.materias.filter(function (m) {
      if (estado.filtroCarrera && texto(m.carreraId) !== estado.filtroCarrera) return false;
      if (estado.filtroEstado && normalizar(m.estadoValidacion) !== estado.filtroEstado) return false;
      if (!q) return true;
      return normalizar([m.nombre, m.codigo, m.nivelNombre, m.estadoValidacion].join(" ")).indexOf(q) !== -1;
    });
  }

  function pintarCarreras() {
    var select = $("locFiltroCarrera");
    if (!select) return;
    select.innerHTML = '<option value="">Todas las carreras</option>' + estado.carreras.map(function (c) {
      return '<option value="' + escapar(c.id) + '">' + escapar(c.nombre) + "</option>";
    }).join("");
    select.value = estado.filtroCarrera;
  }

  function pintarTabla() {
    var tbody = $("locTabla");
    if (!tbody) return;
    var filas = filasFiltradas();
    if (!filas.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="loc-empty">No hay materias con los filtros seleccionados.</td></tr>';
      return;
    }

    tbody.innerHTML = filas.map(function (m) {
      var carrera = carreraPorId(m.carreraId);
      var nivel = nivelPorId(m.nivelId);
      var persistencia = m.persistenciaPEA || {};
      return "<tr>" +
        "<td>" + escapar((carrera && carrera.nombre) || m.carreraNombre || "") + "</td>" +
        "<td>" + escapar((nivel && nivel.nombre) || m.nivelNombre || m.nivelNumero || "") + "</td>" +
        "<td><code>" + escapar(m.codigo || "S/C") + "</code></td>" +
        "<td><strong>" + escapar(m.nombre || "") + "</strong></td>" +
        "<td>" + badge(m.estadoValidacion) + "</td>" +
        "<td>" + (persistencia.baseGuardada === true ? "Sí" : "—") + "</td>" +
        "<td>" + escapar(persistencia.unidadesGuardadas || 0) + "</td>" +
        "<td>" + escapar(persistencia.actividadesGuardadas || 0) + "</td>" +
        '<td><button class="loc-mini" data-local-materia="' + escapar(m.id) + '">Ver</button></td>' +
      "</tr>";
    }).join("");
  }

  async function cargar() {
    if (!Local || !Local.Core || !Local.Schema) {
      pintarEstado("error", "Base local no disponible", "No se cargaron los módulos IndexedDB.");
      return;
    }

    try {
      pintarEstado("warn", "Leyendo base local", "Consultando datos guardados en este equipo.");
      await Local.inicializar();
      var resultados = await Promise.all([
        Local.obtenerResumenGeneral(),
        Local.Core.getAll(Local.Schema.STORES.CARRERAS),
        Local.Core.getAll(Local.Schema.STORES.NIVELES),
        Local.Core.getAll(Local.Schema.STORES.MATERIAS)
      ]);
      var resumen = resultados[0];
      estado.carreras = resultados[1].sort(function (a, b) { return texto(a.nombre).localeCompare(texto(b.nombre), "es"); });
      estado.niveles = resultados[2];
      estado.materias = resultados[3].sort(function (a, b) {
        var ca = carreraPorId(a.carreraId); var cb = carreraPorId(b.carreraId);
        var ordenCarrera = texto(ca && ca.nombre).localeCompare(texto(cb && cb.nombre), "es");
        if (ordenCarrera) return ordenCarrera;
        var na = Number(a.nivelNumero || 0); var nb = Number(b.nivelNumero || 0);
        return na - nb || texto(a.nombre).localeCompare(texto(b.nombre), "es");
      });

      setTexto("locCarreras", resumen.totalCarreras);
      setTexto("locNiveles", resumen.totalNiveles);
      setTexto("locMaterias", resumen.totalMaterias);
      setTexto("locCompletas", resumen.materiasCompletas);
      setTexto("locIncompletas", resumen.materiasIncompletas);
      setTexto("locArchivos", resumen.totalArchivosPEA);
      pintarCarreras();
      pintarTabla();
      pintarEstado("ok", "Base local lista", "Los datos mostrados provienen de IndexedDB y no consumen lecturas de Firebase.");
    } catch (error) {
      pintarEstado("error", "No se pudo abrir la base local", error && error.message ? error.message : error);
    }
  }

  function renderUnidades(unidades) {
    if (!unidades.length) return '<p class="loc-muted">Sin unidades guardadas.</p>';
    return unidades.map(function (u) {
      return '<article class="loc-card"><h4>Unidad ' + escapar(u.unidadNumero || "") + '</h4><p>' + escapar(u.temaDetectado || u.titulo || (u.contenidos || []).join(" · ")) + '</p></article>';
    }).join("");
  }

  async function abrirDetalle(materiaId) {
    var modal = $("localModal");
    var titulo = $("localModalTitulo");
    var contenido = $("localModalContenido");
    if (!modal || !contenido || !titulo) return;
    titulo.textContent = "Cargando...";
    contenido.innerHTML = '<p class="loc-muted">Leyendo IndexedDB.</p>';
    if (typeof modal.showModal === "function") modal.showModal();

    try {
      var detalle = await Local.obtenerPEACompleto(materiaId);
      var m = detalle.materia || {};
      var carrera = carreraPorId(m.carreraId);
      var nivel = nivelPorId(m.nivelId);
      titulo.textContent = (m.codigo ? m.codigo + " · " : "") + (m.nombre || "Materia");
      contenido.innerHTML =
        '<div class="loc-grid">' +
          '<div><span>Carrera</span><strong>' + escapar((carrera && carrera.nombre) || m.carreraNombre || "") + '</strong></div>' +
          '<div><span>Nivel</span><strong>' + escapar((nivel && nivel.nombre) || m.nivelNombre || "") + '</strong></div>' +
          '<div><span>Estado</span><strong>' + escapar(m.estadoValidacion || "pendiente") + '</strong></div>' +
          '<div><span>Archivos PEA</span><strong>' + escapar((detalle.archivos || []).length) + '</strong></div>' +
        '</div>' +
        '<h3>PEA Base</h3><article class="loc-card"><p><b>Descripción:</b> ' + escapar(detalle.base && (detalle.base.descripcion || detalle.base.datos && detalle.base.datos.descripcion)) + '</p><p><b>Objetivo:</b> ' + escapar(detalle.base && (detalle.base.objetivo || detalle.base.datos && detalle.base.datos.objetivo)) + '</p></article>' +
        '<h3>Unidades</h3>' + renderUnidades(detalle.unidades || []) +
        '<h3>Actividades</h3><p>' + escapar((detalle.actividades || []).length) + ' actividades guardadas.</p>' +
        '<h3>Validaciones</h3><p>' + escapar((detalle.validaciones || []).length) + ' observaciones registradas.</p>';
    } catch (error) {
      contenido.innerHTML = '<p class="loc-muted">' + escapar(error && error.message ? error.message : error) + '</p>';
    }
  }

  async function exportar() {
    try {
      var data = await Local.exportarJSON();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "curriculo-base-local-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (error) {
      pintarEstado("error", "No se pudo exportar", error && error.message ? error.message : error);
    }
  }

  document.addEventListener("change", function (event) {
    if (event.target.id === "locFiltroCarrera") { estado.filtroCarrera = event.target.value; pintarTabla(); }
    if (event.target.id === "locFiltroEstado") { estado.filtroEstado = event.target.value; pintarTabla(); }
  });
  document.addEventListener("input", function (event) {
    if (event.target.id === "locBuscar") { estado.buscar = event.target.value; pintarTabla(); }
  });
  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest("[data-local-materia]");
    if (btn) abrirDetalle(btn.getAttribute("data-local-materia"));
    if (event.target.id === "btnRecargarLocal") cargar();
    if (event.target.id === "btnExportarLocal") exportar();
    if (event.target.id === "localModalCerrar" && $("localModal")) $("localModal").close();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cargar, { once: true });
  else cargar();
})(window, document);