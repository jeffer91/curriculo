/* =========================================================
Nombre completo: subir.filtro-importacion.js
Ruta o ubicación: /Curriculo/subir/subir.filtro-importacion.js
Funciones:
- Marcar como subibles únicamente las materias completas.
- Mantener las materias con advertencias o errores visibles, pero omitidas.
- Calcular los contadores de una importación parcial segura.
========================================================= */
(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "1.0.0";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function estadoMateria(materia) {
    return texto(
      materia && (
        materia.estadoClasificado ||
        materia.estadoValidacion ||
        materia.estado
      )
    ).toLowerCase();
  }

  function esCompleta(materia) {
    return ["completa", "completo", "ok", "validado", "validada"].indexOf(
      estadoMateria(materia)
    ) !== -1;
  }

  function motivoOmision(materia) {
    var motivos = arr(materia && materia.motivosEstado).map(texto).filter(Boolean);
    if (motivos.length) return motivos.join(" · ");

    var faltantes = arr(materia && materia.archivosFaltantes).map(texto).filter(Boolean);
    if (faltantes.length) return "Faltan archivos obligatorios: " + faltantes.join(", ");

    var sinContenido = arr(materia && materia.archivosSinContenido).map(texto).filter(Boolean);
    if (sinContenido.length) return "Archivos sin contenido válido: " + sinContenido.join(", ");

    var estado = estadoMateria(materia);
    if (estado === "advertencia" || estado === "revision") {
      return "La materia tiene advertencias pendientes.";
    }
    return "La materia tiene errores o información incompleta.";
  }

  function aplicar(paquete) {
    if (!paquete || typeof paquete !== "object") return paquete;

    var materias = arr(paquete.materias).map(function (materia) {
      var completa = esCompleta(materia);
      var bloqueada = materia && materia.bloqueaImportacion === true;
      var subible = completa && !bloqueada;

      return Object.assign({}, materia, {
        puedeImportar: subible,
        subibleFirebase: subible,
        omitidaImportacion: !subible,
        motivoOmisionImportacion: subible ? "" : motivoOmision(materia)
      });
    });

    var subibles = materias.filter(function (materia) {
      return materia.subibleFirebase === true;
    }).length;
    var omitidas = materias.length - subibles;
    var resumen = Object.assign({}, paquete.resumenValidacion || {}, {
      materiasSubibles: subibles,
      materiasOmitidas: omitidas,
      totalMateriasDetectadas: materias.length,
      puedeImportarParcial: subibles > 0 && !(
        paquete.resumenValidacion &&
        paquete.resumenValidacion.bloqueaImportacion === true
      )
    });

    paquete.materias = materias;
    paquete.resumenValidacion = resumen;
    paquete.carga = Object.assign({}, paquete.carga || {}, {
      materiasSubibles: subibles,
      materiasOmitidas: omitidas,
      totalMateriasDetectadas: materias.length
    });

    return paquete;
  }

  function instalar() {
    if (!NS.Validador || typeof NS.Validador.validarPaquete !== "function") {
      throw new Error("subir.filtro-importacion.js requiere subir.validador.js y subir.estados.js.");
    }
    if (NS.Validador.__filtroImportacionParcial === true) return;

    var validarOriginal = NS.Validador.validarPaquete;
    NS.Validador.validarPaquete = function (paquete, opciones) {
      return aplicar(validarOriginal.call(NS.Validador, paquete, opciones));
    };
    NS.Validador.__filtroImportacionParcial = true;
  }

  NS.FiltroImportacion = {
    VERSION: VERSION,
    aplicar: aplicar,
    esCompleta: esCompleta,
    motivoOmision: motivoOmision
  };

  instalar();
})(window);
