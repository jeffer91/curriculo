/* =========================================================
Nombre completo: subir.main.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.main.js
Función o funciones:
- Controlar la pantalla principal de subida ZIP.
- Gestionar selección de archivo, drag and drop, análisis, validación e importación.
- Coordinar ZIP, detector de estructura, detector de archivos, lectura Excel, validador, preview y BDLocal.
- Cargar dinámicamente subir.excel.js si todavía no fue agregado al HTML.
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

  async function enriquecerConExcel(paqueteClasificado) {
    try {
      var Excel = await asegurarExcelDisponible();

      NS.Preview.pintarProgreso({
        porcentaje: 80,
        mensaje: "Leyendo contenido interno de los Excel..."
      });

      return await Excel.enriquecerPaqueteConExcel(paqueteClasificado, {
        maxFilasPorHoja: 3000,
        onProgress: function (data) {
          NS.Preview.pintarProgreso(data);
        }
      });
    } catch (error) {
      console.warn("[SubirCCC.Main] No se pudo leer Excel internamente:", error);

      var advertencias = Array.isArray(paqueteClasificado.advertencias)
        ? paqueteClasificado.advertencias.slice()
        : [];

      advertencias.push({
        tipo: "xlsx_no_disponible",
        severidad: "advertencia",
        mensaje: "No se pudo leer internamente los Excel. Se importará la clasificación de archivos.",
        error: error.message
      });

      return Object.assign({}, paqueteClasificado, {
        advertencias: advertencias,
        diagnosticoExcel: {
          generadoEn: new Date().toISOString(),
          totalExcelLeidos: 0,
          error: error.message
        }
      });
    }
  }

  async function analizarZIP() {
    if (estado.procesando) return;

    if (!estado.archivoZip) {
      NS.Preview.pintarEstado("error", "No hay ZIP", "Selecciona un archivo ZIP antes de analizar.");
      return;
    }

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
        mensaje: "Validando materias y archivos obligatorios..."
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
      NS.Preview.ocultarProgreso();
      NS.Preview.pintarEstado("error", "Error al analizar ZIP", error.message || "No se pudo procesar el archivo.");
    } finally {
      setProcesando(false);

      var btnImportar = $("btnImportar");
      var btnImportarObservaciones = $("btnImportarObservaciones");

      if (btnImportar && estado.paqueteValidado) {
        var resumen = estado.paqueteValidado.resumenValidacion || {};
        btnImportar.disabled = resumen.bloqueaImportacion === true || resumen.requiereRevision === true;
      }

      if (btnImportarObservaciones && estado.paqueteValidado) {
        var r = estado.paqueteValidado.resumenValidacion || {};
        btnImportarObservaciones.disabled = r.bloqueaImportacion === true;
      }
    }
  }

  async function importar(importarConRevision) {
    if (estado.procesando) return;

    if (!estado.paqueteValidado) {
      NS.Preview.pintarEstado("error", "No hay paquete validado", "Primero analiza un ZIP.");
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
        "Se importarán las materias completas e incompletas para que puedas revisarlas en BDLocal.\n\n" +
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
    getEstado: function () {
      return Object.assign({}, estado);
    }
  };

  document.addEventListener("DOMContentLoaded", iniciar);
})(window, document);