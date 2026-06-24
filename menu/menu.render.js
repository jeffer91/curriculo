/* =========================================================
Nombre completo: menu.render.js
Ruta o ubicación: /menu/menu.render.js
Función o funciones:
- Renderizar visualmente los botones del menú Currículo
- Marcar la opción activa según el módulo seleccionado
- Actualizar el hint de estado del shell
- Permitir estados normales, activos y deshabilitados en la navegación
========================================================= */
(function attachCurriculoMenuRender(window, document) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderNav(items, activeId) {
    var nav = byId("menuNav");
    if (!nav) return;

    var html = (Array.isArray(items) ? items : []).map(function mapItem(item) {
      var isActive = String(item.id || "") === String(activeId || "");
      var disabled = item && item.disabled === true;

      return [
        '<button class="navbtn" type="button" data-id="',
        escapeHtml(item.id || ""),
        '" data-active="',
        isActive ? "true" : "false",
        '"',
        disabled ? ' disabled aria-disabled="true"' : "",
        ' title="',
        escapeHtml(item.hint || item.title || ""),
        '">',
        escapeHtml(item.title || ""),
        "</button>"
      ].join("");
    }).join("");

    nav.innerHTML = html;
  }

  function setHint(text) {
    var hint = byId("menuHint");
    if (!hint) return;
    hint.textContent = text || "Listo.";
  }

  window.CurriculoMenuRender = {
    renderNav: renderNav,
    setHint: setHint
  };
})(window, document);