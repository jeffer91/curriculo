/* =========================================================
Nombre completo: menu-superior.js
Ruta o ubicación: /Curriculo/menu-superior/menu-superior.js
Funciones:
- Crear el menú superior reutilizable.
- Navegar entre Inicio, Subir ZIP, Firebase y Comunicados.
- Mostrar la versión y la carpeta real de ejecución en Electron.
========================================================= */
(function (window, document) {
  "use strict";

  var MENU_ID = "curriculoMenuSuperior";
  var ROOT_CLASS = "cms-menu-mounted";
  var REPOSITORIO_OFICIAL = "jeffer91/curriculo";
  var VERSION_INTERFAZ = "firebase-1";
  var LINKS = [
    { id: "inicio", label: "Inicio", shortLabel: "Inicio", root: "index.html", child: "../index.html", icon: "⌂" },
    { id: "subir", label: "Subir ZIP", shortLabel: "Subir", root: "subir/subir.html", child: "../subir/subir.html", icon: "ZIP" },
    { id: "bdlocal", label: "Firebase", shortLabel: "Firebase", root: "bdlocal/bdlocal.html", child: "../bdlocal/bdlocal.html", icon: "FB" },
    { id: "comunicados", label: "Comunicados", shortLabel: "Com.", root: "comunicados/comunicados.html", child: "../comunicados/comunicados.html", icon: "COM" }
  ];

  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function escapar(v) { return texto(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
  function pathActual() { return String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase(); }
  function estaEnSubcarpeta() { return /\/(subir|bdlocal|comunicados|firebase|menu-superior)\//.test(pathActual()); }
  function pantallaActual() {
    var p = pathActual();
    if (p.indexOf("/subir/") !== -1) return "subir";
    if (p.indexOf("/bdlocal/") !== -1 || p.indexOf("/firebase/") !== -1) return "bdlocal";
    if (p.indexOf("/comunicados/") !== -1) return "comunicados";
    return "inicio";
  }
  function hrefDe(link) { return estaEnSubcarpeta() ? link.child : link.root; }
  function esElectron() { return !!(window.CurriculoElectron && window.CurriculoElectron.isElectron === true && typeof window.CurriculoElectron.navigate === "function"); }

  function construirHTML() {
    var activa = pantallaActual();
    var links = LINKS.map(function (link) {
      return '<a class="cms-link ' + (link.id === activa ? "cms-link-active" : "") + '" href="' + escapar(hrefDe(link)) + '" data-cms-route="' + escapar(link.id) + '" title="' + escapar(link.label) + '">' +
        '<span class="cms-link-icon">' + escapar(link.icon) + '</span><span class="cms-link-label">' + escapar(link.label) + '</span><span class="cms-link-short">' + escapar(link.shortLabel) + '</span></a>';
    }).join("");
    return '<nav id="' + MENU_ID + '" class="cms-menu" aria-label="Menú superior Curriculo"><div class="cms-inner">' +
      '<a class="cms-brand" href="' + escapar(estaEnSubcarpeta() ? "../index.html" : "index.html") + '" data-cms-route="inicio"><span class="cms-brand-mark">CCC</span><span class="cms-brand-text"><strong>Curriculo</strong><small>Firebase · Gestión Curricular</small></span></a>' +
      '<div class="cms-links">' + links + '</div><div class="cms-right"><span class="cms-version" id="cmsVersion">GitHub</span><span class="cms-mode" id="cmsMode">Firebase</span><button class="cms-icon-btn" type="button" id="cmsBtnRecargar" title="Recargar pantalla">↻</button></div></div></nav>';
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
      if (!enlace || !esElectron()) return;
      event.preventDefault();
      navegar(enlace.getAttribute("data-cms-route"), enlace.getAttribute("href"));
    });
    var recargar = document.getElementById("cmsBtnRecargar");
    if (recargar) recargar.addEventListener("click", function () { window.location.reload(); });
  }

  function actualizarModo() {
    var el = document.getElementById("cmsMode");
    if (!el) return;
    el.textContent = esElectron() ? "Electron · Firebase" : "Firebase";
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
      el.textContent = "Versión no disponible";
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
    REPOSITORIO_OFICIAL: REPOSITORIO_OFICIAL,
    VERSION_INTERFAZ: VERSION_INTERFAZ
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar, { once: true });
  else montar();
})(window, document);
