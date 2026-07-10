/* =========================================================
Nombre completo: subir.excel.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.excel.js
Función o funciones:
- Leer internamente los archivos Excel detectados dentro del ZIP.
- Esperar correctamente la carga de XLSX mediante window.__XLSXReady.
- Convertir hojas Excel en matrices, objetos y datos procesados.
- Preparar datos diferentes para PEA Base, PEA Unidades y PEA Actividades.
- Enriquecer el paquete antes de validarlo e importarlo a BDLocal.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;
  var N = NS.Normalizador || null;

  function fechaISO() {
    return new Date().toISOString();
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizadorDisponible() {
    if (!N && window.SubirCCC && window.SubirCCC.Normalizador) {
      N = window.SubirCCC.Normalizador;
    }

    if (!N) {
      throw new Error("Falta cargar primero subir.normalizador.js.");
    }

    return N;
  }

  async function xlsxDisponible() {
    if (window.XLSX) {
      return window.XLSX;
    }

    if (window.__XLSXReady && typeof window.__XLSXReady.then === "function") {
      await window.__XLSXReady;

      if (window.XLSX) {
        return window.XLSX;
      }
    }

    throw new Error(
      "XLSX no está disponible. Revisa /libs/xlsx.min.js y que esté cargado antes de leer Excel."
    );
  }

  function limpiarCelda(valor) {
    if (valor === null || typeof valor === "undefined") return "";

    if (valor instanceof Date) {
      return valor.toISOString();
    }

    return String(valor)
      .replace(/\s+/g, " ")
      .trim();
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

    while (matriz.length && filaVacia(matriz[0])) {
      matriz.shift();
    }

    while (matriz.length && filaVacia(matriz[matriz.length - 1])) {
      matriz.pop();
    }

    var maxCols = 0;

    matriz.forEach(function (fila) {
      for (var i = fila.length - 1; i >= 0; i -= 1) {
        if (limpiarCelda(fila[i]) !== "") {
          maxCols = Math.max(maxCols, i + 1);
          break;
        }
      }
    });

    return matriz.map(function (fila) {
      return fila.slice(0, maxCols);
    });
  }

  function normalizarClave(valor) {
    var NLocal = normalizadorDisponible();

    var clave = NLocal.normalizarComparacion(valor)
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^_|_$/g, "");

    return clave || "campo";
  }

  function claveUnica(base, usadas) {
    var clave = base || "campo";

    if (!usadas[clave]) {
      usadas[clave] = 1;
      return clave;
    }

    usadas[clave] += 1;
    return clave + "_" + usadas[clave];
  }

  function puntuarFilaEncabezado(fila) {
    var NLocal = normalizadorDisponible();

    fila = arr(fila);

    var noVacias = fila.filter(function (celda) {
      return limpiarCelda(celda) !== "";
    });

    if (noVacias.length < 2) return 0;

    var score = noVacias.length * 4;
    var textoFila = NLocal.normalizarComparacion(noVacias.join(" "));

    var palabrasClave = [
      "unidad",
      "tema",
      "subtema",
      "resultado",
      "actividad",
      "horas",
      "contenido",
      "objetivo",
      "evaluacion",
      "metodologia",
      "semana",
      "descripcion"
    ];

    palabrasClave.forEach(function (palabra) {
      if (textoFila.includes(palabra)) {
        score += 10;
      }
    });

    var numericas = noVacias.filter(function (celda) {
      return /^-?\d+(\.\d+)?$/.test(limpiarCelda(celda));
    }).length;

    score -= numericas * 2;

    return score;
  }

  function detectarFilaEncabezado(matriz) {
    matriz = arr(matriz);

    var limite = Math.min(matriz.length, 20);
    var mejor = {
      index: -1,
      score: 0
    };

    for (var i = 0; i < limite; i += 1) {
      var score = puntuarFilaEncabezado(matriz[i]);

      if (score > mejor.score) {
        mejor = {
          index: i,
          score: score
        };
      }
    }

    if (mejor.score < 12) {
      return -1;
    }

    return mejor.index;
  }

  function matrizAObjetos(matriz) {
    matriz = limpiarMatriz(matriz);

    if (!matriz.length) {
      return {
        encabezadoIndex: -1,
        encabezados: [],
        filas: []
      };
    }

    var encabezadoIndex = detectarFilaEncabezado(matriz);

    if (encabezadoIndex === -1) {
      return {
        encabezadoIndex: -1,
        encabezados: [],
        filas: matriz.map(function (fila, index) {
          return {
            __filaExcel: index + 1,
            valores: fila
          };
        })
      };
    }

    var usadas = {};
    var encabezados = arr(matriz[encabezadoIndex]).map(function (celda, index) {
      var clave = normalizarClave(celda || ("columna_" + (index + 1)));
      return claveUnica(clave, usadas);
    });

    var filas = matriz.slice(encabezadoIndex + 1)
      .filter(function (fila) {
        return !filaVacia(fila);
      })
      .map(function (fila, index) {
        var obj = {
          __filaExcel: encabezadoIndex + 2 + index
        };

        encabezados.forEach(function (clave, colIndex) {
          obj[clave] = limpiarCelda(fila[colIndex]);
        });

        return obj;
      });

    return {
      encabezadoIndex: encabezadoIndex,
      encabezados: encabezados,
      filas: filas
    };
  }

  function extraerCamposClaveValor(matriz) {
    matriz = limpiarMatriz(matriz);

    var campos = {};
    var usados = {};

    matriz.forEach(function (fila) {
      var noVacias = arr(fila).filter(function (celda) {
        return limpiarCelda(celda) !== "";
      });

      if (noVacias.length < 2) return;
      if (noVacias.length > 4) return;

      var clave = normalizarClave(noVacias[0]);
      var valor = noVacias.slice(1).join(" ").trim();

      if (!clave || !valor) return;

      campos[claveUnica(clave, usados)] = valor;
    });

    return campos;
  }

  function buscarNumeroEnObjeto(obj, claves) {
    claves = arr(claves);

    for (var i = 0; i < claves.length; i += 1) {
      var clave = claves[i];
      var valor = obj[clave];

      if (valor === null || typeof valor === "undefined") continue;

      var match = String(valor).match(/\d+/);

      if (match) {
        return Number(match[0]);
      }
    }

    var clavesObj = Object.keys(obj || {});

    for (var j = 0; j < clavesObj.length; j += 1) {
      var k = clavesObj[j];

      if (k.includes("unidad") || k.includes("nro") || k.includes("numero")) {
        var match2 = String(obj[k]).match(/\d+/);
        if (match2) return Number(match2[0]);
      }
    }

    return 0;
  }

  function buscarTextoEnObjeto(obj, palabras) {
    palabras = arr(palabras);

    var claves = Object.keys(obj || {});

    for (var i = 0; i < claves.length; i += 1) {
      var clave = claves[i];

      for (var j = 0; j < palabras.length; j += 1) {
        if (clave.includes(palabras[j])) {
          return texto(obj[clave]);
        }
      }
    }

    return "";
  }

  function procesarBase(hojasProcesadas) {
    var campos = {};
    var hojas = {};

    hojasProcesadas.forEach(function (hoja) {
      var kv = extraerCamposClaveValor(hoja.matriz);

      Object.keys(kv).forEach(function (clave) {
        if (!campos[clave]) {
          campos[clave] = kv[clave];
        }
      });

      hojas[hoja.nombre] = {
        totalFilas: hoja.totalFilas,
        totalColumnas: hoja.totalColumnas,
        campos: kv,
        filas: hoja.objetos.filas.slice(0, 300)
      };
    });

    return {
      tipo: "pea_base",
      campos: campos,
      hojas: hojas,
      procesadoEn: fechaISO()
    };
  }

  function procesarUnidades(hojasProcesadas) {
    var filas = [];

    hojasProcesadas.forEach(function (hoja) {
      var objetos = hoja.objetos.filas || [];

      objetos.forEach(function (obj, index) {
        var unidadNumero = buscarNumeroEnObjeto(obj, [
          "unidad",
          "n_unidad",
          "numero_unidad",
          "unidad_numero"
        ]);

        var tema = buscarTextoEnObjeto(obj, ["tema", "contenido", "titulo"]);
        var subtema = buscarTextoEnObjeto(obj, ["subtema", "sub_tema"]);
        var resultado = buscarTextoEnObjeto(obj, ["resultado", "aprendizaje", "logro"]);

        filas.push(Object.assign({}, obj, {
          id: "unidad_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7) + "_" + index,
          hoja: hoja.nombre,
          unidadNumero: unidadNumero,
          temaDetectado: tema,
          subtemaDetectado: subtema,
          resultadoDetectado: resultado
        }));
      });
    });

    return filas;
  }

  function procesarActividades(hojasProcesadas) {
    var filas = [];

    hojasProcesadas.forEach(function (hoja) {
      var objetos = hoja.objetos.filas || [];

      objetos.forEach(function (obj, index) {
        var unidadNumero = buscarNumeroEnObjeto(obj, [
          "unidad",
          "n_unidad",
          "numero_unidad",
          "unidad_numero"
        ]);

        var actividad = buscarTextoEnObjeto(obj, [
          "actividad",
          "taller",
          "proyecto",
          "descripcion"
        ]);

        var tipoActividad = buscarTextoEnObjeto(obj, [
          "tipo",
          "tipo_actividad",
          "modalidad",
          "componente"
        ]);

        filas.push(Object.assign({}, obj, {
          id: "actividad_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7) + "_" + index,
          hoja: hoja.nombre,
          unidadNumero: unidadNumero,
          actividadDetectada: actividad,
          tipoActividad: tipoActividad || "actividad"
        }));
      });
    });

    return filas;
  }

  async function leerExcelArchivo(archivo, opciones) {
    opciones = opciones || {};

    var XLSXLocal = await xlsxDisponible();

    if (!archivo || !archivo.contenidoBinario) {
      throw new Error("El archivo no tiene contenido binario para leer: " + (archivo && archivo.nombreArchivo ? archivo.nombreArchivo : ""));
    }

    var workbook = XLSXLocal.read(archivo.contenidoBinario, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellText: false
    });

    var maxFilasPorHoja = Number(opciones.maxFilasPorHoja || 3000);
    var hojasProcesadas = [];

    workbook.SheetNames.forEach(function (nombreHoja) {
      var ws = workbook.Sheets[nombreHoja];

      var matriz = XLSXLocal.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: false
      });

      matriz = limpiarMatriz(matriz);

      if (maxFilasPorHoja > 0 && matriz.length > maxFilasPorHoja) {
        matriz = matriz.slice(0, maxFilasPorHoja);
      }

      var objetos = matrizAObjetos(matriz);

      hojasProcesadas.push({
        nombre: nombreHoja,
        matriz: matriz,
        objetos: objetos,
        totalFilas: matriz.length,
        totalColumnas: matriz.reduce(function (max, fila) {
          return Math.max(max, fila.length);
        }, 0)
      });
    });

    var datosProcesados = null;

    if (archivo.tipo === "pea_base") {
      datosProcesados = procesarBase(hojasProcesadas);
    } else if (archivo.tipo === "pea_unidades") {
      datosProcesados = procesarUnidades(hojasProcesadas);
    } else if (archivo.tipo === "pea_actividades") {
      datosProcesados = procesarActividades(hojasProcesadas);
    } else {
      datosProcesados = {
        tipo: "excel_generico",
        hojas: hojasProcesadas.map(function (hoja) {
          return {
            nombre: hoja.nombre,
            totalFilas: hoja.totalFilas,
            totalColumnas: hoja.totalColumnas,
            filas: hoja.objetos.filas
          };
        })
      };
    }

    return {
      leido: true,
      nombreArchivo: archivo.nombreArchivo,
      tipo: archivo.tipo,
      totalHojas: hojasProcesadas.length,
      hojas: hojasProcesadas.map(function (hoja) {
        return {
          nombre: hoja.nombre,
          totalFilas: hoja.totalFilas,
          totalColumnas: hoja.totalColumnas,
          encabezados: hoja.objetos.encabezados,
          encabezadoIndex: hoja.objetos.encabezadoIndex,
          preview: hoja.objetos.filas.slice(0, 5)
        };
      }),
      datosProcesados: datosProcesados,
      leidoEn: fechaISO()
    };
  }

  function notificarProgreso(opciones, data) {
    if (opciones && typeof opciones.onProgress === "function") {
      try {
        opciones.onProgress(data);
      } catch (error) {
        console.warn("[SubirCCC.Excel] Error en progreso:", error);
      }
    }
  }

  async function enriquecerPaqueteConExcel(paquete, opciones) {
    opciones = opciones || {};

    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para leer Excel.");
    }

    await xlsxDisponible();

    var archivos = arr(paquete.archivos);
    var excel = archivos.filter(function (archivo) {
      return archivo.esExcel !== false &&
        ["xlsx", "xls", "xlsm", "csv"].indexOf(texto(archivo.extension).toLowerCase()) !== -1 &&
        archivo.contenidoBinario;
    });

    var total = excel.length;
    var leidos = 0;
    var errores = [];

    for (var i = 0; i < archivos.length; i += 1) {
      var archivo = archivos[i];

      if (excel.indexOf(archivo) === -1) continue;

      notificarProgreso(opciones, {
        etapa: "excel",
        mensaje: "Leyendo Excel " + (leidos + 1) + " de " + total,
        porcentaje: total ? 80 + Math.round(((leidos + 1) / total) * 12) : 90,
        archivo: archivo.nombreArchivo
      });

      try {
        var lectura = await leerExcelArchivo(archivo, opciones);

        archivos[i] = Object.assign({}, archivo, {
          excelLeido: true,
          excelResumen: {
            totalHojas: lectura.totalHojas,
            hojas: lectura.hojas
          },
          datosProcesados: lectura.datosProcesados,
          errorExcel: "",
          actualizadoEn: fechaISO()
        });

        leidos += 1;
      } catch (error) {
        errores.push({
          archivoId: archivo.id,
          nombreArchivo: archivo.nombreArchivo,
          rutaOriginal: archivo.rutaOriginal,
          error: error.message
        });

        archivos[i] = Object.assign({}, archivo, {
          excelLeido: false,
          errorExcel: error.message,
          actualizadoEn: fechaISO()
        });
      }
    }

    var advertencias = arr(paquete.advertencias).slice();

    errores.forEach(function (error) {
      advertencias.push({
        tipo: "excel_no_leido",
        severidad: "advertencia",
        mensaje: "No se pudo leer internamente un Excel.",
        archivoId: error.archivoId,
        nombreArchivo: error.nombreArchivo,
        rutaOriginal: error.rutaOriginal,
        error: error.error
      });
    });

    return Object.assign({}, paquete, {
      archivos: archivos,
      advertencias: advertencias,
      diagnosticoExcel: {
        generadoEn: fechaISO(),
        totalExcelConBinario: total,
        totalExcelLeidos: leidos,
        totalErroresExcel: errores.length,
        errores: errores
      },
      diagnostico: Object.assign({}, paquete.diagnostico || {}, {
        totalExcelConBinario: total,
        totalExcelLeidos: leidos,
        totalErroresExcel: errores.length,
        excelActualizadoEn: fechaISO()
      })
    });
  }

  NS.Excel = {
    xlsxDisponible: xlsxDisponible,
    leerExcelArchivo: leerExcelArchivo,
    enriquecerPaqueteConExcel: enriquecerPaqueteConExcel,
    limpiarMatriz: limpiarMatriz,
    matrizAObjetos: matrizAObjetos,
    extraerCamposClaveValor: extraerCamposClaveValor
  };
})(window);