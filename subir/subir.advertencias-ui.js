/* =========================================================
Nombre completo: subir.advertencias-ui.js
Ruta o ubicación: /Curriculo/subir/subir.advertencias-ui.js
Funciones:
- Añadir el botón "Ver advertencia" a las materias que requieren revisión.
- Mostrar problema, solución, acción, impacto y archivo afectado en el modal.
- Diferenciar la revisión de advertencias del detalle general de archivos.
- Mantener los botones después de buscar o volver a pintar la tabla.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "3.0.0";
  var paqueteActual = null;
  var observerTabla = null;
  var decorando = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function obtenerMateria(paquete, materiaId) {
    return arr(paquete && paquete.materias).find(function (materia) {
      return materia && materia.id === materiaId;
    }) || null;
  }

  function obtenerCarrera(paquete, carreraId) {
    return arr(paquete && paquete.carreras).find(function (carrera) {
      return carrera && carrera.id === carreraId;
    }) || null;
  }

  function obtenerNivel(paquete, nivelId) {
    return arr(paquete && paquete.niveles).find(function (nivel) {
      return nivel && nivel.id === nivelId;
    }) || null;
  }

  function validacionesMateria(paquete, materiaId) {
    return arr(paquete && paquete.validacionesSubida).filter(function (validacion) {
      return validacion && validacion.materiaId === materiaId;
    });
  }

  function claseSeveridad(severidad) {
    severidad = texto(severidad).toLowerCase();
    if (severidad === "critico" || severidad === "error") return "error";
    if (severidad === "advertencia" || severidad === "revision") return "warn";
    return "info";
  }

  function etiquetaSeveridad(severidad) {
    severidad = texto(severidad).toLowerCase();
    if (severidad === "critico") return "Crítico";
    if (severidad === "error") return "Error";
    if (severidad === "advertencia") return "Advertencia";
    return severidad ? severidad.charAt(0).toUpperCase() + severidad.slice(1) : "Información";
  }

  function diagnosticoDe(validacion) {
    validacion = validacion || {};
    var diagnostico = validacion.diagnosticoUsuario || {};
    var archivo = diagnostico.archivo || null;

    if (!archivo && (validacion.archivoAfectado || validacion.rutaArchivo)) {
      archivo = {
        nombre: validacion.archivoAfectado || "",
        ruta: validacion.rutaArchivo || "",
        tipo: "",
        motivo: ""
      };
    }

    return {
      codigo: texto(diagnostico.codigo || validacion.tipo || "general"),
      titulo: texto(diagnostico.titulo || validacion.titulo || "Observación detectada"),
      problema: texto(diagnostico.problema || validacion.mensaje || "La materia requiere revisión."),
      solucion: texto(diagnostico.solucion || validacion.solucion || "Revisa el contenido señalado y vuelve a escanear."),
      accion: texto(diagnostico.accionRecomendada || validacion.accionRecomendada || "Corregir y volver a escanear."),
      impacto: texto(diagnostico.impacto || "Requiere revisión."),
      severidad: texto(diagnostico.severidad || validacion.severidad || "info"),
      bloquea: diagnostico.bloqueaImportacion === true || validacion.bloqueaImportacion === true,
      puedeImportar: typeof diagnostico.puedeImportar === "boolean"
        ? diagnostico.puedeImportar
        : validacion.bloqueaImportacion !== true,
      archivo: archivo
    };
  }

  function renderDetallesAdicionales(validacion) {
    var detalle = validacion && validacion.detalle;
    var items = [];

    if (detalle && !Array.isArray(detalle)) {
      arr(detalle.faltantes).forEach(function (item) {
        items.push("Archivo faltante: " + texto(item));
      });
      arr(detalle.tiposSinContenido).forEach(function (item) {
        items.push("Sin contenido válido: " + texto(item));
      });
    }

    if (Array.isArray(detalle)) {
      detalle.forEach(function (item) {
        arr(item && item.observaciones).forEach(function (observacion) {
          items.push(texto(observacion));
        });
        if (item && Array.isArray(item.archivos)) {
          items.push((texto(item.tipo) || "Archivos relacionados") + ": " + item.archivos.join(", "));
        }
      });
    }

    if (!items.length) return "";

    return (
      '<div class="subir-fix-extra">' +
        '<strong>Detalle detectado</strong>' +
        '<ul>' + items.map(function (item) {
          return '<li>' + escapar(item) + '</li>';
        }).join("") + '</ul>' +
      '</div>'
    );
  }

  function renderArchivo(diagnostico) {
    var archivo = diagnostico.archivo;
    if (!archivo || (!texto(archivo.nombre) && !texto(archivo.ruta))) return "";

    return (
      '<div class="subir-fix-file">' +
        '<span>Archivo afectado</span>' +
        (texto(archivo.nombre) ? '<strong>' + escapar(archivo.nombre) + '</strong>' : "") +
        (texto(archivo.tipo) ? '<small><b>Tipo:</b> ' + escapar(archivo.tipo) + '</small>' : "") +
        (texto(archivo.motivo) ? '<small><b>Motivo:</b> ' + escapar(archivo.motivo) + '</small>' : "") +
        (texto(archivo.ruta) ? '<small><b>Ruta:</b> ' + escapar(archivo.ruta) + '</small>' : "") +
      '</div>'
    );
  }

  function renderValidacion(validacion, indice) {
    var diagnostico = diagnosticoDe(validacion);
    var clase = claseSeveridad(diagnostico.severidad);

    return (
      '<article class="subir-fix-card subir-fix-card-' + clase + '">' +
        '<div class="subir-fix-head">' +
          '<div>' +
            '<span class="subir-fix-order">Observación ' + escapar(Number(indice || 0) + 1) + '</span>' +
            '<h3>' + escapar(diagnostico.titulo) + '</h3>' +
          '</div>' +
          '<span class="subir-fix-severity subir-fix-severity-' + clase + '">' + escapar(etiquetaSeveridad(diagnostico.severidad)) + '</span>' +
        '</div>' +
        '<div class="subir-fix-block subir-fix-problem">' +
          '<span>Qué ocurrió</span>' +
          '<p>' + escapar(diagnostico.problema) + '</p>' +
        '</div>' +
        renderArchivo(diagnostico) +
        renderDetallesAdicionales(validacion) +
        '<div class="subir-fix-block subir-fix-solution">' +
          '<span>Cómo corregirlo</span>' +
          '<p>' + escapar(diagnostico.solucion) + '</p>' +
        '</div>' +
        '<div class="subir-fix-block subir-fix-action">' +
          '<span>Acción recomendada</span>' +
          '<p>' + escapar(diagnostico.accion) + '</p>' +
        '</div>' +
        '<div class="subir-fix-impact ' + (diagnostico.bloquea ? "subir-fix-impact-block" : "") + '">' +
          '<strong>' + (diagnostico.bloquea ? "No se puede importar todavía" : "Se puede importar con observaciones") + '</strong>' +
          '<span>' + escapar(diagnostico.impacto) + '</span>' +
        '</div>' +
      '</article>'
    );
  }

  function abrirModal(tituloTexto, subtitulo, validaciones) {
    var modal = $("modalDetalle");
    var titulo = $("modalTitulo");
    var contenido = $("modalContenido");

    if (!modal || !titulo || !contenido) return false;

    titulo.textContent = tituloTexto || "Advertencias";
    contenido.innerHTML =
      '<div class="subir-fix-intro">' +
        '<strong>Diagnóstico y corrección</strong>' +
        '<span>' + escapar(subtitulo || "Revisa las observaciones antes de importar.") + '</span>' +
      '</div>' +
      '<div class="subir-fix-list">' + validaciones.map(function (validacion, indice) {
        return renderValidacion(validacion, indice);
      }).join("") + '</div>';

    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "open");

    return true;
  }

  function abrirMateria(materiaId) {
    var paquete = paqueteActual;
    if (!paquete) return false;

    var materia = obtenerMateria(paquete, materiaId);
    if (!materia) return false;

    var carrera = obtenerCarrera(paquete, materia.carreraId) || {};
    var nivel = obtenerNivel(paquete, materia.nivelId) || {};
    var validaciones = validacionesMateria(paquete, materiaId);

    if (!validaciones.length) {
      validaciones = [{
        tipo: "revision_sin_detalle",
        severidad: "advertencia",
        bloqueaImportacion: false,
        titulo: "Materia pendiente de revisión",
        mensaje: "La materia figura en revisión, pero no tiene una explicación específica.",
        solucion: "Revisa los tres archivos PEA de esta materia y vuelve a escanear.",
        accionRecomendada: "Abrir los archivos PEA y confirmar su contenido."
      }];
    }

    return abrirModal(
      (materia.codigo ? materia.codigo + " · " : "") + (materia.nombre || "Materia"),
      [carrera.nombre, nivel.nombre].filter(Boolean).join(" · "),
      validaciones
    );
  }

  function abrirValidacion(indice) {
    var validaciones = arr(paqueteActual && paqueteActual.validacionesSubida);
    var validacion = validaciones[Number(indice)];
    if (!validacion) return false;

    var materia = obtenerMateria(paqueteActual, validacion.materiaId) || {};
    return abrirModal(
      (materia.codigo ? materia.codigo + " · " : "") + (materia.nombre || validacion.materia || "Advertencia"),
      "Se muestra la causa detectada y la forma recomendada de corregirla.",
      [validacion]
    );
  }

  function decorarTabla(paquete) {
    if (decorando) return;
    decorando = true;

    try {
      var botones = document.querySelectorAll("#tablaPreview [data-detalle-materia]");

      Array.prototype.forEach.call(botones, function (boton) {
        var materiaId = boton.getAttribute("data-detalle-materia");
        var celda = boton.parentElement;
        var validaciones = validacionesMateria(paquete, materiaId);
        var materia = obtenerMateria(paquete, materiaId) || {};
        var estado = texto(materia.estadoValidacion).toLowerCase();
        var requiereRevision = validaciones.length > 0 || (estado && estado !== "completo");

        boton.textContent = "Ver archivos";
        boton.classList.add("subir-mini-btn-secondary");

        if (!celda || !requiereRevision || celda.querySelector("[data-advertencia-materia]")) return;

        var btnAdvertencia = document.createElement("button");
        btnAdvertencia.type = "button";
        btnAdvertencia.className = "subir-mini-btn subir-mini-btn-warning";
        btnAdvertencia.setAttribute("data-advertencia-materia", materiaId);
        btnAdvertencia.textContent = validaciones.length > 1
          ? "Ver " + validaciones.length + " advertencias"
          : "Ver advertencia";

        celda.classList.add("subir-row-actions");
        celda.appendChild(btnAdvertencia);
      });
    } finally {
      decorando = false;
    }
  }

  function decorarListaValidaciones(paquete) {
    var tarjetas = document.querySelectorAll("#listaValidaciones .subir-validation");
    var validaciones = arr(paquete && paquete.validacionesSubida).slice(0, 80);

    Array.prototype.forEach.call(tarjetas, function (tarjeta, indice) {
      if (!validaciones[indice] || tarjeta.querySelector("[data-advertencia-indice]")) return;

      var boton = document.createElement("button");
      boton.type = "button";
      boton.className = "subir-fix-open-btn";
      boton.setAttribute("data-advertencia-indice", String(indice));
      boton.textContent = "Ver cómo corregir";
      tarjeta.appendChild(boton);
    });
  }

  function decorar(paquete) {
    paqueteActual = paquete || paqueteActual;
    if (!paqueteActual) return;
    decorarTabla(paqueteActual);
    decorarListaValidaciones(paqueteActual);
  }

  function observarTabla() {
    var tabla = $("tablaPreview");
    if (!tabla || typeof window.MutationObserver !== "function") return;
    if (observerTabla) observerTabla.disconnect();

    observerTabla = new window.MutationObserver(function () {
      window.setTimeout(function () {
        decorar(paqueteActual);
      }, 0);
    });

    observerTabla.observe(tabla, { childList: true, subtree: true });
  }

  function conectarEventos() {
    document.addEventListener("click", function (event) {
      var btnMateria = event.target.closest("[data-advertencia-materia]");
      if (btnMateria) {
        event.preventDefault();
        event.stopPropagation();
        abrirMateria(btnMateria.getAttribute("data-advertencia-materia"));
        return;
      }

      var btnValidacion = event.target.closest("[data-advertencia-indice]");
      if (btnValidacion) {
        event.preventDefault();
        event.stopPropagation();
        abrirValidacion(btnValidacion.getAttribute("data-advertencia-indice"));
      }
    });

    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "buscadorPreview") {
        window.setTimeout(function () {
          decorar(paqueteActual);
        }, 0);
      }
    });
  }

  function instalar() {
    if (!NS.Preview || typeof NS.Preview.pintarPaquete !== "function") {
      throw new Error("subir.advertencias-ui.js requiere subir.preview.js cargado previamente.");
    }

    if (NS.Preview.__advertenciasUI === true) return;

    var pintarOriginal = NS.Preview.pintarPaquete;
    var limpiarOriginal = NS.Preview.limpiarPreview;

    NS.Preview.pintarPaquete = function (paquete) {
      paqueteActual = paquete;
      var resultado = pintarOriginal.apply(NS.Preview, arguments);
      decorar(paquete);
      observarTabla();
      return resultado;
    };

    NS.Preview.limpiarPreview = function () {
      paqueteActual = null;
      if (observerTabla) observerTabla.disconnect();
      return limpiarOriginal.apply(NS.Preview, arguments);
    };

    NS.Preview.__advertenciasUI = true;
    conectarEventos();
  }

  NS.AdvertenciasUI = {
    VERSION: VERSION,
    instalar: instalar,
    decorar: decorar,
    abrirMateria: abrirMateria,
    abrirValidacion: abrirValidacion,
    renderValidacion: renderValidacion,
    diagnosticoDe: diagnosticoDe
  };

  instalar();
})(window, document);
