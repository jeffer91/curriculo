/* =========================================================
Nombre completo: firebase.mallas-integracion.js
Ruta o ubicación: /Curriculo/firebase/firebase.mallas-integracion.js
Funciones:
- Conservar la vinculación con la malla durante la preparación para Firestore.
- Aplicar nombre y nivel oficiales antes de calcular el ID y la huella curricular.
- Mantener el nombre originalmente detectado para trazabilidad.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  var I = NS.Inteligencia;
  if (!I || typeof I.prepararPaquete !== "function" || I.__mallasIntegracionInstalada === true) return;

  var VERSION = "1.0.0";
  var prepararOriginal = I.prepararPaquete;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    if (typeof I.normalizarTexto === "function") return I.normalizarTexto(valor);
    return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function codigo(valor) {
    if (typeof I.normalizarCodigo === "function") return I.normalizarCodigo(valor);
    return texto(valor).toUpperCase().replace(/\s+/g, "");
  }

  function nivelFuente(materia) {
    return numero(materia && (materia.nivelNumero || materia.numeroNivel), 0);
  }

  function claveCodigo(materia) {
    var c = codigo(materia && (materia.codigo || materia.codigoMateria));
    return c ? c + "|n" + nivelFuente(materia) : "";
  }

  function claveNombre(materia) {
    return normalizar(materia && (materia.nombre || materia.nombreMateria || materia.materia)) + "|n" + nivelFuente(materia);
  }

  function encontrarFuente(item, fuentes, usados) {
    var porCodigo = claveCodigo(item.materia);
    var porNombre = claveNombre(item.materia);
    var indice = -1;

    if (porCodigo) {
      indice = fuentes.findIndex(function (fuente, i) {
        return !usados[i] && claveCodigo(fuente) === porCodigo;
      });
    }
    if (indice < 0) {
      indice = fuentes.findIndex(function (fuente, i) {
        return !usados[i] && claveNombre(fuente) === porNombre;
      });
    }
    if (indice < 0) return null;
    usados[indice] = true;
    return fuentes[indice];
  }

  function actualizarContexto(item, fuente) {
    var materia = item.materia;
    var nivelOficial = numero(fuente.mallaNivelOficial, materia.nivelNumero);
    var nombreOficial = texto(fuente.nombreOficialMalla || fuente.nombreInstitucional || fuente.nombre);
    var nombreOriginal = texto(fuente.nombreOriginalDetectado || fuente.nombreOriginalImportado || materia.nombre);

    materia.nombreOriginalDetectado = nombreOriginal;
    materia.nombreOriginalImportado = nombreOriginal;
    materia.nombreOficialMalla = nombreOficial || materia.nombre;
    materia.nombreInstitucional = nombreOficial || materia.nombre;
    materia.mallaId = texto(fuente.mallaId);
    materia.mallaVersion = numero(fuente.mallaVersion, 0);
    materia.mallaMateriaId = texto(fuente.mallaMateriaId);
    materia.mallaNivelOficial = nivelOficial;
    materia.vinculacionMalla = texto(fuente.vinculacionMalla || "automatica");
    materia.mallaVinculada = fuente.mallaVinculada === true;

    if (nombreOficial) materia.nombre = nombreOficial;
    if (nivelOficial > 0) {
      materia.nivelNumero = nivelOficial;
      materia.nivelNombre = nivelOficial + ". Nivel";
    }

    var nuevoId = I.crearIdMateria(
      materia.carreraId,
      materia.nivelNumero,
      materia.codigo,
      materia.nombre
    );
    I.reasignarMateriaId(item, nuevoId);

    [item.peaBase, item.actividades].forEach(function (documento) {
      if (!documento) return;
      documento.nombreMateria = materia.nombre;
      documento.codigoMateria = materia.codigo;
      documento.nivelNumero = materia.nivelNumero;
      documento.nivelNombre = materia.nivelNombre;
    });

    arr(item.unidades).forEach(function (unidad) {
      unidad.nombreMateria = materia.nombre;
      unidad.codigoMateria = materia.codigo;
      unidad.nivelNumero = materia.nivelNumero;
      unidad.nivelNombre = materia.nivelNombre;
    });

    item.snapshot = I.crearSnapshot(materia, item.peaBase, item.unidades, item.actividades);
    materia.hashContenido = I.hashContenido(item.snapshot);
    materia.hashSecciones = {
      materia: I.hashContenido(item.snapshot.materia),
      peaBase: I.hashContenido(item.snapshot.peaBase),
      unidades: I.hashContenido(item.snapshot.unidades),
      actividades: I.hashContenido(item.snapshot.actividades)
    };
    return item;
  }

  function recalcularCarreras(preparado) {
    arr(preparado.carreras).forEach(function (carrera) {
      var items = arr(preparado.materias).filter(function (item) {
        return item.materia.carreraId === carrera.id;
      });
      var niveles = {};
      items.forEach(function (item) {
        if (numero(item.materia.nivelNumero, 0) > 0) niveles[item.materia.nivelNumero] = true;
      });
      carrera.niveles = Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; });
      carrera.totalNiveles = carrera.niveles.length;
      carrera.totalMaterias = items.length;
    });
  }

  I.prepararPaquete = function (paquete, cargaId) {
    var fuentes = arr(paquete && paquete.materias);
    var vinculadas = fuentes.filter(function (materia) {
      return materia && materia.mallaVinculada === true && texto(materia.mallaMateriaId);
    });
    var preparado = prepararOriginal.call(I, paquete, cargaId);
    var usados = {};

    arr(preparado && preparado.materias).forEach(function (item) {
      var fuente = encontrarFuente(item, vinculadas, usados);
      if (fuente) actualizarContexto(item, fuente);
    });

    recalcularCarreras(preparado);
    preparado.comparacionMalla = paquete && paquete.comparacionMalla ? paquete.comparacionMalla : null;
    preparado.resumenOriginal = Object.assign({}, preparado.resumenOriginal || {}, {
      mallaComparada: !!(paquete && paquete.comparacionMalla),
      mallaIncompleta: !!(paquete && paquete.comparacionMalla && paquete.comparacionMalla.mallaIncompleta),
      materiasMallaFaltantes: numero(paquete && paquete.comparacionMalla && paquete.comparacionMalla.totalFaltantes, 0),
      materiasMallaNoVinculadas: numero(paquete && paquete.comparacionMalla && paquete.comparacionMalla.totalNoVinculadas, 0)
    });
    return preparado;
  };

  I.__mallasIntegracionInstalada = true;
  I.MallasIntegracion = { VERSION: VERSION, actualizarContexto: actualizarContexto };
})(window);
