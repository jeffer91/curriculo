/* =========================================================
Nombre completo: comunicados.main.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.main.js
Función o funciones:
- Controlar la pantalla Comunicados.
- Cargar carreras y materias completas desde BDLocal.
- Permitir editar nombres institucionales de materias.
- Generar un PDF individual por materia.
- Generar un único PDF global con las materias seleccionadas.
- Generar un único PDF global con todas las materias completas.
- Confirmar que Electron guardó un PDF válido y mostrarlo en el Explorador.
- Registrar la numeración institucional únicamente después de guardar el PDF.
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
      "<div>" +
        "<strong>" + escapar(titulo) + "</strong>" +
        "<span>" + escapar(mensaje) + "</span>" +
      "</div>";
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

    document.querySelectorAll(
      ".btnGuardarNombre, .btnGenerarMateria, .chkMateria, .inputNombreInstitucional"
    ).forEach(function (el) {
      el.disabled = estado.cargando;
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
    requireModulo("ComunicadosCCC.Contador", NS.Contador, "obtenerSiguienteNumero");
    requireModulo("ComunicadosCCC.Contador", NS.Contador, "registrarNumeroManual");
    requireModulo("ComunicadosCCC.Contador", NS.Contador, "formatearNumeroComunicado");
    requireModulo("ComunicadosCCC.Plantilla", NS.Plantilla, "generarDocumento");
    requireModulo("ComunicadosCCC.Plantilla", NS.Plantilla, "generarDocumentoMultiple");
    requireModulo("ComunicadosCCC.PDF", NS.PDF, "generarPDFDocumento");
    requireModulo("ComunicadosCCC.PDF", NS.PDF, "generarPDFMultiple");
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

  function buscarElementoMateria(clase, materiaId) {
    var elementos = document.querySelectorAll("." + clase);

    for (var i = 0; i < elementos.length; i += 1) {
      if (elementos[i].getAttribute("data-materia-id") === materiaId) {
        return elementos[i];
      }
    }

    return null;
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
        return '<option value="' + escapar(carrera.id) + '">' + escapar(carrera.nombre) + "</option>";
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
        "<tr>" +
          '<td colspan="8" class="com-empty">No hay materias completas para generar comunicado.</td>' +
        "</tr>";
      return;
    }

    tbody.innerHTML = estado.materias.map(function (materia) {
      var checked = estado.seleccionadas[materia.id] ? "checked" : "";

      return (
        '<tr data-materia-id="' + escapar(materia.id) + '">' +
          '<td class="com-center">' +
            '<input type="checkbox" class="chkMateria" data-materia-id="' + escapar(materia.id) + '" ' + checked + " />" +
          "</td>" +
          "<td>" + escapar(materia.nivelNombre || "") + "</td>" +
          "<td><code>" + escapar(materia.codigo || "S/C") + "</code></td>" +
          "<td>" +
            '<div class="com-materia-original">' + escapar(materia.nombre || "") + "</div>" +
            "<small>Original importado</small>" +
          "</td>" +
          "<td>" +
            '<input class="inputNombreInstitucional" data-materia-id="' + escapar(materia.id) + '" value="' + escapar(materia.nombreMostrar || materia.nombre || "") + '" />' +
          "</td>" +
          "<td>" + estadoMateriaBadge(materia) + "</td>" +
          '<td class="com-center">' + escapar(materia.totalArchivosEncontrados || 3) + "/3</td>" +
          '<td class="com-actions-cell">' +
            '<button type="button" class="com-mini-btn btnGuardarNombre" data-materia-id="' + escapar(materia.id) + '">Guardar nombre</button>' +
            '<button type="button" class="com-mini-btn com-mini-primary btnGenerarMateria" data-materia-id="' + escapar(materia.id) + '">Generar PDF</button>' +
          "</td>" +
        "</tr>"
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
        pintarEstado("ok", "Materias cargadas", "Puedes editar nombres y generar PDF individual o global.");
      }
    } catch (error) {
      console.error(error);
      pintarEstado("error", "Error al cargar materias", error.message || "No se pudieron cargar las materias.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarNombreMateria(materiaId) {
    var input = buscarElementoMateria("inputNombreInstitucional", materiaId);

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

  async function guardarNombreSiCambioRapido(materiaId) {
    var input = buscarElementoMateria("inputNombreInstitucional", materiaId);
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

  function crearReservaProvisional(fecha, secuencia, datos) {
    datos = datos || {};

    return Object.assign({
      secuencia: Number(secuencia || 0),
      numero: NS.Contador.formatearNumeroComunicado(secuencia, fecha),
      mesKey: NS.Contador.obtenerMesKey(fecha),
      fechaTexto: NS.Contador.obtenerFechaLarga(fecha),
      reservadoEn: new Date().toISOString(),
      provisional: true
    }, datos);
  }

  async function registrarReservasConfirmadas(fecha, reservas) {
    reservas = Array.isArray(reservas) ? reservas : [];

    var errores = [];

    for (var i = 0; i < reservas.length; i += 1) {
      var reserva = reservas[i];

      try {
        await NS.Contador.registrarNumeroManual(
          fecha,
          reserva.secuencia,
          {
            materiaId: reserva.materiaId || "",
            carreraId: reserva.carreraId || "",
            nombreMateria: reserva.nombreMateria || "",
            archivoPDF: reserva.archivoPDF || "",
            generadoEn: new Date().toISOString()
          }
        );
      } catch (error) {
        errores.push({
          numero: reserva.numero,
          mensaje: error && error.message ? error.message : "No se pudo registrar la numeración."
        });
      }
    }

    return errores;
  }

  function describirResultadoPDF(resultado, prefijo) {
    prefijo = texto(prefijo || "PDF generado");

    if (!resultado) {
      return prefijo + ".";
    }

    if (resultado.modo === "navegador") {
      return resultado.mensaje || "Se abrió la ventana de impresión para guardar como PDF.";
    }

    return prefijo + ": " + texto(resultado.ruta || resultado.nombreArchivo || "Descargas");
  }

  async function generarMateria(materiaId) {
    var materia = obtenerMateriaEnEstado(materiaId);

    if (!materia) {
      pintarEstado("error", "Materia no encontrada", "No se pudo localizar la materia en la tabla.");
      return;
    }

    setCargando(true);

    try {
      pintarEstado("neutral", "Generando comunicado", "Organizando datos y preparando el PDF.");

      await guardarNombreSiCambioRapido(materiaId);

      var detalle = await obtenerDetalleValidado(materiaId);
      var fecha = obtenerFechaSeleccionada();
      var siguiente = await NS.Contador.obtenerSiguienteNumero(fecha);

      var reserva = crearReservaProvisional(fecha, siguiente.secuencia, {
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
        nombreArchivo: reserva.numero + "_" + documento.nombreAsignatura,
        mostrarArchivo: true
      });

      reserva.archivoPDF = resultadoPDF.nombreArchivo || "";
      var erroresRegistro = await registrarReservasConfirmadas(fecha, [reserva]);

      pintarEstado(
        erroresRegistro.length ? "warn" : "ok",
        erroresRegistro.length ? "PDF generado con observación" : "Comunicado generado",
        describirResultadoPDF(resultadoPDF, "PDF guardado") +
          (erroresRegistro.length ? " La numeración no pudo registrarse: " + erroresRegistro[0].mensaje : "")
      );
    } catch (error) {
      console.error("[ComunicadosCCC.Main] Error generando PDF individual:", error);
      pintarEstado("error", "No se pudo generar", error.message || "Error generando comunicado.");
    } finally {
      setCargando(false);
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
      pintarEstado("warn", "Sin selección", "Selecciona al menos una materia para generar el PDF global.");
      return;
    }

    await generarPDFGlobal(seleccionadas, "seleccionadas");
  }

  async function generarTodas() {
    if (!estado.materias.length) {
      pintarEstado("warn", "Sin materias", "No hay materias completas para generar.");
      return;
    }

    var confirmar = window.confirm(
      "Se generará un único PDF global con un comunicado por cada materia completa.\n\n" +
      "Total: " + estado.materias.length + " comunicado(s).\n\n" +
      "¿Deseas continuar?"
    );

    if (!confirmar) return;

    await generarPDFGlobal(estado.materias, "todas");
  }

  async function generarPDFGlobal(materias, tipoLote) {
    materias = Array.isArray(materias) ? materias : [];

    if (!materias.length) {
      pintarEstado("warn", "Sin materias", "No hay materias para generar el PDF global.");
      return;
    }

    setCargando(true);

    try {
      var fecha = obtenerFechaSeleccionada();
      var config = obtenerConfigPlantilla();
      var siguiente = await NS.Contador.obtenerSiguienteNumero(fecha);
      var primeraSecuencia = Number(siguiente.secuencia || 1);
      var items = [];
      var reservas = [];

      for (var i = 0; i < materias.length; i += 1) {
        var materia = materias[i];

        pintarEstado(
          "neutral",
          "Preparando PDF global",
          "Procesando " + (i + 1) + " de " + materias.length + ": " + (materia.nombreMostrar || materia.nombre || "materia")
        );

        await guardarNombreSiCambioRapido(materia.id);

        var detalle = await obtenerDetalleValidado(materia.id);
        var reserva = crearReservaProvisional(fecha, primeraSecuencia + i, {
          materiaId: materia.id,
          carreraId: detalle.carrera ? detalle.carrera.id : "",
          nombreMateria: detalle.materia ? detalle.materia.nombreMostrar : materia.nombreMostrar
        });

        reservas.push(reserva);
        items.push({
          detalle: detalle,
          reserva: reserva
        });
      }

      pintarEstado(
        "neutral",
        "Generando PDF global",
        "Creando un documento con " + items.length + " comunicado(s)."
      );

      var resultadoMultiple = NS.Plantilla.generarDocumentoMultiple(items, config);
      var carreraNombre = estado.carreraActual ? estado.carreraActual.nombre : "carrera";
      var nombreArchivo = [
        "COMUNICADOS",
        tipoLote === "todas" ? "TODAS" : "SELECCIONADAS",
        carreraNombre
      ].join("_");

      var resultadoPDF = await NS.PDF.generarPDFMultiple(resultadoMultiple, {
        nombreArchivo: nombreArchivo,
        titulo: "Comunicados institucionales - " + carreraNombre,
        mostrarArchivo: true
      });

      reservas.forEach(function (reserva) {
        reserva.archivoPDF = resultadoPDF.nombreArchivo || "";
      });

      var erroresRegistro = await registrarReservasConfirmadas(fecha, reservas);

      pintarEstado(
        erroresRegistro.length ? "warn" : "ok",
        erroresRegistro.length ? "PDF global generado con observaciones" : "PDF global generado",
        describirResultadoPDF(
          resultadoPDF,
          "Se guardó un PDF global con " + materias.length + " comunicado(s)"
        ) +
          (erroresRegistro.length
            ? " No se registraron " + erroresRegistro.length + " número(s) en el contador."
            : "")
      );
    } catch (error) {
      console.error("[ComunicadosCCC.Main] Error generando PDF global:", error);
      pintarEstado("error", "No se pudo generar el PDF global", error.message || "Error generando comunicados.");
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

  async function verificarEntornoPDF() {
    if (!NS.PDF || typeof NS.PDF.diagnosticarEntorno !== "function") {
      return;
    }

    try {
      var diagnostico = await NS.PDF.diagnosticarEntorno();

      if (!diagnostico.electronDisponible) {
        console.warn("[ComunicadosCCC.Main] La pantalla está fuera de Electron. Se usará impresión del navegador.");
      } else if (!diagnostico.ok) {
        console.warn("[ComunicadosCCC.Main] Diagnóstico PDF con observaciones:", diagnostico);
      }
    } catch (error) {
      console.warn("[ComunicadosCCC.Main] No se pudo ejecutar el diagnóstico PDF:", error);
    }
  }

  async function iniciar() {
    try {
      validarDependencias();
      conectarEventos();
      await verificarEntornoPDF();
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
    generarPDFGlobal: generarPDFGlobal,
    getEstado: function () {
      return Object.assign({}, estado);
    }
  };

  document.addEventListener("DOMContentLoaded", iniciar);
})(window, document);
