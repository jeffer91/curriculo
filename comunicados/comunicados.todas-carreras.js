/* =========================================================
Nombre completo: comunicados.todas-carreras.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.todas-carreras.js
Funciones:
- Consultar todas las carreras y sus materias completas en Firebase.
- Validar cada materia antes de reservar numeración.
- Generar un único ZIP organizado con una carpeta por carrera.
- Mantener una numeración consecutiva para todo el lote.
- Confirmar la numeración únicamente después de guardar el ZIP.
========================================================= */
(function (window, document) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};
  var NS = window.ComunicadosCCC;
  var MAXIMO_LOTE = 300;
  var ejecutando = false;

  function $(id) {
    return document.getElementById(id);
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function nombreCarrera(carrera) {
    return texto(
      carrera && (
        carrera.nombreInstitucional ||
        carrera.nombreCorregido ||
        carrera.nombreMostrar ||
        carrera.nombre
      )
    ) || "Carrera sin nombre";
  }

  function nombreMateria(materia) {
    return texto(
      materia && (
        materia.nombreMostrar ||
        materia.nombreInstitucional ||
        materia.nombreCorregido ||
        materia.nombre
      )
    ) || "Materia sin nombre";
  }

  function fechaSeleccionada() {
    var input = $("inputFecha");
    if (!input || !input.value) return new Date();
    return new Date(input.value + "T12:00:00");
  }

  function fechaArchivo(fecha) {
    fecha = fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : new Date();
    return [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0")
    ].join("-");
  }

  function configPlantilla() {
    return {
      unidadResponsable: $("inputUnidadResponsable") ? $("inputUnidadResponsable").value : "",
      ciudad: $("inputCiudad") ? $("inputCiudad").value : "",
      nota: $("inputNota") ? $("inputNota").value : "",
      logoSrc: $("inputLogoSrc") ? $("inputLogoSrc").value : ""
    };
  }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("comEstado");
    if (!el) return;
    el.className = "com-status com-status-" + tipo;
    el.innerHTML =
      '<div class="com-status-dot"></div>' +
      "<div><strong>" + titulo + "</strong><span>" + mensaje + "</span></div>";
  }

  function setOcupado(valor) {
    ejecutando = !!valor;
    [
      "btnGenerarTodasCarreras",
      "btnGenerarTodas",
      "btnGenerarSeleccionadas",
      "btnSeleccionarTodas",
      "btnLimpiarSeleccion",
      "btnRecargar",
      "selectorCarrera"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = ejecutando;
    });
  }

  function validarDependencias() {
    if (!NS.BDLocal || typeof NS.BDLocal.obtenerCarreras !== "function") {
      throw new Error("No está disponible la conexión con Firebase.");
    }
    if (!NS.Contador || typeof NS.Contador.preReservarBloque !== "function") {
      throw new Error("No está disponible la reserva de numeración.");
    }
    if (!NS.Plantilla || typeof NS.Plantilla.generarDocumento !== "function") {
      throw new Error("No está disponible la plantilla de comunicados.");
    }
    if (!NS.PDF || typeof NS.PDF.construirHTMLFinalDocumento !== "function") {
      throw new Error("No está disponible el generador de PDF.");
    }
    if (
      !window.CurriculoElectron ||
      typeof window.CurriculoElectron.guardarComunicadosZIPOrganizado !== "function"
    ) {
      throw new Error("Actualiza y reinicia Electron para generar el ZIP por carreras.");
    }
  }

  async function recopilarMaterias() {
    await NS.BDLocal.inicializar();
    var carreras = await NS.BDLocal.obtenerCarreras();
    var validas = [];
    var totalRegistradas = 0;
    var carrerasConMaterias = 0;

    for (var i = 0; i < carreras.length; i += 1) {
      var carrera = carreras[i];
      var carreraNombre = nombreCarrera(carrera);

      pintarEstado(
        "neutral",
        "Revisando carreras",
        "Carrera " + (i + 1) + " de " + carreras.length + ": " + carreraNombre
      );

      var resumen = await NS.BDLocal.obtenerResumenCarrera(carrera.id);
      totalRegistradas += Number(resumen && resumen.totalMaterias || 0);

      var materias = await NS.BDLocal.obtenerMateriasPorCarrera(carrera.id, {
        soloCompletas: true
      });

      if (materias.length) carrerasConMaterias += 1;

      for (var j = 0; j < materias.length; j += 1) {
        var materia = materias[j];
        try {
          var detalle = await NS.BDLocal.obtenerDetalleMateriaComunicado(materia.id);
          if (!detalle.estadoGeneracion || detalle.estadoGeneracion.puedeGenerar !== true) continue;
          validas.push({
            carrera: carrera,
            carreraNombre: carreraNombre,
            materia: materia,
            detalle: detalle
          });
        } catch (error) {
          console.warn("[Comunicados todas] Materia omitida:", materia.id, error);
        }
      }
    }

    return {
      carreras: carreras,
      carrerasConMaterias: carrerasConMaterias,
      materias: validas,
      totalRegistradas: Math.max(totalRegistradas, validas.length),
      omitidas: Math.max(0, totalRegistradas - validas.length)
    };
  }

  function confirmarLote(datos) {
    return window.confirm([
      "Se generarán los comunicados de todas las carreras.",
      "",
      "Carreras con materias: " + datos.carrerasConMaterias,
      "Materias completas: " + datos.materias.length,
      "Materias omitidas: " + datos.omitidas,
      "",
      "Se creará un ZIP con una carpeta por carrera.",
      "¿Deseas continuar?"
    ].join("\n"));
  }

  async function cancelarReservas(motivo) {
    if (!NS.Contador || typeof NS.Contador.cancelarReservasPendientes !== "function") return;
    try {
      await NS.Contador.cancelarReservasPendientes(motivo);
    } catch (error) {
      console.warn("[Comunicados todas] No se pudieron cancelar las reservas:", error);
    }
  }

  async function confirmarNumeracion(fecha, items, reservas, archivos) {
    var errores = [];

    for (var i = 0; i < reservas.length; i += 1) {
      var item = items[i];
      var reserva = reservas[i];
      var archivo = archivos[i] || {};

      try {
        await NS.Contador.registrarNumeroManual(fecha, reserva.secuencia, {
          materiaId: item.materia.id,
          carreraId: item.carrera.id,
          nombreMateria: nombreMateria(item.materia),
          archivoPDF: archivo.rutaZIP || archivo.nombreArchivo || "",
          generadoEn: new Date().toISOString(),
          lote: "todas_las_carreras"
        });
      } catch (error) {
        errores.push({
          numero: reserva.numero,
          mensaje: error && error.message ? error.message : "No se pudo confirmar la numeración."
        });
      }
    }

    if (errores.length) {
      await cancelarReservas("No se confirmó parte del lote general de comunicados.");
    }

    return errores;
  }

  async function generarTodasLasCarreras() {
    if (ejecutando) return;

    try {
      validarDependencias();
      setOcupado(true);
      pintarEstado("neutral", "Preparando lote general", "Consultando todas las carreras.");

      var datos = await recopilarMaterias();

      if (!datos.materias.length) {
        pintarEstado("warn", "Sin materias completas", "No se encontraron materias listas para generar.");
        return;
      }

      if (datos.materias.length > MAXIMO_LOTE) {
        pintarEstado(
          "error",
          "Lote demasiado grande",
          "El máximo seguro es de " + MAXIMO_LOTE + " comunicados y se encontraron " + datos.materias.length + "."
        );
        return;
      }

      if (!confirmarLote(datos)) {
        pintarEstado("neutral", "Generación cancelada", "No se reservaron números ni se crearon archivos.");
        return;
      }

      var fecha = fechaSeleccionada();
      var configuracion = configPlantilla();
      var reservas = await NS.Contador.preReservarBloque(
        fecha,
        datos.materias.length,
        { origen: "comunicados_todas_las_carreras" }
      );
      var documentos = [];

      for (var i = 0; i < datos.materias.length; i += 1) {
        var item = datos.materias[i];
        var reserva = reservas[i];

        pintarEstado(
          "neutral",
          "Preparando comunicados",
          "Procesando " + (i + 1) + " de " + datos.materias.length + ": " + nombreMateria(item.materia)
        );

        var documento = NS.Plantilla.generarDocumento(
          item.detalle,
          reserva,
          configuracion
        );

        documentos.push({
          html: NS.PDF.construirHTMLFinalDocumento(documento),
          titulo: "Comunicado " + texto(documento.numeroComunicado || reserva.numero),
          nombreArchivo: NS.PDF.nombreArchivoComunicado(documento),
          carpeta: item.carreraNombre
        });
      }

      pintarEstado(
        "neutral",
        "Generando ZIP",
        "Creando " + documentos.length + " PDF y organizándolos por carrera."
      );

      var resultado = await window.CurriculoElectron.guardarComunicadosZIPOrganizado({
        nombreArchivo: "Comunicados TODAS LAS CARRERAS " + fechaArchivo(fecha) + ".zip",
        documentos: documentos
      });

      if (!resultado || resultado.ok !== true) {
        throw new Error(
          resultado && resultado.mensaje
            ? resultado.mensaje
            : "No se pudo generar el ZIP general."
        );
      }

      var errores = await confirmarNumeracion(
        fecha,
        datos.materias,
        reservas,
        resultado.archivos || []
      );

      if (typeof window.CurriculoElectron.mostrarArchivo === "function") {
        await window.CurriculoElectron.mostrarArchivo(resultado.ruta);
      }

      pintarEstado(
        errores.length ? "warn" : "ok",
        errores.length ? "ZIP generado con observaciones" : "Comunicados generados",
        resultado.cantidad + " PDF organizados en " + datos.carrerasConMaterias + " carpetas. " +
          (errores.length ? errores.length + " números no pudieron confirmarse." : "Numeración registrada correctamente.")
      );
    } catch (error) {
      await cancelarReservas("Falló la generación del ZIP de todas las carreras.");
      console.error("[Comunicados todas] Error:", error);
      pintarEstado(
        "error",
        "No se pudo generar",
        error && error.message ? error.message : "Error generando comunicados de todas las carreras."
      );
    } finally {
      setOcupado(false);
    }
  }

  function iniciar() {
    var boton = $("btnGenerarTodasCarreras");
    if (!boton) return;
    boton.addEventListener("click", generarTodasLasCarreras);
  }

  NS.TodasCarreras = {
    MAXIMO_LOTE: MAXIMO_LOTE,
    generar: generarTodasLasCarreras,
    recopilarMaterias: recopilarMaterias
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})(window, document);
