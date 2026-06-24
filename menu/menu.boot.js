/* =========================================================
Nombre completo: menu.boot.js
Ruta o ubicación: /menu/menu.boot.js
Función o funciones:
- Inicializar el menú Currículo
- Conectar configuración, router, render y frame principal
- Cargar el módulo por defecto
- Permitir refrescar la vista actual
- Actualizar el hint según el módulo activo
- Manejar errores de carga del iframe
========================================================= */
(function bootCurriculoMenu(window, document) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function getConfig() {
    return window.CurriculoMenuConfig || {
      appTitle: "Currículo",
      defaultItemId: "",
      items: []
    };
  }

  function getItems() {
    var cfg = getConfig();
    return Array.isArray(cfg.items) ? cfg.items.slice() : [];
  }

  function getItemById(id) {
    var wanted = String(id || "").trim().toLowerCase();
    return getItems().find(function findItem(item) {
      return String(item.id || "").trim().toLowerCase() === wanted;
    }) || null;
  }

  function setFrameSrc(frame, item) {
    if (!frame || !item || !item.routeFromMenu) {
      return;
    }

    frame.src = String(item.routeFromMenu);
  }

  function start() {
    var Router = window.CurriculoMenuRouter;
    var Render = window.CurriculoMenuRender;
    var cfg = getConfig();

    if (!Router || !Render) {
      throw new Error("No se encontraron los módulos del menú Currículo.");
    }

    var frame = byId("menuFrame");
    var brandBtn = byId("menuBrandBtn");
    var refreshBtn = byId("menuRefresh");
    var nav = byId("menuNav");
    var currentItemId = "";

    function syncView(nextId) {
      var wantedId = Router.normalizeId(nextId || cfg.defaultItemId || "");
      var item = getItemById(wantedId) || getItemById(cfg.defaultItemId);

      if (!item) {
        Render.renderNav(getItems(), "");
        Render.setHint("No hay módulos configurados.");
        if (frame) {
          frame.removeAttribute("src");
        }
        return;
      }

      currentItemId = item.id;
      Render.renderNav(getItems(), currentItemId);
      Render.setHint("Cargando: " + item.title + "...");
      setFrameSrc(frame, item);
    }

    Router.init(function onRouteChange(routeId) {
      var nextId = routeId || cfg.defaultItemId || "";
      if (!nextId) return;
      syncView(nextId);
    });

    if (!Router.getCurrentId() && cfg.defaultItemId) {
      Router.go(cfg.defaultItemId);
    }

    if (nav) {
      nav.addEventListener("click", function onNavClick(event) {
        var button = event.target && event.target.closest
          ? event.target.closest("button[data-id]")
          : null;

        if (!button || button.disabled) {
          return;
        }

        var id = button.getAttribute("data-id") || "";
        if (!id) {
          return;
        }

        Router.go(id);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function onRefreshClick() {
        if (!frame) return;

        try {
          if (frame.contentWindow && frame.contentWindow.location) {
            frame.contentWindow.location.reload();
            Render.setHint("Vista actual refrescada.");
            return;
          }
        } catch (error) {
          /* fallback */
        }

        if (currentItemId) {
          syncView(currentItemId);
          Render.setHint("Vista actual refrescada.");
        }
      });
    }

    if (brandBtn) {
      brandBtn.addEventListener("click", function onBrandClick() {
        if (cfg.defaultItemId) {
          Router.go(cfg.defaultItemId);
        }
      });
    }

    if (frame) {
      frame.addEventListener("load", function onFrameLoad() {
        var item = getItemById(currentItemId);
        Render.setHint(
          item ? "Listo. Módulo activo: " + item.title : "Listo."
        );
      });

      frame.addEventListener("error", function onFrameError() {
        Render.setHint("No se pudo cargar la vista seleccionada.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", start);
})(window, document);