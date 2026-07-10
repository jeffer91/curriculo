/* =========================================================
Nombre completo: menu-superior.js
Ruta o ubicación: /Curriculo/menu-superior/menu-superior.js
Función o funciones:
- Crear un menú superior reutilizable en todas las pantallas.
- Navegar de forma segura en navegador y Electron.
- Usar el resultado { ok: true } devuelto por el puente Electron.
- Aplicar una ruta HTML de respaldo si el IPC no responde.
========================================================= */

(function (window, document) {
  "use strict";

  var MENU_ID = "curriculoMenuSuperior";
  var ROOT_CLASS = "cms-menu-mounted";
  var LINKS = [
    { id: "inicio", label: "Inicio", shortLabel: "Inicio", root: "index.html", child: "../index.html", icon: "⌂" },
    { id: "subir", label: "Subir ZIP", shortLabel: "Subir", root: "subir/subir.html", child: "../subir/subir.html", icon: "ZIP" },
    { id: "bdlocal", label: "BDLocal", shortLabel: "BD", root: "bdlocal/bdlocal.html", child: "../bdlocal/bdlocal.html", icon: "BD" },
    { id: "comunicados", label: "Comunicados", shortLabel: "Com.", root: "comunicados/comunicados.html", child: "../comunicados/comunicados.html", icon: "COM" }
  ];

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

  function pathActual() {
    return String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  }

  function estaEnSubcarpeta() {
    var path = pathActual();
    return /\/(subir|bdlocal|comunicados|menu-superior)\//.test(path);
  }

  function pantallaActual() {
    var path = pathActual();
    if (path.indexOf("/subir/") !== -1) return "subir";
    if (path.indexOf("/bdlocal/") !== -1) return "bdlocal";
    if (path.indexOf("/comunicados/") !== -1) return "comunicados";
    return "inicio";
  }

  function hrefDe(link) {
    return estaEnSubcarpeta() ? link.child : link.root;
  }

  function esElectron() {
    return !!(
      window.CurriculoElectron &&
      window.CurriculoElectron.isElectron === true &&
      typeof window.CurriculoElectron.navigate === "function"
    );
  }

  function construirHTML() {
    var activa = pantallaActual();
    var links = LINKS.map(function (link) {
      return (
        '<a class="cms-link ' + (link.id === activa ? "cms-link-active" : "") + '" ' +
          'href="' + escapar(hrefDe(link)) + '" data-cms-route="' + escapar(link.id) + '" title="' + escapar(link.label) + '">' +
          '<span class="cms-link-icon">' + escapar(link.icon) + '</span>' +
          '<span class="cms-link-label">' + escapar(link.label) + '</span>' +
          '<span class="cms-link-short">' + escapar(link.shortLabel) + '</span>' +
        '</a>'
      );
    }).join("");

    return (
      '<nav id="' + MENU_ID + '" class="cms-menu" aria-label="Menú superior Curriculo">' +
        '<div class="cms-inner">' +
          '<a class="cms-brand" href="' + escapar(estaEnSubcarpeta() ? "../index.html" : "index.html") + '" data-cms-route="inicio">' +
            '<span class="cms-brand-mark">CCC</span>' +
            '<span class="cms-brand-text"><strong>Curriculo</strong><small>Gestión Curricular</small></span>' +
          '</a>' +
          '<div class="cms-links">' + links + '</div>' +
          '<div class="cms-right">' +
            '<span class="cms-mode" id="cmsMode">Local</span>' +
            '<button class="cms-icon-btn" type="button" id="cmsBtnRecargar" title="Recargar pantalla">↻</button>' +
          '</div>' +
        '</div>' +
      '</nav>'
    );
  }

  async function navegar(ruta, fallbackHref) {
    var href = texto(fallbackHref);

    if (esElectron()) {
      try {
        var resultado = await window.CurriculoElectron.navigate(ruta);
        if (resultado === true || (resultado && resultado.ok === true)) return true;
        console.warn("[MenuSuperior] Electron no confirmó la navegación:", resultado);
      } catch (error) {
        console.warn("[MenuSuperior] Falló la navegación IPC:", error);
      }
    }

    if (href) {
      window.location.assign(href);
      return true;
    }

    return false;
  }

  function conectarEventos() {
    var menu = document.getElementById(MENU_ID);
    if (!menu) return;

    menu.addEventListener("click", function (event) {
      var enlace = event.target.closest("[data-cms-route]");
      if (!enlace) return;

      if (esElectron()) {
        event.preventDefault();
        navegar(enlace.getAttribute("data-cms-route"), enlace.getAttribute("href"));
      }
    });

    var recargar = document.getElementById("cmsBtnRecargar");
    if (recargar) recargar.addEventListener("click", function () { window.location.reload(); });
  }

  function actualizarModo() {
    var el = document.getElementById("cmsMode");
    if (!el) return;
    el.textContent = esElectron() ? "Electron" : "Navegador";
    el.classList.toggle("cms-mode-electron", esElectron());
  }

  function montar() {
    if (document.getElementById(MENU_ID)) return;
    document.body.classList.add(ROOT_CLASS);
    document.body.insertAdjacentHTML("afterbegin", construirHTML());
    conectarEventos();
    actualizarModo();
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
    navegar: navegar
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montar, { once: true });
  } else {
    montar();
  }
})(window, document);
