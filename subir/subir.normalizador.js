/* =========================================================
Nombre completo: subir.normalizador.js
Ruta o ubicación: /gestion-curricular-ccc/subir/subir.normalizador.js
Función o funciones:
- Normalizar textos, rutas, nombres de carpetas y nombres de archivos.
- Detectar niveles aunque estén escritos de forma diferente.
- Detectar códigos de materia dentro de carpetas o archivos.
- Detectar carpetas tipo MATRIZ CCC aunque no tengan el nombre exacto.
- Entregar utilidades comunes para los detectores inteligentes de subida.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};

  var NS = window.SubirCCC;

  var PALABRAS_IGNORADAS_CARPETA = [
    "gestion curricular",
    "gestión curricular",
    "gestion",
    "curricular",
    "documentos",
    "archivos",
    "backup",
    "__macosx"
  ];

  var PALABRAS_MATRIZ = [
    "matriz ccc",
    "ccc",
    "matriz curricular",
    "matriz de competencias",
    "matriz competencia",
    "matriz competencias",
    "malla ccc",
    "malla curricular",
    "estructura curricular",
    "competencias curriculares"
  ];

  var ORDINALES_NIVEL = {
    primero: 1,
    primer: 1,
    uno: 1,
    segundo: 2,
    dos: 2,
    tercero: 3,
    tercer: 3,
    tres: 3,
    cuarto: 4,
    cuatro: 4,
    quinto: 5,
    cinco: 5,
    sexto: 6,
    seis: 6,
    septimo: 7,
    séptimo: 7,
    siete: 7,
    octavo: 8,
    ocho: 8,
    noveno: 9,
    nueve: 9,
    decimo: 10,
    décimo: 10,
    diez: 10
  };

  var ROMANOS_NIVEL = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor);
  }

  function quitarTildes(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizarTexto(valor) {
    return quitarTildes(valor)
      .replace(/[\\]/g, "/")
      .replace(/[_\-–—]+/g, " ")
      .replace(/[()[\]{}]/g, " ")
      .replace(/[^\w\s./]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizarComparacion(valor) {
    return normalizarTexto(valor)
      .replace(/\./g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function limpiarNombreVisible(valor) {
    var limpio = texto(valor)
      .replace(/[\\]/g, "/")
      .split("/")
      .pop()
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return limpio;
  }

  function slug(valor) {
    var limpio = normalizarTexto(valor)
      .replace(/\./g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    return limpio || "sin_nombre";
  }

  function titleCase(valor) {
    var menores = {
      de: true,
      del: true,
      la: true,
      las: true,
      el: true,
      los: true,
      y: true,
      e: true,
      en: true,
      para: true,
      por: true,
      con: true
    };

    return normalizarTexto(valor)
      .split(" ")
      .filter(Boolean)
      .map(function (palabra, index) {
        if (index > 0 && menores[palabra]) return palabra;

        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
      })
      .join(" ");
  }

  function dividirRuta(ruta) {
    return texto(ruta)
      .replace(/[\\]/g, "/")
      .split("/")
      .map(function (parte) {
        return parte.trim();
      })
      .filter(Boolean);
  }

  function nombreArchivoDesdeRuta(ruta) {
    var partes = dividirRuta(ruta);
    return partes.length ? partes[partes.length - 1] : "";
  }

  function extensionArchivo(nombreArchivo) {
    var nombre = texto(nombreArchivo).trim();
    var match = nombre.match(/\.([a-z0-9]{2,6})$/i);

    return match ? match[1].toLowerCase() : "";
  }

  function esExcel(nombreArchivo) {
    var ext = extensionArchivo(nombreArchivo);

    return ["xlsx", "xls", "xlsm", "csv"].indexOf(ext) !== -1;
  }

  function esZip(nombreArchivo) {
    return extensionArchivo(nombreArchivo) === "zip";
  }

  function esCarpetaIgnorada(nombreCarpeta) {
    var n = normalizarComparacion(nombreCarpeta);

    if (!n) return true;

    return PALABRAS_IGNORADAS_CARPETA.some(function (palabra) {
      var p = normalizarComparacion(palabra);
      return n === p || n.includes(p);
    });
  }

  function levenshtein(a, b) {
    a = normalizarComparacion(a);
    b = normalizarComparacion(b);

    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    var matrix = [];
    var i;
    var j;

    for (i = 0; i <= b.length; i += 1) {
      matrix[i] = [i];
    }

    for (j = 0; j <= a.length; j += 1) {
      matrix[0][j] = j;
    }

    for (i = 1; i <= b.length; i += 1) {
      for (j = 1; j <= a.length; j += 1) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  function similitud(a, b) {
    a = normalizarComparacion(a);
    b = normalizarComparacion(b);

    if (!a && !b) return 100;
    if (!a || !b) return 0;

    if (a === b) return 100;

    if (a.includes(b) || b.includes(a)) {
      var menor = Math.min(a.length, b.length);
      var mayor = Math.max(a.length, b.length);
      return Math.round((menor / mayor) * 92);
    }

    var distancia = levenshtein(a, b);
    var maxLen = Math.max(a.length, b.length);

    return Math.max(0, Math.round((1 - distancia / maxLen) * 100));
  }

  function mejorCoincidencia(valor, candidatos) {
    var mejor = {
      candidato: "",
      confianza: 0,
      detectado: false
    };

    candidatos = Array.isArray(candidatos) ? candidatos : [];

    candidatos.forEach(function (candidato) {
      var score = similitud(valor, candidato);

      if (score > mejor.confianza) {
        mejor = {
          candidato: candidato,
          confianza: score,
          detectado: score >= 72
        };
      }
    });

    return mejor;
  }

  function detectarMatriz(nombreCarpeta) {
    var normalizado = normalizarComparacion(nombreCarpeta);

    if (!normalizado) {
      return {
        detectado: false,
        tipo: "",
        confianza: 0,
        nombreNormalizado: normalizado
      };
    }

    var exacta = PALABRAS_MATRIZ.some(function (palabra) {
      var p = normalizarComparacion(palabra);
      return normalizado === p || normalizado.includes(p);
    });

    if (exacta) {
      return {
        detectado: true,
        tipo: "ccc",
        confianza: 100,
        nombreNormalizado: normalizado
      };
    }

    var match = mejorCoincidencia(normalizado, PALABRAS_MATRIZ);

    return {
      detectado: match.detectado,
      tipo: match.detectado ? "ccc" : "",
      confianza: match.confianza,
      nombreNormalizado: normalizado,
      candidato: match.candidato
    };
  }

  function detectarNivel(nombreCarpeta) {
    var original = texto(nombreCarpeta);
    var normalizado = normalizarComparacion(original);

    if (!normalizado) {
      return {
        detectado: false,
        numero: 0,
        nombre: "",
        confianza: 0
      };
    }

    var matchNumero = normalizado.match(/(?:nivel\s*)?(\d{1,2})(?:\s*\.?\s*nivel)?/);

    if (matchNumero && (normalizado.includes("nivel") || normalizado.length <= 4)) {
      var n = Number(matchNumero[1]);

      return {
        detectado: true,
        numero: n,
        nombre: n + ". Nivel",
        confianza: normalizado.includes("nivel") ? 100 : 82,
        origen: "numero"
      };
    }

    var palabras = normalizado.split(/\s+/).filter(Boolean);

    for (var i = 0; i < palabras.length; i += 1) {
      var palabra = palabras[i];

      if (ORDINALES_NIVEL[palabra]) {
        return {
          detectado: true,
          numero: ORDINALES_NIVEL[palabra],
          nombre: ORDINALES_NIVEL[palabra] + ". Nivel",
          confianza: normalizado.includes("nivel") ? 100 : 78,
          origen: "ordinal"
        };
      }

      if (ROMANOS_NIVEL[palabra] && normalizado.includes("nivel")) {
        return {
          detectado: true,
          numero: ROMANOS_NIVEL[palabra],
          nombre: ROMANOS_NIVEL[palabra] + ". Nivel",
          confianza: 90,
          origen: "romano"
        };
      }
    }

    if (normalizado.includes("nivel")) {
      return {
        detectado: true,
        numero: 0,
        nombre: titleCase(original),
        confianza: 62,
        origen: "texto_nivel"
      };
    }

    return {
      detectado: false,
      numero: 0,
      nombre: "",
      confianza: 0
    };
  }

  function detectarCodigoMateria(valor) {
    var limpio = quitarTildes(valor).toUpperCase();

    var patrones = [
      /[A-Z0-9]{5,}[A-Z0-9]*(?:-[A-Z0-9]{1,}){2,}/g,
      /[A-Z0-9]{3,}\s*-\s*[A-Z0-9]{1,}\s*-\s*[A-Z0-9]{2,}\s*-\s*[A-Z0-9]{2,}/g
    ];

    for (var i = 0; i < patrones.length; i += 1) {
      var match = limpio.match(patrones[i]);

      if (match && match.length) {
        return match[0]
          .replace(/\s+/g, "")
          .replace(/[–—]/g, "-")
          .trim();
      }
    }

    return "";
  }

  function quitarCodigoMateria(valor) {
    var codigo = detectarCodigoMateria(valor);

    if (!codigo) return texto(valor);

    var escaped = codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var reg = new RegExp(escaped, "i");

    return texto(valor)
      .replace(reg, " ")
      .replace(/^[\s\-–—_:]+/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function limpiarNombreMateria(valor) {
    var nombre = limpiarNombreVisible(valor);

    nombre = quitarCodigoMateria(nombre);

    nombre = nombre
      .replace(/\bpea\b/gi, " ")
      .replace(/\bbase\b/gi, " ")
      .replace(/\bunidades\b/gi, " ")
      .replace(/\bunidad\b/gi, " ")
      .replace(/\bactividades\b/gi, " ")
      .replace(/\bactividad\b/gi, " ")
      .replace(/\bplan\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—_:]+/, "")
      .trim();

    return titleCase(nombre);
  }

  function extraerMateriaDesdeSegmento(segmento, fallback) {
    var codigo = detectarCodigoMateria(segmento) || detectarCodigoMateria(fallback || "");
    var nombre = limpiarNombreMateria(segmento);

    if (!nombre && fallback) {
      nombre = limpiarNombreMateria(fallback);
    }

    return {
      codigo: codigo,
      nombre: nombre || "Materia sin nombre",
      nombreNormalizado: normalizarComparacion(nombre || "Materia sin nombre"),
      confianza: codigo ? 100 : nombre ? 75 : 35
    };
  }

  function crearIdCarrera(nombreCarrera) {
    return "carrera_" + slug(nombreCarrera || "carrera_no_identificada");
  }

  function crearIdMatriz(carreraId, nombreMatriz) {
    return "matriz_" + slug(carreraId || "carrera") + "_" + slug(nombreMatriz || "matriz_ccc");
  }

  function crearIdNivel(carreraId, numeroNivel, nombreNivel) {
    return "nivel_" + slug(carreraId || "carrera") + "_" + slug(numeroNivel || nombreNivel || "sn");
  }

  function crearIdMateria(carreraId, nivelId, codigo, nombreMateria) {
    var cod = texto(codigo).trim();

    if (cod) {
      return "materia_" + slug(carreraId || "carrera") + "_" + slug(cod);
    }

    return "materia_" + slug(carreraId || "carrera") + "_" + slug(nivelId || "nivel") + "_" + slug(nombreMateria || "materia");
  }

  function crearIdArchivo(materiaId, tipo, rutaOriginal) {
    return "archivo_" + slug(materiaId || "materia") + "_" + slug(tipo || "sin_tipo") + "_" + slug(rutaOriginal || "archivo").slice(0, 90);
  }

  function rutaPadre(ruta) {
    var partes = dividirRuta(ruta);

    if (partes.length <= 1) return "";

    partes.pop();

    return partes.join("/");
  }

  function obtenerSegmentoSeguro(partes, index) {
    if (!Array.isArray(partes)) return "";
    if (index < 0 || index >= partes.length) return "";

    return partes[index] || "";
  }

  NS.Normalizador = {
    PALABRAS_IGNORADAS_CARPETA: PALABRAS_IGNORADAS_CARPETA,
    PALABRAS_MATRIZ: PALABRAS_MATRIZ,
    ORDINALES_NIVEL: ORDINALES_NIVEL,

    texto: texto,
    quitarTildes: quitarTildes,
    normalizarTexto: normalizarTexto,
    normalizarComparacion: normalizarComparacion,
    limpiarNombreVisible: limpiarNombreVisible,
    slug: slug,
    titleCase: titleCase,
    dividirRuta: dividirRuta,
    nombreArchivoDesdeRuta: nombreArchivoDesdeRuta,
    extensionArchivo: extensionArchivo,
    esExcel: esExcel,
    esZip: esZip,
    esCarpetaIgnorada: esCarpetaIgnorada,
    similitud: similitud,
    mejorCoincidencia: mejorCoincidencia,

    detectarMatriz: detectarMatriz,
    detectarNivel: detectarNivel,
    detectarCodigoMateria: detectarCodigoMateria,
    quitarCodigoMateria: quitarCodigoMateria,
    limpiarNombreMateria: limpiarNombreMateria,
    extraerMateriaDesdeSegmento: extraerMateriaDesdeSegmento,

    crearIdCarrera: crearIdCarrera,
    crearIdMatriz: crearIdMatriz,
    crearIdNivel: crearIdNivel,
    crearIdMateria: crearIdMateria,
    crearIdArchivo: crearIdArchivo,
    rutaPadre: rutaPadre,
    obtenerSegmentoSeguro: obtenerSegmentoSeguro
  };
})(window);