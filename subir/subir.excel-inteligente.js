/* =========================================================
Nombre completo: subir.excel-inteligente.js
Ruta o ubicación: /Curriculo/subir/subir.excel-inteligente.js
Funciones:
- Detectar columnas de unidad aunque su encabezado esté vacío o sea genérico.
- Recuperar automáticamente contenidos válidos de PEA Unidades irregulares.
- No modificar el archivo Excel original.
- Registrar la corrección automática como información de diagnóstico.
- Mantener el lector original como primera opción y actuar solo cuando mejora el resultado.
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

  function fechaISO() {
    return new Date().toISOString();
  }

  function limpiarCelda(valor) {
    if (valor === null || typeof valor === "undefined") return "";
    return String(valor)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(function (linea) {
        return linea.replace(/[\t ]+/g, " ").trim();
      })
      .filter(function (linea, index, lineas) {
        return linea || (index > 0 && index < lineas.length - 1);
      })
      .join("\n")
      .trim();
  }

  function normalizarCampo(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function filaVacia(fila) {
    return !arr(fila).some(function (celda) {
      return limpiarCelda(celda) !== "";
    });
  }

  function limpiarMatriz(matriz) {
    matriz = arr(matriz).map(function (fila) {
      return arr(fila).map(limpiarCelda);
    });

    while (matriz.length && filaVacia(matriz[0])) matriz.shift();
    while (matriz.length && filaVacia(matriz[matriz.length - 1])) matriz.pop();

    return matriz;
  }

  function numeroUnidad(valor) {
    var match = texto(valor).match(/(?:^|\D)([1-4])(?:\D|$)/);
    return match ? Number(match[1]) : 0;
  }

  function unidadDesdeContenido(valor) {
    var match = texto(valor).match(/^\s*([1-4])(?:\s*[.\-:]|\s|$)/);
    return match ? Number(match[1]) : 0;
  }

  function contieneAlias(valor, aliases) {
    return aliases.indexOf(normalizarCampo(valor)) !== -1;
  }

  function detectarFilaEncabezado(matriz) {
    var limite = Math.min(20, matriz.length);
    var mejor = { indice: -1, puntaje: 0 };

    for (var i = 0; i < limite; i += 1) {
      var fila = arr(matriz[i]);
      var puntaje = 0;

      fila.forEach(function (celda) {
        var clave = normalizarCampo(celda);
        if (!clave) return;
        if ([
          "codigocomponente",
          "ordencomponente",
          "descripcioncomponente",
          "contenido",
          "unidad",
          "unidadnumero",
          "numerounidad"
        ].indexOf(clave) !== -1) {
          puntaje += 20;
        } else if (clave.indexOf("componente") !== -1 || clave.indexOf("unidad") !== -1) {
          puntaje += 8;
        }
      });

      if (puntaje > mejor.puntaje) {
        mejor = { indice: i, puntaje: puntaje };
      }
    }

    return mejor.puntaje >= 20 ? mejor.indice : -1;
  }

  function indicePorAlias(encabezados, aliases) {
    for (var i = 0; i < encabezados.length; i += 1) {
      if (contieneAlias(encabezados[i], aliases)) return i;
    }
    return -1;
  }

  function esEncabezadoGenerico(valor) {
    var clave = normalizarCampo(valor);
    return !clave || /^columna\d*$/.test(clave) || /^campo\d*$/.test(clave);
  }

  function evaluarColumnaUnidad(matriz, encabezadoIndex, columna, columnaDescripcion) {
    var filas = matriz.slice(encabezadoIndex + 1).filter(function (fila) {
      return !filaVacia(fila);
    });
    var noVacios = 0;
    var validos = 0;
    var descripcionesValidas = 0;
    var distintos = Object.create(null);

    filas.slice(0, 1000).forEach(function (fila) {
      var valor = limpiarCelda(fila[columna]);
      var descripcion = limpiarCelda(fila[columnaDescripcion]);
      if (!valor) return;

      noVacios += 1;
      var unidad = numeroUnidad(valor);
      if (unidad >= 1 && unidad <= 4) {
        validos += 1;
        distintos[unidad] = true;
        if (descripcion.length >= 4) descripcionesValidas += 1;
      }
    });

    if (noVacios < 3 || validos < 3) return null;

    var proporcionValida = validos / noVacios;
    var proporcionDescripcion = descripcionesValidas / validos;
    var totalDistintos = Object.keys(distintos).length;

    if (proporcionValida < 0.85) return null;
    if (proporcionDescripcion < 0.75) return null;
    if (totalDistintos < 2 && validos >= 8) return null;

    return {
      columna: columna,
      confianza: Math.min(
        0.99,
        0.55 + proporcionValida * 0.25 + proporcionDescripcion * 0.12 + totalDistintos * 0.02
      ),
      validos: validos,
      total: noVacios,
      unidadesDistintas: totalDistintos,
      puntaje:
        proporcionValida * 100 +
        proporcionDescripcion * 35 +
        totalDistintos * 12 +
        (Math.abs(columnaDescripcion - columna) === 1 ? 15 : 0)
    };
  }

  function detectarColumnas(matriz) {
    matriz = limpiarMatriz(matriz);
    var encabezadoIndex = detectarFilaEncabezado(matriz);

    if (encabezadoIndex === -1) {
      return { encontrado: false, motivo: "No se identificó una fila de encabezados." };
    }

    var encabezados = arr(matriz[encabezadoIndex]);
    var descripcionAliases = [
      "descripcioncomponente",
      "descripcion",
      "contenido",
      "tema",
      "titulo"
    ];
    var unidadAliases = [
      "ordencomponente",
      "orden",
      "unidad",
      "unidadnumero",
      "numerounidad",
      "nroUnidad",
      "nivel"
    ].map(normalizarCampo);
    var codigoAliases = ["codigocomponente", "codigo"].map(normalizarCampo);

    var columnaDescripcion = indicePorAlias(encabezados, descripcionAliases);
    var columnaUnidad = indicePorAlias(encabezados, unidadAliases);
    var columnaCodigo = indicePorAlias(encabezados, codigoAliases);
    var correcciones = [];

    if (columnaDescripcion === -1) {
      return { encontrado: false, motivo: "No se identificó la columna de contenidos." };
    }

    if (columnaUnidad === -1) {
      var candidatos = [];

      for (var i = 0; i < encabezados.length; i += 1) {
        if (i === columnaDescripcion || i === columnaCodigo) continue;
        if (!esEncabezadoGenerico(encabezados[i])) continue;

        var evaluacion = evaluarColumnaUnidad(
          matriz,
          encabezadoIndex,
          i,
          columnaDescripcion
        );
        if (evaluacion) candidatos.push(evaluacion);
      }

      candidatos.sort(function (a, b) {
        return b.puntaje - a.puntaje;
      });

      if (!candidatos.length) {
        return {
          encontrado: false,
          motivo: "No hubo suficiente confianza para inferir la columna de unidad."
        };
      }

      columnaUnidad = candidatos[0].columna;
      correcciones.push({
        tipo: "encabezado_inferido",
        columnaNumero: columnaUnidad + 1,
        encabezadoOriginal: texto(encabezados[columnaUnidad]) || "(vacío)",
        encabezadoInferido: "ordenComponente",
        confianza: candidatos[0].confianza,
        filasAnalizadas: candidatos[0].total,
        mensaje:
          "La columna " + (columnaUnidad + 1) +
          " se interpretó automáticamente como ordenComponente."
      });
    }

    return {
      encontrado: true,
      encabezadoIndex: encabezadoIndex,
      encabezados: encabezados,
      columnaCodigo: columnaCodigo,
      columnaUnidad: columnaUnidad,
      columnaDescripcion: columnaDescripcion,
      correcciones: correcciones
    };
  }

  function inferirUnidadesDesdeMatriz(matriz, contexto) {
    contexto = contexto || {};
    matriz = limpiarMatriz(matriz);
    var columnas = detectarColumnas(matriz);

    if (!columnas.encontrado) {
      return {
        valido: false,
        unidades: [],
        correcciones: [],
        motivo: columnas.motivo || "No se pudo interpretar el PEA Unidades."
      };
    }

    var mapa = Object.create(null);
    var unidadAnterior = 0;
    var filasUsadas = 0;

    matriz.slice(columnas.encabezadoIndex + 1).forEach(function (fila, index) {
      if (filaVacia(fila)) return;

      var contenido = limpiarCelda(fila[columnas.columnaDescripcion]);
      if (!contenido) return;

      var unidad = numeroUnidad(fila[columnas.columnaUnidad]);
      if (!unidad) unidad = unidadDesdeContenido(contenido);
      if (!unidad) unidad = unidadAnterior;
      if (unidad < 1 || unidad > 4) return;

      unidadAnterior = unidad;
      if (!mapa[unidad]) {
        mapa[unidad] = {
          unidadNumero: unidad,
          contenidos: [],
          filasOriginales: [],
          temaDetectado: "",
          subtemaDetectado: "",
          resultadoDetectado: "",
          recuperadaAutomaticamente: columnas.correcciones.length > 0
        };
      }

      if (mapa[unidad].contenidos.indexOf(contenido) === -1) {
        mapa[unidad].contenidos.push(contenido);
      }

      mapa[unidad].filasOriginales.push({
        __filaExcel: columnas.encabezadoIndex + 2 + index,
        __hoja: texto(contexto.hoja),
        codigoComponente:
          columnas.columnaCodigo >= 0
            ? limpiarCelda(fila[columnas.columnaCodigo]) || "3"
            : "3",
        ordenComponente: String(unidad),
        descripcionComponente: contenido,
        correccionAutomatica: columnas.correcciones.length > 0
      });
      filasUsadas += 1;
    });

    var unidades = Object.keys(mapa)
      .map(function (clave) {
        var unidad = mapa[clave];
        unidad.totalContenidos = unidad.contenidos.length;
        unidad.temaDetectado = unidad.contenidos[0] || "";
        return unidad;
      })
      .sort(function (a, b) {
        return a.unidadNumero - b.unidadNumero;
      });

    var totalContenidos = unidades.reduce(function (total, unidad) {
      return total + unidad.contenidos.length;
    }, 0);

    return {
      valido: unidades.length > 0 && totalContenidos > 0,
      unidades: unidades,
      correcciones: columnas.correcciones.map(function (item) {
        return Object.assign({}, item, {
          hoja: texto(contexto.hoja)
        });
      }),
      totalContenidos: totalContenidos,
      filasUsadas: filasUsadas,
      motivo: unidades.length ? "" : "No se recuperaron unidades curriculares."
    };
  }

  function contarContenidos(unidades) {
    return arr(unidades).reduce(function (total, unidad) {
      return total + arr(unidad && unidad.contenidos).length;
    }, 0);
  }

  function unidadesValidas(unidades) {
    return arr(unidades).filter(function (unidad) {
      var numero = Number(unidad && unidad.unidadNumero || 0);
      return numero >= 1 && numero <= 4 && arr(unidad && unidad.contenidos).length > 0;
    });
  }

  function fusionarUnidades(destino, nuevas) {
    var mapa = Object.create(null);

    arr(destino).concat(arr(nuevas)).forEach(function (unidad) {
      var numero = Number(unidad && unidad.unidadNumero || 0);
      if (numero < 1 || numero > 4) return;

      if (!mapa[numero]) {
        mapa[numero] = {
          unidadNumero: numero,
          contenidos: [],
          filasOriginales: [],
          temaDetectado: "",
          subtemaDetectado: "",
          resultadoDetectado: "",
          recuperadaAutomaticamente: false
        };
      }

      arr(unidad.contenidos).forEach(function (contenido) {
        contenido = texto(contenido);
        if (contenido && mapa[numero].contenidos.indexOf(contenido) === -1) {
          mapa[numero].contenidos.push(contenido);
        }
      });

      mapa[numero].filasOriginales = mapa[numero].filasOriginales.concat(
        arr(unidad.filasOriginales)
      );
      mapa[numero].recuperadaAutomaticamente =
        mapa[numero].recuperadaAutomaticamente ||
        unidad.recuperadaAutomaticamente === true;
    });

    return Object.keys(mapa)
      .map(function (clave) {
        var unidad = mapa[clave];
        unidad.totalContenidos = unidad.contenidos.length;
        unidad.temaDetectado = unidad.contenidos[0] || "";
        return unidad;
      })
      .sort(function (a, b) {
        return a.unidadNumero - b.unidadNumero;
      });
  }

  async function repararArchivoUnidades(archivo) {
    if (!archivo || !archivo.contenidoBinario || !window.XLSX) return null;

    var workbook = window.XLSX.read(archivo.contenidoBinario, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    var unidades = [];
    var correcciones = [];
    var hojas = [];

    workbook.SheetNames.forEach(function (nombreHoja) {
      var ws = workbook.Sheets[nombreHoja];
      var matriz = window.XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: false
      });
      var resultado = inferirUnidadesDesdeMatriz(matriz, { hoja: nombreHoja });

      hojas.push({
        nombre: nombreHoja,
        valido: resultado.valido,
        unidades: resultado.unidades.length,
        contenidos: resultado.totalContenidos || 0,
        correcciones: resultado.correcciones
      });

      if (!resultado.valido) return;
      unidades = fusionarUnidades(unidades, resultado.unidades);
      correcciones = correcciones.concat(resultado.correcciones);
    });

    if (!unidades.length || !contarContenidos(unidades)) return null;

    return {
      unidades: unidades,
      correcciones: correcciones,
      hojas: hojas,
      totalContenidos: contarContenidos(unidades)
    };
  }

  function instalar() {
    if (!NS.Excel || typeof NS.Excel.enriquecerPaqueteConExcel !== "function") {
      console.error(
        "[SubirCCC.ExcelInteligente] Debe cargarse después de subir.excel.js."
      );
      return;
    }

    if (NS.Excel.__encabezadosInteligentes === true) return;

    var enriquecerOriginal = NS.Excel.enriquecerPaqueteConExcel;

    NS.Excel.enriquecerPaqueteConExcel = async function (paquete, opciones) {
      var resultado = await enriquecerOriginal.call(NS.Excel, paquete, opciones);
      var archivos = arr(resultado && resultado.archivos).slice();
      var advertencias = arr(resultado && resultado.advertencias).slice();
      var correcciones = [];

      for (var i = 0; i < archivos.length; i += 1) {
        var archivo = archivos[i];
        if (!archivo || archivo.tipo !== "pea_unidades" || !archivo.contenidoBinario) {
          continue;
        }

        var existentes = unidadesValidas(archivo.datosProcesados);
        var reparacion = await repararArchivoUnidades(archivo);

        if (!reparacion) continue;

        var debeReemplazar =
          reparacion.unidades.length > existentes.length ||
          reparacion.totalContenidos > contarContenidos(existentes);

        if (!debeReemplazar) continue;

        var correccionesArchivo = reparacion.correcciones.length
          ? reparacion.correcciones
          : [{
              tipo: "estructura_recuperada",
              encabezadoInferido: "ordenComponente",
              confianza: 0.9,
              mensaje: "Se recuperó la estructura del PEA Unidades por el patrón de sus datos."
            }];

        archivos[i] = Object.assign({}, archivo, {
          excelLeido: true,
          datosProcesados: reparacion.unidades,
          correccionesAutomaticas: correccionesArchivo,
          excelResumen: Object.assign({}, archivo.excelResumen || {}, {
            correccionesAutomaticas: correccionesArchivo,
            hojasInteligentes: reparacion.hojas,
            totalContenidosRecuperados: reparacion.totalContenidos
          }),
          errorExcel: "",
          actualizadoEn: fechaISO()
        });

        correcciones.push({
          archivoId: texto(archivo.id),
          carreraId: texto(archivo.carreraId),
          nivelId: texto(archivo.nivelId),
          materiaId: texto(archivo.materiaId),
          nombreArchivo: texto(archivo.nombreArchivo),
          rutaOriginal: texto(archivo.rutaOriginal),
          totalUnidades: reparacion.unidades.length,
          totalContenidos: reparacion.totalContenidos,
          detalle: correccionesArchivo
        });

        advertencias.push({
          tipo: "excel_corregido_automaticamente",
          severidad: "info",
          bloqueaImportacion: false,
          mensaje:
            "Se corrigió automáticamente la estructura del PEA Unidades: " +
            reparacion.unidades.length + " unidades y " +
            reparacion.totalContenidos + " contenidos recuperados.",
          archivoId: texto(archivo.id),
          carreraId: texto(archivo.carreraId),
          nivelId: texto(archivo.nivelId),
          materiaId: texto(archivo.materiaId),
          nombreArchivo: texto(archivo.nombreArchivo),
          tipoPEA: "pea_unidades",
          tipoPEALabel: texto(archivo.tipoLabel || "PEA Unidades"),
          rutaOriginal: texto(archivo.rutaOriginal),
          correccionesAutomaticas: correccionesArchivo
        });
      }

      if (!correcciones.length) return resultado;

      return Object.assign({}, resultado, {
        archivos: archivos,
        advertencias: advertencias,
        diagnosticoExcel: Object.assign({}, resultado.diagnosticoExcel || {}, {
          totalCorreccionesAutomaticas:
            Number(resultado.diagnosticoExcel &&
              resultado.diagnosticoExcel.totalCorreccionesAutomaticas || 0) +
            correcciones.length,
          correccionesAutomaticas: arr(
            resultado.diagnosticoExcel &&
            resultado.diagnosticoExcel.correccionesAutomaticas
          ).concat(correcciones)
        }),
        diagnostico: Object.assign({}, resultado.diagnostico || {}, {
          totalCorreccionesExcelAutomaticas:
            Number(resultado.diagnostico &&
              resultado.diagnostico.totalCorreccionesExcelAutomaticas || 0) +
            correcciones.length,
          excelInteligenteActualizadoEn: fechaISO()
        })
      });
    };

    NS.Excel.__encabezadosInteligentes = true;
  }

  NS.ExcelInteligente = {
    VERSION: VERSION,
    detectarFilaEncabezado: detectarFilaEncabezado,
    detectarColumnas: detectarColumnas,
    inferirUnidadesDesdeMatriz: inferirUnidadesDesdeMatriz,
    repararArchivoUnidades: repararArchivoUnidades,
    instalar: instalar
  };

  instalar();
})(window);
