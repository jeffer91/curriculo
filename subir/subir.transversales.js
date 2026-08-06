/* =========================================================
Nombre completo: subir.transversales.js
Ruta o ubicación: /Curriculo/subir/subir.transversales.js
Funciones:
- Reconocer carpetas de materias que empiezan con N como materias transversales institucionales.
- Aceptarlas aunque no estén dentro de un nivel académico.
- Quitar la N del nombre visible de la materia.
- Conservar un nivel técnico "Transversal" para mantener la integridad de Firebase.
- Excluir las materias transversales de la comparación con la malla curricular.
- Mantener su validación PEA, importación y generación de comunicados.
========================================================= */
(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var N = NS.Normalizador;
  var Detector = NS.DetectorEstructura;

  if (!N || !Detector || Detector.__transversalesV1 === true) return;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    return N.normalizarComparacion(valor || "");
  }

  function dividirRuta(ruta) {
    return N.dividirRuta(ruta || "");
  }

  function esMateriaTransversal(nombre) {
    var original = texto(nombre);
    var normalizado = normalizar(original);

    if (!original) return false;

    return /^\s*n(?:\s*[-–—._:]\s*|\s+)(?=\S)/i.test(original) ||
      /^(transversal|institucional)(?:\s*[-–—._:]\s*|\s+)/i.test(original) ||
      normalizado.indexOf("materia transversal ") === 0 ||
      normalizado.indexOf("materia institucional ") === 0;
  }

  function limpiarNombreTransversal(nombre) {
    var limpio = texto(nombre)
      .replace(/^\s*n(?:\s*[-–—._:]\s*|\s+)/i, "")
      .replace(/^\s*(?:materia\s+)?(?:transversal|institucional)(?:\s*[-–—._:]\s*|\s+)/i, "")
      .replace(/\s+/g, " ")
      .trim();

    return N.titleCase(limpio || "Materia transversal");
  }

  function indiceMatriz(partes) {
    var mejor = -1;
    var confianza = 0;

    partes.forEach(function (parte, index) {
      var deteccion = N.detectarMatriz(parte);
      if (deteccion.detectado && deteccion.confianza > confianza) {
        mejor = index;
        confianza = deteccion.confianza;
      }
    });

    return mejor;
  }

  function prepararEntrada(entrada, mapaRutas) {
    var rutaOriginal = texto(entrada && (entrada.ruta || entrada.path || entrada.name || entrada.nombre));
    var partes = dividirRuta(rutaOriginal);

    if (partes.length < 2) return entrada;

    var archivoIndex = partes.length - 1;
    var materiaIndex = archivoIndex - 1;
    var carpetaMateria = partes[materiaIndex];

    if (!esMateriaTransversal(carpetaMateria)) return entrada;

    var matrizIndex = indiceMatriz(partes);
    if (matrizIndex < 0) return entrada;

    var existeNivel = false;
    for (var i = matrizIndex + 1; i < materiaIndex; i += 1) {
      if (N.detectarNivel(partes[i]).detectado) {
        existeNivel = true;
        break;
      }
    }

    var partesProcesadas = partes.slice();
    if (!existeNivel) {
      partesProcesadas.splice(materiaIndex, 0, "Nivel Transversal");
    }

    var rutaProcesada = partesProcesadas.join("/");
    mapaRutas[rutaProcesada] = rutaOriginal;

    return Object.assign({}, entrada, {
      ruta: rutaProcesada,
      path: rutaProcesada,
      rutaOriginalTransversal: rutaOriginal,
      esTransversalDetectada: true,
      nombreMateriaTransversal: limpiarNombreTransversal(carpetaMateria)
    });
  }

  function nivelTransversalId(carreraId) {
    return N.crearIdNivel(carreraId || "carrera", "transversal", "Transversal");
  }

  function materiaTransversalId(carreraId, nombre) {
    return N.crearIdMateria(
      carreraId || "carrera",
      nivelTransversalId(carreraId),
      "",
      nombre || "Materia transversal"
    );
  }

  function marcarPaquete(paquete, mapaRutas) {
    paquete = paquete || {};
    var materias = arr(paquete.materias).slice();
    var niveles = arr(paquete.niveles).slice();
    var archivos = arr(paquete.archivos).slice();
    var remapeoMaterias = {};
    var carrerasTransversales = {};

    materias = materias.map(function (materia) {
      if (!esMateriaTransversal(materia && materia.nombreOriginal)) return materia;

      var nombreOficial = limpiarNombreTransversal(materia.nombreOriginal || materia.nombre);
      var idAnterior = materia.id;
      var idNuevo = materiaTransversalId(materia.carreraId, nombreOficial);
      var nivelId = nivelTransversalId(materia.carreraId);

      remapeoMaterias[idAnterior] = {
        id: idNuevo,
        nombre: nombreOficial,
        nivelId: nivelId
      };
      carrerasTransversales[materia.carreraId] = true;

      return Object.assign({}, materia, {
        id: idNuevo,
        nivelId: nivelId,
        numeroNivel: 0,
        nivelNumero: 0,
        nombre: nombreOficial,
        nombreOficial: nombreOficial,
        nombreOriginalDetectado: materia.nombreOriginal,
        nombreNormalizado: normalizar(nombreOficial),
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        origenMateria: "institucional",
        nivelAcademico: null,
        mallaExcepcionAprobada: true,
        actualizadoEn: new Date().toISOString()
      });
    });

    archivos = archivos.map(function (archivo) {
      var cambio = remapeoMaterias[archivo.materiaId];
      var rutaOriginal = mapaRutas[archivo.rutaOriginal] || archivo.rutaOriginal;

      if (!cambio) {
        return Object.assign({}, archivo, {
          rutaOriginal: rutaOriginal
        });
      }

      return Object.assign({}, archivo, {
        id: N.crearIdArchivo(cambio.id, archivo.tipo || "pendiente", rutaOriginal || archivo.nombreArchivo),
        materiaId: cambio.id,
        nivelId: cambio.nivelId,
        numeroNivel: 0,
        nivel: "Transversal",
        materia: cambio.nombre,
        rutaOriginal: rutaOriginal,
        tipoMateria: "transversal",
        esTransversal: true,
        perteneceMalla: false,
        origenMateria: "institucional",
        actualizadoEn: new Date().toISOString()
      });
    });

    Object.keys(carrerasTransversales).forEach(function (carreraId) {
      var id = nivelTransversalId(carreraId);
      var existente = niveles.find(function (nivel) { return nivel.id === id; });

      if (!existente) {
        niveles.push({
          id: id,
          carreraId: carreraId,
          matrizId: (arr(paquete.matrices).find(function (m) { return m.carreraId === carreraId; }) || {}).id || "",
          numero: 0,
          nombre: "Transversal",
          nombreOriginal: "N",
          nombreNormalizado: "transversal",
          confianza: 100,
          estado: "activo",
          tipoNivel: "transversal",
          esTransversal: true,
          perteneceMalla: false,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString()
        });
      }
    });

    var idsUsados = {};
    materias.forEach(function (materia) { idsUsados[materia.nivelId] = true; });
    niveles = niveles.filter(function (nivel) {
      if (nivel && normalizar(nivel.nombre) === "nivel transversal") {
        return false;
      }
      return idsUsados[nivel.id] || nivel.esTransversal !== true;
    });

    var totalTransversales = materias.filter(function (materia) {
      return materia.esTransversal === true;
    }).length;

    return Object.assign({}, paquete, {
      materias: materias,
      niveles: niveles,
      archivos: archivos,
      carga: Object.assign({}, paquete.carga || {}, {
        totalMateriasTransversales: totalTransversales,
        actualizadoEn: new Date().toISOString()
      }),
      diagnostico: Object.assign({}, paquete.diagnostico || {}, {
        totalMateriasTransversales: totalTransversales,
        reglaTransversal: "Las carpetas cuyo nombre inicia con N se consideran materias transversales institucionales.",
        actualizadoEn: new Date().toISOString()
      })
    });
  }

  var detectarOriginal = Detector.detectarEstructura.bind(Detector);
  Detector.detectarEstructura = function (entradas, opciones) {
    var mapaRutas = {};
    var preparadas = arr(entradas).map(function (entrada) {
      return prepararEntrada(entrada, mapaRutas);
    });
    return marcarPaquete(detectarOriginal(preparadas, opciones || {}), mapaRutas);
  };

  if (typeof Detector.construirDesdeEntradas === "function") {
    var construirOriginal = Detector.construirDesdeEntradas.bind(Detector);
    Detector.construirDesdeEntradas = function (entradas, opciones) {
      var mapaRutas = {};
      var preparadas = arr(entradas).map(function (entrada) {
        return prepararEntrada(entrada, mapaRutas);
      });
      return marcarPaquete(construirOriginal(preparadas, opciones || {}), mapaRutas);
    };
  }

  function instalarFiltroMalla() {
    var Comparador = window.MallasComparador;
    if (!Comparador || Comparador.__transversalesV1 === true || typeof Comparador.comparar !== "function") {
      return false;
    }

    var compararOriginal = Comparador.comparar.bind(Comparador);
    Comparador.comparar = function (detectadas, oficiales, equivalencias) {
      var todas = arr(detectadas);
      var transversales = todas.filter(function (materia) {
        return materia && (
          materia.esTransversal === true ||
          materia.perteneceMalla === false ||
          materia.tipoMateria === "transversal"
        );
      });
      var curriculares = todas.filter(function (materia) {
        return transversales.indexOf(materia) === -1;
      });
      var resultado = compararOriginal(curriculares, oficiales, equivalencias);

      resultado.transversales = transversales;
      resultado.resumen = Object.assign({}, resultado.resumen || {}, {
        transversales: transversales.length
      });

      return resultado;
    };

    Comparador.__transversalesV1 = true;
    return true;
  }

  instalarFiltroMalla();
  var intentos = 0;
  var temporizador = window.setInterval(function () {
    intentos += 1;
    if (instalarFiltroMalla() || intentos >= 120) {
      window.clearInterval(temporizador);
    }
  }, 250);

  NS.Transversales = {
    esMateriaTransversal: esMateriaTransversal,
    limpiarNombreTransversal: limpiarNombreTransversal,
    marcarPaquete: marcarPaquete
  };
  Detector.__transversalesV1 = true;
})(window);
