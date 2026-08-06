/* =========================================================
Nombre completo: firebase.transversales.js
Ruta o ubicación: /Curriculo/firebase/firebase.transversales.js
Funciones:
- Conservar en Firestore la clasificación de materias transversales institucionales.
- Mantenerlas fuera de la malla curricular después de importar el ZIP.
- Recalcular las huellas del contenido cuando se agregan los metadatos transversales.
- Conservar la clasificación dentro del historial de versiones.
========================================================= */
(function (window) {
  "use strict";

  var Firebase = window.CurriculoFirebase = window.CurriculoFirebase || {};
  var I = Firebase.Inteligencia;

  if (!I || I.__transversalesV1 === true || typeof I.prepararPaquete !== "function") return;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    return typeof I.normalizarTexto === "function"
      ? I.normalizarTexto(valor || "")
      : texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function esTransversal(materia) {
    materia = materia || {};
    return materia.esTransversal === true ||
      materia.perteneceMalla === false ||
      texto(materia.tipoMateria).toLowerCase() === "transversal" ||
      texto(materia.origenMateria).toLowerCase() === "institucional" ||
      /^\s*n(?:\s*[-–—._:]\s*|\s+)(?=\S)/i.test(texto(materia.nombreOriginal || materia.nombreOriginalDetectado));
  }

  function metadatosTransversales() {
    return {
      tipoMateria: "transversal",
      esTransversal: true,
      perteneceMalla: false,
      origenMateria: "institucional",
      nivelAcademico: null,
      nivelNumero: 0,
      nivelNombre: "Transversal"
    };
  }

  function clave(carreraNombre, materiaNombre) {
    return normalizar(carreraNombre) + "|" + normalizar(materiaNombre);
  }

  function aplicarMetadatos(item, original) {
    if (!item || !item.materia || !esTransversal(original)) return item;

    var metadatos = Object.assign({}, metadatosTransversales(), {
      nombreOriginalImportado: texto(
        original.nombreOriginalDetectado || original.nombreOriginal || original.nombre || item.materia.nombre
      )
    });

    item.materia = Object.assign({}, item.materia, metadatos);

    if (item.peaBase) {
      item.peaBase = Object.assign({}, item.peaBase, {
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        nivelNumero: 0,
        nivelNombre: "Transversal"
      });
    }

    item.unidades = arr(item.unidades).map(function (unidad) {
      return Object.assign({}, unidad, {
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        nivelNumero: 0,
        nivelNombre: "Transversal"
      });
    });

    if (item.actividades) {
      item.actividades = Object.assign({}, item.actividades, {
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        nivelNumero: 0,
        nivelNombre: "Transversal"
      });
    }

    item.snapshot = Object.assign({}, item.snapshot || {}, {
      materia: Object.assign(
        {},
        item.snapshot && item.snapshot.materia || {},
        metadatosTransversales()
      )
    });

    item.materia.hashContenido = I.hashContenido(item.snapshot);
    item.materia.hashSecciones = Object.assign({}, item.materia.hashSecciones || {}, {
      materia: I.hashContenido(item.snapshot.materia),
      peaBase: I.hashContenido(item.snapshot.peaBase || {}),
      unidades: I.hashContenido(item.snapshot.unidades || []),
      actividades: I.hashContenido(item.snapshot.actividades || [])
    });

    return item;
  }

  if (typeof I.crearSnapshot === "function") {
    var crearSnapshotOriginal = I.crearSnapshot.bind(I);
    I.crearSnapshot = function (materia, peaBase, unidades, peaActividades) {
      var snapshot = crearSnapshotOriginal(materia, peaBase, unidades, peaActividades);
      if (!esTransversal(materia)) return snapshot;
      return Object.assign({}, snapshot, {
        materia: Object.assign({}, snapshot && snapshot.materia || {}, metadatosTransversales())
      });
    };
  }

  var prepararOriginal = I.prepararPaquete.bind(I);

  I.prepararPaquete = function (paquete, cargaId) {
    paquete = paquete || {};
    var preparado = prepararOriginal(paquete, cargaId);
    var carreras = {};
    arr(paquete.carreras).forEach(function (carrera) {
      carreras[texto(carrera.id)] = texto(carrera.nombre || carrera.carrera);
    });

    var originales = {};
    arr(paquete.materias).forEach(function (materia) {
      if (!esTransversal(materia)) return;
      var carreraNombre = carreras[texto(materia.carreraId)] ||
        (arr(paquete.carreras).length === 1 ? texto(paquete.carreras[0].nombre || paquete.carreras[0].carrera) : "");
      originales[clave(carreraNombre, materia.nombre || materia.materia || materia.nombreMateria)] = materia;
    });

    preparado.materias = arr(preparado.materias).map(function (item) {
      var original = originales[clave(item.materia.carreraNombre, item.materia.nombre)];
      return original ? aplicarMetadatos(item, original) : item;
    });

    preparado.carreras = arr(preparado.carreras).map(function (carrera) {
      var transversales = preparado.materias.filter(function (item) {
        return item.materia.carreraId === carrera.id && item.materia.esTransversal === true;
      }).length;
      return Object.assign({}, carrera, {
        totalMateriasTransversales: transversales
      });
    });

    return preparado;
  };

  I.esMateriaTransversal = esTransversal;
  I.__transversalesV1 = true;
})(window);
