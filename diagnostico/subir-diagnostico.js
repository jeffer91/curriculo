/* =========================================================
Nombre completo: subir-diagnostico.js
Ruta o ubicación: /Curriculo/diagnostico/subir-diagnostico.js
Función o funciones:
- Vigilar el análisis del ZIP antes de iniciar la importación.
- Convertir los cambios de progreso y estado en etapas diagnósticas.
- Detectar en qué punto se detuvo la lectura, clasificación o validación.
========================================================= */

(function (window, document) {
  "use strict";

  var D = window.DiagnosticoFlujo;
  if (!D) return;

  var analisisActivo = false;
  var ultimoMensaje = "";
  var observer = null;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function archivoSeleccionado() {
    var input = document.getElementById("inputZip");
    var archivo = input && input.files && input.files[0];
    return archivo ? archivo.name : texto(document.getElementById("archivoNombre") && document.getElementById("archivoNombre").textContent);
  }

  function inferirEtapa(mensaje) {
    var limpio = mensaje.toLowerCase();
    if (limpio.indexOf("prepar") !== -1) return "preparacion_zip";
    if (limpio.indexOf("carpeta") !== -1 || limpio.indexOf("estructura") !== -1) return "deteccion_estructura";
    if (limpio.indexOf("clasific") !== -1 || limpio.indexOf("archivo") !== -1) return "clasificacion_archivos";
    if (limpio.indexOf("excel") !== -1 || limpio.indexOf("hoja") !== -1) return "lectura_excel";
    if (limpio.indexOf("valid") !== -1) return "validacion_paquete";
    if (limpio.indexOf("complet") !== -1) return "analisis_completado";
    return "analisis_zip";
  }

  function registrarProgreso() {
    if (!analisisActivo) return;
    var mensaje = texto(document.getElementById("progresoTexto") && document.getElementById("progresoTexto").textContent);
    if (!mensaje || mensaje === ultimoMensaje) return;
    ultimoMensaje = mensaje;
    var barra = document.getElementById("progresoBar");
    var porcentaje = barra ? Number.parseFloat(barra.style.width || "0") : 0;
    D.paso({
      etapa: inferirEtapa(mensaje),
      archivo: mensaje.toLowerCase().indexOf("excel") !== -1 ? "subir/subir.excel.js" : "subir/subir.main.js",
      funcion: mensaje.toLowerCase().indexOf("excel") !== -1 ? "enriquecerPaqueteConExcel()" : "analizarZIP()",
      mensaje: mensaje,
      porcentaje: porcentaje,
      zip: archivoSeleccionado()
    });
  }

  function observarEstado() {
    var estado = document.getElementById("subirEstado");
    var progreso = document.getElementById("progresoWrap");
    if (!estado || !progreso || typeof MutationObserver === "undefined") return;

    observer = new MutationObserver(function () {
      registrarProgreso();
      if (!analisisActivo) return;
      var titulo = texto(estado.querySelector("strong") && estado.querySelector("strong").textContent);
      var mensaje = texto(estado.querySelector("span") && estado.querySelector("span").textContent);
      var clase = texto(estado.className);

      if (clase.indexOf("subir-status-error") !== -1) {
        analisisActivo = false;
        D.fallar(new Error(mensaje || titulo || "No se pudo analizar el ZIP."), {
          titulo: titulo || "Error al analizar ZIP",
          flujo: "Análisis y lectura del ZIP",
          zip: archivoSeleccionado(),
          archivo: "subir/subir.main.js",
          funcion: "analizarZIP()"
        });
        return;
      }

      if (/análisis completado|analisis completado/i.test(titulo + " " + mensaje)) {
        analisisActivo = false;
        D.completar({
          etapa: "analisis_completado",
          archivo: "subir/subir.main.js",
          funcion: "analizarZIP()",
          mensaje: "Análisis del ZIP completado.",
          porcentaje: 100
        });
      }
    });

    observer.observe(estado, { subtree: true, childList: true, characterData: true, attributes: true });
    observer.observe(progreso, { subtree: true, childList: true, characterData: true, attributes: true });
  }

  function conectar() {
    var boton = document.getElementById("btnAnalizar");
    if (boton) {
      boton.addEventListener("click", function () {
        var input = document.getElementById("inputZip");
        if (!input || !input.files || !input.files.length) return;
        analisisActivo = true;
        ultimoMensaje = "";
        D.iniciar({
          prefijo: "ZIP",
          flujo: "Análisis y lectura del ZIP",
          pantalla: "subir/subir.html",
          archivo: "subir/subir.main.js",
          funcion: "analizarZIP()",
          zip: archivoSeleccionado(),
          etapa: "inicio",
          mensaje: "Iniciando análisis del ZIP.",
          stallTimeoutMs: 30000
        });
      }, true);
    }
    observarEstado();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", conectar, { once: true });
  } else {
    conectar();
  }
})(window, document);
