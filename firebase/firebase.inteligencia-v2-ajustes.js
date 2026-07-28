/* =========================================================
Nombre completo: firebase.inteligencia-v2-ajustes.js
Ruta o ubicación: /Curriculo/firebase/firebase.inteligencia-v2-ajustes.js
Funciones:
- Usar el código canónico para relacionar materias existentes.
- Excluir estados de validación y etiquetas de visualización del versionado.
- Recalcular las huellas después de aplicar los ajustes.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  var I = NS.Inteligencia;

  if (!I || I.__ajustesV21 === true) return;

  var prepararAnterior = I.prepararPaquete;
  var crearSnapshotAnterior = I.crearSnapshot;
  var compararAnterior = I.compararSnapshots;

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function limpiarMetadatos(snapshot) {
    snapshot = JSON.parse(JSON.stringify(snapshot || {}));
    if (snapshot.materia) {
      delete snapshot.materia.estadoValidacion;
      delete snapshot.materia.carreraNombre;
      delete snapshot.materia.nivelNombre;
    }
    return snapshot;
  }

  I.crearSnapshot = function (
    materia,
    peaBase,
    unidades,
    peaActividades
  ) {
    return limpiarMetadatos(
      crearSnapshotAnterior.call(
        I,
        materia,
        peaBase,
        unidades,
        peaActividades
      )
    );
  };

  I.compararSnapshots = function (anterior, nuevo) {
    return compararAnterior.call(
      I,
      limpiarMetadatos(anterior),
      limpiarMetadatos(nuevo)
    );
  };

  I.prepararPaquete = function (paquete, cargaId) {
    var preparado = prepararAnterior.call(I, paquete, cargaId);

    arr(preparado && preparado.materias).forEach(function (item) {
      var materia = item.materia || {};
      var codigoCanonico = I.normalizarCodigo(materia.codigo);

      materia.codigoNormalizado = codigoCanonico;

      if (materia.identidad) {
        materia.identidad.codigoNormalizado = codigoCanonico;
        materia.identidad.claveCodigo = codigoCanonico
          ? [
              materia.carreraId,
              materia.nivelNumero,
              codigoCanonico
            ].join("|")
          : "";
      }

      item.snapshot = I.crearSnapshot(
        materia,
        item.peaBase,
        item.unidades,
        item.actividades
      );
      materia.hashContenido = I.hashContenido(item.snapshot);
      materia.hashSecciones = {
        materia: I.hashContenido(item.snapshot.materia),
        peaBase: I.hashContenido(item.snapshot.peaBase),
        unidades: I.hashContenido(item.snapshot.unidades),
        actividades: I.hashContenido(item.snapshot.actividades)
      };
    });

    return preparado;
  };

  I.VERSION = "2.1.0";
  I.__ajustesV21 = true;
  I.limpiarMetadatosVersion = limpiarMetadatos;
})(window);
