/* =========================================================
Nombre completo: subir.detector-archivos.js
Ruta o ubicación: /Curriculo/subir/subir.detector-archivos.js
Función o funciones:
- Clasificar archivos Excel de cada materia en PEA Base, PEA Unidades o PEA Actividades.
- Reconocer nombres reales como Redes base, PEA unidades Logros y PEA actividades Logros.
- Asignar confianza alta cuando las palabras clave sean claras.
- Detectar duplicados reales por tipo dentro de una materia.
- Enriquecer el paquete antes de validarlo o importarlo a BDLocal.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;
  var N = NS.Normalizador;

  if (!N) {
    console.error("[SubirCCC.DetectorArchivos] Falta cargar primero subir.normalizador.js");
    return;
  }

  var TIPOS = {
    BASE: "pea_base",
    UNIDADES: "pea_unidades",
    ACTIVIDADES: "pea_actividades"
  };

  var LABELS = {};
  LABELS[TIPOS.BASE] = "PEA Base";
  LABELS[TIPOS.UNIDADES] = "PEA Unidades";
  LABELS[TIPOS.ACTIVIDADES] = "PEA Actividades";

  var REGLAS = [
    {
      tipo: TIPOS.BASE,
      label: "PEA Base",
      frasesExactas: [
        "pea base",
        "base pea",
        "redes base",
        "red base",
        "datos base",
        "base datos",
        "base general",
        "pea general",
        "informacion base",
        "información base"
      ],
      palabrasFuertes: [
        "base",
        "redes",
        "red"
      ],
      palabrasApoyo: [
        "pea",
        "datos",
        "general",
        "asignatura",
        "materia",
        "informacion",
        "información",
        "logros"
      ]
    },
    {
      tipo: TIPOS.UNIDADES,
      label: "PEA Unidades",
      frasesExactas: [
        "pea unidades",
        "pea unidad",
        "unidades pea",
        "unidad pea",
        "pea unidades logros",
        "unidades logros",
        "unidades de aprendizaje",
        "contenidos por unidad",
        "contenido por unidad"
      ],
      palabrasFuertes: [
        "unidades",
        "unidad",
        "contenidos",
        "contenido"
      ],
      palabrasApoyo: [
        "pea",
        "logros",
        "tema",
        "temas",
        "subtema",
        "subtemas",
        "resultado",
        "aprendizaje"
      ]
    },
    {
      tipo: TIPOS.ACTIVIDADES,
      label: "PEA Actividades",
      frasesExactas: [
        "pea actividades",
        "pea actividad",
        "actividades pea",
        "actividad pea",
        "pea actividades logros",
        "actividades logros",
        "plan actividades",
        "plan de actividades",
        "actividades de aprendizaje"
      ],
      palabrasFuertes: [
        "actividades",
        "actividad",
        "taller",
        "talleres",
        "proyecto",
        "proyectos"
      ],
      palabrasApoyo: [
        "pea",
        "logros",
        "autonomo",
        "autónomo",
        "autonoma",
        "autónoma",
        "docente",
        "practica",
        "práctica",
        "evaluacion",
        "evaluación"
      ]
    }
  ];

  function fechaISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizar(valor) {
    return N.normalizarComparacion(valor || "");
  }

  function escaparRegExp(valor) {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function prepararTextoArchivo(archivo) {
    var nombre = texto(archivo.nombreArchivo || archivo.nombre || "");
    var ruta = texto(archivo.rutaOriginal || archivo.ruta || "");
    var materia = texto(archivo.materia || "");

    return {
      nombreOriginal: nombre,
      rutaOriginal: ruta,
      materia: materia,
      nombre: normalizar(nombre),
      ruta: normalizar(ruta),
      combinado: normalizar(nombre + " " + ruta)
    };
  }

  function contienePalabra(textoBase, palabra) {
    var p = normalizar(palabra);

    if (!p) return false;

    var reg = new RegExp("(^|\\s|_|-|\\.)" + escaparRegExp(p) + "(\\s|_|-|\\.|$)", "i");

    return reg.test(textoBase) || textoBase.includes(p);
  }

  function contarCoincidencias(textoBase, palabras) {
    var total = 0;

    palabras.forEach(function (palabra) {
      if (contienePalabra(textoBase, palabra)) {
        total += 1;
      }
    });

    return total;
  }

  function reglaDirectaPorNombre(archivoTexto) {
    var n = archivoTexto.nombre;

    if (
      n.includes("redes base") ||
      n.includes("red base") ||
      n.includes("pea base") ||
      (contienePalabra(n, "base") && !contienePalabra(n, "unidades") && !contienePalabra(n, "actividades"))
    ) {
      return {
        tipo: TIPOS.BASE,
        label: LABELS[TIPOS.BASE],
        confianza: 100,
        estado: "detectado",
        razones: ["Regla directa por nombre: base."],
        puntajes: []
      };
    }

    if (
      n.includes("pea unidades") ||
      n.includes("unidades logros") ||
      n.includes("pea unidades logros") ||
      contienePalabra(n, "unidades") ||
      contienePalabra(n, "unidad") ||
      contienePalabra(n, "contenidos") ||
      contienePalabra(n, "contenido")
    ) {
      return {
        tipo: TIPOS.UNIDADES,
        label: LABELS[TIPOS.UNIDADES],
        confianza: 100,
        estado: "detectado",
        razones: ["Regla directa por nombre: unidades."],
        puntajes: []
      };
    }

    if (
      n.includes("pea actividades") ||
      n.includes("actividades logros") ||
      n.includes("pea actividades logros") ||
      contienePalabra(n, "actividades") ||
      contienePalabra(n, "actividad")
    ) {
      return {
        tipo: TIPOS.ACTIVIDADES,
        label: LABELS[TIPOS.ACTIVIDADES],
        confianza: 100,
        estado: "detectado",
        razones: ["Regla directa por nombre: actividades."],
        puntajes: []
      };
    }

    return null;
  }

  function puntuarRegla(archivoTexto, regla) {
    var score = 0;
    var razones = [];

    regla.frasesExactas.forEach(function (frase) {
      var f = normalizar(frase);

      if (archivoTexto.nombre.includes(f)) {
        score += 80;
        razones.push("frase en nombre: " + frase);
      } else if (archivoTexto.ruta.includes(f)) {
        score += 35;
        razones.push("frase en ruta: " + frase);
      }
    });

    var fuertesNombre = contarCoincidencias(archivoTexto.nombre, regla.palabrasFuertes);
    var apoyoNombre = contarCoincidencias(archivoTexto.nombre, regla.palabrasApoyo);
    var fuertesRuta = contarCoincidencias(archivoTexto.ruta, regla.palabrasFuertes);
    var apoyoRuta = contarCoincidencias(archivoTexto.ruta, regla.palabrasApoyo);

    if (fuertesNombre) {
      score += fuertesNombre * 38;
      razones.push("palabra fuerte en nombre");
    }

    if (apoyoNombre) {
      score += apoyoNombre * 10;
      razones.push("palabra de apoyo en nombre");
    }

    if (fuertesRuta) {
      score += fuertesRuta * 12;
      razones.push("palabra fuerte en ruta");
    }

    if (apoyoRuta) {
      score += apoyoRuta * 4;
      razones.push("palabra de apoyo en ruta");
    }

    var sim = N.mejorCoincidencia(archivoTexto.nombre, regla.frasesExactas);

    if (sim.confianza >= 78) {
      score += 28;
      razones.push("similitud alta con " + regla.label + ": " + sim.confianza + "%");
    }

    return {
      tipo: regla.tipo,
      label: regla.label,
      score: Math.round(score),
      razones: razones
    };
  }

  function resolverConfianza(score, diferencia) {
    if (score >= 85 && diferencia >= 10) return 100;
    if (score >= 70 && diferencia >= 8) return 95;
    if (score >= 55 && diferencia >= 5) return 88;
    if (score >= 42 && diferencia >= 3) return 78;
    if (score >= 32) return 65;
    return 0;
  }

  function clasificarArchivo(archivo) {
    var archivoTexto = prepararTextoArchivo(archivo);
    var extension = texto(archivo.extension || N.extensionArchivo(archivo.nombreArchivo || ""));
    var esExcel = archivo.esExcel !== false && ["xlsx", "xls", "xlsm", "csv"].indexOf(extension.toLowerCase()) !== -1;

    if (!esExcel) {
      return {
        tipo: "",
        label: "No identificado",
        confianza: 0,
        estado: "no_excel",
        razones: ["El archivo no tiene extensión Excel válida."],
        puntajes: []
      };
    }

    var directa = reglaDirectaPorNombre(archivoTexto);

    if (directa) {
      return directa;
    }

    var puntajes = REGLAS.map(function (regla) {
      return puntuarRegla(archivoTexto, regla);
    }).sort(function (a, b) {
      return b.score - a.score;
    });

    var primero = puntajes[0] || { score: 0 };
    var segundo = puntajes[1] || { score: 0 };
    var diferencia = primero.score - segundo.score;
    var confianza = resolverConfianza(primero.score, diferencia);

    if (!primero.tipo || confianza < 60) {
      return {
        tipo: "",
        label: "No identificado",
        confianza: confianza,
        estado: "no_identificado",
        razones: ["No se encontró una regla suficientemente confiable."],
        puntajes: puntajes
      };
    }

    return {
      tipo: primero.tipo,
      label: LABELS[primero.tipo],
      confianza: confianza,
      estado: "detectado",
      razones: primero.razones,
      puntajes: puntajes
    };
  }

  function recalcularIdArchivo(archivo) {
    return Object.assign({}, archivo, {
      id: N.crearIdArchivo(
        archivo.materiaId || "sin_materia",
        archivo.tipo || "sin_tipo",
        archivo.rutaOriginal || archivo.nombreArchivo || "archivo"
      )
    });
  }

  function clasificarArchivos(archivos) {
    archivos = Array.isArray(archivos) ? archivos : [];

    return archivos.map(function (archivo) {
      var deteccion = clasificarArchivo(archivo);

      var actualizado = Object.assign({}, archivo, {
        tipo: deteccion.tipo,
        tipoSugerido: deteccion.tipo,
        tipoLabel: deteccion.label,
        confianza: deteccion.confianza,
        estado: deteccion.estado,
        razonesDeteccion: deteccion.razones,
        puntajesDeteccion: deteccion.puntajes,
        actualizadoEn: fechaISO()
      });

      return recalcularIdArchivo(actualizado);
    });
  }

  function agruparPorMateria(archivos) {
    var mapa = {};

    archivos.forEach(function (archivo) {
      var key = archivo.materiaId || "sin_materia";

      if (!mapa[key]) {
        mapa[key] = [];
      }

      mapa[key].push(archivo);
    });

    return mapa;
  }

  function resumenMateriaArchivos(archivosMateria) {
    archivosMateria = Array.isArray(archivosMateria) ? archivosMateria : [];

    var base = archivosMateria.filter(function (a) {
      return a.tipo === TIPOS.BASE;
    });

    var unidades = archivosMateria.filter(function (a) {
      return a.tipo === TIPOS.UNIDADES;
    });

    var actividades = archivosMateria.filter(function (a) {
      return a.tipo === TIPOS.ACTIVIDADES;
    });

    var noIdentificados = archivosMateria.filter(function (a) {
      return !a.tipo;
    });

    var noExcel = archivosMateria.filter(function (a) {
      return a.esExcel === false || a.estado === "no_excel";
    });

    var erroresExcel = archivosMateria.filter(function (a) {
      return !!(a.errorExcel || a.errorLectura);
    });

    var faltantes = [];

    if (!base.length) faltantes.push(TIPOS.BASE);
    if (!unidades.length) faltantes.push(TIPOS.UNIDADES);
    if (!actividades.length) faltantes.push(TIPOS.ACTIVIDADES);

    var duplicados = [];

    if (base.length > 1) duplicados.push(TIPOS.BASE);
    if (unidades.length > 1) duplicados.push(TIPOS.UNIDADES);
    if (actividades.length > 1) duplicados.push(TIPOS.ACTIVIDADES);

    var completo = faltantes.length === 0 && duplicados.length === 0;

    return {
      total: archivosMateria.length,
      encontrados: {
        pea_base: base.length,
        pea_unidades: unidades.length,
        pea_actividades: actividades.length
      },
      faltantes: faltantes,
      duplicados: duplicados,
      noIdentificados: noIdentificados.length,
      noExcel: noExcel.length,
      erroresExcel: erroresExcel.length,
      completo: completo
    };
  }

  function actualizarMateriasConResumen(paquete, archivosClasificados) {
    var materias = Array.isArray(paquete.materias) ? paquete.materias : [];
    var porMateria = agruparPorMateria(archivosClasificados);

    return materias.map(function (materia) {
      var archivosMateria = porMateria[materia.id] || [];
      var resumen = resumenMateriaArchivos(archivosMateria);

      var estado = "completo";

      if (resumen.faltantes.length) {
        estado = "incompleto";
      } else if (resumen.duplicados.length) {
        estado = "revision";
      }

      return Object.assign({}, materia, {
        estadoValidacion: estado,
        totalArchivosEsperados: 3,
        totalArchivosEncontrados:
          (resumen.encontrados.pea_base > 0 ? 1 : 0) +
          (resumen.encontrados.pea_unidades > 0 ? 1 : 0) +
          (resumen.encontrados.pea_actividades > 0 ? 1 : 0),
        archivosFaltantes: resumen.faltantes,
        archivosDuplicados: resumen.duplicados,
        resumenArchivos: resumen,
        actualizadoEn: fechaISO()
      });
    });
  }

  function construirAdvertenciasClasificacion(paquete, archivosClasificados) {
    var advertencias = Array.isArray(paquete.advertencias) ? paquete.advertencias.slice() : [];
    var porMateria = agruparPorMateria(archivosClasificados);

    Object.keys(porMateria).forEach(function (materiaId) {
      var archivosMateria = porMateria[materiaId];
      var resumen = resumenMateriaArchivos(archivosMateria);

      var materia = (paquete.materias || []).find(function (m) {
        return m.id === materiaId;
      });

      if (resumen.faltantes.length) {
        advertencias.push({
          tipo: "materia_incompleta",
          severidad: "error",
          mensaje: "La materia no tiene los 3 Excel PEA obligatorios.",
          materiaId: materiaId,
          materia: materia ? materia.nombre : "",
          faltantes: resumen.faltantes
        });
      }

      if (resumen.duplicados.length) {
        advertencias.push({
          tipo: "archivos_duplicados",
          severidad: "advertencia",
          mensaje: "La materia tiene archivos duplicados para un mismo tipo PEA.",
          materiaId: materiaId,
          materia: materia ? materia.nombre : "",
          duplicados: resumen.duplicados
        });
      }

      if (resumen.noIdentificados) {
        advertencias.push({
          tipo: "archivos_no_identificados",
          severidad: "advertencia",
          mensaje: "Hay archivos dentro de una materia que no fueron clasificados.",
          materiaId: materiaId,
          materia: materia ? materia.nombre : "",
          total: resumen.noIdentificados
        });
      }

      if (resumen.erroresExcel) {
        advertencias.push({
          tipo: "excel_con_error_lectura",
          severidad: "advertencia",
          mensaje: "Hay Excel clasificados que no pudieron leerse internamente.",
          materiaId: materiaId,
          materia: materia ? materia.nombre : "",
          total: resumen.erroresExcel
        });
      }
    });

    return advertencias;
  }

  function enriquecerPaquete(paquete) {
    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para clasificar archivos.");
    }

    var archivosOriginales = Array.isArray(paquete.archivos) ? paquete.archivos : [];
    var archivosClasificados = clasificarArchivos(archivosOriginales);
    var materiasActualizadas = actualizarMateriasConResumen(paquete, archivosClasificados);

    var paqueteTemporal = Object.assign({}, paquete, {
      materias: materiasActualizadas
    });

    var advertencias = construirAdvertenciasClasificacion(paqueteTemporal, archivosClasificados);

    var completas = materiasActualizadas.filter(function (m) {
      return m.estadoValidacion === "completo";
    }).length;

    var incompletas = materiasActualizadas.filter(function (m) {
      return m.estadoValidacion === "incompleto";
    }).length;

    var revision = materiasActualizadas.filter(function (m) {
      return m.estadoValidacion === "revision";
    }).length;

    return Object.assign({}, paquete, {
      archivos: archivosClasificados,
      materias: materiasActualizadas,
      advertencias: advertencias,
      carga: Object.assign({}, paquete.carga || {}, {
        estado: "clasificado",
        totalArchivos: archivosClasificados.length,
        materiasCompletas: completas,
        materiasIncompletas: incompletas,
        materiasRevision: revision,
        actualizadoEn: fechaISO()
      }),
      diagnostico: Object.assign({}, paquete.diagnostico || {}, {
        totalArchivosClasificados: archivosClasificados.filter(function (a) { return !!a.tipo; }).length,
        totalArchivosNoIdentificados: archivosClasificados.filter(function (a) { return !a.tipo; }).length,
        materiasCompletas: completas,
        materiasIncompletas: incompletas,
        materiasRevision: revision,
        totalAdvertencias: advertencias.length,
        actualizadoEn: fechaISO()
      })
    });
  }

  function nombreTipo(tipo) {
    return LABELS[tipo] || "No identificado";
  }

  NS.DetectorArchivos = {
    TIPOS: TIPOS,
    LABELS: LABELS,
    REGLAS: REGLAS,
    clasificarArchivo: clasificarArchivo,
    clasificarArchivos: clasificarArchivos,
    enriquecerPaquete: enriquecerPaquete,
    agruparPorMateria: agruparPorMateria,
    resumenMateriaArchivos: resumenMateriaArchivos,
    nombreTipo: nombreTipo
  };
})(window);