/* =========================================================
Nombre completo: mallas.transversales.js
Ruta o ubicación: /Curriculo/mallas/mallas.transversales.js
Funciones:
- Excluir las materias transversales e institucionales al construir una malla curricular.
- Mantenerlas disponibles en Firebase y en Comunicados.
- Evitar que aparezcan como materias nuevas o faltantes de una carrera.
========================================================= */
(function (window) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  if (!Firebase || Firebase.__mallasSinTransversalesV1 === true) return;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function esTransversal(materia) {
    materia = materia || {};
    var nombreOriginal = texto(materia.nombreOriginal || materia.nombreOriginalDetectado);

    return materia.esTransversal === true ||
      materia.perteneceMalla === false ||
      texto(materia.tipoMateria).toLowerCase() === "transversal" ||
      texto(materia.origenMateria).toLowerCase() === "institucional" ||
      /^\s*n(?:\s*[-–—._:]\s*|\s+)(?=\S)/i.test(nombreOriginal);
  }

  function filtrarMaterias(lista) {
    return Array.isArray(lista)
      ? lista.filter(function (materia) { return !esTransversal(materia); })
      : [];
  }

  if (typeof Firebase.obtenerMateriasPorCarrera === "function") {
    var obtenerOriginal = Firebase.obtenerMateriasPorCarrera.bind(Firebase);
    Firebase.obtenerMateriasPorCarrera = async function () {
      var materias = await obtenerOriginal.apply(null, arguments);
      return filtrarMaterias(materias);
    };
  }

  if (
    Firebase.Mallas &&
    typeof Firebase.Mallas.obtenerMallaVigenteParaCarrera === "function"
  ) {
    var obtenerMallaOriginal = Firebase.Mallas.obtenerMallaVigenteParaCarrera.bind(Firebase.Mallas);
    Firebase.Mallas.obtenerMallaVigenteParaCarrera = async function () {
      var detalle = await obtenerMallaOriginal.apply(null, arguments);
      if (!detalle) return detalle;
      return Object.assign({}, detalle, {
        materias: filtrarMaterias(detalle.materias),
        malla: Object.assign({}, detalle.malla || {}, {
          totalMaterias: filtrarMaterias(detalle.materias).length
        })
      });
    };
  }

  Firebase.__mallasSinTransversalesV1 = true;
  window.MallasTransversales = {
    esTransversal: esTransversal,
    filtrarMaterias: filtrarMaterias
  };
})(window);
