/*
Nombre del archivo: mat.state.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\core\mat.state.js
Función:
- Estado central del módulo
- Guarda selección actual
- Guarda carreras cargadas
- Guarda texto pegado
- Guarda vista previa procesada
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.state = {
    data: {
      careers: [],
      selectedCareerId: "",
      selectedCareerName: "",
      selectedCareerType: "",
      selectedLoadType: "",
      rawText: "",
      preview: null,
      dirty: false,
      ready: false
    },

    setCareers: function (list) {
      this.data.careers = Array.isArray(list) ? list.slice() : [];
    },

    setCareer: function (career) {
      career = career || {};

      this.data.selectedCareerId = String(career.id || "");
      this.data.selectedCareerName = String(career.nombre || "");
      this.data.selectedCareerType = String(career.tipo || "");
    },

    clearCareer: function () {
      this.data.selectedCareerId = "";
      this.data.selectedCareerName = "";
      this.data.selectedCareerType = "";
    },

    setLoadType: function (value) {
      this.data.selectedLoadType = String(value || "");
    },

    setRawText: function (value) {
      this.data.rawText = String(value || "");
    },

    setPreview: function (value) {
      this.data.preview = value || null;
    },

    clearPreview: function () {
      this.data.preview = null;
    },

    setDirty: function (value) {
      this.data.dirty = !!value;
    },

    setReady: function (value) {
      this.data.ready = !!value;
    },

    getCareerById: function (id) {
      id = String(id || "");

      for (var i = 0; i < this.data.careers.length; i += 1) {
        if (String(this.data.careers[i].id || "") === id) {
          return this.data.careers[i];
        }
      }

      return null;
    }
  };
})(window);