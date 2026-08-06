/* =========================================================
Nombre completo: comunicados.todas-carreras.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.todas-carreras.js
Funciones:
- Consultar todas las carreras y sus materias en Firebase.
- Validar cada materia y omitir únicamente las que tienen errores.
- Mostrar una barra de progreso durante todo el proceso.
- Generar un ZIP organizado con los comunicados válidos.
- Informar las materias omitidas y el motivo de cada una.
- Confirmar numeración solo para los PDF creados correctamente.
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

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, Number(valor || 0)));
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
      "<div><strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span></div>";
  }

  function actualizarProgreso(porcentaje, titulo, detalle, trabajando) {
    var panel = $("comProgresoTodas");
    var barra = $("comProgresoBarra");
    var track = $("comProgresoTrack");
    var porcentajeEl = $("comProgresoPorcentaje");
    var tituloEl = $("comProgresoTitulo");
    var detalleEl = $("comProgresoDetalle");
    var valor = Math.round(limitar(porcentaje, 0, 100));

    if (!panel || !barra) return;
    panel.hidden = false;
    barra.style.width = valor + "%";
    barra.classList.toggle("com-progress-working", trabajando === true && valor < 100);
    if (track) track.setAttribute("aria-valuenow", String(valor));
    if (porcentajeEl) porcentajeEl.textContent = valor + "%";
    if (tituloEl) tituloEl.textContent = texto(titulo || "Procesando");
    if (detalleEl) detalleEl.textContent = texto(detalle || "");
  }

  function crearIncidencia(carrera, materia, mensaje, etapa) {
    return {
      carrera: texto(carrera || "Carrera no identificada"),
      materia: texto(materia || "Materia no identificada"),
      mensaje: texto(mensaje || "Requiere revisión."),
      etapa: texto(etapa || "validación")
    };
  }

  function mostrarReporte(incidencias) {
    incidencias = Array.isArray(incidencias) ? incidencias : [];
    var panel = $("comReporteTodas");
    var total = $("comReporteTotal");
    var lista = $("comReporteLista");

    if (!panel || !lista) return;
    panel.hidden = incidencias.length === 0;
    if (total) total.textContent = String(incidencias.length);

    if (!incidencias.length) {
      lista.innerHTML = "";
      return;
    }

    var limite = 120;
    lista.innerHTML = incidencias.slice(0, limite).map(function (item) {
      return "<li><strong>" + escapar(item.carrera + " · " + item.materia) + "</strong>" +
        "<span>" + escapar(item.mensaje) + "</span></li>";
    }).join("") + (
      incidencias.length > limite
        ? "<li><strong>Más incidencias</strong><span>Se omitieron " + escapar(incidencias.length - limite) + " registros adicionales.</span></li>"
        : ""
    );
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

  function reservaDePrueba(fecha, indice) {
    var numero = typeof NS.Contador.formatearNumeroComunicado === "function"
      ? NS.Contador.formatearNumeroComunicado(indice + 1, fecha)
      : "COM-PRUEBA-" + String(indice + 1).padStart(2, "0");

    return {
      numero: numero,
      secuencia: indice + 1,
      mesKey: typeof NS.Contador.obtenerMesKey === "function" ? NS.Contador.obtenerMesKey(fecha) : "",
      fechaTexto: typeof NS.Contador.obtenerFechaLarga === "function" ? NS.Contador.obtenerFechaLarga(fecha) : "",
      provisional: true
    };
  }

  async function recopilarMaterias(fecha, configuracion) {
    await NS.BDLocal.inicializar();
    var carreras = await NS.BDLocal.obtenerCarreras();
    var registros = [];
    var detallesValidos = [];
    var materiasValidas = [];
    var incidencias = [];

    for (var i = 0; i < carreras.length; i += 1) {
      var carrera = carreras[i];
      var carreraNombre = nombreCarrera(carrera);
      actualizarProgreso(
        3 + ((i + 1) / Math.max(1, carreras.length)) * 17,
        "Consultando carreras",
        "Carrera " + (i + 1) + " de " + carreras.length + ": " + carreraNombre,
        true
      );

      try {
        var materias = await NS.BDLocal.obtenerMateriasPorCarrera(carrera.id, {
          soloCompletas: false,
          incluirRetiradas: false
        });
        materias.forEach(function (materia) {
          registros.push({
            carrera: carrera,
            carreraNombre: carreraNombre,
            materia: materia
          });
        });
      } catch (error) {
        incidencias.push(crearIncidencia(
          carreraNombre,
          "Todas las materias",
          error && error.message ? error.message : "No se pudieron consultar las materias.",
          "consulta"
        ));
      }
    }

    for (var j = 0; j < registros.length; j += 1) {
      var registro = registros[j];
      actualizarProgreso(
        20 + ((j + 1) / Math.max(1, registros.length)) * 30,
        "Validando PEA",
        "Materia " + (j + 1) + " de " + registros.length + ": " + nombreMateria(registro.materia),
        true
      );

      try {
        var detalle = await NS.BDLocal.obtenerDetalleMateriaComunicado(registro.materia.id);
        if (!detalle.estadoGeneracion || detalle.estadoGeneracion.puedeGenerar !== true) {
          var faltantes = detalle.estadoGeneracion && Array.isArray(detalle.estadoGeneracion.faltantes)
            ? detalle.estadoGeneracion.faltantes.join(", ")
            : "PEA incompleto";
          incidencias.push(crearIncidencia(
            registro.carreraNombre,
            nombreMateria(registro.materia),
            "Faltan: " + faltantes + ".",
            "PEA"
          ));
          continue;
        }

        detallesValidos.push(Object.assign({}, registro, { detalle: detalle }));
      } catch (error) {
        incidencias.push(crearIncidencia(
          registro.carreraNombre,
          nombreMateria(registro.materia),
          error && error.message ? error.message : "No se pudo leer el PEA.",
          "PEA"
        ));
      }
    }

    for (var k = 0; k < detallesValidos.length; k += 1) {
      var item = detallesValidos[k];
      actualizarProgreso(
        50 + ((k + 1) / Math.max(1, detallesValidos.length)) * 15,
        "Comprobando comunicados",
        "Revisando " + nombreMateria(item.materia),
        true
      );

      try {
        NS.Plantilla.generarDocumento(
          item.detalle,
          reservaDePrueba(fecha, k),
          configuracion
        );
        materiasValidas.push(item);
      } catch (error) {
        incidencias.push(crearIncidencia(
          item.carreraNombre,
          nombreMateria(item.materia),
          error && error.message ? error.message : "El comunicado no pudo construirse.",
          "plantilla"
        ));
      }
    }

    if (materiasValidas.length > MAXIMO_LOTE) {
      materiasValidas.slice(MAXIMO_LOTE).forEach(function (itemExcedente) {
        incidencias.push(crearIncidencia(
          itemExcedente.carreraNombre,
          nombreMateria(itemExcedente.materia),
          "No se incluyó porque el lote máximo es de " + MAXIMO_LOTE + " comunicados.",
          "límite"
        ));
      });
      materiasValidas = materiasValidas.slice(0, MAXIMO_LOTE);
    }

    var carrerasValidas = Object.create(null);
    materiasValidas.forEach(function (itemValido) {
      carrerasValidas[itemValido.carrera.id] = true;
    });

    return {
      carreras: carreras,
      carrerasConMaterias: Object.keys(carrerasValidas).length,
      materias: materiasValidas,
      totalRegistradas: registros.length,
      incidencias: incidencias,
      omitidas: incidencias.length
    };
  }

  function confirmarLote(datos) {
    return window.confirm([
      "Se generarán los comunicados válidos de todas las carreras.",
      "",
      "Carreras con comunicados: " + datos.carrerasConMaterias,
      "Comunicados listos: " + datos.materias.length,
      "Registros omitidos: " + datos.incidencias.length,
      "",
      "Los registros con errores no detendrán la descarga.",
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

  async function confirmarNumeracion(fecha, exitos, incidencias) {
    var errores = [];

    for (var i = 0; i < exitos.length; i += 1) {
      var exito = exitos[i];
      actualizarProgreso(
        96 + ((i + 1) / Math.max(1, exitos.length)) * 3,
        "Registrando numeración",
        "Comunicado " + (i + 1) + " de " + exitos.length,
        true
      );

      try {
        await NS.Contador.registrarNumeroManual(fecha, exito.reserva.secuencia, {
          materiaId: exito.item.materia.id,
          carreraId: exito.item.carrera.id,
          nombreMateria: nombreMateria(exito.item.materia),
          archivoPDF: exito.archivo.rutaZIP || exito.archivo.nombreArchivo || "",
          generadoEn: new Date().toISOString(),
          lote: "todas_las_carreras"
        });
      } catch (error) {
        var incidencia = crearIncidencia(
          exito.item.carreraNombre,
          nombreMateria(exito.item.materia),
          "El PDF se creó, pero no se confirmó la numeración: " +
            (error && error.message ? error.message : "error desconocido"),
          "numeración"
        );
        incidencias.push(incidencia);
        errores.push(incidencia);
      }
    }

    return errores;
  }

  async function generarTodasLasCarreras() {
    if (ejecutando) return;
    var incidencias = [];

    try {
      validarDependencias();
      setOcupado(true);
      mostrarReporte([]);
      actualizarProgreso(1, "Preparando lote general", "Consultando Firebase.", true);
      pintarEstado("neutral", "Preparando lote general", "Se descargarán los comunicados válidos.");

      var fecha = fechaSeleccionada();
      var configuracion = configPlantilla();
      var datos = await recopilarMaterias(fecha, configuracion);
      incidencias = datos.incidencias.slice();
      mostrarReporte(incidencias);

      if (!datos.materias.length) {
        actualizarProgreso(100, "Proceso terminado", "No hubo comunicados válidos para descargar.", false);
        pintarEstado(
          "warn",
          "No hay comunicados válidos",
          "Revisa las materias indicadas en el reporte."
        );
        return;
      }

      actualizarProgreso(
        66,
        "Revisión terminada",
        datos.materias.length + " comunicados listos y " + incidencias.length + " registros omitidos.",
        false
      );

      if (!confirmarLote(datos)) {
        pintarEstado("neutral", "Generación cancelada", "No se reservaron números ni se crearon archivos.");
        return;
      }

      actualizarProgreso(68, "Reservando numeración", "Preparando " + datos.materias.length + " números.", true);
      var reservas = await NS.Contador.preReservarBloque(
        fecha,
        datos.materias.length,
        { origen: "comunicados_todas_las_carreras" }
      );
      var preparados = [];

      for (var i = 0; i < datos.materias.length; i += 1) {
        var item = datos.materias[i];
        var reserva = reservas[i];
        actualizarProgreso(
          70 + ((i + 1) / Math.max(1, datos.materias.length)) * 10,
          "Preparando documentos",
          "Documento " + (i + 1) + " de " + datos.materias.length + ": " + nombreMateria(item.materia),
          true
        );

        try {
          var documento = NS.Plantilla.generarDocumento(
            item.detalle,
            reserva,
            configuracion
          );

          preparados.push({
            item: item,
            reserva: reserva,
            documento: documento,
            referencia: texto(item.materia.id)
          });
        } catch (error) {
          incidencias.push(crearIncidencia(
            item.carreraNombre,
            nombreMateria(item.materia),
            error && error.message ? error.message : "No se pudo preparar el documento.",
            "plantilla"
          ));
        }
      }

      if (!preparados.length) {
        await cancelarReservas("Ningún comunicado pudo prepararse.");
        mostrarReporte(incidencias);
        actualizarProgreso(100, "Proceso terminado", "No se pudo preparar ningún comunicado.", false);
        pintarEstado("warn", "Sin archivos para descargar", "Revisa las incidencias mostradas.");
        return;
      }

      actualizarProgreso(81, "Generando PDF", "Creando los archivos y organizándolos por carrera.", true);
      var resultado = await window.CurriculoElectron.guardarComunicadosZIPOrganizado({
        nombreArchivo: "Comunicados TODAS LAS CARRERAS " + fechaArchivo(fecha) + ".zip",
        documentos: preparados.map(function (preparado) {
          return {
            html: NS.PDF.construirHTMLFinalDocumento(preparado.documento),
            titulo: "Comunicado " + texto(preparado.documento.numeroComunicado || preparado.reserva.numero),
            nombreArchivo: NS.PDF.nombreArchivoComunicado(preparado.documento),
            carpeta: preparado.item.carreraNombre,
            referencia: preparado.referencia
          };
        })
      }, function (progreso) {
        progreso = progreso || {};
        var relativo = limitar(progreso.porcentaje, 0, 100);
        actualizarProgreso(
          81 + relativo * 0.14,
          texto(progreso.titulo || "Generando PDF"),
          texto(progreso.mensaje || "Procesando archivos."),
          true
        );
      });

      if (!resultado || resultado.ok !== true) {
        throw new Error(
          resultado && resultado.mensaje
            ? resultado.mensaje
            : "No se pudo generar el ZIP general."
        );
      }

      var preparadosPorReferencia = Object.create(null);
      preparados.forEach(function (preparado) {
        preparadosPorReferencia[preparado.referencia] = preparado;
      });

      (resultado.omitidos || []).forEach(function (omitido) {
        var preparado = preparadosPorReferencia[texto(omitido.referencia)];
        incidencias.push(crearIncidencia(
          preparado ? preparado.item.carreraNombre : texto(omitido.carpeta),
          preparado ? nombreMateria(preparado.item.materia) : texto(omitido.nombreArchivo),
          texto(omitido.mensaje || "Electron no pudo crear este PDF."),
          "PDF"
        ));
      });

      var exitos = [];
      (resultado.archivos || []).forEach(function (archivo, indice) {
        var preparado = preparadosPorReferencia[texto(archivo.referencia)] || preparados[indice];
        if (!preparado) return;
        exitos.push({
          item: preparado.item,
          reserva: preparado.reserva,
          archivo: archivo
        });
      });

      await confirmarNumeracion(fecha, exitos, incidencias);
      await cancelarReservas("Reservas de comunicados omitidos en el lote general.");

      if (typeof window.CurriculoElectron.mostrarArchivo === "function") {
        await window.CurriculoElectron.mostrarArchivo(resultado.ruta);
      }

      mostrarReporte(incidencias);
      actualizarProgreso(
        100,
        "Descarga terminada",
        resultado.cantidad + " PDF guardados en el ZIP.",
        false
      );

      var carpetas = Object.create(null);
      (resultado.archivos || []).forEach(function (archivo) {
        carpetas[texto(archivo.carpeta)] = true;
      });

      pintarEstado(
        incidencias.length ? "warn" : "ok",
        incidencias.length ? "ZIP generado con observaciones" : "Comunicados generados",
        resultado.cantidad + " PDF descargados en " + Object.keys(carpetas).length + " carpetas. " +
          (incidencias.length
            ? incidencias.length + " registros requieren revisión."
            : "Todos los comunicados se generaron correctamente.")
      );
    } catch (error) {
      await cancelarReservas("Falló la generación del ZIP de todas las carreras.");
      console.error("[Comunicados todas] Error:", error);
      mostrarReporte(incidencias);
      actualizarProgreso(
        100,
        "Proceso detenido",
        error && error.message ? error.message : "Error generando el lote.",
        false
      );
      pintarEstado(
        "error",
        "No se pudo completar",
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
    recopilarMaterias: recopilarMaterias,
    mostrarReporte: mostrarReporte,
    actualizarProgreso: actualizarProgreso
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})(window, document);
