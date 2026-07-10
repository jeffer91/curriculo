/* =========================================================
Nombre completo: menu-superior.js
Ruta o ubicación: /Curriculo/menu-superior/menu-superior.js
Función o funciones:
- Crear un menú superior visual reutilizable para toda la app Curriculo.
- Permitir navegación entre Inicio, Subir ZIP, BDLocal y Comunicados.
- Funcionar tanto en navegador normal como en modo Electron.
- Detectar automáticamente la pantalla activa.
- Exponer una API pequeña en window.CurriculoMenuSuperior.
========================================================= */

(function (window, document) {
  "use strict";

  var APP_NAME = "Curriculo";
  var MENU_ID = "curriculoMenuSuperior";
  var ROOT_CLASS = "cms-menu-mounted";

  var LINKS = [
    {
      id: "inicio",
      label: "Inicio",
      shortLabel: "Inicio",
      hrefRoot: "index.html",
      hrefChild: "../index.html",
      icon: "⌂"
    },
    {
      id: "subir",
      label: "Subir ZIP",
      shortLabel: "Subir",
      hrefRoot: "subir/subir.html",
      hrefChild: "../subir/subir.html",
      icon: "ZIP"
    },
    {
      id: "bdlocal",
      label: "BDLocal",
      shortLabel: "BD",
      hrefRoot: "bdlocal/bdlocal.html",
      hrefChild: "../bdlocal/bdlocal.html",
      icon: "BD"
    },
    {
      id: "comunicados",
      label: "Comunicados",
      shortLabel: "Com.",
      hrefRoot: "comunicados/comunicados.html",
      hrefChild: "../comunicados/comunicados.html",
      icon: "COM"
    }
  ];

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizar(valor) {
    return texto(valor)
      .replace(/\\/g, "/")
      .toLowerCase();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function estaEnSubcarpeta() {
    var path = normalizar(window.location.pathname || "");

    return path.indexOf("/subir/") !== -1 ||
      path.indexOf("/bdlocal/") !== -1 ||
      path.indexOf("/comunicados/") !== -1 ||
      path.indexOf("/menu-superior/") !== -1;
  }

  function obtenerPantallaActual() {
    var path = normalizar(window.location.pathname || "");
    var file = path.split("/").pop();

    if (path.indexOf("/subir/") !== -1 || file === "subir.html") {
      return "subir";
    }

    if (path.indexOf("/bdlocal/") !== -1 || file === "bdlocal.html") {
      return "bdlocal";
    }

    if (path.indexOf("/comunicados/") !== -1 || file === "comunicados.html") {
      return "comunicados";
    }

    return "inicio";
  }

  function obtenerHref(link) {
    return estaEnSubcarpeta() ? link.hrefChild : link.hrefRoot;
  }

  function esElectron() {
    return !!(window.CurriculoElectron && window.CurriculoElectron.isElectron);
  }

  function crearBotonLink(link, activo) {
    var href = obtenerHref(link);

    return (
      '<a class="cms-link ' + (activo ? "cms-link-active" : "") + '" ' +
        'href="' + escapar(href) + '" ' +
        'data-cms-route="' + escapar(link.id) + '" ' +
        'title="' + escapar(link.label) + '">' +
        '<span class="cms-link-icon">' + escapar(link.icon) + '</span>' +
        '<span class="cms-link-label">' + escapar(link.label) + '</span>' +
        '<span class="cms-link-short">' + escapar(link.shortLabel) + '</span>' +
      '</a>'
    );
  }

  function construirHTML() {
    var actual = obtenerPantallaActual();

    var linksHTML = LINKS.map(function (link) {
      return crearBotonLink(link, link.id === actual);
    }).join("");

    return (
      '<nav id="' + MENU_ID + '" class="cms-menu" aria-label="Menú superior Curriculo">' +
        '<div class="cms-inner">' +
          '<a class="cms-brand" href="' + escapar(estaEnSubcarpeta() ? "../index.html" : "index.html") + '" data-cms-route="inicio">' +
            '<span class="cms-brand-mark">CCC</span>' +
            '<span class="cms-brand-text">' +
              '<strong>' + escapar(APP_NAME) + '</strong>' +
              '<small>Gestión Curricular</small>' +
            '</span>' +
          '</a>' +

          '<div class="cms-links">' +
            linksHTML +
          '</div>' +

          '<div class="cms-right">' +
            '<span class="cms-mode" id="cmsMode">Local</span>' +
            '<button class="cms-icon-btn" type="button" id="cmsBtnRecargar" title="Recargar pantalla">↻</button>' +
          '</div>' +
        '</div>' +
      '</nav>'
    );
  }

  function montarMenu() {
    if (document.getElementById(MENU_ID)) {
      return;
    }

    document.body.classList.add(ROOT_CLASS);
    document.body.insertAdjacentHTML("afterbegin", construirHTML());

    conectarEventos();
    actualizarModo();
  }

  function actualizarModo() {
    var el = document.getElementById("cmsMode");

    if (!el) return;

    if (esElectron()) {
      el.textContent = "Electron";
      el.classList.add("cms-mode-electron");
    } else {
      el.textContent = "Navegador";
      el.classList.remove("cms-mode-electron");
    }
  }

  async function navegar(ruta, fallbackHref) {
    var href = fallbackHref || "";

    if (esElectron() && typeof window.CurriculoElectron.navigate === "function") {
      try {
        var resultado = await window.CurriculoElectron.navigate(ruta);

        if (resultado === true) {
          return true;
        }
      } catch (error) {
        console.warn("[MenuSuperior] No se pudo navegar con Electron:", error);
      }
    }

    if (href) {
      window.location.href = href;
      return true;
    }

    return false;
  }

  function conectarEventos() {
    var menu = document.getElementById(MENU_ID);

    if (!menu) return;

    menu.addEventListener("click", function (event) {
      var routeElement = event.target.closest("[data-cms-route]");

      if (!routeElement) return;

      var ruta = routeElement.getAttribute("data-cms-route");
      var href = routeElement.getAttribute("href");

      if (esElectron()) {
        event.preventDefault();
        navegar(ruta, href);
      }
    });

    var btnRecargar = document.getElementById("cmsBtnRecargar");

    if (btnRecargar) {
      btnRecargar.addEventListener("click", function () {
        window.location.reload();
      });
    }
  }

  function marcarActivo(ruta) {
    var actual = texto(ruta || obtenerPantallaActual()).toLowerCase();
    var links = document.querySelectorAll(".cms-link");

    links.forEach(function (link) {
      var route = link.getAttribute("data-cms-route");

      if (route === actual) {
        link.classList.add("cms-link-active");
      } else {
        link.classList.remove("cms-link-active");
      }
    });
  }

  function desmontarMenu() {
    var menu = document.getElementById(MENU_ID);

    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }

    document.body.classList.remove(ROOT_CLASS);
  }

  window.CurriculoMenuSuperior = {
    montar: montarMenu,
    desmontar: desmontarMenu,
    marcarActivo: marcarActivo,
    obtenerPantallaActual: obtenerPantallaActual,
    esElectron: esElectron,
    navegar: navegar
  };

  document.addEventListener("DOMContentLoaded", montarMenu);
})(window, document);