/* =========================================================
Nombre completo: subir.detector-estructura.js
Ruta o ubicación: /Curriculo/subir/subir.detector-estructura.js
Función o funciones:
- Analizar rutas internas del ZIP y detectar estructura curricular real.
- Aceptar únicamente archivos dentro de MATRIZ CCC / NIVEL / MATERIA.
- Ignorar completamente ACTAS, FICHAS, archivos sueltos y carpetas fuera de MATRIZ CCC.
- Identificar carrera, matriz, nivel, código de materia, nombre de materia y archivos.
- Construir un paquete normalizado limpio para clasificar PEA Base, PEA Unidades y PEA Actividades.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;
  var N = NS.Normalizador;

  if (!N) {
    console.error("[SubirCCC.DetectorEstructura] Falta cargar primero subir.normalizador.js");
    return;
  }

  var CARPETAS_PROHIBIDAS = [
    "actas",
    "acta",
    "fichas",
    "ficha",
    "firmas",
    "firma",
    "documentos",
    "documentacion",
    "documentación",
    "__macosx"
  ];

  function fechaISO() {
    return new Date().toISOString();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizar(valor) {
    return N.normalizarComparacion(valor || "");
  }

  function contieneCarpetaProhibida(partes) {
    partes = arr(partes);

    return partes.some(function (parte) {
      var p = normalizar(parte);

      return CARPETAS_PROHIBIDAS.some(function (prohibida) {
        var prohibidaNorm = normalizar(prohibida);
        return p === prohibidaNorm || p.includes(prohibidaNorm);
      });
    });
  }

  function esEntradaArchivo(entrada) {
    if (!entrada) return false;

    if (entrada.tipo === "archivo") return true;
    if (entrada.dir === false) return true;
    if (entrada.esArchivo === true) return true;

    var nombre = entrada.nombre || entrada.name || N.nombreArchivoDesdeRuta(entrada.ruta || entrada.path || "");
    var ext = N.extensionArchivo(nombre);

    return !!ext;
  }

  function normalizarEntrada(entrada) {
    var ruta = texto(entrada.ruta || entrada.path || entrada.name || entrada.nombre || "");
    var nombre = texto(entrada.nombre || entrada.name || N.nombreArchivoDesdeRuta(ruta));
    var partes = N.dividirRuta(ruta);
    var extension = texto(entrada.extension || N.extensionArchivo(nombre));

    return Object.assign({}, entrada, {
      ruta: ruta,
      rutaOriginal: ruta,
      nombre: nombre,
      nombreArchivo: nombre,
      partes: partes,
      extension: extension,
      tipoEntrada: esEntradaArchivo(entrada) ? "archivo" : "carpeta",
      esExcel: N.esExcel(nombre)
    });
  }

  function buscarIndiceMatriz(partes) {
    var mejor = {
      index: -1,
      confianza: 0,
      deteccion: null
    };

    partes.forEach(function (parte, index) {
      var d = N.detectarMatriz(parte);

      if (d.detectado && d.confianza > mejor.confianza) {
        mejor = {
          index: index,
          confianza: d.confianza,
          deteccion: d
        };
      }
    });

    return mejor;
  }

  function buscarIndiceNivel(partes, desdeIndex) {
    var mejor = {
      index: -1,
      confianza: 0,
      deteccion: null
    };

    partes.forEach(function (parte, index) {
      if (typeof desdeIndex === "number" && index <= desdeIndex) return;

      var d = N.detectarNivel(parte);

      if (d.detectado && d.confianza > mejor.confianza) {
        mejor = {
          index: index,
          confianza: d.confianza,
          deteccion: d
        };
      }
    });

    return mejor;
  }

  function rutaDentroDeMatrizCCC(entrada) {
    var partes = entrada.partes || [];

    if (!entrada || entrada.tipoEntrada !== "archivo") {
      return {
        ok: false,
        motivo: "no_es_archivo"
      };
    }

    if (!entrada.esExcel) {
      return {
        ok: false,
        motivo: "no_es_excel"
      };
    }

    if (contieneCarpetaProhibida(partes)) {
      return {
        ok: false,
        motivo: "carpeta_prohibida"
      };
    }

    var matrizInfo = buscarIndiceMatriz(partes);

    if (matrizInfo.index === -1) {
      return {
        ok: false,
        motivo: "fuera_de_matriz_ccc"
      };
    }

    var nivelInfo = buscarIndiceNivel(partes, matrizInfo.index);

    if (nivelInfo.index === -1) {
      return {
        ok: false,
        motivo: "sin_nivel_despues_de_matriz"
      };
    }

    var archivoIndex = partes.length - 1;
    var materiaIndex = archivoIndex - 1;

    if (materiaIndex <= nivelInfo.index) {
      return {
        ok: false,
        motivo: "sin_carpeta_materia"
      };
    }

    var carpetaMateria = partes[materiaIndex];

    if (!carpetaMateria || N.detectarNivel(carpetaMateria).detectado || N.detectarMatriz(carpetaMateria).detectado) {
      return {
        ok: false,
        motivo: "materia_invalida"
      };
    }

    return {
      ok: true,
      matrizInfo: matrizInfo,
      nivelInfo: nivelInfo,
      materiaIndex: materiaIndex,
      archivoIndex: archivoIndex
    };
  }

  function detectarCarreraDesdeRuta(partes, matrizIndex) {
    var candidatos = [];

    for (var i = matrizIndex - 1; i >= 0; i -= 1) {
      var parte = texto(partes[i]);
      var parteNorm = normalizar(parte);

      if (!parte) continue;
      if (N.esCarpetaIgnorada(parte)) continue;
      if (N.detectarMatriz(parte).detectado) continue;
      if (N.detectarNivel(parte).detectado) continue;

      if (CARPETAS_PROHIBIDAS.indexOf(parteNorm) !== -1) continue;

      candidatos.push({
        nombre: parte,
        index: i,
        confianza: 100,
        origen: "antes_matriz"
      });

      break;
    }

    if (!candidatos.length) {
      return {
        nombre: "Carrera no identificada",
        nombreOriginal: "",
        nombreNormalizado: "carrera no identificada",
        confianza: 20,
        origen: "fallback",
        index: -1
      };
    }

    return {
      nombre: N.titleCase(candidatos[0].nombre),
      nombreOriginal: candidatos[0].nombre,
      nombreNormalizado: normalizar(candidatos[0].nombre),
      confianza: candidatos[0].confianza,
      origen: candidatos[0].origen,
      index: candidatos[0].index
    };
  }

  function extraerMateriaDesdeCarpeta(carpetaMateria, nombreArchivo) {
    var codigo = N.detectarCodigoMateria(carpetaMateria) || "";
    var nombre = "";

    if (codigo) {
      nombre = N.quitarCodigoMateria(carpetaMateria)
        .replace(/^[\s\-–—_:]+/, "")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      nombre = carpetaMateria;
    }

    nombre = texto(nombre);

    if (!nombre || normalizar(nombre) === "sin nombre") {
      nombre = N.limpiarNombreMateria(nombreArchivo || carpetaMateria);
    }

    return {
      codigo: codigo,
      nombre: N.titleCase(nombre || "Materia sin nombre"),
      nombreOriginal: carpetaMateria,
      nombreNormalizado: normalizar(nombre || "Materia sin nombre"),
      confianza: codigo ? 100 : 84
    };
  }

  function detectarContextoArchivo(entrada) {
    entrada = normalizarEntrada(entrada);

    var evaluacion = rutaDentroDeMatrizCCC(entrada);

    if (!evaluacion.ok) {
      return {
        valido: false,
        motivo: evaluacion.motivo,
        rutaOriginal: entrada.rutaOriginal
      };
    }

    var partes = entrada.partes;
    var matrizInfo = evaluacion.matrizInfo;
    var nivelInfo = evaluacion.nivelInfo;
    var materiaIndex = evaluacion.materiaIndex;

    var carreraInfo = detectarCarreraDesdeRuta(partes, matrizInfo.index);
    var nivelDet = nivelInfo.deteccion || {};
    var carpetaMateria = partes[materiaIndex];
    var materiaInfo = extraerMateriaDesdeCarpeta(carpetaMateria, entrada.nombreArchivo);

    return {
      valido: true,
      carrera: carreraInfo,
      matriz: {
        nombre: "Matriz CCC",
        nombreOriginal: partes[matrizInfo.index],
        tipo: "ccc",
        confianza: matrizInfo.confianza || 100,
        index: matrizInfo.index
      },
      nivel: {
        nombre: nivelDet.nombre || "Nivel no identificado",
        numero: Number(nivelDet.numero || 0),
        nombreOriginal: partes[nivelInfo.index],
        confianza: nivelInfo.confianza || 100,
        index: nivelInfo.index
      },
      materia: materiaInfo,
      archivo: {
        nombreArchivo: entrada.nombreArchivo,
        rutaOriginal: entrada.rutaOriginal,
        extension: entrada.extension,
        esExcel: entrada.esExcel,
        tamanoBytes: entrada.tamanoBytes || 0
      }
    };
  }

  function upsertMapa(mapa, key, data) {
    if (!mapa[key]) {
      mapa[key] = data;
    } else {
      mapa[key] = Object.assign({}, mapa[key], data, {
        actualizadoEn: fechaISO()
      });
    }

    return mapa[key];
  }

  function construirArchivoDesdeContexto(entrada, contexto, ids) {
    return {
      id: N.crearIdArchivo(ids.materiaId, "pendiente", entrada.rutaOriginal),
      cargaId: null,
      carreraId: ids.carreraId,
      matrizId: ids.matrizId,
      nivelId: ids.nivelId,
      materiaId: ids.materiaId,
      carrera: contexto.carrera.nombre,
      nivel: contexto.nivel.nombre,
      numeroNivel: contexto.nivel.numero,
      codigo: contexto.materia.codigo,
      materia: contexto.materia.nombre,
      tipo: "",
      tipoSugerido: "",
      nombreArchivo: entrada.nombreArchivo,
      rutaOriginal: entrada.rutaOriginal,
      extension: entrada.extension,
      esExcel: entrada.esExcel,
      estado: "pendiente_clasificacion",
      confianza: 0,
      contenidoBinario: entrada.contenidoBinario || null,
      tieneContenidoBinario: !!entrada.contenidoBinario,
      tamanoBytes: entrada.tamanoBytes || 0,
      errorLectura: entrada.errorLectura || "",
      creadoEn: fechaISO(),
      actualizadoEn: fechaISO()
    };
  }

  function construirDesdeEntradas(entradas, opciones) {
    opciones = opciones || {};

    var entradasNormalizadas = arr(entradas)
      .map(normalizarEntrada)
      .filter(function (entrada) {
        return entrada.ruta && entrada.tipoEntrada === "archivo";
      });

    var carrerasMap = {};
    var matricesMap = {};
    var nivelesMap = {};
    var materiasMap = {};
    var archivos = [];
    var advertencias = [];
    var ignorados = [];

    entradasNormalizadas.forEach(function (entrada) {
      var contexto = detectarContextoArchivo(entrada);

      if (!contexto.valido) {
        ignorados.push({
          rutaOriginal: entrada.rutaOriginal,
          nombreArchivo: entrada.nombreArchivo,
          motivo: contexto.motivo
        });
        return;
      }

      var carreraId = N.crearIdCarrera(contexto.carrera.nombre);
      var matrizId = N.crearIdMatriz(carreraId, "Matriz CCC");
      var nivelId = N.crearIdNivel(carreraId, contexto.nivel.numero || contexto.nivel.nombre, contexto.nivel.nombre);
      var materiaId = N.crearIdMateria(carreraId, nivelId, contexto.materia.codigo, contexto.materia.nombre);

      upsertMapa(carrerasMap, carreraId, {
        id: carreraId,
        nombre: contexto.carrera.nombre,
        nombreOriginal: contexto.carrera.nombreOriginal,
        nombreNormalizado: normalizar(contexto.carrera.nombre),
        confianza: contexto.carrera.confianza,
        origenDeteccion: contexto.carrera.origen,
        estado: "activo",
        creadoEn: fechaISO(),
        actualizadoEn: fechaISO()
      });

      upsertMapa(matricesMap, matrizId, {
        id: matrizId,
        carreraId: carreraId,
        nombre: "Matriz CCC",
        nombreOriginal: contexto.matriz.nombreOriginal || "Matriz CCC",
        nombreNormalizado: normalizar("Matriz CCC"),
        tipo: "ccc",
        confianza: contexto.matriz.confianza,
        estado: "activo",
        creadoEn: fechaISO(),
        actualizadoEn: fechaISO()
      });

      upsertMapa(nivelesMap, nivelId, {
        id: nivelId,
        carreraId: carreraId,
        matrizId: matrizId,
        numero: contexto.nivel.numero,
        nombre: contexto.nivel.nombre,
        nombreOriginal: contexto.nivel.nombreOriginal,
        nombreNormalizado: normalizar(contexto.nivel.nombre),
        confianza: contexto.nivel.confianza,
        estado: "activo",
        creadoEn: fechaISO(),
        actualizadoEn: fechaISO()
      });

      upsertMapa(materiasMap, materiaId, {
        id: materiaId,
        carreraId: carreraId,
        matrizId: matrizId,
        nivelId: nivelId,
        codigo: contexto.materia.codigo,
        nombre: contexto.materia.nombre,
        nombreOriginal: contexto.materia.nombreOriginal,
        nombreNormalizado: normalizar(contexto.materia.nombre),
        confianza: contexto.materia.confianza,
        estadoValidacion: "pendiente",
        totalArchivosEsperados: 3,
        totalArchivosEncontrados: 0,
        archivosFaltantes: [],
        archivosDuplicados: [],
        creadoEn: fechaISO(),
        actualizadoEn: fechaISO()
      });

      archivos.push(construirArchivoDesdeContexto(entrada, contexto, {
        carreraId: carreraId,
        matrizId: matrizId,
        nivelId: nivelId,
        materiaId: materiaId
      }));
    });

    var carreras = Object.keys(carrerasMap).map(function (key) {
      return carrerasMap[key];
    });

    var matrices = Object.keys(matricesMap).map(function (key) {
      return matricesMap[key];
    });

    var niveles = Object.keys(nivelesMap).map(function (key) {
      return nivelesMap[key];
    }).sort(function (a, b) {
      return Number(a.numero || 0) - Number(b.numero || 0);
    });

    var materias = Object.keys(materiasMap).map(function (key) {
      return materiasMap[key];
    });

    if (!archivos.length) {
      advertencias.push({
        tipo: "sin_archivos_curriculares",
        severidad: "critico",
        mensaje: "No se encontraron Excel dentro de MATRIZ CCC / NIVEL / MATERIA.",
        detalle: {
          totalEntradasRecibidas: entradasNormalizadas.length,
          totalIgnorados: ignorados.length
        }
      });
    }

    return {
      carga: {
        nombreZip: opciones.nombreZip || "carga-ccc.zip",
        fechaCarga: fechaISO(),
        estado: "estructura_detectada",
        totalCarreras: carreras.length,
        totalMatrices: matrices.length,
        totalNiveles: niveles.length,
        totalMaterias: materias.length,
        totalArchivos: archivos.length,
        totalExcel: archivos.length
      },
      carreras: carreras,
      matrices: matrices,
      niveles: niveles,
      materias: materias,
      archivos: archivos,
      advertencias: advertencias,
      ignorados: ignorados,
      diagnostico: {
        generadoEn: fechaISO(),
        reglaPrincipal: "Solo archivos Excel dentro de MATRIZ CCC / NIVEL / MATERIA.",
        totalEntradasRecibidas: entradasNormalizadas.length,
        totalArchivosProcesados: archivos.length,
        totalArchivosIgnorados: ignorados.length,
        totalCarreras: carreras.length,
        totalNiveles: niveles.length,
        totalMaterias: materias.length,
        totalAdvertencias: advertencias.length,
        ignoradosPorMotivo: contarIgnoradosPorMotivo(ignorados)
      }
    };
  }

  function contarIgnoradosPorMotivo(ignorados) {
    var mapa = {};

    arr(ignorados).forEach(function (item) {
      var motivo = item.motivo || "sin_motivo";
      mapa[motivo] = (mapa[motivo] || 0) + 1;
    });

    return mapa;
  }

  function detectarEstructura(entradas, opciones) {
    return construirDesdeEntradas(entradas, opciones || {});
  }

  function buscarIndiceMateria(partes, nivelIndex, esArchivo) {
    var archivoIndex = esArchivo ? partes.length - 1 : partes.length;
    var materiaIndex = archivoIndex - 1;

    if (materiaIndex <= nivelIndex) {
      return {
        index: -1,
        confianza: 0,
        codigo: "",
        nombre: ""
      };
    }

    var segmento = partes[materiaIndex];
    var info = extraerMateriaDesdeCarpeta(segmento, "");

    return {
      index: materiaIndex,
      confianza: info.confianza,
      codigo: info.codigo,
      nombre: info.nombre
    };
  }

  NS.DetectorEstructura = {
    normalizarEntrada: normalizarEntrada,
    detectarContextoArchivo: detectarContextoArchivo,
    detectarEstructura: detectarEstructura,
    construirDesdeEntradas: construirDesdeEntradas,
    buscarIndiceMatriz: buscarIndiceMatriz,
    buscarIndiceNivel: buscarIndiceNivel,
    buscarIndiceMateria: buscarIndiceMateria,
    rutaDentroDeMatrizCCC: rutaDentroDeMatrizCCC
  };
})(window);