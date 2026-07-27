/* =========================================================
Nombre completo: subir.acciones.js
Ruta o ubicación: /Curriculo/subir/subir.acciones.js
Funciones:
- Facilitar la revisión del primer problema detectado.
- Volver a analizar el ZIP seleccionado sin repetir la navegación.
- Permitir seleccionar nuevamente un ZIP corregido.
- Mantener el panel de acciones sincronizado con el análisis actual.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "5.0.0";
  var paqueteActual = null;
  var conectado = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setTexto(id, valor) {
    var elemento = $(id);
    if (elemento) elemento.textContent = texto(valor);
  }

  function mostrar(id, visible) {
    var elemento = $(id);
    if (!elemento) return;
    if (visible) elemento.removeAttribute("hidden");
    else elemento.setAttribute("hidden", "hidden");
  }

  function severidadPeso(validacion) {
    var severidad = texto(validacion && validacion.severidad).toLowerCase();
    if (severidad === "critico") return 4;
    if (severidad === "error") return 3;
    if (severidad === "advertencia" || severidad === "revision") return 2;
    return 1;
  }

  function resumenAcciones(paquete) {
    var resumen = paquete && paquete.resumenValidacion ? paquete.resumenValidacion : {};
    var completas = Number(resumen.materiasCompletas || 0);
    var advertencias = Number(resumen.materiasAdvertencia || resumen.materiasRevision || 0);
    var errores = Number(resumen.materiasError || resumen.materiasIncompletas || 0);
    var globales = Number(resumen.alertasGlobales || 0);
    var bloqueado = resumen.bloqueaImportacion === true;

    var partes = [];
    if (errores) partes.push(errores + " error" + (errores === 1 ? "" : "es"));
    if (advertencias) partes.push(advertencias + " advertencia" + (advertencias === 1 ? "" : "s"));
    if (globales) partes.push(globales + " alerta" + (globales === 1 ? " global" : "s globales"));

    return {
      completas: completas,
      advertencias: advertencias,
      errores: errores,
      globales: globales,
      totalProblemas: advertencias + errores + globales,
      bloqueado: bloqueado,
      texto: partes.length
        ? "Se detectaron " + partes.join(", ") + ". Revisa, corrige y vuelve a analizar."
        : "No se detectaron problemas. El ZIP está listo para continuar."
    };
  }

  function primeraIncidencia(paquete) {
    var validaciones = arr(paquete && paquete.validacionesSubida)
      .map(function (validacion, indice) {
        return { validacion: validacion, indice: indice };
      })
      .sort(function (a, b) {
        return severidadPeso(b.validacion) - severidadPeso(a.validacion);
      });

    if (validaciones.length) {
      return {
        tipo: validaciones[0].validacion && validaciones[0].validacion.materiaId
          ? "materia"
          : "global",
        materiaId: texto(validaciones[0].validacion && validaciones[0].validacion.materiaId),
        indice: validaciones[0].indice,
        severidad: texto(validaciones[0].validacion && validaciones[0].validacion.severidad)
      };
    }

    var materia = arr(paquete && paquete.materias).find(function (item) {
      var estado = texto(item && (item.estadoClasificado || item.estadoValidacion)).toLowerCase();
      return estado && ["completa", "completo", "ok", "validado"].indexOf(estado) === -1;
    });

    return materia ? {
      tipo: "materia",
      materiaId: texto(materia.id),
      indice: -1,
      severidad: texto(materia.severidadEstado || "advertencia")
    } : null;
  }

  function estadoMain() {
    if (!NS.Main || typeof NS.Main.getEstado !== "function") return {};
    return NS.Main.getEstado() || {};
  }

  function bloquearAcciones(valor) {
    ["btnPrimeraAdvertencia", "btnReanalizar", "btnSeleccionarZipCorregido"].forEach(function (id) {
      var boton = $(id);
      if (boton) boton.disabled = valor === true;
    });
  }

  function actualizarPanel(paquete) {
    paqueteActual = paquete || null;
    mostrar("accionesRevision", !!paqueteActual);

    if (!paqueteActual) {
      setTexto("resumenAccionesRevision", "Analiza un ZIP para habilitar las acciones de revisión.");
      return null;
    }

    var resumen = resumenAcciones(paqueteActual);
    var incidencia = primeraIncidencia(paqueteActual);
    var estado = estadoMain();
    var procesando = estado.procesando === true;
    var tieneZip = !!estado.archivoZip;

    setTexto("resumenAccionesRevision", resumen.texto);

    var btnPrimera = $("btnPrimeraAdvertencia");
    if (btnPrimera) {
      btnPrimera.disabled = procesando || !incidencia;
      btnPrimera.textContent = incidencia
        ? (/critico|error/i.test(incidencia.severidad) ? "Revisar primer error" : "Revisar primera advertencia")
        : "Sin incidencias pendientes";
    }

    var btnReanalizar = $("btnReanalizar");
    if (btnReanalizar) btnReanalizar.disabled = procesando || !tieneZip;

    var btnCorregido = $("btnSeleccionarZipCorregido");
    if (btnCorregido) btnCorregido.disabled = procesando;

    return resumen;
  }

  function abrirPrimeraIncidencia() {
    var incidencia = primeraIncidencia(paqueteActual);
    if (!incidencia) return false;

    if (
      incidencia.tipo === "materia" &&
      incidencia.materiaId &&
      NS.AdvertenciasUI &&
      typeof NS.AdvertenciasUI.abrirMateria === "function"
    ) {
      return NS.AdvertenciasUI.abrirMateria(incidencia.materiaId);
    }

    if (
      NS.AdvertenciasUI &&
      typeof NS.AdvertenciasUI.abrirValidacion === "function" &&
      incidencia.indice >= 0
    ) {
      return NS.AdvertenciasUI.abrirValidacion(incidencia.indice);
    }

    var lista = $("listaValidaciones");
    if (lista && typeof lista.scrollIntoView === "function") {
      lista.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }

    return false;
  }

  async function reanalizar() {
    if (!NS.Main || typeof NS.Main.analizarZIP !== "function") return false;
    var estado = estadoMain();

    if (!estado.archivoZip) {
      if (NS.Preview && typeof NS.Preview.pintarEstado === "function") {
        NS.Preview.pintarEstado("warn", "Selecciona el ZIP", "No hay un archivo disponible para volver a analizar.");
      }
      return false;
    }

    bloquearAcciones(true);
    try {
      await NS.Main.analizarZIP();
      actualizarPanel(NS.Main.getEstado().paqueteValidado || paqueteActual);
      return true;
    } finally {
      actualizarPanel(NS.Main.getEstado().paqueteValidado || paqueteActual);
    }
  }

  function seleccionarZipCorregido() {
    var input = $("inputZip");
    if (!input) return false;

    paqueteActual = null;
    actualizarPanel(null);

    // El navegador conserva una copia del archivo seleccionado. Se limpia el
    // valor para que también permita escoger nuevamente el mismo nombre.
    input.value = "";
    if (typeof input.click === "function") input.click();
    return true;
  }

  function conectarEventos() {
    if (conectado) return;
    conectado = true;

    var btnPrimera = $("btnPrimeraAdvertencia");
    if (btnPrimera) btnPrimera.addEventListener("click", abrirPrimeraIncidencia);

    var btnReanalizar = $("btnReanalizar");
    if (btnReanalizar) btnReanalizar.addEventListener("click", function () {
      reanalizar();
    });

    var btnCorregido = $("btnSeleccionarZipCorregido");
    if (btnCorregido) btnCorregido.addEventListener("click", seleccionarZipCorregido);

    var btnAnalizar = $("btnAnalizar");
    if (btnAnalizar) btnAnalizar.addEventListener("click", function () {
      bloquearAcciones(true);
    });

    var input = $("inputZip");
    if (input) input.addEventListener("change", function () {
      paqueteActual = null;
      actualizarPanel(null);
    });
  }

  function instalar() {
    if (!NS.Preview || typeof NS.Preview.pintarPaquete !== "function") {
      throw new Error("subir.acciones.js requiere subir.preview.js cargado previamente.");
    }
    if (!NS.Main || typeof NS.Main.analizarZIP !== "function") {
      throw new Error("subir.acciones.js requiere subir.main.js cargado previamente.");
    }
    if (NS.Preview.__accionesRevision === true) return;

    var pintarOriginal = NS.Preview.pintarPaquete;
    var limpiarOriginal = NS.Preview.limpiarPreview;

    NS.Preview.pintarPaquete = function (paquete) {
      var resultado = pintarOriginal.apply(NS.Preview, arguments);
      actualizarPanel(paquete);
      return resultado;
    };

    NS.Preview.limpiarPreview = function () {
      paqueteActual = null;
      actualizarPanel(null);
      return limpiarOriginal.apply(NS.Preview, arguments);
    };

    NS.Preview.__accionesRevision = true;
    conectarEventos();
  }

  NS.AccionesRevision = {
    VERSION: VERSION,
    instalar: instalar,
    actualizarPanel: actualizarPanel,
    resumenAcciones: resumenAcciones,
    primeraIncidencia: primeraIncidencia,
    abrirPrimeraIncidencia: abrirPrimeraIncidencia,
    reanalizar: reanalizar,
    seleccionarZipCorregido: seleccionarZipCorregido
  };

  instalar();
})(window, document);
