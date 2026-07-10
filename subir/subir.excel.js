/* =========================================================
Nombre completo: subir.excel.js
Ruta o ubicación: /Curriculo/subir/subir.excel.js
Función o funciones:
- Leer internamente los archivos Excel detectados dentro del ZIP.
- Interpretar la estructura real codigoComponente/ordenComponente de los PEA.
- Guardar descripción, objetivo, cuatro unidades, competencias, resultados y bibliografía.
- Agrupar todos los contenidos en sus cuatro unidades correctas.
- Conservar todas las actividades con mecanismo, tema y descripción.
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
    if (window.XLSX) return window.XLSX;

    if (window.__XLSXReady && typeof window.__XLSXReady.then === "function") {
      await window.__XLSXReady;
      if (window.XLSX) return window.XLSX;
    }

    throw new Error(
      "XLSX no está disponible. Revisa /libs/xlsx.min.js y que esté cargado antes de leer Excel."
    );
  }

  function limpiarCelda(valor) {
    if (valor === null || typeof valor === "undefined") return "";
    if (valor instanceof Date) return valor.toISOString();

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

  function normalizarNombreCampo(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
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
    fila = arr(fila);

    var noVacias = fila.filter(function (celda) {
      return limpiarCelda(celda) !== "";
    });

    if (noVacias.length < 2) return 0;

    var score = noVacias.length * 4;
    var textoFila = normalizarNombreCampo(noVacias.join(" "));
    var palabrasClave = [
      "codigocomponente",
      "ordencomponente",
      "descripcioncomponente",
      "unidad",
      "tema",
      "subtema",
      "resultado",
      "actividad",
      "mecanismo",
      "nivel",
      "contenido",
      "objetivo",
      "evaluacion",
      "bibliografia"
    ];

    palabrasClave.forEach(function (palabra) {
      if (textoFila.includes(palabra)) score += 12;
    });

    return score;
  }

  function detectarFilaEncabezado(matriz) {
    matriz = arr(matriz);
    var limite = Math.min(matriz.length, 20);
    var mejor = { index: -1, score: 0 };

    for (var i = 0; i < limite; i += 1) {
      var score = puntuarFilaEncabezado(matriz[i]);
      if (score > mejor.score) mejor = { index: i, score: score };
    }

    return mejor.score >= 12 ? mejor.index : -1;
  }

  function matrizAObjetos(matriz) {
    matriz = limpiarMatriz(matriz);

    if (!matriz.length) {
      return { encabezadoIndex: -1, encabezados: [], filas: [] };
    }

    var encabezadoIndex = detectarFilaEncabezado(matriz);

    if (encabezadoIndex === -1) {
      return {
        encabezadoIndex: -1,
        encabezados: [],
        filas: matriz.map(function (fila, index) {
          return { __filaExcel: index + 1, valores: fila };
        })
      };
    }

    var usadas = {};
    var encabezados = arr(matriz[encabezadoIndex]).map(function (celda, index) {
      return claveUnica(normalizarClave(celda || ("columna_" + (index + 1))), usadas);
    });

    var filas = matriz.slice(encabezadoIndex + 1)
      .filter(function (fila) {
        return !filaVacia(fila);
      })
      .map(function (fila, index) {
        var obj = { __filaExcel: encabezadoIndex + 2 + index };

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

      if (noVacias.length < 2 || noVacias.length > 4) return;

      var clave = normalizarClave(noVacias[0]);
      var valor = noVacias.slice(1).join(" ").trim();

      if (clave && valor) campos[claveUnica(clave, usados)] = valor;
    });

    return campos;
  }

  function obtenerValor(obj, aliases) {
    obj = obj || {};
    aliases = arr(aliases).map(normalizarNombreCampo);
    var claves = Object.keys(obj);

    for (var i = 0; i < claves.length; i += 1) {
      var clave = claves[i];
      if (aliases.indexOf(normalizarNombreCampo(clave)) !== -1 && texto(obj[clave])) {
        return texto(obj[clave]);
      }
    }

    return "";
  }

  function obtenerNumero(obj, aliases, defecto) {
    var valor = obtenerValor(obj, aliases);
    var match = valor.match(/-?\d+/);
    return match ? Number(match[0]) : Number(defecto || 0);
  }

  function obtenerFilas(hojasProcesadas) {
    var filas = [];

    arr(hojasProcesadas).forEach(function (hoja) {
      arr(hoja.objetos && hoja.objetos.filas).forEach(function (fila) {
        filas.push(Object.assign({ __hoja: hoja.nombre }, fila));
      });
    });

    return filas;
  }

  function esEstructuraComponentes(filas) {
    return arr(filas).some(function (fila) {
      return !!obtenerValor(fila, ["codigoComponente", "codigo_componente"]);
    });
  }

  function procesarBase(hojasProcesadas) {
    var campos = {};
    var hojas = {};
    var filas = obtenerFilas(hojasProcesadas);

    hojasProcesadas.forEach(function (hoja) {
      var kv = extraerCamposClaveValor(hoja.matriz);

      Object.keys(kv).forEach(function (clave) {
        if (!campos[clave]) campos[clave] = kv[clave];
      });

      hojas[hoja.nombre] = {
        totalFilas: hoja.totalFilas,
        totalColumnas: hoja.totalColumnas,
        campos: kv,
        filas: arr(hoja.objetos.filas).slice(0, 1000)
      };
    });

    var descripcion = "";
    var objetivo = "";
    var mapaUnidades = {};
    var bibliografia = [];

    if (esEstructuraComponentes(filas)) {
      filas.forEach(function (fila) {
        var codigo = obtenerNumero(fila, ["codigoComponente", "codigo_componente"], 0);
        var orden = obtenerNumero(fila, ["ordenComponente", "orden_componente"], 0);
        var descripcion1 = obtenerValor(fila, ["descripcionComponente", "descripcion_componente"]);
        var descripcion2 = obtenerValor(fila, ["descripcionComponente2", "descripcion_componente_2"]);
        var descripcion3 = obtenerValor(fila, ["descripcionComponente3", "descripcion_componente_3"]);

        if (codigo === 1 && !descripcion) descripcion = descripcion1;
        if (codigo === 2 && !objetivo) objetivo = descripcion1;

        if (codigo >= 3 && codigo <= 5 && orden > 0) {
          if (!mapaUnidades[orden]) {
            mapaUnidades[orden] = {
              unidadNumero: orden,
              nombre: "",
              competencia: "",
              resultadoAprendizaje: ""
            };
          }

          if (codigo === 3) mapaUnidades[orden].nombre = descripcion1;
          if (codigo === 4) mapaUnidades[orden].competencia = descripcion1;
          if (codigo === 5) mapaUnidades[orden].resultadoAprendizaje = descripcion1;
        }

        if (codigo === 8 && descripcion1) {
          bibliografia.push({
            orden: orden || bibliografia.length + 1,
            referencia: descripcion1,
            codigoReferencia: descripcion2,
            justificacion: descripcion3
          });
        }
      });
    }

    var unidadesBase = Object.keys(mapaUnidades)
      .map(function (key) { return mapaUnidades[key]; })
      .sort(function (a, b) { return a.unidadNumero - b.unidadNumero; });

    campos.descripcion_asignatura = descripcion || campos.descripcion_asignatura || "";
    campos.objetivo_asignatura = objetivo || campos.objetivo_asignatura || "";

    return {
      tipo: "pea_base",
      versionEstructura: 2,
      descripcion: descripcion,
      objetivo: objetivo,
      unidadesBase: unidadesBase,
      bibliografia: bibliografia.sort(function (a, b) { return a.orden - b.orden; }),
      campos: campos,
      hojas: hojas,
      filas: filas,
      procesadoEn: fechaISO()
    };
  }

  function procesarUnidades(hojasProcesadas) {
    var filas = obtenerFilas(hojasProcesadas);
    var mapa = {};

    filas.forEach(function (fila) {
      var unidadNumero = obtenerNumero(fila, [
        "ordenComponente",
        "orden_componente",
        "unidadNumero",
        "unidad_numero",
        "numeroUnidad",
        "numero_unidad",
        "unidad"
      ], 0);

      var contenido = obtenerValor(fila, [
        "descripcionComponente",
        "descripcion_componente",
        "contenido",
        "tema",
        "titulo"
      ]);

      if (!unidadNumero || !contenido) return;

      if (!mapa[unidadNumero]) {
        mapa[unidadNumero] = {
          unidadNumero: unidadNumero,
          contenidos: [],
          filasOriginales: [],
          temaDetectado: "",
          subtemaDetectado: "",
          resultadoDetectado: ""
        };
      }

      mapa[unidadNumero].contenidos.push(contenido);
      mapa[unidadNumero].filasOriginales.push(fila);
    });

    return Object.keys(mapa)
      .map(function (key) {
        var unidad = mapa[key];
        unidad.totalContenidos = unidad.contenidos.length;
        unidad.temaDetectado = unidad.contenidos[0] || "";
        return unidad;
      })
      .sort(function (a, b) {
        return a.unidadNumero - b.unidadNumero;
      });
  }

  function procesarActividades(hojasProcesadas) {
    var filas = obtenerFilas(hojasProcesadas);

    return filas.map(function (fila, index) {
      var nivel = obtenerNumero(fila, ["nivel", "unidad", "unidadNumero", "unidad_numero"], 0);
      var mecanismo = obtenerValor(fila, ["mecanismo", "tipoActividad", "tipo_actividad", "tipo", "modalidad"]);
      var tema = obtenerValor(fila, ["tema", "titulo"]);
      var descripcion = obtenerValor(fila, ["descripcion", "descripción", "actividad", "contenido"]);

      return Object.assign({}, fila, {
        id: "actividad_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8) + "_" + index,
        nivel: nivel,
        unidadNumero: nivel,
        mecanismo: mecanismo,
        tema: tema,
        descripcion: descripcion,
        actividadDetectada: descripcion || tema,
        tipoActividad: mecanismo || "Actividad",
        evaluacion: ""
      });
    }).filter(function (fila) {
      return texto(fila.mecanismo) || texto(fila.tema) || texto(fila.descripcion);
    });
  }

  async function leerExcelArchivo(archivo, opciones) {
    opciones = opciones || {};
    var XLSXLocal = await xlsxDisponible();

    if (!archivo || !archivo.contenidoBinario) {
      throw new Error(
        "El archivo no tiene contenido binario para leer: " +
        (archivo && archivo.nombreArchivo ? archivo.nombreArchivo : "")
      );
    }

    var workbook = XLSXLocal.read(archivo.contenidoBinario, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellText: false
    });

    var maxFilasPorHoja = Number(opciones.maxFilasPorHoja || 5000);
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

    var datosProcesados;

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
    extraerCamposClaveValor: extraerCamposClaveValor,
    procesarBase: procesarBase,
    procesarUnidades: procesarUnidades,
    procesarActividades: procesarActividades
  };
})(window);
