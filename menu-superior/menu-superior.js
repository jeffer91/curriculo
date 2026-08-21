/* =========================================================
Nombre completo: menu-superior.js
Ruta o ubicación: /Curriculo/menu-superior/menu-superior.js
Funciones:
- Crear el menú superior reutilizable.
- Navegar entre Inicio, Subir, Firebase, Estadísticas, Mallas, Comunicados, Fichas y Configuración.
- Mostrar la versión instalada.
- Cargar la comparación de mallas en Subir ZIP.
========================================================= */
(function (window, document) {
  "use strict";

  var MENU_ID = "curriculoMenuSuperior";
  var ROOT_CLASS = "cms-menu-mounted";
  var REPOSITORIO_OFICIAL = "jeffer91/curriculo";
  var VERSION_INTERFAZ = "firebase-mallas-estadisticas-1";
  var LINKS = [
    { id: "inicio", label: "Inicio", shortLabel: "Inicio", root: "index.html", child: "../index.html", icon: "⌂", electron: true },
    { id: "subir", label: "Subir", shortLabel: "Subir", root: "subir/subir.html", child: "../subir/subir.html", icon: "ZIP", electron: true },
    { id: "bdlocal", label: "Firebase", shortLabel: "Firebase", root: "bdlocal/bdlocal.html", child: "../bdlocal/bdlocal.html", icon: "FB", electron: true },
    { id: "estadisticas", label: "Estadísticas", shortLabel: "Est.", root: "estadisticas/estadisticas.html", child: "../estadisticas/estadisticas.html", icon: "EST", electron: false },
    { id: "mallas", label: "Mallas", shortLabel: "Mallas", root: "mallas/mallas.html", child: "../mallas/mallas.html", icon: "MC", electron: false },
    { id: "comunicados", label: "Comunicados", shortLabel: "Com.", root: "comunicados/comunicados.html", child: "../comunicados/comunicados.html", icon: "COM", electron: true },
    { id: "fichas", label: "Fichas", shortLabel: "Fichas", root: "fichas/fichas.html", child: "../fichas/fichas.html", icon: "FIC", electron: false },
    { id: "configuracion", label: "Configuración", shortLabel: "Config.", root: "configuracion/configuracion.html", child: "../configuracion/configuracion.html", icon: "IA", electron: false }
  ];

  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function escapar(v) { return texto(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
  function pathActual() { return String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase(); }
  function estaEnSubcarpeta() { return /\/(subir|bdlocal|estadisticas|comunicados|firebase|mallas|fichas|configuracion|menu-superior)\//.test(pathActual()); }
  function pantallaActual() {
    var p = pathActual();
    if (p.indexOf("/subir/") !== -1) return "subir";
    if (p.indexOf("/bdlocal/") !== -1 || p.indexOf("/firebase/") !== -1) return "bdlocal";
    if (p.indexOf("/estadisticas/") !== -1) return "estadisticas";
    if (p.indexOf("/mallas/") !== -1) return "mallas";
    if (p.indexOf("/comunicados/") !== -1) return "comunicados";
    if (p.indexOf("/fichas/") !== -1) return "fichas";
    if (p.indexOf("/configuracion/") !== -1) return "configuracion";
    return "inicio";
  }
  function hrefDe(link) { return estaEnSubcarpeta() ? link.child : link.root; }
  function rutaDesdeRaiz(ruta) { return estaEnSubcarpeta() ? "../" + ruta : ruta; }
  function esElectron() { return !!(window.CurriculoElectron && window.CurriculoElectron.isElectron === true && typeof window.CurriculoElectron.navigate === "function"); }

  function construirHTML() {
    var activa = pantallaActual();
    var links = LINKS.map(function (link) {
      return '<a class="cms-link ' + (link.id === activa ? "cms-link-active" : "") + '" href="' + escapar(hrefDe(link)) + '" data-cms-route="' + escapar(link.id) + '" data-cms-native="' + (link.electron === false ? "true" : "false") + '" title="' + escapar(link.label) + '">' +
        '<span class="cms-link-icon">' + escapar(link.icon) + '</span><span class="cms-link-label">' + escapar(link.label) + '</span><span class="cms-link-short">' + escapar(link.shortLabel) + '</span></a>';
    }).join("");
    return '<nav id="' + MENU_ID + '" class="cms-menu" aria-label="Menú superior Curriculo"><div class="cms-inner">' +
      '<a class="cms-brand" href="' + escapar(estaEnSubcarpeta() ? "../index.html" : "index.html") + '" data-cms-route="inicio"><span class="cms-brand-mark">CCC</span><span class="cms-brand-text"><strong>Curriculo</strong><small>Gestión curricular</small></span></a>' +
      '<div class="cms-links">' + links + '</div><div class="cms-right"><span class="cms-version" id="cmsVersion">GitHub</span><span class="cms-mode" id="cmsMode">Firebase</span><button class="cms-icon-btn" type="button" id="cmsBtnRecargar" title="Recargar">↻</button></div></div></nav>';
  }

  async function navegar(ruta, fallbackHref) {
    var href = texto(fallbackHref);
    if (esElectron()) {
      try {
        var resultado = await window.CurriculoElectron.navigate(ruta);
        if (resultado === true || (resultado && resultado.ok === true)) return true;
      } catch (error) {
        console.warn("[MenuSuperior] Falló la navegación Electron:", error);
      }
    }
    if (href) { window.location.assign(href); return true; }
    return false;
  }

  function conectarEventos() {
    var menu = document.getElementById(MENU_ID);
    if (!menu) return;
    menu.addEventListener("click", function (event) {
      var enlace = event.target.closest("[data-cms-route]");
      if (!enlace || !esElectron() || enlace.getAttribute("data-cms-native") === "true") return;
      event.preventDefault();
      navegar(enlace.getAttribute("data-cms-route"), enlace.getAttribute("href"));
    });
    var recargar = document.getElementById("cmsBtnRecargar");
    if (recargar) recargar.addEventListener("click", function () { window.location.reload(); });
  }

  function cargarCSSUnaVez(href) {
    if (document.querySelector('link[data-cms-dinamico="' + href + '"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-cms-dinamico", href);
    document.head.appendChild(link);
  }

  function cargarScript(src) {
    return new Promise(function (resolve, reject) {
      var existente = document.querySelector('script[data-cms-dinamico="' + src + '"]');
      if (existente) {
        if (existente.getAttribute("data-cargado") === "true") resolve(true);
        else existente.addEventListener("load", function () { resolve(true); }, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute("data-cms-dinamico", src);
      script.onload = function () { script.setAttribute("data-cargado", "true"); resolve(true); };
      script.onerror = function () { reject(new Error("No se pudo cargar " + src)); };
      document.body.appendChild(script);
    });
  }

  async function cargarIntegracionMallasSubir() {
    if (pantallaActual() !== "subir" || window.__curriculoMallasSubirCargando) return;
    window.__curriculoMallasSubirCargando = true;
    try {
      cargarCSSUnaVez(rutaDesdeRaiz("subir/subir.malla.css?v=20260804-1"));
      await cargarScript(rutaDesdeRaiz("firebase/firebase.mallas.js?v=20260804-1"));
      await cargarScript(rutaDesdeRaiz("mallas/mallas.comparador.js?v=20260804-1"));
      await cargarScript(rutaDesdeRaiz("firebase/firebase.mallas-integracion.js?v=20260818-1"));
      await cargarScript(rutaDesdeRaiz("subir/subir.malla-ui.js?v=20260804-1"));
    } catch (error) {
      window.__curriculoMallasSubirCargando = false;
      console.error("[MenuSuperior] No se pudo cargar la comparación con mallas:", error);
    }
  }

  function actualizarModo() {
    var el = document.getElementById("cmsMode");
    if (!el) return;
    el.textContent = esElectron() ? "Electron" : "Firebase";
    el.classList.toggle("cms-mode-electron", esElectron());
  }

  async function actualizarIdentidad() {
    var el = document.getElementById("cmsVersion");
    if (!el) return null;
    var detalle = ["Repositorio esperado: " + REPOSITORIO_OFICIAL, "Interfaz: " + VERSION_INTERFAZ, "Pantalla: " + pantallaActual()];
    el.textContent = "GitHub";
    el.title = detalle.join("\n");
    if (!esElectron() || typeof window.CurriculoElectron.getAppInfo !== "function") return null;
    try {
      var info = await window.CurriculoElectron.getAppInfo();
      if (!info || info.ok !== true) throw new Error("No se recibió la versión instalada.");
      var version = texto(info.version) || "sin versión";
      el.textContent = "v" + version;
      detalle.push("Carpeta raíz: " + texto(info.rootDir));
      detalle.push("Proyecto Firebase: curriculo-ddfcd");
      el.title = detalle.join("\n");
      el.dataset.version = version;
      el.dataset.root = texto(info.rootDir);
      el.classList.remove("cms-version-warning");
      return info;
    } catch (error) {
      el.textContent = "Sin versión";
      el.classList.add("cms-version-warning");
      return null;
    }
  }

  function montar() {
    if (!document.getElementById(MENU_ID)) {
      document.body.classList.add(ROOT_CLASS);
      document.body.insertAdjacentHTML("afterbegin", construirHTML());
      conectarEventos();
    }
    actualizarModo();
    actualizarIdentidad();
    if (document.readyState === "complete") cargarIntegracionMallasSubir();
    else window.addEventListener("load", cargarIntegracionMallasSubir, { once: true });
  }

  function marcarActivo(ruta) {
    document.querySelectorAll(".cms-link").forEach(function (link) {
      link.classList.toggle("cms-link-active", link.getAttribute("data-cms-route") === texto(ruta || pantallaActual()).toLowerCase());
    });
  }

  window.CurriculoMenuSuperior = {
    montar: montar,
    marcarActivo: marcarActivo,
    obtenerPantallaActual: pantallaActual,
    esElectron: esElectron,
    navegar: navegar,
    actualizarIdentidad: actualizarIdentidad,
    cargarIntegracionMallasSubir: cargarIntegracionMallasSubir,
    REPOSITORIO_OFICIAL: REPOSITORIO_OFICIAL,
    VERSION_INTERFAZ: VERSION_INTERFAZ
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar, { once: true });
  else montar();
})(window, document);
