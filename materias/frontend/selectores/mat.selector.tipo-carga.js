/*
Nombre del archivo: mat.selector.tipo-carga.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\selectores\mat.selector.tipo-carga.js
Función:
- Maneja el selector de tipo de carga
- Renderiza opciones desde la configuración
- Lee y establece el valor actual
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.selectores = MAT.selectores || {};

  MAT.selectores.tipoCarga = {
    getEl: function () {
      var selector = MAT.config && MAT.config.selectors && MAT.config.selectors.loadTypeSelect;
      return selector ? document.querySelector(selector) : null;
    },

    render: function () {
      var el = this.getEl();
      var items = (MAT.config && Array.isArray(MAT.config.loadTypes)) ? MAT.config.loadTypes : [];
      var html = '<option value="">Selecciona un tipo de carga</option>';
      var i;
      var item;

      if (!el) {
        return;
      }

      for (i = 0; i < items.length; i += 1) {
        item = items[i] || {};
        html += '<option value="' + this.escape(item.value) + '">';
        html += this.escape(item.label);
        html += "</option>";
      }

      el.innerHTML = html;
    },

    setValue: function (value) {
      var el = this.getEl();

      if (!el) return;

      el.value = String(value || "");
    },

    getValue: function () {
      var el = this.getEl();

      if (!el) return "";

      return String(el.value || "");
    },

    getSelectedText: function () {
      var el = this.getEl();

      if (!el || !el.options || el.selectedIndex < 0) {
        return "";
      }

      return String(el.options[el.selectedIndex].text || "");
    },

    syncFromState: function () {
      this.render();
      this.setValue((MAT.state && MAT.state.data && MAT.state.data.selectedLoadType) || "");
    },

    escape: function (value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  };
})(window, document);