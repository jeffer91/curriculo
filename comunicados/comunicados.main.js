/* =========================================================
Nombre completo: comunicados.main.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.main.js
Función o funciones:
- Controlar la pantalla Comunicados.
- Cargar carreras desde BDLocal.
- Mostrar materias completas de la carrera seleccionada.
- Permitir editar nombres institucionales de materias.
- Generar comunicado PDF individual por materia.
- Generar varios comunicados, descargando un PDF individual por cada materia.
- Esperar la respuesta de Electron para confirmar que los PDF fueron guardados en Descargas.
========================================================= */

(function (window, document) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  var estado = {
    carreras: [],
    carreraActual: null,
    materias: [],
    seleccionadas: {},
    cargando: false
  };

  function $(id) {
    return document.getElementById(id);
  }

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

  function fechaInputHoy() {
    var d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function setTexto(id, valor) {
    var el = $(id);
    if (el) el.textContent = texto(valor);
  }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("comEstado");

    if (!el) return;

    el.className = "com-status com-status-" + tipo;
    el.innerHTML =
      '<div class="com-status-dot"></div>' +
      '<div>' +
        '<strong>' + escapar(titulo) + '</strong>' +
        '<span>' + escapar(mensaje) + '</span>' +
      '</div>';
  }

  function setCargando(valor) {
    estado.cargando = !!valor;

    [
      "selectorCarrera",
      "btnRecargar",
      "btnGenerarSeleccionadas",
      "btnGenerarTodas",
      "btnSeleccionarTodas",
      "btnLimpiarSeleccion"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = estado.cargando;
    });
  }

  function requireModulo(nombre, obj, metodo) {
    if (!obj) {
      throw new Error("Falta cargar módulo: " + nombre);
    }

    if (metodo && typeof obj[metodo] !== "function") {
      throw new Error("El módulo " + nombre + " no tiene la función " + metodo + ".");
    }
  }

  function validarDependencias() {
    requireModulo("ComunicadosCCC.BDLocal", NS.BDLocal, "obtenerCarreras");
    requireModulo("ComunicadosCCC.Contador", NS.Contador, "reservarNumero");
    requireModulo("ComunicadosCCC.Plantilla", NS.Plantilla, "generarDocumento");
    requireModulo("ComunicadosCCC.PDF", NS.PDF, "generarPDFDocumento");
  }

  function obtenerFechaSeleccionada() {
    var input = $("inputFecha");

    if (!input || !input.value) {
      return new Date();
    }

    return new Date(input.value + "T12:00:00");
  }

  function obtenerConfigPlantilla() {
    var unidad = $("inputUnidadResponsable");
    var ciudad = $("inputCiudad");
    var nota = $("inputNota");
    var logo = $("inputLogoSrc");

    return {
      unidadResponsable: unidad ? unidad.value : "UNIDAD DE GESTIÓN PEDAGÓGICA ACADÉMICA",
      ciudad: ciudad ? ciudad.value : "Quito, D.M.",
      nota: nota ? nota.value : "Nota: Cualquier inquietud por favor acercarse a la Unidad de Gestión Pedagógica Académica.",
      logoSrc: logo ? logo.value : "../assets/logo-itsqmet-comunicado.png"
    };
  }

  function pintarCarreras() {
    var select = $("selectorCarrera");

    if (!select) return;

    if (!estado.carreras.length) {
      select.innerHTML = '<option value="">No hay carreras en BDLocal</option>';
      return;
    }

    select.innerHTML =
      '<option value="">Seleccione una carrera...</option>' +
      estado.carreras.map(function (carrera) {
        return '<option value="' + escapar(carrera.id) + '">' + escapar(carrera.nombre) + '</option>';
      }).join("");
  }

  function pintarResumenCarrera(resumen) {
    resumen = resumen || {};

    setTexto("statTotalMaterias", resumen.totalMaterias || 0);
    setTexto("statCompletas", resumen.completas || 0);
    setTexto("statIncompletas", resumen.incompletas || 0);
    setTexto("statRevision", resumen.revision || 0);
    setTexto("statMostradas", estado.materias.length || 0);
    actualizarContadorSeleccionadas();
  }

  function estadoMateriaBadge(materia) {
    var estadoValidacion = materia.estadoValidacion || "pendiente";

    if (estadoValidacion === "completo") {
      return '<span class="com-badge com-badge-ok">Completa</span>';
    }

    if (estadoValidacion === "revision") {
      return '<span class="com-badge com-badge-warn">Revisión</span>';
    }

    return '<span class="com-badge com-badge-error">Incompleta</span>';
  }

  function pintarTablaMaterias() {
    var tbody = $("tablaMaterias");

    if (!tbody) return;

    if (!estado.materias.length) {
      tbody.innerHTML =
        '<tr>' +
          '<td colspan="8" class="com-empty">No hay materias completas para generar comunicado.</td>' +
        '</tr>';
      return;
    }

    tbody.innerHTML = estado.materias.map(function (materia) {
      var checked = estado.seleccionadas[materia.id] ? "checked" : "";

      return (
        '<tr data-materia-id="' + escapar(materia.id) + '">' +
          '<td class="com-center">' +
            '<input type="checkbox" class="chkMateria" data-materia-id="' + escapar(materia.id) + '" ' + checked + ' />' +
          '</td>' +
          '<td>' + escapar(materia.nivelNombre || "") + '</td>' +
          '<td><code>' + escapar(materia.codigo || "S/C") + '</code></td>' +
          '<td>' +
            '<div class="com-materia-original">' + escapar(materia.nombre || "") + '</div>' +
            '<small>Original importado</small>' +
          '</td>' +
          '<td>' +
            '<input class="inputNombreInstitucional" data-materia-id="' + escapar(materia.id) + '" value="' + escapar(materia.nombreMostrar || materia.nombre || "") + '" />' +
          '</td>' +
          '<td>' + estadoMateriaBadge(materia) + '</td>' +
          '<td class="com-center">' + escapar(materia.totalArchivosEncontrados || 3) + '/3</td>' +
          '<td class="com-actions-cell">' +
            '<button type="button" class="com-mini-btn btnGuardarNombre" data-materia-id="' + escapar(materia.id) + '">Guardar nombre</button>' +
            '<button type="button" class="com-mini-btn com-mini-primary btnGenerarMateria" data-materia-id="' + escapar(materia.id) + '">Generar PDF</button>' +
          '</td>' +
        '</tr>'
      );
    }).join("");

    actualizarContadorSeleccionadas();
  }

  function obtenerMateriaEnEstado(materiaId) {
    return estado.materias.find(function (materia) {
      return materia.id === materiaId;
    }) || null;
  }

  async function cargarCarreras() {
    setCargando(true);

    try {
      pintarEstado("neutral", "Cargando carreras", "Consultando información guardada en BDLocal.");

      await NS.BDLocal.inicializar();

      estado.carreras = await NS.BDLocal.obtenerCarreras();

      pintarCarreras();

      if (!estado.carreras.length) {
        pintarEstado("warn", "Sin carreras", "Primero debes importar un ZIP desde la pantalla Subir ZIP.");
      } else {
        pintarEstado("ok", "BDLocal conectada", "Selecciona una carrera para ver sus materias completas.");
      }
    } catch (error) {
      console.error(error);
      pintarEstado("error", "Error al cargar carreras", error.message || "No se pudo conectar con BDLocal.");
    } finally {
      setCargando(false);
    }
  }

  async function cargarMateriasCarrera(carreraId) {
    estado.carreraActual = estado.carreras.find(function (carrera) {
      return carrera.id === carreraId;
    }) || null;

    estado.materias = [];
    estado.seleccionadas = {};

    pintarTablaMaterias();

    if (!carreraId) {
      pintarResumenCarrera({});
      pintarEstado("neutral", "Seleccione una carrera", "La tabla se cargará con materias completas.");
      return;
    }

    setCargando(true);

    try {
      pintarEstado("neutral", "Cargando materias", "Buscando materias completas para generar comunicados.");

      var resumen = await NS.BDLocal.obtenerResumenCarrera(carreraId);

      estado.materias = await NS.BDLocal.obtenerMateriasPorCarrera(carreraId, {
        soloCompletas: true
      });

      estado.materias.forEach(function (materia) {
        estado.seleccionadas[materia.id] = false;
      });

      pintarResumenCarrera(resumen);
      pintarTablaMaterias();

      if (!estado.materias.length) {
        pintarEstado("warn", "Sin materias completas", "Esta carrera no tiene materias completas con los 3 PEA obligatorios.");
      } else {
        pintarEstado("ok", "Materias cargadas", "Puedes editar nombres y generar comunicados por materia.");
      }
    } catch (error) {
      console.error(error);
      pintarEstado("error", "Error al cargar materias", error.message || "No se pudieron cargar las materias.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarNombreMateria(materiaId) {
    var input = document.querySelector('.inputNombreInstitucional[data-materia-id="' + CSS.escape(materiaId) + '"]');

    if (!input) return;

    var nuevoNombre = texto(input.value);

    if (!nuevoNombre) {
      pintarEstado("error", "Nombre vacío", "El nombre institucional de la materia no puede estar vacío.");
      return;
    }

    setCargando(true);

    try {
      var actualizada = await NS.BDLocal.guardarNombreInstitucionalMateria(materiaId, nuevoNombre);

      estado.materias = estado.materias.map(function (materia) {
        if (materia.id !== materiaId) return materia;

        return Object.assign({}, materia, {
          nombreInstitucional: actualizada.nombreInstitucional,
          nombreCorregido: actualizada.nombreCorregido,
          nombreMostrar: actualizada.nombreInstitucional
        });
      });

      pintarEstado("ok", "Nombre guardado", "El nombre institucional fue actualizado en BDLocal.");
    } catch (error) {
      console.error(error);
      pintarEstado("error", "No se pudo guardar", error.message || "Error guardando nombre.");
    } finally {
      setCargando(false);
    }
  }

  async function obtenerDetalleValidado(materiaId) {
    var detalle = await NS.BDLocal.obtenerDetalleMateriaComunicado(materiaId);

    if (!detalle.estadoGeneracion || detalle.estadoGeneracion.puedeGenerar !== true) {
      var faltantes = detalle.estadoGeneracion && detalle.estadoGeneracion.faltantes
        ? detalle.estadoGeneracion.faltantes.join(", ")
        : "PEA obligatorio";

      throw new Error("No se puede generar esta materia. Faltan: " + faltantes);
    }

    return detalle;
  }

  async function generarMateria(materiaId) {
    var materia = obtenerMateriaEnEstado(materiaId);

    if (!materia) {
      pintarEstado("error", "Materia no encontrada", "No se pudo localizar la materia en la tabla.");
      return;
    }

    setCargando(true);

    try {
      pintarEstado("neutral", "Generando comunicado", "Organizando datos de PEA Base, Unidades y Actividades.");

      await guardarNombreSiCambioRapido(materiaId);

      var detalle = await obtenerDetalleValidado(materiaId);

      var reserva = await NS.Contador.reservarNumero(obtenerFechaSeleccionada(), {
        materiaId: materiaId,
        carreraId: detalle.carrera ? detalle.carrera.id : "",
        nombreMateria: detalle.materia ? detalle.materia.nombreMostrar : materia.nombreMostrar
      });

      var documento = NS.Plantilla.generarDocumento(
        detalle,
        reserva,
        obtenerConfigPlantilla()
      );

      var resultadoPDF = await NS.PDF.generarPDFDocumento(documento, {
        nombreArchivo: reserva.numero + "_" + documento.nombreAsignatura
      });

      pintarEstado(
        "ok",
        "Comunicado generado",
        "PDF guardado en Descargas: " + (resultadoPDF.nombreArchivo || reserva.numero + ".pdf")
      );
    } catch (error) {
      console.error(error);
      pintarEstado("error", "No se pudo generar", error.message || "Error generando comunicado.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarNombreSiCambioRapido(materiaId) {
    var input = document.querySelector('.inputNombreInstitucional[data-materia-id="' + CSS.escape(materiaId) + '"]');
    var materia = obtenerMateriaEnEstado(materiaId);

    if (!input || !materia) return;

    var nuevoNombre = texto(input.value);

    if (nuevoNombre && nuevoNombre !== texto(materia.nombreMostrar)) {
      await NS.BDLocal.guardarNombreInstitucionalMateria(materiaId, nuevoNombre);

      materia.nombreMostrar = nuevoNombre;
      materia.nombreInstitucional = nuevoNombre;
      materia.nombreCorregido = nuevoNombre;
    }
  }

  function obtenerMateriasSeleccionadas() {
    return estado.materias.filter(function (materia) {
      return estado.seleccionadas[materia.id] === true;
    });
  }

  function actualizarContadorSeleccionadas() {
    var seleccionadas = obtenerMateriasSeleccionadas();

    setTexto("statSeleccionadas", seleccionadas.length);
  }

  async function generarSeleccionadas() {
    var seleccionadas = obtenerMateriasSeleccionadas();

    if (!seleccionadas.length) {
      pintarEstado("warn", "Sin selección", "Selecciona al menos una materia para generar comunicados.");
      return;
    }

    await generarLote(seleccionadas);
  }

  async function generarTodas() {
    if (!estado.materias.length) {
      pintarEstado("warn", "Sin materias", "No hay materias completas para generar.");
      return;
    }

    var confirmar = window.confirm(
      "Se generará un PDF individual por cada materia completa de la carrera seleccionada.\n\n" +
      "Total: " + estado.materias.length + " comunicado(s).\n\n" +
      "¿Deseas continuar?"
    );

    if (!confirmar) return;

    await generarLote(estado.materias);
  }

  async function generarLote(materias) {
    materias = Array.isArray(materias) ? materias : [];

    setCargando(true);

    try {
      pintarEstado("neutral", "Generando comunicados", "Procesando " + materias.length + " materia(s).");

      var fecha = obtenerFechaSeleccionada();
      var config = obtenerConfigPlantilla();
      var generados = [];

      for (var i = 0; i < materias.length; i += 1) {
        var materia = materias[i];

        pintarEstado(
          "neutral",
          "Generando comunicados",
          "Procesando " + (i + 1) + " de " + materias.length + ": " + (materia.nombreMostrar || materia.nombre || "materia")
        );

        await guardarNombreSiCambioRapido(materia.id);

        var detalle = await obtenerDetalleValidado(materia.id);

        var reserva = await NS.Contador.reservarNumero(fecha, {
          materiaId: materia.id,
          carreraId: detalle.carrera ? detalle.carrera.id : "",
          nombreMateria: detalle.materia ? detalle.materia.nombreMostrar : materia.nombreMostrar
        });

        var documento = NS.Plantilla.generarDocumento(
          detalle,
          reserva,
          config
        );

        var resultadoPDF = await NS.PDF.generarPDFDocumento(documento, {
          nombreArchivo: reserva.numero + "_" + documento.nombreAsignatura
        });

        generados.push(resultadoPDF);
      }

      pintarEstado(
        "ok",
        "Comunicados generados",
        "Se guardaron " + generados.length + " PDF(s) individuales en Descargas. Último archivo: " + (generados[generados.length - 1] ? generados[generados.length - 1].nombreArchivo : "comunicado.pdf")
      );
    } catch (error) {
      console.error(error);
      pintarEstado("error", "No se pudo generar el lote", error.message || "Error generando comunicados.");
    } finally {
      setCargando(false);
    }
  }

  function seleccionarTodas(valor) {
    estado.materias.forEach(function (materia) {
      estado.seleccionadas[materia.id] = !!valor;
    });

    pintarTablaMaterias();
  }

  function conectarEventos() {
    var selector = $("selectorCarrera");

    if (selector) {
      selector.addEventListener("change", function () {
        cargarMateriasCarrera(selector.value);
      });
    }

    var fecha = $("inputFecha");

    if (fecha && !fecha.value) {
      fecha.value = fechaInputHoy();
    }

    var btnRecargar = $("btnRecargar");

    if (btnRecargar) {
      btnRecargar.addEventListener("click", cargarCarreras);
    }

    var btnSeleccionarTodas = $("btnSeleccionarTodas");

    if (btnSeleccionarTodas) {
      btnSeleccionarTodas.addEventListener("click", function () {
        seleccionarTodas(true);
      });
    }

    var btnLimpiarSeleccion = $("btnLimpiarSeleccion");

    if (btnLimpiarSeleccion) {
      btnLimpiarSeleccion.addEventListener("click", function () {
        seleccionarTodas(false);
      });
    }

    var btnGenerarSeleccionadas = $("btnGenerarSeleccionadas");

    if (btnGenerarSeleccionadas) {
      btnGenerarSeleccionadas.addEventListener("click", generarSeleccionadas);
    }

    var btnGenerarTodas = $("btnGenerarTodas");

    if (btnGenerarTodas) {
      btnGenerarTodas.addEventListener("click", generarTodas);
    }

    var tabla = $("tablaMaterias");

    if (tabla) {
      tabla.addEventListener("change", function (event) {
        var chk = event.target.closest(".chkMateria");

        if (!chk) return;

        var materiaId = chk.getAttribute("data-materia-id");
        estado.seleccionadas[materiaId] = chk.checked;
        actualizarContadorSeleccionadas();
      });

      tabla.addEventListener("click", function (event) {
        var btnGuardar = event.target.closest(".btnGuardarNombre");
        var btnGenerar = event.target.closest(".btnGenerarMateria");

        if (btnGuardar) {
          guardarNombreMateria(btnGuardar.getAttribute("data-materia-id"));
          return;
        }

        if (btnGenerar) {
          generarMateria(btnGenerar.getAttribute("data-materia-id"));
        }
      });
    }
  }

  async function iniciar() {
    try {
      validarDependencias();
      conectarEventos();
      await cargarCarreras();
    } catch (error) {
      console.error(error);
      pintarEstado("error", "Error inicializando Comunicados", error.message || "Faltan dependencias.");
    }
  }

  NS.Main = {
    iniciar: iniciar,
    cargarCarreras: cargarCarreras,
    cargarMateriasCarrera: cargarMateriasCarrera,
    generarMateria: generarMateria,
    generarSeleccionadas: generarSeleccionadas,
    generarTodas: generarTodas,
    getEstado: function () {
      return Object.assign({}, estado);
    }
  };

  document.addEventListener("DOMContentLoaded", iniciar);
})(window, document);