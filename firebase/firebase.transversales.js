/* =========================================================
Nombre completo: firebase.transversales.js
Ruta o ubicación: /Curriculo/firebase/firebase.transversales.js
Funciones:
- Conservar en Firestore la clasificación de materias transversales institucionales.
- Permitir su preparación aunque no tengan un nivel académico numérico.
- Mantenerlas fuera de la malla curricular después de importar el ZIP.
- Recalcular identificadores y huellas sin conservar niveles técnicos temporales.
========================================================= */
(function (window) {
  "use strict";

  var Firebase = window.CurriculoFirebase = window.CurriculoFirebase || {};
  var I = Firebase.Inteligencia;
  var NIVEL_TECNICO_TEMPORAL = 999;

  if (!I || I.__transversalesV2 === true || typeof I.prepararPaquete !== "function") return;

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

  function clave(carreraNombre, materiaNombre) {
    return normalizar(carreraNombre) + "|" + normalizar(materiaNombre);
  }

  function paqueteCompatibleConValidacion(paquete) {
    paquete = paquete || {};
    return Object.assign({}, paquete, {
      materias: arr(paquete.materias).map(function (materia) {
        if (!esTransversal(materia)) return materia;
        return Object.assign({}, materia, {
          numeroNivel: NIVEL_TECNICO_TEMPORAL,
          nivelNumero: NIVEL_TECNICO_TEMPORAL,
          nivel: "Transversal"
        });
      })
    });
  }

  function reasignarIdTransversal(item) {
    if (!item || !item.materia) return;

    var materia = item.materia;
    var idFinal = typeof I.crearIdMateria === "function"
      ? I.crearIdMateria(materia.carreraId, 0, materia.codigo, materia.nombre)
      : materia.id;

    if (idFinal && typeof I.reasignarMateriaId === "function") {
      I.reasignarMateriaId(item, idFinal);
      return;
    }

    if (!idFinal) return;
    materia.id = idFinal;
    materia.materiaId = idFinal;
    if (item.peaBase) item.peaBase.materiaId = idFinal;
    if (item.actividades) item.actividades.materiaId = idFinal;
    arr(item.unidades).forEach(function (unidad) {
      unidad.materiaId = idFinal;
      if (typeof I.crearIdUnidad === "function") {
        unidad.id = I.crearIdUnidad(idFinal, unidad.unidadNumero);
      }
    });
  }

  function aplicarMetadatos(item, original) {
    if (!item || !item.materia || !esTransversal(original)) return item;

    reasignarIdTransversal(item);

    var nombreNormalizado = normalizar(item.materia.nombre);
    var codigoNormalizado = typeof I.normalizarCodigo === "function"
      ? I.normalizarCodigo(item.materia.codigo)
      : texto(item.materia.codigo);
    var metadatos = {
      tipoMateria: "transversal",
      esTransversal: true,
      perteneceMalla: false,
      origenMateria: "institucional",
      nivelAcademico: null,
      nivelNumero: 0,
      nivelNombre: "Transversal",
      nombreOriginalImportado: texto(
        original.nombreOriginalDetectado || original.nombreOriginal || original.nombre || item.materia.nombre
      )
    };

    item.materia = Object.assign({}, item.materia, metadatos, {
      identidad: {
        carreraId: item.materia.carreraId,
        nivelNumero: 0,
        codigoNormalizado: normalizar(codigoNormalizado),
        nombreNormalizado: nombreNormalizado,
        claveCodigo: codigoNormalizado
          ? [item.materia.carreraId, 0, normalizar(codigoNormalizado)].join("|")
          : "",
        claveNombre: [item.materia.carreraId, 0, nombreNormalizado].join("|")
      }
    });

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

    var snapshotBase = typeof I.crearSnapshot === "function"
      ? I.crearSnapshot(item.materia, item.peaBase, item.unidades, item.actividades)
      : (item.snapshot || {});

    item.snapshot = Object.assign({}, snapshotBase || {}, {
      materia: Object.assign({}, snapshotBase && snapshotBase.materia || {}, {
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        origenMateria: "institucional",
        nivelNumero: 0,
        nivelNombre: "Transversal"
      })
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

  var prepararOriginal = I.prepararPaquete.bind(I);

  I.prepararPaquete = function (paquete, cargaId) {
    paquete = paquete || {};
    var paqueteTemporal = paqueteCompatibleConValidacion(paquete);
    var preparado = prepararOriginal(paqueteTemporal, cargaId);
    var carreras = {};
    var idsFinales = {};

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
      var corregido = original ? aplicarMetadatos(item, original) : item;
      var id = texto(corregido && corregido.materia && corregido.materia.id);

      if (id && idsFinales[id]) {
        throw new Error(
          "Dos materias producirían el mismo ID en Firebase: " +
          corregido.materia.nombre + " y " + idsFinales[id] + "."
        );
      }
      if (id) idsFinales[id] = corregido.materia.nombre;
      return corregido;
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
  I.__transversalesV2 = true;
})(window);
