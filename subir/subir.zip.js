/* =========================================================
Nombre completo: subir.zip.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.zip.js
Función o funciones:
- Leer archivos ZIP cargados desde la pantalla subir.
- Esperar correctamente la carga de JSZip mediante window.__JSZipReady.
- Extraer rutas internas, carpetas y archivos del ZIP usando JSZip.
- Identificar archivos Excel dentro del ZIP sin depender de nombres exactos.
- Conservar contenido binario de los Excel para lectura posterior con XLSX.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;
  var N = NS.Normalizador || null;

  function fechaISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizadorDisponible() {
    if (!N && window.SubirCCC && window.SubirCCC.Normalizador) {
      N = window.SubirCCC.Normalizador;
    }

    if (!N) {
      throw new Error("Falta cargar primero subir.normalizador.js.");
    }

    return N;
  }

  async function jszipDisponible() {
    if (window.JSZip) {
      return window.JSZip;
    }

    if (window.__JSZipReady && typeof window.__JSZipReady.then === "function") {
      await window.__JSZipReady;

      if (window.JSZip) {
        return window.JSZip;
      }
    }

    throw new Error(
      "JSZip no está disponible. Revisa /libs/jszip.min.js y que esté cargado antes de subir.zip.js."
    );
  }

  function obtenerNombreArchivo(file) {
    return file && file.name ? file.name : "carga-ccc.zip";
  }

  function obtenerTamanoArchivo(file) {
    return file && typeof file.size === "number" ? file.size : 0;
  }

  function validarArchivoZip(file) {
    var NLocal = normalizadorDisponible();

    if (!file) {
      throw new Error("No se recibió ningún archivo ZIP.");
    }

    var nombre = obtenerNombreArchivo(file);
    var extension = NLocal.extensionArchivo(nombre);

    if (extension !== "zip") {
      throw new Error("El archivo seleccionado no es ZIP. Archivo recibido: " + nombre);
    }

    return true;
  }

  function debeIgnorarRuta(ruta) {
    var NLocal = normalizadorDisponible();
    var partes = NLocal.dividirRuta(ruta);
    var nombre = partes.length ? partes[partes.length - 1] : "";

    if (!ruta) return true;

    var rutaNorm = NLocal.normalizarComparacion(ruta);

    if (rutaNorm.includes("__macosx")) return true;
    if (rutaNorm.includes(".ds store")) return true;
    if (rutaNorm.includes("thumbs db")) return true;
    if (rutaNorm.includes("desktop ini")) return true;
    if (nombre.indexOf("~$") === 0) return true;

    return false;
  }

  function obtenerExtension(nombreArchivo) {
    var NLocal = normalizadorDisponible();
    return NLocal.extensionArchivo(nombreArchivo);
  }

  function esArchivoSoportado(nombreArchivo) {
    var extension = obtenerExtension(nombreArchivo);

    return [
      "xlsx",
      "xls",
      "xlsm",
      "csv",
      "pdf",
      "doc",
      "docx",
      "txt",
      "png",
      "jpg",
      "jpeg"
    ].indexOf(extension) !== -1;
  }

  function construirCarpetaDesdeRuta(ruta) {
    var NLocal = normalizadorDisponible();
    var partes = NLocal.dividirRuta(ruta);

    return {
      ruta: ruta,
      nombre: partes.length ? partes[partes.length - 1] : ruta,
      partes: partes,
      tipo: "carpeta",
      dir: true,
      esArchivo: false,
      creadoEn: fechaISO()
    };
  }

  function obtenerTamanoEntrada(entry) {
    try {
      if (entry && entry._data && typeof entry._data.uncompressedSize === "number") {
        return entry._data.uncompressedSize;
      }
    } catch (error) {
      return 0;
    }

    return 0;
  }

  async function construirArchivoDesdeZip(entry, opciones) {
    opciones = opciones || {};

    var NLocal = normalizadorDisponible();

    var ruta = texto(entry.name);
    var partes = NLocal.dividirRuta(ruta);
    var nombreArchivo = partes.length ? partes[partes.length - 1] : ruta;
    var extension = NLocal.extensionArchivo(nombreArchivo);
    var excel = NLocal.esExcel(nombreArchivo);
    var tamano = obtenerTamanoEntrada(entry);

    var entrada = {
      ruta: ruta,
      path: ruta,
      rutaOriginal: ruta,
      nombre: nombreArchivo,
      name: nombreArchivo,
      nombreArchivo: nombreArchivo,
      partes: partes,
      extension: extension,
      tipo: "archivo",
      tipoEntrada: "archivo",
      dir: false,
      esArchivo: true,
      esExcel: excel,
      esSoportado: esArchivoSoportado(nombreArchivo),
      tamanoBytes: tamano,
      contenidoBinario: null,
      tieneContenidoBinario: false,
      creadoEn: fechaISO(),
      actualizadoEn: fechaISO()
    };

    var leerContenidoExcel = opciones.leerContenidoExcel !== false;
    var leerContenidoTodos = opciones.leerContenidoTodos === true;

    if ((excel && leerContenidoExcel) || leerContenidoTodos) {
      try {
        entrada.contenidoBinario = await entry.async("arraybuffer");
        entrada.tamanoBytes = entrada.contenidoBinario ? entrada.contenidoBinario.byteLength : tamano;
        entrada.tieneContenidoBinario = !!entrada.contenidoBinario;
      } catch (error) {
        entrada.errorLectura = error.message;
        entrada.tieneContenidoBinario = false;
      }
    }

    return entrada;
  }

  function construirResumen(nombreZip, tamanoZip, carpetas, archivos) {
    var NLocal = normalizadorDisponible();

    var excel = archivos.filter(function (archivo) {
      return archivo.esExcel;
    });

    var soportados = archivos.filter(function (archivo) {
      return archivo.esSoportado;
    });

    return {
      nombreZip: nombreZip,
      tamanoZipBytes: tamanoZip,
      procesadoEn: fechaISO(),
      totalCarpetas: carpetas.length,
      totalArchivos: archivos.length,
      totalExcel: excel.length,
      totalSoportados: soportados.length,
      totalNoSoportados: archivos.length - soportados.length,
      archivosBaseProbables: excel.filter(function (a) {
        return NLocal.normalizarComparacion(a.nombreArchivo).includes("base");
      }).length,
      archivosUnidadesProbables: excel.filter(function (a) {
        var n = NLocal.normalizarComparacion(a.nombreArchivo);
        return n.includes("unidad") || n.includes("unidades") || n.includes("contenido");
      }).length,
      archivosActividadesProbables: excel.filter(function (a) {
        var n = NLocal.normalizarComparacion(a.nombreArchivo);
        return n.includes("actividad") || n.includes("actividades");
      }).length
    };
  }

  function notificarProgreso(opciones, data) {
    if (opciones && typeof opciones.onProgress === "function") {
      try {
        opciones.onProgress(data);
      } catch (error) {
        console.warn("[SubirCCC.Zip] Error en callback de progreso:", error);
      }
    }
  }

  async function leerZIP(file, opciones) {
    opciones = opciones || {};

    var JSZipLocal = await jszipDisponible();
    var NLocal = normalizadorDisponible();

    validarArchivoZip(file);

    var nombreZip = obtenerNombreArchivo(file);
    var tamanoZip = obtenerTamanoArchivo(file);

    notificarProgreso(opciones, {
      etapa: "inicio",
      mensaje: "Cargando JSZip y leyendo archivo ZIP...",
      porcentaje: 5
    });

    var zip = await JSZipLocal.loadAsync(file);

    var entradasRaw = [];
    var carpetasMap = {};
    var archivos = [];

    zip.forEach(function (relativePath, entry) {
      if (debeIgnorarRuta(relativePath)) return;

      entradasRaw.push({
        relativePath: relativePath,
        entry: entry
      });

      var partes = NLocal.dividirRuta(relativePath);

      if (entry.dir) {
        carpetasMap[relativePath.replace(/\/$/, "")] = construirCarpetaDesdeRuta(relativePath.replace(/\/$/, ""));
        return;
      }

      for (var i = 1; i < partes.length; i += 1) {
        var rutaCarpeta = partes.slice(0, i).join("/");

        if (rutaCarpeta && !carpetasMap[rutaCarpeta]) {
          carpetasMap[rutaCarpeta] = construirCarpetaDesdeRuta(rutaCarpeta);
        }
      }
    });

    var archivosRaw = entradasRaw.filter(function (item) {
      return item.entry && !item.entry.dir;
    });

    var total = archivosRaw.length;

    for (var i = 0; i < archivosRaw.length; i += 1) {
      var item = archivosRaw[i];

      notificarProgreso(opciones, {
        etapa: "extrayendo",
        mensaje: "Procesando archivo " + (i + 1) + " de " + total,
        actual: i + 1,
        total: total,
        porcentaje: total ? Math.round(((i + 1) / total) * 65) + 10 : 75,
        ruta: item.relativePath
      });

      var archivo = await construirArchivoDesdeZip(item.entry, opciones);
      archivos.push(archivo);
    }

    var carpetas = Object.keys(carpetasMap).map(function (key) {
      return carpetasMap[key];
    });

    var resumen = construirResumen(nombreZip, tamanoZip, carpetas, archivos);

    notificarProgreso(opciones, {
      etapa: "zip_finalizado",
      mensaje: "ZIP leído correctamente.",
      porcentaje: 78,
      resumen: resumen
    });

    return {
      ok: true,
      nombreZip: nombreZip,
      tamanoZipBytes: tamanoZip,
      leidoEn: fechaISO(),
      carpetas: carpetas,
      archivos: archivos,
      entradas: carpetas.concat(archivos),
      resumen: resumen
    };
  }

  async function leerDesdeInput(inputFile, opciones) {
    if (!inputFile) {
      throw new Error("No se recibió archivo desde el input.");
    }

    return await leerZIP(inputFile, opciones || {});
  }

  function construirEntradasParaDetector(resultadoZip) {
    if (!resultadoZip || !Array.isArray(resultadoZip.archivos)) {
      return [];
    }

    return resultadoZip.archivos.map(function (archivo) {
      return {
        ruta: archivo.rutaOriginal || archivo.ruta,
        path: archivo.rutaOriginal || archivo.ruta,
        nombre: archivo.nombreArchivo,
        name: archivo.nombreArchivo,
        nombreArchivo: archivo.nombreArchivo,
        extension: archivo.extension,
        tipo: "archivo",
        dir: false,
        esArchivo: true,
        esExcel: archivo.esExcel,
        tamanoBytes: archivo.tamanoBytes,
        contenidoBinario: archivo.contenidoBinario || null,
        tieneContenidoBinario: !!archivo.contenidoBinario,
        errorLectura: archivo.errorLectura || ""
      };
    });
  }

  function copiarContenidoBinarioAArchivos(paquete, entradas) {
    var mapa = {};

    entradas.forEach(function (entrada) {
      mapa[entrada.rutaOriginal || entrada.ruta || entrada.path] = entrada;
    });

    paquete.archivos = (paquete.archivos || []).map(function (archivo) {
      var entrada = mapa[archivo.rutaOriginal] || mapa[archivo.ruta];

      if (!entrada) return archivo;

      return Object.assign({}, archivo, {
        contenidoBinario: entrada.contenidoBinario || null,
        tieneContenidoBinario: !!entrada.contenidoBinario,
        tamanoBytes: entrada.tamanoBytes || archivo.tamanoBytes || 0,
        errorLectura: entrada.errorLectura || archivo.errorLectura || ""
      });
    });

    return paquete;
  }

  async function leerYDetectarEstructura(file, opciones) {
    opciones = opciones || {};

    var resultadoZip = await leerZIP(file, opciones);

    if (!NS.DetectorEstructura || typeof NS.DetectorEstructura.detectarEstructura !== "function") {
      throw new Error("Falta cargar subir.detector-estructura.js.");
    }

    var entradas = construirEntradasParaDetector(resultadoZip);

    var paquete = NS.DetectorEstructura.detectarEstructura(entradas, {
      nombreZip: resultadoZip.nombreZip
    });

    paquete = copiarContenidoBinarioAArchivos(paquete, entradas);

    paquete.zip = {
      nombreZip: resultadoZip.nombreZip,
      tamanoZipBytes: resultadoZip.tamanoZipBytes,
      resumen: resultadoZip.resumen
    };

    return paquete;
  }

  async function leerDetectarYClasificar(file, opciones) {
    opciones = opciones || {};

    var paquete = await leerYDetectarEstructura(file, opciones);

    if (!NS.DetectorArchivos || typeof NS.DetectorArchivos.enriquecerPaquete !== "function") {
      throw new Error("Falta cargar subir.detector-archivos.js.");
    }

    return NS.DetectorArchivos.enriquecerPaquete(paquete);
  }

  NS.Zip = {
    validarArchivoZip: validarArchivoZip,
    leerZIP: leerZIP,
    leerDesdeInput: leerDesdeInput,
    construirEntradasParaDetector: construirEntradasParaDetector,
    leerYDetectarEstructura: leerYDetectarEstructura,
    leerDetectarYClasificar: leerDetectarYClasificar,
    debeIgnorarRuta: debeIgnorarRuta,
    jszipDisponible: jszipDisponible
  };
})(window);