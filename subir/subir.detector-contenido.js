/* =========================================================
Nombre completo: subir.detector-contenido.js
Ruta o ubicación: /Curriculo/subir/subir.detector-contenido.js
Funciones:
- Clasificar Excel por su contenido cuando el nombre es ambiguo.
- Reconocer PEA Base, PEA Unidades y PEA Actividades mediante encabezados y patrones de filas.
- Aumentar la confianza cuando el contenido confirma el tipo detectado por nombre.
- Recalcular el estado de las materias después de recuperar archivos no identificados.
- No modificar los Excel originales.
========================================================= */
(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var D = NS.DetectorArchivos;
  var N = NS.Normalizador;
  var VERSION = "1.0.0";

  if (!D || !N || D.__detectorContenidoV1 === true) return;

  var TIPOS = D.TIPOS || {
    BASE: "pea_base",
    UNIDADES: "pea_unidades",
    ACTIVIDADES: "pea_actividades"
  };

  var LABELS = D.LABELS || {};
  LABELS[TIPOS.BASE] = LABELS[TIPOS.BASE] || "PEA Base";
  LABELS[TIPOS.UNIDADES] = LABELS[TIPOS.UNIDADES] || "PEA Unidades";
  LABELS[TIPOS.ACTIVIDADES] = LABELS[TIPOS.ACTIVIDADES] || "PEA Actividades";

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
  }

  function extensionExcel(archivo) {
    var extension = texto(archivo && archivo.extension).toLowerCase();
    if (!extension && N && typeof N.extensionArchivo === "function") {
      extension = texto(N.extensionArchivo(archivo && archivo.nombreArchivo)).toLowerCase();
    }
    return ["xlsx", "xls", "xlsm", "csv"].indexOf(extension) !== -1;
  }

  function limpiarFila(fila) {
    return arr(fila).map(function (celda) {
      return texto(celda).replace(/\s+/g, " ").trim();
    });
  }

  function filaVacia(fila) {
    return !limpiarFila(fila).some(Boolean);
  }

  function leerHojas(archivo) {
    if (!archivo || !archivo.contenidoBinario || !window.XLSX || !extensionExcel(archivo)) {
      return [];
    }

    var workbook = window.XLSX.read(archivo.contenidoBinario, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellText: false
    });

    return arr(workbook.SheetNames).map(function (nombre) {
      var hoja = workbook.Sheets[nombre];
      var matriz = window.XLSX.utils.sheet_to_json(hoja, {
        header: 1,
        defval: "",
        raw: false
      }).map(limpiarFila);

      while (matriz.length && filaVacia(matriz[0])) matriz.shift();
      while (matriz.length && filaVacia(matriz[matriz.length - 1])) matriz.pop();

      return {
        nombre: nombre,
        matriz: matriz
      };
    }).filter(function (hoja) {
      return hoja.matriz.length > 0;
    });
  }

  function indiceAlias(encabezados, aliases) {
    var buscados = aliases.map(normalizar);
    for (var i = 0; i < encabezados.length; i += 1) {
      if (buscados.indexOf(normalizar(encabezados[i])) !== -1) return i;
    }
    return -1;
  }

  function detectarFilaEncabezado(matriz) {
    var aliases = [
      "codigoComponente", "ordenComponente", "descripcionComponente",
      "nivel", "unidad", "mecanismo", "tipoActividad", "modalidad",
      "tema", "titulo", "descripcion", "actividad", "contenido"
    ].map(normalizar);
    var limite = Math.min(20, matriz.length);
    var mejor = { indice: -1, puntaje: 0 };

    for (var i = 0; i < limite; i += 1) {
      var fila = limpiarFila(matriz[i]);
      var puntaje = fila.reduce(function (total, celda) {
        return total + (aliases.indexOf(normalizar(celda)) !== -1 ? 20 : 0);
      }, 0);
      if (puntaje > mejor.puntaje) mejor = { indice: i, puntaje: puntaje };
    }

    return mejor.puntaje >= 40 ? mejor.indice : -1;
  }

  function numerosColumna(filas, indice) {
    if (indice < 0) return [];
    return filas.map(function (fila) {
      var match = texto(fila[indice]).match(/-?\d+/);
      return match ? Number(match[0]) : NaN;
    }).filter(function (numero) {
      return Number.isFinite(numero);
    });
  }

  function contarValoresTexto(filas, indice) {
    if (indice < 0) return 0;
    return filas.filter(function (fila) {
      return texto(fila[indice]).length >= 3;
    }).length;
  }

  function evaluarHoja(hoja) {
    var matriz = hoja.matriz;
    var encabezadoIndex = detectarFilaEncabezado(matriz);
    if (encabezadoIndex === -1) return [];

    var encabezados = limpiarFila(matriz[encabezadoIndex]);
    var filas = matriz.slice(encabezadoIndex + 1).filter(function (fila) {
      return !filaVacia(fila);
    }).slice(0, 1500);

    if (!filas.length) return [];

    var indiceCodigo = indiceAlias(encabezados, ["codigoComponente", "codigo", "componente"]);
    var indiceOrden = indiceAlias(encabezados, [
      "ordenComponente", "orden", "unidad", "unidadNumero", "numeroUnidad", "nivel"
    ]);
    var indiceDescripcionComponente = indiceAlias(encabezados, [
      "descripcionComponente", "descripcion", "contenido", "tema", "titulo"
    ]);
    var indiceNivel = indiceAlias(encabezados, ["nivel", "unidad", "unidadNumero", "numeroUnidad"]);
    var indiceMecanismo = indiceAlias(encabezados, [
      "mecanismo", "tipoActividad", "tipo", "modalidad", "estrategia"
    ]);
    var indiceTema = indiceAlias(encabezados, ["tema", "titulo", "nombreTema"]);
    var indiceDescripcionActividad = indiceAlias(encabezados, [
      "descripcion", "descripcionActividad", "actividad", "contenido", "detalle"
    ]);

    var candidatos = [];

    var tieneEstructuraActividad = indiceMecanismo >= 0 &&
      (indiceTema >= 0 || indiceDescripcionActividad >= 0) &&
      (indiceNivel >= 0 || indiceOrden >= 0);

    if (tieneEstructuraActividad) {
      var actividadesConTexto = Math.max(
        contarValoresTexto(filas, indiceMecanismo),
        contarValoresTexto(filas, indiceDescripcionActividad),
        contarValoresTexto(filas, indiceTema)
      );

      if (actividadesConTexto >= 2) {
        candidatos.push({
          tipo: TIPOS.ACTIVIDADES,
          label: LABELS[TIPOS.ACTIVIDADES],
          confianza: 99,
          puntaje: 150 + actividadesConTexto,
          registros: actividadesConTexto,
          hoja: hoja.nombre,
          razones: [
            "El contenido incluye columnas de nivel, mecanismo y descripción de actividades."
          ]
        });
      }
    }

    if (indiceCodigo >= 0 && indiceDescripcionComponente >= 0) {
      var codigos = numerosColumna(filas, indiceCodigo);
      var ordenes = numerosColumna(filas, indiceOrden);
      var distintos = {};
      codigos.forEach(function (codigo) { distintos[codigo] = true; });
      var tieneDescripcion = contarValoresTexto(filas, indiceDescripcionComponente) >= 2;
      var tieneDescripcionAsignatura = codigos.indexOf(1) !== -1;
      var tieneObjetivo = codigos.indexOf(2) !== -1;
      var tieneComponentesBase = [3, 4, 5, 8].some(function (codigo) {
        return codigos.indexOf(codigo) !== -1;
      });

      if (tieneDescripcion && tieneDescripcionAsignatura && tieneObjetivo && tieneComponentesBase) {
        candidatos.push({
          tipo: TIPOS.BASE,
          label: LABELS[TIPOS.BASE],
          confianza: 99,
          puntaje: 170 + Object.keys(distintos).length * 5,
          registros: filas.length,
          hoja: hoja.nombre,
          razones: [
            "El contenido incluye descripción, objetivo y componentes curriculares del PEA Base."
          ]
        });
      } else {
        var ordenesValidas = ordenes.filter(function (numero) {
          return numero >= 1 && numero <= 4;
        });
        var codigosUnidades = codigos.filter(function (codigo) {
          return codigo === 3 || codigo === 4;
        });
        var proporcionOrden = ordenes.length ? ordenesValidas.length / ordenes.length : 0;
        var proporcionCodigo = codigos.length ? codigosUnidades.length / codigos.length : 0;

        if (
          tieneDescripcion &&
          ordenesValidas.length >= 3 &&
          proporcionOrden >= 0.8 &&
          proporcionCodigo >= 0.75
        ) {
          candidatos.push({
            tipo: TIPOS.UNIDADES,
            label: LABELS[TIPOS.UNIDADES],
            confianza: 98,
            puntaje: 135 + ordenesValidas.length,
            registros: filas.length,
            hoja: hoja.nombre,
            razones: [
              "El contenido agrupa descripciones curriculares en unidades numeradas del 1 al 4."
            ]
          });
        }
      }
    }

    return candidatos;
  }

  function detectarTipoPorContenido(archivo) {
    try {
      var candidatos = [];
      leerHojas(archivo).forEach(function (hoja) {
        candidatos = candidatos.concat(evaluarHoja(hoja));
      });

      candidatos.sort(function (a, b) {
        return b.puntaje - a.puntaje;
      });

      if (!candidatos.length) return null;

      var primero = candidatos[0];
      var segundo = candidatos[1];
      if (segundo && segundo.tipo !== primero.tipo && primero.puntaje - segundo.puntaje < 18) {
        return null;
      }

      return primero;
    } catch (error) {
      console.warn(
        "[SubirCCC.DetectorContenido] No se pudo analizar " +
        texto(archivo && archivo.nombreArchivo) + ":",
        error
      );
      return null;
    }
  }

  function recalcularId(archivo) {
    if (!N || typeof N.crearIdArchivo !== "function") return archivo;
    return Object.assign({}, archivo, {
      id: N.crearIdArchivo(
        archivo.materiaId || "sin_materia",
        archivo.tipo || "sin_tipo",
        archivo.rutaOriginal || archivo.nombreArchivo || "archivo"
      )
    });
  }

  function aplicarDeteccionContenido(archivo) {
    if (!archivo || archivo.esExcel === false || !extensionExcel(archivo)) return archivo;

    var deteccion = detectarTipoPorContenido(archivo);
    if (!deteccion) return archivo;

    var tipoActual = texto(archivo.tipo);
    var confianzaActual = Number(archivo.confianza || 0);
    var puedeReemplazar = !tipoActual || confianzaActual < 70;
    var confirmaTipo = tipoActual === deteccion.tipo;

    if (!puedeReemplazar && !confirmaTipo) {
      return Object.assign({}, archivo, {
        tipoDetectadoContenido: deteccion.tipo,
        confianzaContenido: deteccion.confianza,
        razonesDeteccionContenido: deteccion.razones,
        contenidoClasificadoEn: new Date().toISOString()
      });
    }

    if (confirmaTipo && confianzaActual >= 70) {
      return Object.assign({}, archivo, {
        confirmadoPorContenido: true,
        tipoDetectadoContenido: deteccion.tipo,
        confianzaContenido: deteccion.confianza,
        razonesDeteccionContenido: deteccion.razones,
        contenidoClasificadoEn: new Date().toISOString()
      });
    }

    var actualizado = Object.assign({}, archivo, {
      tipo: deteccion.tipo,
      tipoSugerido: deteccion.tipo,
      tipoLabel: deteccion.label,
      confianza: Math.max(confianzaActual, deteccion.confianza),
      estado: "detectado_contenido",
      razonesDeteccion: arr(archivo.razonesDeteccion).concat(deteccion.razones),
      tipoDetectadoContenido: deteccion.tipo,
      confianzaContenido: deteccion.confianza,
      hojaDetectadaContenido: deteccion.hoja,
      registrosDetectadosContenido: deteccion.registros,
      clasificadoPorContenido: true,
      contenidoClasificadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    });

    return recalcularId(actualizado);
  }

  function actualizarMaterias(paquete, archivos) {
    var porMateria = D.agruparPorMateria(archivos);
    return arr(paquete.materias).map(function (materia) {
      var resumen = D.resumenMateriaArchivos(porMateria[materia.id] || []);
      var estado = resumen.faltantes.length
        ? "incompleto"
        : (resumen.duplicados.length ? "revision" : "completo");

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
        actualizadoEn: new Date().toISOString()
      });
    });
  }

  function reconstruirAdvertencias(paquete, materias, archivos) {
    var controladas = {
      materia_incompleta: true,
      archivos_duplicados: true,
      archivos_no_identificados: true,
      archivos_baja_confianza: true
    };
    var advertencias = arr(paquete.advertencias).filter(function (advertencia) {
      return !advertencia || !controladas[advertencia.tipo];
    });
    var porMateria = D.agruparPorMateria(archivos);

    materias.forEach(function (materia) {
      var resumen = D.resumenMateriaArchivos(porMateria[materia.id] || []);
      if (resumen.faltantes.length) {
        advertencias.push({
          tipo: "materia_incompleta",
          severidad: "error",
          mensaje: "La materia no tiene los 3 Excel PEA obligatorios.",
          materiaId: materia.id,
          materia: materia.nombre || "",
          faltantes: resumen.faltantes
        });
      }
      if (resumen.duplicados.length) {
        advertencias.push({
          tipo: "archivos_duplicados",
          severidad: "advertencia",
          mensaje: "La materia tiene archivos duplicados para un mismo tipo PEA.",
          materiaId: materia.id,
          materia: materia.nombre || "",
          duplicados: resumen.duplicados
        });
      }
      if (resumen.noIdentificados) {
        advertencias.push({
          tipo: "archivos_no_identificados",
          severidad: "advertencia",
          mensaje: "Hay archivos dentro de una materia que no fueron clasificados.",
          materiaId: materia.id,
          materia: materia.nombre || "",
          total: resumen.noIdentificados
        });
      }
    });

    return advertencias;
  }

  var enriquecerOriginal = D.enriquecerPaquete.bind(D);

  D.enriquecerPaquete = function (paquete) {
    var clasificado = enriquecerOriginal(paquete);
    var archivos = arr(clasificado.archivos).map(aplicarDeteccionContenido);
    var materias = actualizarMaterias(clasificado, archivos);
    var advertencias = reconstruirAdvertencias(clasificado, materias, archivos);
    var completas = materias.filter(function (m) { return m.estadoValidacion === "completo"; }).length;
    var incompletas = materias.filter(function (m) { return m.estadoValidacion === "incompleto"; }).length;
    var revision = materias.filter(function (m) { return m.estadoValidacion === "revision"; }).length;
    var recuperados = archivos.filter(function (archivo) {
      return archivo.clasificadoPorContenido === true;
    }).length;

    return Object.assign({}, clasificado, {
      archivos: archivos,
      materias: materias,
      advertencias: advertencias,
      carga: Object.assign({}, clasificado.carga || {}, {
        materiasCompletas: completas,
        materiasIncompletas: incompletas,
        materiasRevision: revision,
        actualizadoEn: new Date().toISOString()
      }),
      diagnostico: Object.assign({}, clasificado.diagnostico || {}, {
        totalArchivosClasificados: archivos.filter(function (a) { return !!a.tipo; }).length,
        totalArchivosNoIdentificados: archivos.filter(function (a) { return !a.tipo; }).length,
        totalClasificadosPorContenido: recuperados,
        materiasCompletas: completas,
        materiasIncompletas: incompletas,
        materiasRevision: revision,
        actualizadoEn: new Date().toISOString()
      })
    });
  };

  D.detectarTipoPorContenido = detectarTipoPorContenido;
  D.VERSION_CONTENIDO = VERSION;
  D.__detectorContenidoV1 = true;
})(window);
