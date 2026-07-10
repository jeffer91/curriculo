/* =========================================================
Nombre completo: subir.preview.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.preview.js
Función o funciones:
- Pintar la vista previa del ZIP antes de importar a BDLocal.
- Mostrar resumen de carreras, niveles, materias, archivos y validaciones.
- Renderizar tabla de materias con estado de PEA Base, PEA Unidades y PEA Actividades.
- Mostrar detalle de una materia y sus archivos detectados.
- Permitir filtrar visualmente los resultados antes de guardar.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;

  var estadoActual = {
    paquete: null,
    filasTabla: [],
    filtro: ""
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setHTML(id, html) {
    var el = $(id);
    if (el) el.innerHTML = html;
  }

  function setTexto(id, valor) {
    var el = $(id);
    if (el) el.textContent = texto(valor);
  }

  function mostrar(id, visible) {
    var el = $(id);
    if (!el) return;

    if (visible) {
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "hidden");
    }
  }

  function claseEstado(estado) {
    if (estado === "completo" || estado === "ok" || estado === "validado") return "ok";
    if (estado === "incompleto" || estado === "error" || estado === "critico") return "error";
    if (estado === "revision" || estado === "advertencia" || estado === "con_observaciones") return "warn";
    return "neutral";
  }

  function badge(valor, tipo) {
    return '<span class="subir-badge subir-badge-' + claseEstado(tipo || valor) + '">' + escapar(valor) + "</span>";
  }

  function badgeSiNo(valor) {
    return valor
      ? '<span class="subir-badge subir-badge-ok">Sí</span>'
      : '<span class="subir-badge subir-badge-error">No</span>';
  }

  function nombreTipo(tipo) {
    if (NS.DetectorArchivos && typeof NS.DetectorArchivos.nombreTipo === "function") {
      return NS.DetectorArchivos.nombreTipo(tipo);
    }

    if (tipo === "pea_base") return "PEA Base";
    if (tipo === "pea_unidades") return "PEA Unidades";
    if (tipo === "pea_actividades") return "PEA Actividades";

    return "No identificado";
  }

  function agruparArchivosPorMateria(archivos) {
    var mapa = {};

    (archivos || []).forEach(function (archivo) {
      var materiaId = archivo.materiaId || "sin_materia";

      if (!mapa[materiaId]) {
        mapa[materiaId] = [];
      }

      mapa[materiaId].push(archivo);
    });

    return mapa;
  }

  function obtenerCarrera(paquete, carreraId) {
    return (paquete.carreras || []).find(function (carrera) {
      return carrera.id === carreraId;
    }) || null;
  }

  function obtenerNivel(paquete, nivelId) {
    return (paquete.niveles || []).find(function (nivel) {
      return nivel.id === nivelId;
    }) || null;
  }

  function resumenArchivos(archivos) {
    archivos = archivos || [];

    return {
      total: archivos.length,
      base: archivos.some(function (archivo) {
        return archivo.tipo === "pea_base";
      }),
      unidades: archivos.some(function (archivo) {
        return archivo.tipo === "pea_unidades";
      }),
      actividades: archivos.some(function (archivo) {
        return archivo.tipo === "pea_actividades";
      }),
      noIdentificados: archivos.filter(function (archivo) {
        return !archivo.tipo;
      }).length,
      revision: archivos.filter(function (archivo) {
        return archivo.estado === "revision" || Number(archivo.confianza || 0) < 70;
      }).length
    };
  }

  function construirFilasTabla(paquete) {
    var archivosPorMateria = agruparArchivosPorMateria(paquete.archivos || []);

    return (paquete.materias || []).map(function (materia) {
      var carrera = obtenerCarrera(paquete, materia.carreraId);
      var nivel = obtenerNivel(paquete, materia.nivelId);
      var archivosMateria = archivosPorMateria[materia.id] || [];
      var r = resumenArchivos(archivosMateria);

      return {
        carreraId: materia.carreraId,
        carrera: carrera ? carrera.nombre : materia.carrera || "",
        nivelId: materia.nivelId,
        nivel: nivel ? nivel.nombre : materia.nivel || "",
        numeroNivel: nivel ? nivel.numero : materia.numeroNivel || 0,
        materiaId: materia.id,
        codigo: materia.codigo || "",
        materia: materia.nombre || "",
        estado: materia.estadoValidacion || "pendiente",
        peaBase: r.base,
        peaUnidades: r.unidades,
        peaActividades: r.actividades,
        totalArchivos: r.total,
        noIdentificados: r.noIdentificados,
        revision: r.revision,
        confianza: materia.confianza || 0
      };
    });
  }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("subirEstado");
    if (!el) return;

    el.className = "subir-status subir-status-" + claseEstado(tipo);
    el.innerHTML =
      '<div class="subir-status-dot"></div>' +
      '<div>' +
        '<strong>' + escapar(titulo) + '</strong>' +
        '<span>' + escapar(mensaje) + '</span>' +
      '</div>';
  }

  function pintarProgreso(data) {
    data = data || {};

    var wrap = $("progresoWrap");
    var bar = $("progresoBar");
    var text = $("progresoTexto");

    if (!wrap || !bar || !text) return;

    var porcentaje = Math.max(0, Math.min(100, Number(data.porcentaje || 0)));

    wrap.removeAttribute("hidden");
    bar.style.width = porcentaje + "%";
    text.textContent = data.mensaje || "Procesando...";
  }

  function ocultarProgreso() {
    var wrap = $("progresoWrap");

    if (wrap) {
      wrap.setAttribute("hidden", "hidden");
    }
  }

  function pintarResumen(paquete) {
    var resumen = paquete.resumenValidacion || {};
    var carga = paquete.carga || {};
    var diagnostico = paquete.diagnostico || {};

    setTexto("statCarreras", resumen.totalCarreras || carga.totalCarreras || 0);
    setTexto("statNiveles", resumen.totalNiveles || carga.totalNiveles || 0);
    setTexto("statMaterias", resumen.totalMaterias || carga.totalMaterias || 0);
    setTexto("statArchivos", resumen.totalArchivos || carga.totalArchivos || 0);
    setTexto("statCompletas", resumen.materiasCompletas || carga.materiasCompletas || 0);
    setTexto(
      "statObservaciones",
      resumen.totalValidaciones || diagnostico.totalAdvertencias || 0
    );

    var titulo = "ZIP analizado";
    var mensaje = "La información fue clasificada y está lista para revisión.";

    if (resumen.bloqueaImportacion) {
      titulo = "ZIP con errores críticos";
      mensaje = "Hay errores que deben corregirse antes de importar.";
      pintarEstado("error", titulo, mensaje);
    } else if (resumen.requiereRevision) {
      titulo = "ZIP con observaciones";
      mensaje = "Puedes revisar las observaciones o importar con revisión.";
      pintarEstado("warn", titulo, mensaje);
    } else {
      titulo = "ZIP listo para importar";
      mensaje = "Todas las materias detectadas tienen los 3 Excel obligatorios.";
      pintarEstado("ok", titulo, mensaje);
    }
  }

  function pintarTabla(filas) {
    var tbody = $("tablaPreview");

    if (!tbody) return;

    if (!filas.length) {
      tbody.innerHTML =
        '<tr>' +
          '<td colspan="10" class="subir-empty">No hay materias para mostrar.</td>' +
        '</tr>';
      return;
    }

    tbody.innerHTML = filas.map(function (fila) {
      return (
        '<tr>' +
          '<td>' + escapar(fila.carrera) + '</td>' +
          '<td>' + escapar(fila.nivel) + '</td>' +
          '<td><code>' + escapar(fila.codigo || "S/C") + '</code></td>' +
          '<td><strong>' + escapar(fila.materia) + '</strong></td>' +
          '<td>' + badgeSiNo(fila.peaBase) + '</td>' +
          '<td>' + badgeSiNo(fila.peaUnidades) + '</td>' +
          '<td>' + badgeSiNo(fila.peaActividades) + '</td>' +
          '<td>' + badge(fila.estado, fila.estado) + '</td>' +
          '<td>' + escapar(fila.totalArchivos) + '</td>' +
          '<td><button class="subir-mini-btn" type="button" data-detalle-materia="' + escapar(fila.materiaId) + '">Ver</button></td>' +
        '</tr>'
      );
    }).join("");
  }

  function aplicarFiltro() {
    var q = normalizar(estadoActual.filtro);

    if (!q) {
      pintarTabla(estadoActual.filasTabla);
      return;
    }

    var filtradas = estadoActual.filasTabla.filter(function (fila) {
      var textoFila = [
        fila.carrera,
        fila.nivel,
        fila.codigo,
        fila.materia,
        fila.estado
      ].join(" ");

      return normalizar(textoFila).includes(q);
    });

    pintarTabla(filtradas);
  }

  function pintarValidaciones(paquete) {
    var validaciones = paquete.validacionesSubida || [];
    var cont = $("listaValidaciones");

    if (!cont) return;

    if (!validaciones.length) {
      cont.innerHTML = '<p class="subir-muted">Sin observaciones detectadas.</p>';
      return;
    }

    cont.innerHTML = validaciones.slice(0, 80).map(function (validacion) {
      return (
        '<div class="subir-validation subir-validation-' + claseEstado(validacion.severidad) + '">' +
          '<div>' +
            '<strong>' + escapar(validacion.tipo || "validacion") + '</strong>' +
            '<span>' + escapar(validacion.mensaje || "") + '</span>' +
          '</div>' +
          badge(validacion.severidad || "info", validacion.severidad || "info") +
        '</div>'
      );
    }).join("");
  }

  function pintarCarrerasYNiveles(paquete) {
    var cont = $("listaEstructura");

    if (!cont) return;

    var carreras = paquete.carreras || [];
    var niveles = paquete.niveles || [];
    var materias = paquete.materias || [];

    if (!carreras.length) {
      cont.innerHTML = '<p class="subir-muted">No se detectó estructura curricular.</p>';
      return;
    }

    cont.innerHTML = carreras.map(function (carrera) {
      var nivelesCarrera = niveles.filter(function (nivel) {
        return nivel.carreraId === carrera.id;
      });

      return (
        '<div class="subir-tree-item">' +
          '<strong>' + escapar(carrera.nombre) + '</strong>' +
          '<span>Confianza: ' + escapar(carrera.confianza || 0) + '%</span>' +
          '<div class="subir-tree-levels">' +
            nivelesCarrera.map(function (nivel) {
              var totalMaterias = materias.filter(function (materia) {
                return materia.nivelId === nivel.id;
              }).length;

              return (
                '<div>' +
                  '<b>' + escapar(nivel.nombre) + '</b>' +
                  '<small>' + escapar(totalMaterias) + ' materias · Confianza: ' + escapar(nivel.confianza || 0) + '%</small>' +
                '</div>'
              );
            }).join("") +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function abrirDetalleMateria(materiaId) {
    var paquete = estadoActual.paquete;

    if (!paquete) return;

    var materia = (paquete.materias || []).find(function (m) {
      return m.id === materiaId;
    });

    if (!materia) return;

    var carrera = obtenerCarrera(paquete, materia.carreraId);
    var nivel = obtenerNivel(paquete, materia.nivelId);
    var archivos = (paquete.archivos || []).filter(function (archivo) {
      return archivo.materiaId === materiaId;
    });

    var validaciones = (paquete.validacionesSubida || []).filter(function (validacion) {
      return validacion.materiaId === materiaId;
    });

    var modal = $("modalDetalle");
    var titulo = $("modalTitulo");
    var contenido = $("modalContenido");

    if (!modal || !titulo || !contenido) return;

    titulo.textContent = (materia.codigo ? materia.codigo + " · " : "") + materia.nombre;

    contenido.innerHTML =
      '<div class="subir-detail-grid">' +
        '<div><span>Carrera</span><strong>' + escapar(carrera ? carrera.nombre : "") + '</strong></div>' +
        '<div><span>Nivel</span><strong>' + escapar(nivel ? nivel.nombre : "") + '</strong></div>' +
        '<div><span>Estado</span><strong>' + escapar(materia.estadoValidacion || "pendiente") + '</strong></div>' +
        '<div><span>Confianza materia</span><strong>' + escapar(materia.confianza || 0) + '%</strong></div>' +
      '</div>' +

      '<h3>Archivos detectados</h3>' +
      (
        archivos.length
          ? '<div class="subir-file-list">' + archivos.map(function (archivo) {
              return (
                '<div class="subir-file-item">' +
                  '<strong>' + escapar(archivo.nombreArchivo || "") + '</strong>' +
                  '<span>' + escapar(nombreTipo(archivo.tipo)) + ' · ' + escapar(archivo.confianza || 0) + '% · ' + escapar(archivo.estado || "") + '</span>' +
                  '<small>' + escapar(archivo.rutaOriginal || "") + '</small>' +
                '</div>'
              );
            }).join("") + '</div>'
          : '<p class="subir-muted">No hay archivos asociados.</p>'
      ) +

      '<h3>Observaciones de esta materia</h3>' +
      (
        validaciones.length
          ? '<div class="subir-file-list">' + validaciones.map(function (validacion) {
              return (
                '<div class="subir-file-item">' +
                  '<strong>' + escapar(validacion.tipo || "") + '</strong>' +
                  '<span>' + escapar(validacion.severidad || "") + '</span>' +
                  '<small>' + escapar(validacion.mensaje || "") + '</small>' +
                '</div>'
              );
            }).join("") + '</div>'
          : '<p class="subir-muted">Sin observaciones para esta materia.</p>'
      );

    modal.showModal();
  }

  function pintarPaquete(paquete) {
    estadoActual.paquete = paquete;
    estadoActual.filasTabla = construirFilasTabla(paquete);
    estadoActual.filtro = "";

    var inputFiltro = $("buscadorPreview");
    if (inputFiltro) inputFiltro.value = "";

    pintarResumen(paquete);
    pintarTabla(estadoActual.filasTabla);
    pintarValidaciones(paquete);
    pintarCarrerasYNiveles(paquete);

    mostrar("previewPanel", true);
    mostrar("accionesImportacion", true);

    var resumen = paquete.resumenValidacion || {};

    var btnImportar = $("btnImportar");
    var btnImportarObservaciones = $("btnImportarObservaciones");

    if (btnImportar) {
      btnImportar.disabled = resumen.bloqueaImportacion === true || resumen.requiereRevision === true;
    }

    if (btnImportarObservaciones) {
      btnImportarObservaciones.disabled = resumen.bloqueaImportacion === true;
      mostrar("btnImportarObservaciones", resumen.requiereRevision === true && resumen.bloqueaImportacion !== true);
    }
  }

  function limpiarPreview() {
    estadoActual.paquete = null;
    estadoActual.filasTabla = [];
    estadoActual.filtro = "";

    setTexto("statCarreras", "0");
    setTexto("statNiveles", "0");
    setTexto("statMaterias", "0");
    setTexto("statArchivos", "0");
    setTexto("statCompletas", "0");
    setTexto("statObservaciones", "0");

    setHTML(
      "tablaPreview",
      '<tr><td colspan="10" class="subir-empty">Sube un ZIP para ver la clasificación.</td></tr>'
    );

    setHTML("listaValidaciones", '<p class="subir-muted">Sin observaciones todavía.</p>');
    setHTML("listaEstructura", '<p class="subir-muted">Sin estructura detectada todavía.</p>');

    mostrar("previewPanel", false);
    mostrar("accionesImportacion", false);
    ocultarProgreso();

    pintarEstado("neutral", "Esperando ZIP", "Selecciona un archivo .zip para iniciar la lectura.");
  }

  function mostrarResultadoImportacion(resultado) {
    var resumen = resultado && resultado.resumen ? resultado.resumen : resultado && resultado.resultado && resultado.resultado.resumen ? resultado.resultado.resumen : null;

    if (!resumen) {
      pintarEstado("ok", "Importación completada", "La información fue guardada en BDLocal.");
      return;
    }

    pintarEstado(
      "ok",
      "Importación completada",
      "Carreras: " + (resumen.totalCarreras || 0) +
        " · Materias: " + (resumen.totalMaterias || 0) +
        " · Completas: " + (resumen.materiasCompletas || 0)
    );
  }

  function conectarEventosUI() {
    var inputFiltro = $("buscadorPreview");

    if (inputFiltro && !inputFiltro.__subirPreviewBound) {
      inputFiltro.__subirPreviewBound = true;
      inputFiltro.addEventListener("input", function () {
        estadoActual.filtro = inputFiltro.value;
        aplicarFiltro();
      });
    }

    var tabla = $("tablaPreview");

    if (tabla && !tabla.__subirPreviewBound) {
      tabla.__subirPreviewBound = true;
      tabla.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-detalle-materia]");
        if (!btn) return;

        abrirDetalleMateria(btn.getAttribute("data-detalle-materia"));
      });
    }

    var btnCerrar = $("btnCerrarModal");

    if (btnCerrar && !btnCerrar.__subirPreviewBound) {
      btnCerrar.__subirPreviewBound = true;
      btnCerrar.addEventListener("click", function () {
        var modal = $("modalDetalle");
        if (modal) modal.close();
      });
    }
  }

  NS.Preview = {
    pintarEstado: pintarEstado,
    pintarProgreso: pintarProgreso,
    ocultarProgreso: ocultarProgreso,
    pintarPaquete: pintarPaquete,
    limpiarPreview: limpiarPreview,
    mostrarResultadoImportacion: mostrarResultadoImportacion,
    conectarEventosUI: conectarEventosUI,
    abrirDetalleMateria: abrirDetalleMateria,
    construirFilasTabla: construirFilasTabla
  };
})(window, document);