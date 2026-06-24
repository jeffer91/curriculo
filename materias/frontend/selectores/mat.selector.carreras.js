/*
Nombre del archivo: mat.selector.carreras.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\selectores\mat.selector.carreras.js
Función:
- Maneja el selector de carreras en un módulo separado
- Renderiza opciones
- Lee y establece el valor actual
- Muestra solo el nombre de la carrera en el selector
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.selectores = MAT.selectores || {};

  MAT.selectores.carreras = {
    getEl: function () {
      var selector = MAT.config && MAT.config.selectors && MAT.config.selectors.careerSelect;
      return selector ? document.querySelector(selector) : null;
    },

    render: function (list) {
      var el = this.getEl();
      var items = Array.isArray(list) ? list : [];
      var html = '<option value="">Selecciona una carrera</option>';
      var i;
      var item;
      var label;

      if (!el) {
        return;
      }

      for (i = 0; i < items.length; i += 1) {
        item = items[i] || {};
        label = String(item.nombre || "").trim();

        html += '<option value="' + this.escape(item.id) + '">';
        html += this.escape(label);
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
      this.render(MAT.state.data.careers || []);
      this.setValue(MAT.state.data.selectedCareerId || "");
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