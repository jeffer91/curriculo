/* =========================================================
Nombre completo: bdlocal.detalle-rapido.js
Ruta: /Curriculo/bdlocal/bdlocal.detalle-rapido.js
Funciones:
- Abrir el detalle de una materia sin esperar la reparación curricular.
- Leer las tablas de IndexedDB en paralelo.
- Evitar el JSON completo que bloqueaba la interfaz.
- Ejecutar la reparación en segundo plano y actualizar el estado al terminar.
========================================================= */
(function (window, document) {
  "use strict";

  var BD = window.BDLocalCCC;
  var tabla = document.getElementById("tablaMaterias");
  var modal = document.getElementById("modalDetalle");
  var modalTitulo = document.getElementById("modalTitulo");
  var modalContenido = document.getElementById("modalContenido");

  if (!BD || !BD.Core || !BD.Schema || !tabla || !modal || !modalTitulo || !modalContenido) return;

  var S = BD.Schema.STORES;
  var solicitudActual = 0;
  var materiaActiva = "";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    return Array.isArray(valor) ? valor : (valor === null || typeof valor === "undefined" ? [] : [valor]);
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function saltos(valor) {
    return escapar(valor).replace(/\n/g, "<br>");
  }

  function conTiempoLimite(promesa, ms, contexto) {
    return new Promise(function (resolve, reject) {
      var terminada = false;
      var timer = setTimeout(function () {
        if (terminada) return;
        terminada = true;
        reject(new Error("Tiempo agotado: " + contexto));
      }, Number(ms || 12000));

      Promise.resolve(promesa).then(function (resultado) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        resolve(resultado);
      }).catch(function (error) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function obtenerDatosBase(base) {
    base = base || {};
    return base.datos || base;
  }

  function obtenerDescripcion(base) {
    var datos = obtenerDatosBase(base);
    var campos = (base && base.campos) || datos.campos || {};
    return texto(datos.descripcion || base.descripcion || campos.descripcion_asignatura || campos.descripcion);
  }

  function obtenerObjetivo(base) {
    var datos = obtenerDatosBase(base);
    var campos = (base && base.campos) || datos.campos || {};
    return texto(datos.objetivo || base.objetivo || campos.objetivo_asignatura || campos.objetivo);
  }

  function obtenerUnidadesBase(base) {
    var datos = obtenerDatosBase(base);
    return arr(datos.unidadesBase || base.unidadesBase);
  }

  function obtenerBibliografia(base) {
    var datos = obtenerDatosBase(base);
    return arr(datos.bibliografia || base.bibliografia);
  }

  function rutaNumerica(valor) {
    var match = texto(valor).match(/^\s*(\d+(?:\.\d+)*)/);
    return match ? match[1].split(".").map(Number) : null;
  }

  function ordenarContenidos(lista) {
    return arr(lista).map(function (valor, index) {
      return { valor: valor, index: index, ruta: rutaNumerica(valor) };
    }).sort(function (a, b) {
      if (a.ruta && b.ruta) {
        var limite = Math.max(a.ruta.length, b.ruta.length);
        for (var i = 0; i < limite; i += 1) {
          if (i >= a.ruta.length) return -1;
          if (i >= b.ruta.length) return 1;
          if (a.ruta[i] !== b.ruta[i]) return a.ruta[i] - b.ruta[i];
        }
        return a.index - b.index;
      }
      if (a.ruta) return -1;
      if (b.ruta) return 1;
      return a.index - b.index;
    }).map(function (item) { return item.valor; });
  }

  async function obtenerDetalleRapido(materiaId) {
    await conTiempoLimite(BD.Core.ready(), 8000, "abrir BDLocal");

    var materia = await conTiempoLimite(BD.Core.get(S.MATERIAS, materiaId), 8000, "leer la materia");
    if (!materia) throw new Error("No se encontró la materia seleccionada.");

    var resultados = await conTiempoLimite(Promise.all([
      materia.carreraId ? BD.Core.get(S.CARRERAS, materia.carreraId) : Promise.resolve(null),
      materia.matrizId ? BD.Core.get(S.MATRICES, materia.matrizId) : Promise.resolve(null),
      materia.nivelId ? BD.Core.get(S.NIVELES, materia.nivelId) : Promise.resolve(null),
      BD.Core.getAllByIndex(S.PEA_ARCHIVOS, "materiaId", materiaId),
      BD.Core.getAllByIndex(S.VALIDACIONES, "materiaId", materiaId),
      BD.Core.get(S.PEA_BASE, materiaId),
      BD.Core.getAllByIndex(S.PEA_UNIDADES, "materiaId", materiaId),
      BD.Core.getAllByIndex(S.PEA_ACTIVIDADES, "materiaId", materiaId)
    ]), 12000, "leer el detalle curricular");

    return {
      materia: materia,
      carrera: resultados[0],
      matriz: resultados[1],
      nivel: resultados[2],
      archivos: resultados[3] || [],
      validaciones: resultados[4] || [],
      pea: {
        base: resultados[5] || null,
        unidades: resultados[6] || [],
        actividades: resultados[7] || []
      }
    };
  }

  function renderUnidades(base, unidades) {
    var mapa = {};
    arr(unidades).forEach(function (unidad) {
      mapa[Number(unidad.unidadNumero || 0)] = unidad;
    });
    var meta = obtenerUnidadesBase(base);

    return [1, 2, 3, 4].map(function (numero) {
      var unidadBase = meta.find(function (item) {
        return Number(item.unidadNumero || item.orden || 0) === numero;
      }) || {};
      var unidad = mapa[numero] || {};
      var contenidos = ordenarContenidos(arr(unidad.contenidos).filter(function (item) { return texto(item); }));
      if (!contenidos.length) {
        var unico = texto(unidad.temaDetectado || unidad.contenido || unidad.tema);
        if (unico) contenidos = [unico];
      }

      return '<details class="bd-unit" open>' +
        '<summary>Unidad ' + numero + ': ' + escapar(unidadBase.nombre || unidadBase.tituloUnidad || "No registrada") + ' · ' + contenidos.length + ' contenidos</summary>' +
        '<div class="bd-unit-body">' +
          '<p><strong>Resultado de aprendizaje:</strong></p><div class="bd-text-block">' + saltos(unidadBase.resultadoAprendizaje || unidadBase.resultado || "No registrado") + '</div>' +
          '<p><strong>Competencia:</strong></p><div class="bd-text-block">' + saltos(unidadBase.competencia || "No registrada") + '</div>' +
          '<p><strong>Contenidos:</strong></p>' +
          (contenidos.length
            ? '<ol class="bd-content-list">' + contenidos.map(function (contenido) { return '<li>' + saltos(contenido) + '</li>'; }).join("") + '</ol>'
            : '<p class="bd-alert">No hay contenidos guardados para esta unidad.</p>') +
        '</div></details>';
    }).join("");
  }

  function renderActividades(actividades) {
    if (!arr(actividades).length) return '<p class="bd-alert">No hay actividades guardadas.</p>';
    return arr(actividades).map(function (actividad, index) {
      return '<div class="bd-activity"><h4>Actividad ' + (index + 1) + '</h4><div class="bd-activity-grid">' +
        '<strong>Mecanismo</strong><span>' + saltos(actividad.mecanismo || actividad.tipoActividad || actividad.tipo || "No registrado") + '</span>' +
        '<strong>Tema</strong><span>' + saltos(actividad.tema || actividad.titulo || "No registrado") + '</span>' +
        '<strong>Descripción</strong><span>' + saltos(actividad.descripcion || actividad.actividadDetectada || actividad.actividad || "No registrada") + '</span>' +
      '</div></div>';
    }).join("");
  }

  function renderBibliografia(base) {
    var items = obtenerBibliografia(base);
    if (!items.length) return '<p class="bd-alert">No hay bibliografía guardada.</p>';
    return items.map(function (item, index) {
      return '<div class="bd-biblio"><strong>Bibliografía ' + (index + 1) + '</strong>' +
        '<p>' + saltos(item.referencia || item.bibliografia || item.descripcion) + '</p>' +
        (texto(item.codigoReferencia || item.codigo) ? '<p><strong>Código:</strong> ' + escapar(item.codigoReferencia || item.codigo) + '</p>' : '') +
        '<p><strong>Justificación:</strong><br>' + saltos(item.justificacion || item.descripcionComponente3 || "No registrada") + '</p></div>';
    }).join("");
  }

  function renderDetalle(detalle, mensajeFondo) {
    var materia = detalle.materia || {};
    var base = detalle.pea && detalle.pea.base || {};
    var unidades = detalle.pea && detalle.pea.unidades || [];
    var actividades = detalle.pea && detalle.pea.actividades || [];
    var integridad = materia.integridadContenido || {};
    var faltantes = arr(integridad.faltantes);

    var estado = integridad.completo === true
      ? '<div class="bd-success">La materia tiene contenido curricular completo.</div>'
      : '<div class="bd-alert">Contenido pendiente: ' + escapar(faltantes.join(", ") || "revisa la información procesada") + '</div>';

    var notaFondo = mensajeFondo
      ? '<div id="bdDetalleEstadoFondo" class="bd-progress-note">' + escapar(mensajeFondo) + '</div>'
      : '<div id="bdDetalleEstadoFondo" class="bd-progress-note"></div>';

    return notaFondo +
      '<div class="bd-detail-grid">' +
        '<div><span>Carrera</span><strong>' + escapar(detalle.carrera && detalle.carrera.nombre) + '</strong></div>' +
        '<div><span>Nivel</span><strong>' + escapar(detalle.nivel && detalle.nivel.nombre) + '</strong></div>' +
        '<div><span>Estado</span><strong>' + escapar(materia.estadoValidacion || "pendiente") + '</strong></div>' +
        '<div><span>Archivos</span><strong>' + escapar(arr(detalle.archivos).length) + '</strong></div>' +
      '</div>' + estado +
      '<section class="bd-detail-section"><h3>Descripción de la asignatura</h3><div class="bd-text-block">' + saltos(obtenerDescripcion(base) || "No registrada") + '</div></section>' +
      '<section class="bd-detail-section"><h3>Objetivo de la asignatura</h3><div class="bd-text-block">' + saltos(obtenerObjetivo(base) || "No registrado") + '</div></section>' +
      '<section class="bd-detail-section"><h3>Unidades, resultados, competencias y contenidos</h3>' + renderUnidades(base, unidades) + '</section>' +
      '<section class="bd-detail-section"><h3>Actividades · ' + arr(actividades).length + '</h3>' + renderActividades(actividades) + '</section>' +
      '<section class="bd-detail-section"><h3>Bibliografía y justificación</h3>' + renderBibliografia(base) + '</section>' +
      '<section class="bd-detail-section"><h3>Archivos detectados</h3><div class="bd-file-list">' + arr(detalle.archivos).map(function (archivo) {
        return '<div class="bd-file-item"><strong>' + escapar(archivo.nombreArchivo) + '</strong><span>' + escapar(archivo.tipo) + ' · Confianza ' + escapar(archivo.confianza || 0) + '%</span><small>' + escapar(archivo.rutaOriginal) + '</small></div>';
      }).join("") + '</div></section>';
  }

  async function abrirDetalleRapido(id, boton) {
    var solicitud = ++solicitudActual;
    materiaActiva = id;
    var fila = boton && boton.closest("tr");
    var nombreInicial = fila ? texto(fila.querySelector("td:nth-child(4)") && fila.querySelector("td:nth-child(4)").textContent) : "Materia";
    var codigoInicial = fila ? texto(fila.querySelector("td:nth-child(3)") && fila.querySelector("td:nth-child(3)").textContent) : "";

    modalTitulo.textContent = (codigoInicial ? codigoInicial + " · " : "") + (nombreInicial || "Materia");
    modalContenido.innerHTML = '<p>Consultando la información guardada...</p>';
    if (!modal.open) modal.showModal();

    if (boton) {
      boton.disabled = true;
      boton.dataset.textoOriginal = boton.textContent;
      boton.textContent = "Abriendo...";
    }

    try {
      var detalle = await obtenerDetalleRapido(id);
      if (solicitud !== solicitudActual || materiaActiva !== id || !modal.open) return;

      var materia = detalle.materia || {};
      modalTitulo.textContent = (materia.codigo ? materia.codigo + " · " : "") + (materia.nombre || "Materia");
      modalContenido.innerHTML = renderDetalle(detalle, "Datos mostrados. La validación continuará en segundo plano.");

      if (BD.Inteligencia && typeof BD.Inteligencia.repararMateria === "function") {
        Promise.resolve(BD.Inteligencia.repararMateria(id)).then(async function () {
          if (solicitud !== solicitudActual || materiaActiva !== id || !modal.open) return;
          try {
            var actualizado = await obtenerDetalleRapido(id);
            if (solicitud !== solicitudActual || materiaActiva !== id || !modal.open) return;
            modalContenido.innerHTML = renderDetalle(actualizado, "Validación finalizada. Se muestran los datos actualizados.");
          } catch (errorRecarga) {
            var estado = document.getElementById("bdDetalleEstadoFondo");
            if (estado) estado.textContent = "La validación terminó, pero no se pudo refrescar automáticamente: " + (errorRecarga.message || errorRecarga);
          }
        }).catch(function (errorReparacion) {
          if (solicitud !== solicitudActual || materiaActiva !== id || !modal.open) return;
          var estado = document.getElementById("bdDetalleEstadoFondo");
          if (estado) estado.textContent = "Los datos están disponibles. La reparación en segundo plano no terminó: " + (errorReparacion.message || errorReparacion);
        });
      }
    } catch (error) {
      if (solicitud !== solicitudActual) return;
      modalContenido.innerHTML = '<p class="bd-alert">' + escapar(error.message || error) + '</p>';
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = boton.dataset.textoOriginal || "Ver todo";
      }
    }
  }

  tabla.addEventListener("click", function (event) {
    var boton = event.target.closest("[data-materia-id]");
    if (!boton) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    abrirDetalleRapido(boton.getAttribute("data-materia-id"), boton);
  }, true);

  modal.addEventListener("close", function () {
    solicitudActual += 1;
    materiaActiva = "";
  });

  console.info("[BDLocalCCC.DetalleRapido] Apertura no bloqueante del detalle activada.");
})(window, document);
