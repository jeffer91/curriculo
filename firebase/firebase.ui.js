/* =========================================================
Nombre completo: firebase.ui.js
Ruta o ubicación: /Curriculo/firebase/firebase.ui.js
Funciones:
- Mostrar el estado de Firestore, carreras, materias y versiones.
- Filtrar materias por carrera, nivel, estado, nombre o código.
- Mostrar el detalle curricular y el historial de cambios de cada materia.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var estado = { carreras: [], materias: [], carreraId: "", filtro: "" };

  function $(id) { return document.getElementById(id); }
  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function escapar(v) {
    return texto(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function normalizar(v) {
    return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function fecha(v) {
    if (!v) return "—";
    var d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-EC");
  }
  function setTexto(id, valor) { var el = $(id); if (el) el.textContent = texto(valor); }
  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("fbEstado");
    if (!el) return;
    el.className = "fb-status fb-status-" + tipo;
    el.innerHTML = "<strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span>";
  }
  function estadoBadge(materia) {
    var e = texto(materia.estadoValidacion).toLowerCase();
    var clase = materia.activo === false ? "off" : (["completo", "completa"].includes(e) ? "ok" : (["revision", "advertencia"].includes(e) ? "warn" : "error"));
    var label = materia.activo === false ? "Retirada" : (e || "pendiente");
    return '<span class="fb-badge fb-badge-' + clase + '">' + escapar(label) + "</span>";
  }

  async function cargarDashboard() {
    var d = await Firebase.obtenerDashboard();
    setTexto("statCarreras", d.carreras);
    setTexto("statMaterias", d.materias);
    setTexto("statCargas", d.cargas);
    setTexto("statVersiones", d.versiones);
    setTexto("statCambios", d.cambios);
  }

  function pintarCarreras() {
    var select = $("selectorCarrera");
    if (!select) return;
    select.innerHTML = '<option value="">Todas las carreras</option>' + estado.carreras.map(function (c) {
      return '<option value="' + escapar(c.id) + '">' + escapar(c.nombre) + "</option>";
    }).join("");
    select.value = estado.carreraId;
  }

  function materiasFiltradas() {
    var q = normalizar(estado.filtro);
    return estado.materias.filter(function (m) {
      if (!q) return true;
      return normalizar([m.nombre, m.codigo, m.nivelNombre, m.estadoValidacion, m.versionActual].join(" ")).includes(q);
    });
  }

  function pintarMaterias() {
    var tbody = $("tablaMaterias");
    var lista = materiasFiltradas();
    setTexto("statMostradas", lista.length);
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="fb-empty">No hay materias para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (m) {
      return "<tr>" +
        "<td>" + escapar(m.carreraNombre || "") + "</td>" +
        "<td>" + escapar(m.nivelNombre || m.nivelNumero || "") + "</td>" +
        "<td><code>" + escapar(m.codigo || "S/C") + "</code></td>" +
        "<td><strong>" + escapar(m.nombreMostrar || m.nombre) + "</strong></td>" +
        "<td>" + estadoBadge(m) + "</td>" +
        "<td>v" + escapar(m.versionActual || 1) + "</td>" +
        "<td>" + escapar((m.pea && m.pea.totalUnidades) || 0) + " / " + escapar((m.pea && m.pea.totalActividades) || 0) + "</td>" +
        '<td><button class="fb-mini" data-materia-id="' + escapar(m.id) + '">Ver detalle</button></td>' +
      "</tr>";
    }).join("");
  }

  async function cargarMaterias() {
    pintarEstado("neutral", "Consultando Firestore", "Leyendo materias y versiones vigentes.");
    if (estado.carreraId) {
      estado.materias = await Firebase.obtenerMateriasPorCarrera(estado.carreraId, { soloCompletas: false, incluirRetiradas: true });
    } else {
      var grupos = await Promise.all(estado.carreras.map(function (c) {
        return Firebase.obtenerMateriasPorCarrera(c.id, { soloCompletas: false, incluirRetiradas: true });
      }));
      estado.materias = grupos.reduce(function (total, items) { return total.concat(items); }, []);
    }
    pintarMaterias();
    pintarEstado("ok", "Firebase conectado", "La vista muestra la versión vigente de cada materia.");
  }

  function renderUnidades(unidades) {
    if (!unidades.length) return '<p class="fb-muted">Sin unidades guardadas.</p>';
    return unidades.map(function (u) {
      return '<article class="fb-detail-card"><h4>Unidad ' + escapar(u.unidadNumero) + ': ' + escapar(u.titulo || "") + '</h4>' +
        (u.resultadoAprendizaje ? '<p><b>Resultado:</b> ' + escapar(u.resultadoAprendizaje) + '</p>' : "") +
        '<p><b>Contenidos:</b> ' + escapar((u.contenidos || []).join(" · ")) + '</p></article>';
    }).join("");
  }

  function renderCambios(cambios) {
    if (!cambios.length) return '<p class="fb-muted">Todavía no hay historial de cambios.</p>';
    return cambios.map(function (c) {
      return '<article class="fb-change"><div><strong>v' + escapar(c.versionNueva) + ' · ' + escapar(c.tipoCambio) + '</strong><span>' + escapar(fecha(c.creadoEn)) + '</span></div><p>' + escapar(c.resumen || "") + '</p></article>';
    }).join("");
  }

  async function abrirDetalle(materiaId) {
    var modal = $("modalFirebase");
    var contenido = $("modalFirebaseContenido");
    var titulo = $("modalFirebaseTitulo");
    titulo.textContent = "Cargando materia...";
    contenido.innerHTML = '<p class="fb-muted">Consultando contenido e historial.</p>';
    if (typeof modal.showModal === "function") modal.showModal();

    try {
      var resultados = await Promise.all([
        Firebase.obtenerDetalleMateria(materiaId),
        Firebase.obtenerVersionesMateria(materiaId),
        Firebase.obtenerCambiosMateria(materiaId)
      ]);
      var d = resultados[0];
      var versiones = resultados[1];
      var cambios = resultados[2];
      titulo.textContent = (d.materia.codigo ? d.materia.codigo + " · " : "") + d.materia.nombreMostrar;
      contenido.innerHTML =
        '<div class="fb-detail-grid">' +
          '<div><span>Carrera</span><strong>' + escapar(d.carrera && d.carrera.nombre) + '</strong></div>' +
          '<div><span>Nivel</span><strong>' + escapar(d.nivel && d.nivel.nombre) + '</strong></div>' +
          '<div><span>Versión vigente</span><strong>v' + escapar(d.materia.versionActual || 1) + '</strong></div>' +
          '<div><span>Hash</span><code>' + escapar(d.materia.hashContenido || "") + '</code></div>' +
        '</div>' +
        '<h3>PEA Base</h3>' +
        '<article class="fb-detail-card"><p><b>Descripción:</b> ' + escapar(d.peaBase && d.peaBase.descripcion) + '</p><p><b>Objetivo:</b> ' + escapar(d.peaBase && d.peaBase.objetivo) + '</p></article>' +
        '<h3>Unidades</h3>' + renderUnidades(d.unidades || []) +
        '<h3>Actividades</h3><p>' + escapar((d.actividades || []).length) + ' actividades guardadas.</p>' +
        '<h3>Historial</h3><p class="fb-muted">' + escapar(versiones.length) + ' versiones anteriores conservadas.</p>' + renderCambios(cambios);
    } catch (error) {
      contenido.innerHTML = '<p class="fb-error">' + escapar(error.message || error) + '</p>';
    }
  }

  async function iniciar() {
    if (!Firebase) {
      pintarEstado("error", "Firebase no disponible", "No se cargó el servicio de Firestore.");
      return;
    }
    try {
      pintarEstado("neutral", "Conectando", "Abriendo el proyecto curriculo-ddfcd.");
      await Firebase.ready();
      var conexion = await Firebase.probarConexion();
      if (!conexion.ok) throw new Error(conexion.mensaje);
      await cargarDashboard();
      estado.carreras = await Firebase.obtenerCarreras();
      pintarCarreras();
      await cargarMaterias();
    } catch (error) {
      pintarEstado("error", "No se pudo conectar", error.message || error);
    }
  }

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "selectorCarrera") {
      estado.carreraId = event.target.value;
      cargarMaterias().catch(function (e) { pintarEstado("error", "Error", e.message); });
    }
  });
  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "buscadorMaterias") {
      estado.filtro = event.target.value;
      pintarMaterias();
    }
  });
  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest("[data-materia-id]");
    if (btn) abrirDetalle(btn.getAttribute("data-materia-id"));
    if (event.target && event.target.id === "btnRecargarFirebase") window.location.reload();
    if (event.target && event.target.id === "btnCerrarFirebase") $("modalFirebase").close();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
