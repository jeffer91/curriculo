/* =========================================================
Nombre completo: subir.main.js
Ruta o ubicación: /Curriculo/subir/subir.main.js
Función o funciones:
- Controlar la pantalla principal de subida ZIP.
- Gestionar selección de archivo, drag and drop, análisis, validación e importación.
- Coordinar ZIP, detector de estructura, detector de archivos, lectura Excel, validador, preview y BDLocal.
- Bloquear la importación cuando la lectura global de Excel falle o no genere datos procesados.
- Permitir importación con observaciones solo cuando exista información curricular recuperable.
- Mantener la carpeta subir independiente de bdlocal, comunicándose solo por subir.conexion-bdlocal.js.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;

  var estado = {
    archivoZip: null,
    paqueteDetectado: null,
    paqueteConExcel: null,
    paqueteValidado: null,
    procesando: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
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

  function formatoBytes(bytes) {
    bytes = Number(bytes || 0);

    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function requireModulo(nombre, path) {
    var partes = path.split(".");
    var ref = window;

    for (var i = 0; i < partes.length; i += 1) {
      ref = ref[partes[i]];

      if (!ref) {
        throw new Error("Falta cargar el módulo requerido: " + nombre);
      }
    }

    return ref;
  }

  function validarDependencias() {
    requireModulo("SubirCCC.Normalizador", "SubirCCC.Normalizador");
    requireModulo("SubirCCC.DetectorEstructura", "SubirCCC.DetectorEstructura");
    requireModulo("SubirCCC.DetectorArchivos", "SubirCCC.DetectorArchivos");
    requireModulo("SubirCCC.Zip", "SubirCCC.Zip");
    requireModulo("SubirCCC.Validador", "SubirCCC.Validador");
    requireModulo("SubirCCC.ConexionBDLocal", "SubirCCC.ConexionBDLocal");
    requireModulo("SubirCCC.Preview", "SubirCCC.Preview");
  }

  function cargarScriptUnaVez(src, verificarPath) {
    return new Promise(function (resolve, reject) {
      try {
        if (verificarPath) {
          var partes = verificarPath.split(".");
          var ref = window;

          for (var i = 0; i < partes.length; i += 1) {
            ref = ref[partes[i]];
            if (!ref) break;
          }

          if (ref) {
            resolve(ref);
            return;
          }
        }

        var existente = document.querySelector('script[src="' + src + '"]');

        if (existente) {
          existente.addEventListener("load", function () {
            resolve(true);
          });

          existente.addEventListener("error", function () {
            reject(new Error("No se pudo cargar: " + src));
          });

          setTimeout(function () {
            resolve(true);
          }, 300);

          return;
        }

        var script = document.createElement("script");
        script.src = src;
        script.async = false;

        script.onload = function () {
          resolve(true);
        };

        script.onerror = function () {
          reject(new Error("No se pudo cargar: " + src));
        };

        document.body.appendChild(script);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function asegurarExcelDisponible() {
    if (NS.Excel && typeof NS.Excel.enriquecerPaqueteConExcel === "function") {
      return NS.Excel;
    }

    await cargarScriptUnaVez("./subir.excel.js", "SubirCCC.Excel");

    if (!NS.Excel || typeof NS.Excel.enriquecerPaqueteConExcel !== "function") {
      throw new Error("No se pudo cargar subir.excel.js.");
    }

    return NS.Excel;
  }

  function setProcesando(valor) {
    estado.procesando = !!valor;

    var ids = [
      "btnAnalizar",
      "btnLimpiar",
      "btnImportar",
      "btnImportarObservaciones",
      "btnSeleccionarZip"
    ];

    ids.forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = estado.procesando;
    });

    var input = $("inputZip");
    if (input) input.disabled = estado.procesando;
  }

  function archivoEsZip(file) {
    if (!file) return false;

    var nombre = file.name || "";
    return /\.zip$/i.test(nombre);
  }

  function setArchivo(file) {
    if (!file) return;

    if (!archivoEsZip(file)) {
      NS.Preview.pintarEstado("error", "Archivo no válido", "Selecciona un archivo con extensión .zip.");
      estado.archivoZip = null;
      setTexto("archivoNombre", "Ningún archivo seleccionado");
      setTexto("archivoTamano", "");
      mostrar("archivoInfo", false);
      return;
    }

    estado.archivoZip = file;
    estado.paqueteDetectado = null;
    estado.paqueteConExcel = null;
    estado.paqueteValidado = null;

    setTexto("archivoNombre", file.name || "archivo.zip");
    setTexto("archivoTamano", formatoBytes(file.size || 0));
    mostrar("archivoInfo", true);
    mostrar("accionesImportacion", false);

    NS.Preview.pintarEstado("ok", "ZIP seleccionado", "Ahora puedes analizar la estructura interna.");
  }

  function limpiarTodo() {
    estado.archivoZip = null;
    estado.paqueteDetectado = null;
    estado.paqueteConExcel = null;
    estado.paqueteValidado = null;
    estado.procesando = false;

    var input = $("inputZip");
    if (input) input.value = "";

    setTexto("archivoNombre", "Ningún archivo seleccionado");
    setTexto("archivoTamano", "");
    mostrar("archivoInfo", false);

    NS.Preview.limpiarPreview();
  }

  function esExcelCurricular(archivo) {
    var extension = texto(archivo && archivo.extension).toLowerCase();
    return !!archivo && archivo.esExcel !== false &&
      ["xlsx", "xls", "xlsm", "csv"].indexOf(extension) !== -1;
  }

  function tieneDatosProcesados(archivo) {
    var datos = archivo && archivo.datosProcesados;

    if (!datos || typeof datos !== "object") return false;

    // PEA Unidades y PEA Actividades se procesan como arreglos. Antes se
    // rechazaban aquí y una carga correcta terminaba marcada como parcial.
    if (Array.isArray(datos)) return datos.length > 0;

    return Object.keys(datos).length > 0;
  }

  function diagnosticarArchivoLeido(archivo) {
    archivo = archivo || {};

    var error = texto(archivo.errorExcel || archivo.errorLectura);
    var tieneBinario = !!archivo.contenidoBinario || archivo.tieneContenidoBinario === true;
    var leido = archivo.excelLeido === true;
    var tieneDatos = tieneDatosProcesados(archivo);
    var estado = "correcto";
    var motivo = "El Excel fue leído y produjo información curricular.";

    if (error) {
      estado = "error_lectura";
      motivo = "No se pudo leer el contenido interno del Excel.";
    } else if (!tieneBinario) {
      estado = "sin_contenido_binario";
      motivo = "El archivo fue detectado, pero no se pudo extraer desde el ZIP.";
    } else if (!leido) {
      estado = "no_leido";
      motivo = "El archivo fue detectado, pero no quedó marcado como leído.";
    } else if (!tieneDatos) {
      estado = "sin_datos";
      motivo = "El Excel se abrió, pero no produjo información curricular procesada.";
    }

    return {
      archivoId: archivo.id || "",
      carreraId: archivo.carreraId || "",
      nivelId: archivo.nivelId || "",
      materiaId: archivo.materiaId || "",
      nombreArchivo: archivo.nombreArchivo || archivo.nombre || "",
      tipo: archivo.tipo || "",
      rutaOriginal: archivo.rutaOriginal || archivo.ruta || "",
      estado: estado,
      motivo: motivo,
      errorTecnico: error,
      excelLeido: leido,
      tieneContenidoBinario: tieneBinario,
      tieneDatosProcesados: tieneDatos
    };
  }

  function aplicarControlLectura(paqueteClasificado, paqueteLeido, errorGeneral) {
    var paquete = Object.assign({}, paqueteLeido || paqueteClasificado || {});
    var detectados = (paqueteClasificado.archivos || []).filter(esExcelCurricular);
    var resultados = (paquete.archivos || []).filter(esExcelCurricular);
    var conBinario = detectados.filter(function (archivo) {
      return !!archivo.contenidoBinario || archivo.tieneContenidoBinario === true;
    });
    var leidos = resultados.filter(function (archivo) {
      return archivo.excelLeido === true && !archivo.errorExcel && !archivo.errorLectura;
    });
    var conDatos = leidos.filter(tieneDatosProcesados);
    var errores = resultados.filter(function (archivo) {
      return !!(archivo.errorExcel || archivo.errorLectura);
    });
    var diagnosticoArchivos = resultados.map(diagnosticarArchivoLeido);
    var archivosProblema = diagnosticoArchivos.filter(function (archivo) {
      return archivo.estado !== "correcto";
    });
    var motivos = [];

    if (detectados.length > 0 && conBinario.length === 0) {
      motivos.push("Los Excel fueron detectados, pero no se pudo extraer su contenido del ZIP.");
    }

    if (detectados.length > 0 && leidos.length === 0) {
      motivos.push("Ningún Excel curricular pudo leerse correctamente.");
    }

    if (leidos.length > 0 && conDatos.length === 0) {
      motivos.push("Los Excel se abrieron, pero no produjeron información curricular procesada.");
    }

    if (errorGeneral) {
      motivos.push("La lectura general de Excel falló: " + (errorGeneral.message || errorGeneral));
    }

    var control = {
      generadoEn: new Date().toISOString(),
      totalExcelDetectados: detectados.length,
      totalExcelConBinario: conBinario.length,
      totalExcelLeidos: leidos.length,
      totalConDatosProcesados: conDatos.length,
      totalErroresExcel: errores.length,
      totalNoLeidos: diagnosticoArchivos.filter(function (archivo) {
        return archivo.estado === "no_leido" || archivo.estado === "sin_contenido_binario";
      }).length,
      totalSinDatos: diagnosticoArchivos.filter(function (archivo) {
        return archivo.estado === "sin_datos";
      }).length,
      totalProblemas: archivosProblema.length,
      lecturaParcial: detectados.length > 0 &&
        (leidos.length < detectados.length || conDatos.length < leidos.length),
      tieneDatosRecuperables: conDatos.length > 0,
      bloqueaImportacion: motivos.length > 0,
      motivosBloqueo: motivos,
      archivos: diagnosticoArchivos,
      archivosProblema: archivosProblema
    };

    var advertencias = Array.isArray(paquete.advertencias)
      ? paquete.advertencias.slice()
      : [];

    if (control.bloqueaImportacion) {
      advertencias.push({
        tipo: "lectura_excel_total_fallida",
        severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "No se obtuvo contenido curricular válido de los Excel. La importación fue bloqueada.",
        detalle: control
      });
    } else if (control.lecturaParcial) {
      advertencias.push({
        tipo: "lectura_excel_parcial",
        severidad: "advertencia",
        bloqueaImportacion: false,
        mensaje: archivosProblema.length + " de " + detectados.length +
          " Excel requieren revisión. Consulta el detalle por materia y archivo.",
        detalle: control
      });
    }

    return Object.assign({}, paquete, {
      advertencias: advertencias,
      diagnosticoExcel: Object.assign({}, paquete.diagnosticoExcel || {}, {
        generadoEn: control.generadoEn,
        totalExcelDetectados: control.totalExcelDetectados,
        totalExcelConBinario: control.totalExcelConBinario,
        totalExcelLeidos: control.totalExcelLeidos,
        totalConDatosProcesados: control.totalConDatosProcesados,
        totalErroresExcel: control.totalErroresExcel,
        totalNoLeidos: control.totalNoLeidos,
        totalSinDatos: control.totalSinDatos,
        totalProblemas: control.totalProblemas,
        archivos: control.archivos,
        archivosProblema: control.archivosProblema,
        error: errorGeneral ? (errorGeneral.message || texto(errorGeneral)) : "",
        controlLectura: control
      })
    });
  }

  async function enriquecerConExcel(paqueteClasificado) {
    try {
      var Excel = await asegurarExcelDisponible();

      NS.Preview.pintarProgreso({
        porcentaje: 80,
        mensaje: "Leyendo contenido interno de los Excel..."
      });

      var paqueteLeido = await Excel.enriquecerPaqueteConExcel(paqueteClasificado, {
        maxFilasPorHoja: 3000,
        onProgress: function (data) {
          NS.Preview.pintarProgreso(data);
        }
      });

      return aplicarControlLectura(paqueteClasificado, paqueteLeido, null);
    } catch (error) {
      console.error("[SubirCCC.Main] Falló la lectura general de Excel:", error);
      return aplicarControlLectura(paqueteClasificado, paqueteClasificado, error);
    }
  }

  function mensajeErrorAnalisis(error) {
    var mensaje = texto(error && error.message) || "No se pudo procesar el archivo.";
    var normalizado = mensaje.toLowerCase();

    if (normalizado.indexOf("jszip") !== -1) {
      return "No se pudo abrir el ZIP porque JSZip no está disponible. Ejecuta npm install y vuelve a iniciar la aplicación.";
    }

    if (
      normalizado.indexOf("central directory") !== -1 ||
      normalizado.indexOf("corrupt") !== -1 ||
      normalizado.indexOf("can't find end") !== -1
    ) {
      return "El archivo ZIP parece estar dañado o no tiene una estructura ZIP válida.";
    }

    return mensaje;
  }

  async function analizarZIP() {
    if (estado.procesando) return;

    if (!estado.archivoZip) {
      NS.Preview.pintarEstado("error", "No hay ZIP", "Selecciona un archivo ZIP antes de analizar.");
      return;
    }

    estado.paqueteDetectado = null;
    estado.paqueteConExcel = null;
    estado.paqueteValidado = null;
    mostrar("accionesImportacion", false);

    try {
      setProcesando(true);

      NS.Preview.pintarEstado("neutral", "Analizando ZIP", "Leyendo carpetas, niveles, materias y archivos Excel.");
      NS.Preview.pintarProgreso({
        porcentaje: 4,
        mensaje: "Preparando lectura..."
      });

      var paqueteClasificado = await NS.Zip.leerDetectarYClasificar(estado.archivoZip, {
        leerContenidoExcel: true,
        onProgress: function (data) {
          NS.Preview.pintarProgreso(data);
        }
      });

      estado.paqueteDetectado = paqueteClasificado;

      var paqueteConExcel = await enriquecerConExcel(paqueteClasificado);
      estado.paqueteConExcel = paqueteConExcel;

      NS.Preview.pintarProgreso({
        porcentaje: 94,
        mensaje: "Validando materias, lectura y archivos obligatorios..."
      });

      var paqueteValidado = NS.Validador.validarPaquete(paqueteConExcel, {
        lanzarSiBloquea: false
      });

      estado.paqueteValidado = paqueteValidado;

      NS.Preview.pintarProgreso({
        porcentaje: 100,
        mensaje: "Análisis completado."
      });

      setTimeout(function () {
        NS.Preview.ocultarProgreso();
      }, 450);

      NS.Preview.pintarPaquete(paqueteValidado);
    } catch (error) {
      console.error(error);
      estado.paqueteDetectado = null;
      estado.paqueteConExcel = null;
      estado.paqueteValidado = null;
      NS.Preview.ocultarProgreso();
      NS.Preview.pintarEstado("error", "Error al analizar ZIP", mensajeErrorAnalisis(error));
    } finally {
      setProcesando(false);

      var btnImportar = $("btnImportar");
      var btnImportarObservaciones = $("btnImportarObservaciones");
      var resumen = estado.paqueteValidado
        ? estado.paqueteValidado.resumenValidacion || {}
        : {};
      var control = estado.paqueteValidado && estado.paqueteValidado.diagnosticoExcel
        ? estado.paqueteValidado.diagnosticoExcel.controlLectura || {}
        : {};
      var bloqueado = !estado.paqueteValidado ||
        resumen.bloqueaImportacion === true ||
        control.bloqueaImportacion === true;

      if (btnImportar) {
        btnImportar.disabled = bloqueado || resumen.requiereRevision === true;
      }

      if (btnImportarObservaciones) {
        btnImportarObservaciones.disabled = bloqueado;
      }
    }
  }

  async function importar(importarConRevision) {
    if (estado.procesando) return;

    if (!estado.paqueteValidado) {
      NS.Preview.pintarEstado("error", "No hay paquete validado", "Primero analiza un ZIP.");
      return;
    }

    var control = estado.paqueteValidado.diagnosticoExcel
      ? estado.paqueteValidado.diagnosticoExcel.controlLectura || {}
      : {};

    if (control.bloqueaImportacion === true) {
      NS.Preview.pintarEstado(
        "error",
        "Importación bloqueada",
        control.motivosBloqueo && control.motivosBloqueo.length
          ? control.motivosBloqueo.join(" ")
          : "La lectura de los Excel no produjo contenido curricular válido."
      );
      return;
    }

    if (
      Number(control.totalExcelDetectados || 0) > 0 &&
      Number(control.totalConDatosProcesados || 0) === 0
    ) {
      NS.Preview.pintarEstado("error", "Importación bloqueada", "No existe contenido Excel procesado para guardar en BDLocal.");
      return;
    }

    var resumen = estado.paqueteValidado.resumenValidacion || {};

    if (resumen.bloqueaImportacion) {
      NS.Preview.pintarEstado("error", "Importación bloqueada", "Existen errores críticos que impiden guardar.");
      return;
    }

    if (resumen.requiereRevision && importarConRevision !== true) {
      NS.Preview.pintarEstado("warn", "Requiere revisión", "Usa el botón de importar con observaciones.");
      return;
    }

    if (resumen.requiereRevision && importarConRevision === true) {
      var confirma = window.confirm(
        "El ZIP tiene observaciones.\n\n" +
        "Se importará únicamente la información curricular que pudo leerse y validarse.\n\n" +
        "Las materias o archivos con errores quedarán señalados para revisión en BDLocal.\n\n" +
        "¿Deseas continuar?"
      );

      if (!confirma) return;
    }

    try {
      setProcesando(true);

      NS.Preview.pintarEstado("neutral", "Importando a BDLocal", "Guardando carreras, niveles, materias, archivos y datos Excel.");
      NS.Preview.pintarProgreso({
        porcentaje: 10,
        mensaje: "Iniciando importación..."
      });

      var resultado = await NS.ConexionBDLocal.importarPaquete(estado.paqueteValidado, {
        importarConRevision: importarConRevision === true,
        conservarContenidoBinario: true,
        bloquearCriticos: true
      });

      NS.Preview.pintarProgreso({
        porcentaje: 100,
        mensaje: "Importación completada."
      });

      setTimeout(function () {
        NS.Preview.ocultarProgreso();
      }, 450);

      NS.Preview.mostrarResultadoImportacion(resultado);
      mostrar("linkBDLocal", true);
    } catch (error) {
      console.error(error);
      NS.Preview.ocultarProgreso();
      NS.Preview.pintarEstado("error", "Error al importar", error.message || "No se pudo guardar en BDLocal.");
    } finally {
      setProcesando(false);
    }
  }

  function configurarInput() {
    var input = $("inputZip");
    var btnSeleccionar = $("btnSeleccionarZip");

    if (btnSeleccionar && input) {
      btnSeleccionar.addEventListener("click", function () {
        input.click();
      });
    }

    if (input) {
      input.addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (file) setArchivo(file);
      });
    }
  }

  function configurarDropZone() {
    var dropZone = $("dropZone");

    if (!dropZone) return;

    ["dragenter", "dragover"].forEach(function (evento) {
      dropZone.addEventListener(evento, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("subir-drop-active");
      });
    });

    ["dragleave", "drop"].forEach(function (evento) {
      dropZone.addEventListener(evento, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("subir-drop-active");
      });
    });

    dropZone.addEventListener("drop", function (e) {
      var files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;

      if (!files || !files.length) return;

      setArchivo(files[0]);
    });
  }

  function configurarBotones() {
    var btnAnalizar = $("btnAnalizar");
    var btnLimpiar = $("btnLimpiar");
    var btnImportar = $("btnImportar");
    var btnImportarObservaciones = $("btnImportarObservaciones");
    var btnProbarBD = $("btnProbarBD");

    if (btnAnalizar) {
      btnAnalizar.addEventListener("click", analizarZIP);
    }

    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", limpiarTodo);
    }

    if (btnImportar) {
      btnImportar.addEventListener("click", function () {
        importar(false);
      });
    }

    if (btnImportarObservaciones) {
      btnImportarObservaciones.addEventListener("click", function () {
        importar(true);
      });
    }

    if (btnProbarBD) {
      btnProbarBD.addEventListener("click", async function () {
        try {
          NS.Preview.pintarEstado("neutral", "Probando BDLocal", "Verificando conexión con IndexedDB.");
          var res = await NS.ConexionBDLocal.probarConexion();

          if (res.ok) {
            NS.Preview.pintarEstado("ok", "BDLocal conectada", "La base local está lista para recibir información.");
          } else {
            NS.Preview.pintarEstado("error", "BDLocal no disponible", res.mensaje || "No se pudo conectar.");
          }
        } catch (error) {
          NS.Preview.pintarEstado("error", "BDLocal no disponible", error.message || "Error desconocido.");
        }
      });
    }
  }

  function configurarEventosImportacion() {
    window.addEventListener("subirccc:importacion-progreso", function (event) {
      NS.Preview.pintarProgreso(event.detail || {});
    });

    window.addEventListener("subirccc:importacion-fin", function (event) {
      NS.Preview.pintarProgreso(event.detail || {});
    });
  }

  async function iniciar() {
    try {
      validarDependencias();

      NS.Preview.conectarEventosUI();
      NS.Preview.limpiarPreview();

      configurarInput();
      configurarDropZone();
      configurarBotones();
      configurarEventosImportacion();

      var conexion = await NS.ConexionBDLocal.probarConexion();

      if (conexion.ok) {
        NS.Preview.pintarEstado("neutral", "Esperando ZIP", "BDLocal está disponible. Selecciona un archivo .zip.");
      } else {
        NS.Preview.pintarEstado("warn", "BDLocal no conectada", conexion.mensaje || "Puedes analizar, pero no importar todavía.");
      }
    } catch (error) {
      console.error(error);

      if (NS.Preview && typeof NS.Preview.pintarEstado === "function") {
        NS.Preview.pintarEstado("error", "Error inicializando pantalla", error.message || "Faltan dependencias.");
      } else {
        alert(error.message || "Error inicializando pantalla.");
      }
    }
  }

  NS.Main = {
    iniciar: iniciar,
    analizarZIP: analizarZIP,
    importar: importar,
    limpiarTodo: limpiarTodo,
    setArchivo: setArchivo,
    asegurarExcelDisponible: asegurarExcelDisponible,
    aplicarControlLectura: aplicarControlLectura,
    getEstado: function () {
      return Object.assign({}, estado);
    }
  };

  document.addEventListener("DOMContentLoaded", iniciar);
})(window, document);
