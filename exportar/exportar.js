/* =========================================================
Nombre completo: exportar.js
Ruta o ubicación: /Curriculo/exportar/exportar.js
Funciones:
- Cargar el respaldo completo desde Firebase.
- Mostrar progreso, conteos y errores por colección.
- Generar TXT con JSON completo.
- Generar XLSX con resumen y una hoja por colección.
- Guardar archivos mediante Electron o descarga del navegador.
========================================================= */
(function (window, document) {
  "use strict";

  var estado = {
    respaldo: null,
    cargando: false
  };

  function $(id) {
    return document.getElementById(id);
  }

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

  function setEstado(tipo, titulo, mensaje) {
    var el = $("expEstado");
    if (!el) return;
    el.className = "exp-status exp-status-" + (tipo || "neutral");
    $("expTituloEstado").textContent = titulo || "Estado";
    $("expMensajeEstado").textContent = mensaje || "";
  }

  function setCargando(valor) {
    estado.cargando = !!valor;
    ["btnCargar", "btnTxt", "btnExcel"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (id === "btnCargar") el.disabled = estado.cargando;
      else el.disabled = estado.cargando || !estado.respaldo;
    });
  }

  function setProgreso(datos) {
    datos = datos || {};
    var wrap = $("expProgressWrap");
    if (!wrap) return;

    wrap.hidden = false;
    var porcentaje = Math.max(0, Math.min(100, Number(datos.porcentaje || 0)));
    $("expProgressTexto").textContent = datos.mensaje || "Leyendo Firebase...";
    $("expProgressPorcentaje").textContent = Math.round(porcentaje) + "%";
    $("expProgressBar").style.width = porcentaje + "%";
  }

  function ocultarProgreso() {
    var wrap = $("expProgressWrap");
    if (wrap) wrap.hidden = true;
  }

  function fechaLegible(iso) {
    var fecha = new Date(iso || Date.now());
    if (Number.isNaN(fecha.getTime())) return texto(iso);
    return fecha.toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function fechaArchivo() {
    var d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-") + "_" + [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0")
    ].join("-");
  }

  function pintarResumen(respaldo) {
    respaldo = respaldo || {};
    $("kpiColecciones").textContent = Number(respaldo.coleccionesLeidas || 0) + "/" + Number(respaldo.totalColecciones || 0);
    $("kpiColeccionesDetalle").textContent = Number(respaldo.totalColecciones || 0) + " colecciones previstas";
    $("kpiRegistros").textContent = Number(respaldo.totalRegistros || 0).toLocaleString("es-EC");
    $("kpiErrores").textContent = Array.isArray(respaldo.errores) ? respaldo.errores.length : 0;
    $("kpiErroresDetalle").textContent = respaldo.errores && respaldo.errores.length
      ? "Revisa la tabla antes de descargar"
      : "Lectura completa";
    $("kpiProyecto").textContent = respaldo.proyectoId || "curriculo-ddfcd";
    $("kpiFecha").textContent = respaldo.generadoEn
      ? "Cargado " + fechaLegible(respaldo.generadoEn)
      : "Sin respaldo cargado";

    var filas = Array.isArray(respaldo.resumen) ? respaldo.resumen : [];
    $("expTabla").innerHTML = filas.length
      ? filas.map(function (item) {
          var ok = item.estado === "ok";
          return "<tr>" +
            "<td><strong>" + escapar(item.coleccion) + "</strong></td>" +
            "<td>" + Number(item.registros || 0).toLocaleString("es-EC") + "</td>" +
            '<td><span class="exp-badge exp-badge-' + (ok ? "ok" : "error") + '">' + (ok ? "OK" : "Error") + "</span></td>" +
            '<td class="' + (ok ? "" : "exp-detail-error") + '">' + escapar(ok ? "Incluida en el respaldo" : item.error || "No se pudo leer") + "</td>" +
          "</tr>";
        }).join("")
      : '<tr><td colspan="4" class="exp-empty">No se encontraron colecciones para mostrar.</td></tr>';
  }

  async function cargar() {
    if (estado.cargando) return;

    try {
      estado.respaldo = null;
      setCargando(true);
      setEstado("neutral", "Leyendo Firebase", "Se está preparando una copia de todas las colecciones de la app.");
      setProgreso({ porcentaje: 0, mensaje: "Conectando con Firebase..." });

      if (!window.CurriculoFirebase || !window.CurriculoFirebase.Exportar) {
        throw new Error("No se cargó el módulo de exportación de Firebase.");
      }

      var respaldo = await window.CurriculoFirebase.Exportar.obtenerTodo({
        onProgress: setProgreso
      });

      estado.respaldo = respaldo;
      pintarResumen(respaldo);

      if (respaldo.errores && respaldo.errores.length) {
        setEstado(
          "error",
          "Respaldo parcial",
          "Se leyeron " + respaldo.coleccionesLeidas + " de " + respaldo.totalColecciones + " colecciones. Las que fallaron aparecen en la tabla."
        );
      } else {
        setEstado(
          "ok",
          "Firebase listo para descargar",
          respaldo.totalRegistros.toLocaleString("es-EC") + " registros leídos en " + respaldo.totalColecciones + " colecciones."
        );
      }
    } catch (error) {
      console.error("[Exportar Firebase] Error:", error);
      setEstado("error", "No se pudo leer Firebase", error && error.message ? error.message : "Error no identificado.");
      $("expTabla").innerHTML = '<tr><td colspan="4" class="exp-empty">No fue posible cargar la información.</td></tr>';
    } finally {
      setCargando(false);
      setTimeout(ocultarProgreso, 500);
    }
  }

  function descargarBrowser(nombreArchivo, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
    return { ok: true, nombreArchivo: nombreArchivo, modo: "browser" };
  }

  async function guardarTexto(nombreArchivo, contenido) {
    if (
      window.CurriculoElectron &&
      window.CurriculoElectron.isElectron === true &&
      typeof window.CurriculoElectron.guardarArchivoEnDescargas === "function"
    ) {
      return await window.CurriculoElectron.guardarArchivoEnDescargas({
        nombreArchivo: nombreArchivo,
        extension: ".txt",
        contenido: contenido,
        encoding: "utf8"
      });
    }

    return descargarBrowser(
      nombreArchivo,
      new Blob([contenido], { type: "text/plain;charset=utf-8" })
    );
  }

  async function guardarExcel(nombreArchivo, base64) {
    if (
      window.CurriculoElectron &&
      window.CurriculoElectron.isElectron === true &&
      typeof window.CurriculoElectron.guardarArchivoEnDescargas === "function"
    ) {
      return await window.CurriculoElectron.guardarArchivoEnDescargas({
        nombreArchivo: nombreArchivo,
        extension: ".xlsx",
        contenidoBase64: base64,
        encoding: "base64"
      });
    }

    var binario = atob(base64);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

    return descargarBrowser(
      nombreArchivo,
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      })
    );
  }

  async function descargarTxt() {
    if (!estado.respaldo) return;

    try {
      setCargando(true);
      setEstado("neutral", "Generando TXT", "Preparando la copia completa en formato de texto.");
      var nombre = "Firebase_" + (estado.respaldo.proyectoId || "curriculo") + "_" + fechaArchivo() + ".txt";
      var contenido = JSON.stringify(estado.respaldo, null, 2);
      var resultado = await guardarTexto(nombre, contenido);

      if (!resultado || resultado.ok !== true) {
        throw new Error(resultado && resultado.mensaje ? resultado.mensaje : "No se pudo guardar el TXT.");
      }

      setEstado("ok", "TXT descargado", resultado.nombreArchivo || nombre);
      if (resultado.ruta && window.CurriculoElectron && typeof window.CurriculoElectron.mostrarArchivo === "function") {
        window.CurriculoElectron.mostrarArchivo(resultado.ruta);
      }
    } catch (error) {
      setEstado("error", "No se pudo generar el TXT", error && error.message ? error.message : "Error no identificado.");
    } finally {
      setCargando(false);
    }
  }

  function valorCelda(valor) {
    if (valor === null || typeof valor === "undefined") return "";
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return valor;
    try {
      return JSON.stringify(valor);
    } catch (error) {
      return texto(valor);
    }
  }

  function fragmentarCampo(salida, clave, valor) {
    var contenido = valorCelda(valor);

    if (typeof contenido !== "string" || contenido.length <= 30000) {
      salida[clave] = contenido;
      return;
    }

    var total = Math.ceil(contenido.length / 30000);
    for (var i = 0; i < total; i += 1) {
      salida[clave + "__parte_" + (i + 1)] = contenido.slice(i * 30000, (i + 1) * 30000);
    }
  }

  function filasExcel(registros) {
    registros = Array.isArray(registros) ? registros : [];

    return registros.map(function (registro) {
      var salida = {};
      Object.keys(registro || {}).forEach(function (clave) {
        fragmentarCampo(salida, clave, registro[clave]);
      });
      return salida;
    });
  }

  function nombreHoja(nombre, usados) {
    var limpio = texto(nombre)
      .replace(/[\\/?*\[\]:]/g, "_")
      .slice(0, 31) || "Hoja";

    var base = limpio;
    var n = 2;
    while (usados[limpio.toLowerCase()]) {
      var sufijo = "_" + n;
      limpio = base.slice(0, 31 - sufijo.length) + sufijo;
      n += 1;
    }
    usados[limpio.toLowerCase()] = true;
    return limpio;
  }

  async function obtenerXLSX() {
    if (window.XLSX) return window.XLSX;
    if (window.__XLSXReady) return await window.__XLSXReady;
    throw new Error("No se cargó la librería XLSX.");
  }

  async function descargarExcel() {
    if (!estado.respaldo) return;

    try {
      setCargando(true);
      setEstado("neutral", "Generando Excel", "Creando una hoja por cada colección de Firebase.");

      var XLSX = await obtenerXLSX();
      var wb = XLSX.utils.book_new();
      var usados = Object.create(null);

      var resumen = (estado.respaldo.resumen || []).map(function (item) {
        return {
          Coleccion: item.coleccion,
          Registros: item.registros,
          Estado: item.estado,
          Error: item.error || ""
        };
      });

      resumen.push({
        Coleccion: "TOTAL",
        Registros: estado.respaldo.totalRegistros,
        Estado: estado.respaldo.errores && estado.respaldo.errores.length ? "parcial" : "ok",
        Error: ""
      });

      var wsResumen = XLSX.utils.json_to_sheet(resumen);
      XLSX.utils.book_append_sheet(wb, wsResumen, nombreHoja("RESUMEN", usados));

      Object.keys(estado.respaldo.colecciones || {}).forEach(function (coleccion) {
        var filas = filasExcel(estado.respaldo.colecciones[coleccion]);
        var ws = filas.length
          ? XLSX.utils.json_to_sheet(filas)
          : XLSX.utils.aoa_to_sheet([["id"], [""]]);

        XLSX.utils.book_append_sheet(wb, ws, nombreHoja(coleccion, usados));
      });

      var base64 = XLSX.write(wb, {
        bookType: "xlsx",
        type: "base64",
        compression: true
      });

      var nombre = "Firebase_" + (estado.respaldo.proyectoId || "curriculo") + "_" + fechaArchivo() + ".xlsx";
      var resultado = await guardarExcel(nombre, base64);

      if (!resultado || resultado.ok !== true) {
        throw new Error(resultado && resultado.mensaje ? resultado.mensaje : "No se pudo guardar el Excel.");
      }

      setEstado("ok", "Excel descargado", resultado.nombreArchivo || nombre);
      if (resultado.ruta && window.CurriculoElectron && typeof window.CurriculoElectron.mostrarArchivo === "function") {
        window.CurriculoElectron.mostrarArchivo(resultado.ruta);
      }
    } catch (error) {
      console.error("[Exportar Firebase] Excel:", error);
      setEstado("error", "No se pudo generar el Excel", error && error.message ? error.message : "Error no identificado.");
    } finally {
      setCargando(false);
    }
  }

  function conectar() {
    $("btnCargar").addEventListener("click", cargar);
    $("btnTxt").addEventListener("click", descargarTxt);
    $("btnExcel").addEventListener("click", descargarExcel);
    $("btnAbrirDescargas").addEventListener("click", function () {
      if (window.CurriculoElectron && typeof window.CurriculoElectron.openDownloads === "function") {
        window.CurriculoElectron.openDownloads();
      }
    });
  }

  function iniciar() {
    conectar();
    cargar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})(window, document);
