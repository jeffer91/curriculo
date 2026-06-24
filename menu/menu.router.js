/* =========================================================
Nombre completo: menu.router.js
Ruta o ubicación: /menu/menu.router.js
Función o funciones:
- Manejar la navegación por hash del menú Currículo
- Permitir leer, cambiar y normalizar la opción activa
- Mantener la URL sincronizada con el módulo seleccionado
- Recordar la última opción activa dentro de la sesión
========================================================= */
(function attachCurriculoMenuRouter(window) {
  "use strict";

  var onChangeHandler = null;
  var STORAGE_KEY = "curriculo_menu_last_id";

  function normalizeId(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/^\/+/, "")
      .replace(/^modulo\//i, "")
      .replace(/\s+/g, "-");
  }

  function buildHash(id) {
    return "#/modulo/" + normalizeId(id);
  }

  function getCurrentId() {
    var hash = String(window.location.hash || "");
    var match = hash.match(/^#\/modulo\/(.+)$/i);

    if (!match || !match[1]) {
      return "";
    }

    return normalizeId(match[1]);
  }

  function saveLastId(id) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, normalizeId(id));
    } catch (error) {
      /* no-op */
    }
  }

  function getLastId() {
    try {
      return normalizeId(window.sessionStorage.getItem(STORAGE_KEY) || "");
    } catch (error) {
      return "";
    }
  }

  function notify() {
    var currentId = getCurrentId();
    if (currentId) {
      saveLastId(currentId);
    }

    if (typeof onChangeHandler === "function") {
      onChangeHandler(currentId);
    }
  }

  function go(id) {
    var nextId = normalizeId(id);
    if (!nextId) {
      return;
    }

    var nextHash = buildHash(nextId);

    if (window.location.hash === nextHash) {
      notify();
      return;
    }

    window.location.hash = nextHash;
  }

  function init(handler) {
    onChangeHandler = typeof handler === "function" ? handler : null;
    window.addEventListener("hashchange", notify);

    if (!getCurrentId()) {
      var remembered = getLastId();
      if (remembered) {
        go(remembered);
        return;
      }
    }

    notify();
  }

  window.CurriculoMenuRouter = {
    init: init,
    go: go,
    getCurrentId: getCurrentId,
    normalizeId: normalizeId,
    buildHash: buildHash,
    getLastId: getLastId
  };
})(window);