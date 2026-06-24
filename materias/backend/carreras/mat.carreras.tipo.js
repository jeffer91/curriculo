/*
Nombre del archivo: mat.carreras.tipo.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\backend\carreras\mat.carreras.tipo.js
Función:
- Normaliza el tipo de carrera
- Detecta la categoría principal
- Devuelve cuántos ejes se esperan
*/

(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.carreras = MAT.carreras || {};

  MAT.carreras.normalizarTipo = function (value) {
    var text = String(value || "").toLowerCase().trim();

    text = text
      .replace(/á/g, "a")
      .replace(/é/g, "e")
      .replace(/í/g, "i")
      .replace(/ó/g, "o")
      .replace(/ú/g, "u");

    return text;
  };

  MAT.carreras.detectarClaveTipo = function (value) {
    var text = MAT.carreras.normalizarTipo(value);

    if (text.indexOf("universitaria") >= 0 || text.indexOf("universitario") >= 0) {
      return "universitaria";
    }

    if (text.indexOf("tecnica") >= 0 || text.indexOf("tecnico") >= 0) {
      return "tecnica";
    }

    if (text.indexOf("superior") >= 0) {
      return "superior";
    }

    return "desconocido";
  };

  MAT.carreras.getEjesEsperados = function (value) {
    var key = MAT.carreras.detectarClaveTipo(value);
    var limits = (MAT.config && MAT.config.limits && MAT.config.limits.ejes) || {};

    if (key === "universitaria") {
      return Number(limits.universitaria || 6);
    }

    if (key === "tecnica") {
      return Number(limits.tecnica || 4);
    }

    if (key === "superior") {
      return Number(limits.superior || 4);
    }

    return 4;
  };

  MAT.carreras.esUniversitaria = function (value) {
    return MAT.carreras.detectarClaveTipo(value) === "universitaria";
  };

  MAT.carreras.esSuperior = function (value) {
    return MAT.carreras.detectarClaveTipo(value) === "superior";
  };

  MAT.carreras.esTecnica = function (value) {
    return MAT.carreras.detectarClaveTipo(value) === "tecnica";
  };
})(window);