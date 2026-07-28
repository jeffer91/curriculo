/* =========================================================
Nombre completo: firebase.inteligencia-v2.js
Ruta o ubicación: /Curriculo/firebase/firebase.inteligencia-v2.js
Funciones:
- Normalizar semánticamente el contenido antes de calcular versiones.
- Evitar versiones falsas por orden, espacios, filas técnicas o duplicados.
- Generar IDs de materia sin colisiones simples.
- Validar que ninguna materia se pierda durante la preparación.
- Permitir conservar el ID existente cuando cambia un código o un nombre.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  var I = NS.Inteligencia;

  if (!I || I.__v2Instalada === true) return;

  var VERSION = "2.0.0";
  var prepararPaqueteOriginal = I.prepararPaquete;
  var CLAVES_IGNORADAS_HASH = Object.freeze({
    id: true,
    orden: true,
    creadoEn: true,
    actualizadoEn: true,
    procesadoEn: true,
    leidoEn: true,
    validadoEn: true,
    generadoEn: true,
    fechaCarga: true,
    cargaId: true,
    ultimaCargaId: true,
    retiradoEn: true,
    guardadoEn: true,
    preparadoEn: true,
    preparadoParaBDLocalEn: true,
    contenidoBinario: true,
    tieneContenidoBinario: true,
    workbook: true,
    archivoOriginal: true,
    file: true,
    blob: true,
    raw: true,
    __filaExcel: true,
    __hoja: true,
    filas: true
  });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function esObjeto(valor) {
    return !!valor && typeof valor === "object" && !Array.isArray(valor) && !(valor instanceof Date);
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
  }

  function normalizarCadena(valor) {
    return texto(valor)
      .normalize("NFC")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizarBusqueda(valor) {
    return normalizarCadena(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-–—./]+/g, " ")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function slug(valor) {
    return normalizarBusqueda(valor).replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function normalizarCodigo(valor) {
    var codigo = normalizarCadena(valor).toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
    return /^(S\/?C|SINCODIGO|SIN-CODIGO)$/i.test(codigo) ? "" : codigo;
  }

  function jsonEstable(valor) {
    if (valor === null || typeof valor === "undefined") return "null";
    if (Array.isArray(valor)) return "[" + valor.map(jsonEstable).join(",") + "]";
    if (!esObjeto(valor)) return JSON.stringify(valor);
    return "{" + Object.keys(valor).sort().map(function (clave) {
      return JSON.stringify(clave) + ":" + jsonEstable(valor[clave]);
    }).join(",") + "}";
  }

  function canonizar(valor, clavePadre) {
    if (valor === null || typeof valor === "undefined") return null;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === "string") return normalizarCadena(valor);
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    if (typeof valor === "boolean") return valor;

    if (Array.isArray(valor)) {
      var vistos = {};
      return valor.map(function (item) {
        return canonizar(item, clavePadre);
      }).filter(function (item) {
        return item !== null && typeof item !== "undefined";
      }).map(function (item) {
        return { item: item, firma: jsonEstable(item) };
      }).filter(function (entrada) {
        if (vistos[entrada.firma]) return false;
        vistos[entrada.firma] = true;
        return true;
      }).sort(function (a, b) {
        return a.firma.localeCompare(b.firma, "es");
      }).map(function (entrada) {
        return entrada.item;
      });
    }

    if (!esObjeto(valor)) return normalizarCadena(valor);

    var salida = {};
    Object.keys(valor).sort().forEach(function (clave) {
      if (CLAVES_IGNORADAS_HASH[clave]) return;
      var limpio = canonizar(valor[clave], clave);
      if (limpio === null || typeof limpio === "undefined" || limpio === "") return;
      salida[clave] = limpio;
    });
    return salida;
  }

  function hashSemantico(valor) {
    var cadena = jsonEstable(canonizar(valor));
    var h1 = 0xdeadbeef ^ cadena.length;
    var h2 = 0x41c6ce57 ^ cadena.length;
    var i;
    var ch;

    for (i = 0; i < cadena.length; i += 1) {
      ch = cadena.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (4294967296 * (2097151 & h2) + (h1 >>> 0))
      .toString(36)
      .padStart(11, "0");
  }

  function crearIdMateria(carreraId, nivelNumero, codigo, nombre) {
    var codigoLimpio = normalizarCodigo(codigo);
    return [
      "materia",
      slug(carreraId),
      "n" + pad(nivelNumero, 2),
      codigoLimpio ? slug(codigoLimpio) : "sin_codigo",
      slug(nombre)
    ].join("_").slice(0, 520);
  }

  function crearIdUnidad(materiaId, unidadNumero) {
    return texto(materiaId) + "__u" + pad(unidadNumero, 3);
  }

  function reasignarMateriaId(item, nuevoId) {
    if (!item || !item.materia) return item;
    nuevoId = texto(nuevoId);
    if (!nuevoId) throw new Error("No se puede asignar un ID vacío a una materia.");

    item.materia.id = nuevoId;
    item.materia.materiaId = nuevoId;

    if (item.peaBase) item.peaBase.materiaId = nuevoId;
    if (item.actividades) item.actividades.materiaId = nuevoId;

    arr(item.unidades).forEach(function (unidad) {
      unidad.materiaId = nuevoId;
      unidad.id = crearIdUnidad(nuevoId, unidad.unidadNumero);
      delete unidad.filas;
    });

    return item;
  }

  function limpiarBibliografia(lista) {
    return arr(lista).map(function (item) {
      return {
        referencia: normalizarCadena(item && (item.referencia || item.descripcion || item.titulo || item)),
        codigoReferencia: normalizarCadena(item && (item.codigoReferencia || item.codigo)),
        justificacion: normalizarCadena(item && item.justificacion)
      };
    }).filter(function (item) {
      return !!item.referencia;
    });
  }

  function limpiarUnidades(unidades) {
    return arr(unidades).map(function (unidad) {
      return {
        unidadNumero: numero(unidad && unidad.unidadNumero, 0),
        titulo: normalizarCadena(unidad && unidad.titulo),
        competencia: normalizarCadena(unidad && unidad.competencia),
        resultadoAprendizaje: normalizarCadena(unidad && unidad.resultadoAprendizaje),
        subtema: normalizarCadena(unidad && unidad.subtema),
        contenidos: arr(unidad && unidad.contenidos).map(normalizarCadena).filter(Boolean),
        estado: normalizarCadena(unidad && unidad.estado)
      };
    }).filter(function (unidad) {
      return unidad.unidadNumero > 0;
    }).sort(function (a, b) {
      return a.unidadNumero - b.unidadNumero;
    });
  }

  function limpiarActividades(actividades) {
    return arr(actividades).map(function (actividad) {
      return {
        unidadNumero: numero(actividad && actividad.unidadNumero, 0),
        tipoActividad: normalizarCadena(actividad && actividad.tipoActividad),
        mecanismo: normalizarCadena(actividad && actividad.mecanismo),
        tema: normalizarCadena(actividad && actividad.tema),
        descripcion: normalizarCadena(actividad && actividad.descripcion),
        evaluacion: normalizarCadena(actividad && actividad.evaluacion),
        horas: numero(actividad && actividad.horas, 0),
        campos: actividad && actividad.campos ? actividad.campos : {}
      };
    }).filter(function (actividad) {
      return actividad.tipoActividad || actividad.mecanismo ||
        actividad.tema || actividad.descripcion || actividad.evaluacion;
    });
  }

  function crearSnapshot(materia, peaBase, unidades, peaActividades) {
    materia = materia || {};
    peaBase = peaBase || {};
    return canonizar({
      materia: {
        carreraId: materia.carreraId,
        carreraNombre: materia.carreraNombre,
        nivelNumero: materia.nivelNumero,
        nivelNombre: materia.nivelNombre,
        codigo: normalizarCodigo(materia.codigo),
        nombre: normalizarCadena(materia.nombre),
        estadoValidacion: materia.estadoValidacion,
        activo: materia.activo !== false
      },
      peaBase: {
        descripcion: normalizarCadena(peaBase.descripcion),
        objetivo: normalizarCadena(peaBase.objetivo),
        unidadesBase: arr(peaBase.unidadesBase),
        bibliografia: limpiarBibliografia(peaBase.bibliografia),
        campos: peaBase.campos || {},
        estado: peaBase.estado
      },
      unidades: limpiarUnidades(unidades),
      actividades: limpiarActividades(
        peaActividades && peaActividades.actividades
          ? peaActividades.actividades
          : peaActividades
      )
    });
  }

  function recalcularItem(item) {
    if (!item || !item.materia) return item;
    var materia = item.materia;
    var nuevoId = crearIdMateria(
      materia.carreraId,
      materia.nivelNumero,
      materia.codigo,
      materia.nombre
    );

    reasignarMateriaId(item, nuevoId);

    materia.codigo = normalizarCodigo(materia.codigo);
    materia.codigoNormalizado = normalizarBusqueda(materia.codigo);
    materia.nombre = normalizarCadena(materia.nombre);
    materia.nombreNormalizado = normalizarBusqueda(materia.nombre);
    materia.identidad = {
      carreraId: materia.carreraId,
      nivelNumero: numero(materia.nivelNumero, 0),
      codigoNormalizado: materia.codigoNormalizado,
      nombreNormalizado: materia.nombreNormalizado,
      claveCodigo: materia.codigoNormalizado
        ? [materia.carreraId, materia.nivelNumero, materia.codigoNormalizado].join("|")
        : "",
      claveNombre: [materia.carreraId, materia.nivelNumero, materia.nombreNormalizado].join("|")
    };

    arr(item.unidades).forEach(function (unidad) {
      delete unidad.filas;
      unidad.contenidos = arr(unidad.contenidos)
        .map(normalizarCadena)
        .filter(Boolean);
    });

    if (item.actividades && Array.isArray(item.actividades.actividades)) {
      item.actividades.actividades = item.actividades.actividades.map(function (actividad, indice) {
        return Object.assign({}, actividad, {
          orden: indice + 1,
          tema: normalizarCadena(actividad.tema),
          descripcion: normalizarCadena(actividad.descripcion),
          evaluacion: normalizarCadena(actividad.evaluacion)
        });
      });
    }

    item.snapshot = crearSnapshot(
      materia,
      item.peaBase,
      item.unidades,
      item.actividades
    );
    materia.hashContenido = hashSemantico(item.snapshot);
    materia.hashSecciones = {
      materia: hashSemantico(item.snapshot.materia),
      peaBase: hashSemantico(item.snapshot.peaBase),
      unidades: hashSemantico(item.snapshot.unidades),
      actividades: hashSemantico(item.snapshot.actividades)
    };

    return item;
  }

  function validarEntrada(paquete) {
    var carreras = arr(paquete && paquete.carreras);
    var materias = arr(paquete && paquete.materias);
    var errores = [];

    if (!carreras.length) errores.push("No se detectó ninguna carrera.");
    if (!materias.length) errores.push("No se detectó ninguna materia.");

    var carrerasIds = {};
    carreras.forEach(function (carrera) {
      carrerasIds[texto(carrera && carrera.id)] = true;
    });

    materias.forEach(function (materia, indice) {
      var nombre = texto(materia && (materia.nombre || materia.nombreMateria || materia.materia));
      if (!nombre) errores.push("La materia en la posición " + (indice + 1) + " no tiene nombre.");
      if (
        carreras.length > 1 &&
        !carrerasIds[texto(materia && materia.carreraId)]
      ) {
        errores.push(
          "No se pudo relacionar con una carrera: " +
          (nombre || "materia " + (indice + 1))
        );
      }
    });

    if (errores.length) {
      throw new Error("Preparación de Firebase detenida: " + errores.join(" | "));
    }
  }

  function prepararPaquete(paquete, cargaId) {
    validarEntrada(paquete);
    var totalEntrada = arr(paquete && paquete.materias).length;
    var preparado = prepararPaqueteOriginal.call(I, paquete, cargaId);

    if (!preparado || arr(preparado.materias).length !== totalEntrada) {
      throw new Error(
        "La preparación perdió materias: se detectaron " + totalEntrada +
        " y solo se prepararon " + arr(preparado && preparado.materias).length + "."
      );
    }

    var ids = {};
    preparado.materias = arr(preparado.materias).map(recalcularItem);

    preparado.materias.forEach(function (item) {
      var id = item.materia.id;
      if (ids[id]) {
        throw new Error(
          "Dos materias producirían el mismo ID en Firebase: " +
          item.materia.nombre + " y " + ids[id] + "."
        );
      }
      ids[id] = item.materia.nombre;

      if (numero(item.materia.nivelNumero, 0) < 1) {
        throw new Error(
          "No se pudo determinar el nivel de la materia " +
          item.materia.nombre + "."
        );
      }
    });

    preparado.totalMateriasEntrada = totalEntrada;
    preparado.totalMateriasPreparadas = preparado.materias.length;
    preparado.contadoresConsistentes =
      preparado.totalMateriasEntrada === preparado.totalMateriasPreparadas;

    return preparado;
  }

  function tokens(valor) {
    var salida = {};
    normalizarBusqueda(valor).split(" ").filter(Boolean).forEach(function (token) {
      salida[token] = true;
    });
    return salida;
  }

  function similitudNombres(a, b) {
    var ta = tokens(a);
    var tb = tokens(b);
    var clavesA = Object.keys(ta);
    var clavesB = Object.keys(tb);
    if (!clavesA.length || !clavesB.length) return 0;
    var comunes = clavesA.filter(function (token) { return tb[token]; }).length;
    return (2 * comunes) / (clavesA.length + clavesB.length);
  }

  function camposDiferentes(anterior, nuevo) {
    anterior = esObjeto(anterior) ? anterior : {};
    nuevo = esObjeto(nuevo) ? nuevo : {};
    var claves = {};
    Object.keys(anterior).forEach(function (k) { claves[k] = true; });
    Object.keys(nuevo).forEach(function (k) { claves[k] = true; });
    return Object.keys(claves).sort().filter(function (clave) {
      return hashSemantico(anterior[clave]) !== hashSemantico(nuevo[clave]);
    });
  }

  function mapaUnidades(unidades) {
    var mapa = {};
    arr(unidades).forEach(function (unidad) {
      mapa[String(numero(unidad && unidad.unidadNumero, 0))] = unidad;
    });
    return mapa;
  }

  function compararSnapshots(anterior, nuevo) {
    var a = canonizar(anterior || {});
    var n = canonizar(nuevo || {});
    var detalle = {
      materia: {
        campos: camposDiferentes(a.materia, n.materia)
      },
      peaBase: {
        campos: camposDiferentes(a.peaBase, n.peaBase)
      },
      unidades: {
        agregadas: [],
        eliminadas: [],
        modificadas: []
      },
      actividades: {
        totalAnterior: arr(a.actividades).length,
        totalNuevo: arr(n.actividades).length,
        agregadas: 0,
        eliminadas: 0,
        modificadas: 0
      }
    };
    var mapaA = mapaUnidades(a.unidades);
    var mapaN = mapaUnidades(n.unidades);

    Object.keys(mapaN).sort().forEach(function (unidadNumero) {
      if (!mapaA[unidadNumero]) {
        detalle.unidades.agregadas.push(Number(unidadNumero));
      } else if (
        hashSemantico(mapaA[unidadNumero]) !==
        hashSemantico(mapaN[unidadNumero])
      ) {
        detalle.unidades.modificadas.push(Number(unidadNumero));
      }
    });

    Object.keys(mapaA).sort().forEach(function (unidadNumero) {
      if (!mapaN[unidadNumero]) {
        detalle.unidades.eliminadas.push(Number(unidadNumero));
      }
    });

    var actividadesA = {};
    var actividadesN = {};
    arr(a.actividades).forEach(function (actividad) {
      actividadesA[hashSemantico(actividad)] = true;
    });
    arr(n.actividades).forEach(function (actividad) {
      actividadesN[hashSemantico(actividad)] = true;
    });
    detalle.actividades.agregadas = Object.keys(actividadesN).filter(function (k) {
      return !actividadesA[k];
    }).length;
    detalle.actividades.eliminadas = Object.keys(actividadesA).filter(function (k) {
      return !actividadesN[k];
    }).length;
    detalle.actividades.modificadas =
      detalle.actividades.agregadas || detalle.actividades.eliminadas
        ? Math.min(arr(a.actividades).length, arr(n.actividades).length)
        : 0;

    var secciones = [];
    if (detalle.materia.campos.length) secciones.push("materia");
    if (detalle.peaBase.campos.length) secciones.push("pea_base");
    if (
      detalle.unidades.agregadas.length ||
      detalle.unidades.eliminadas.length ||
      detalle.unidades.modificadas.length
    ) {
      secciones.push("pea_unidades");
    }
    if (
      detalle.actividades.agregadas ||
      detalle.actividades.eliminadas
    ) {
      secciones.push("pea_actividades");
    }

    var frases = [];
    if (detalle.materia.campos.length) {
      frases.push("Datos de la materia: " + detalle.materia.campos.join(", "));
    }
    if (detalle.peaBase.campos.length) {
      frases.push("PEA Base: " + detalle.peaBase.campos.join(", "));
    }
    if (detalle.unidades.agregadas.length) {
      frases.push("Unidades añadidas: " + detalle.unidades.agregadas.join(", "));
    }
    if (detalle.unidades.modificadas.length) {
      frases.push("Unidades modificadas: " + detalle.unidades.modificadas.join(", "));
    }
    if (detalle.unidades.eliminadas.length) {
      frases.push("Unidades eliminadas: " + detalle.unidades.eliminadas.join(", "));
    }
    if (detalle.actividades.agregadas) {
      frases.push("Actividades añadidas: " + detalle.actividades.agregadas);
    }
    if (detalle.actividades.eliminadas) {
      frases.push("Actividades eliminadas: " + detalle.actividades.eliminadas);
    }

    return {
      cambioReal: hashSemantico(a) !== hashSemantico(n),
      seccionesCambiadas: secciones,
      resumen: frases.join(" · ") || "Sin cambios curriculares.",
      detalle: detalle,
      hashAnterior: hashSemantico(a),
      hashNuevo: hashSemantico(n)
    };
  }

  function estimarBytes(valor) {
    var json = JSON.stringify(valor || {});
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(json).length;
    }
    return unescape(encodeURIComponent(json)).length;
  }

  I.VERSION = VERSION;
  I.__v2Instalada = true;
  I.canonizar = canonizar;
  I.hashContenido = hashSemantico;
  I.hashSemantico = hashSemantico;
  I.normalizarTexto = normalizarBusqueda;
  I.normalizarCodigo = normalizarCodigo;
  I.crearIdMateria = crearIdMateria;
  I.crearIdUnidad = crearIdUnidad;
  I.reasignarMateriaId = reasignarMateriaId;
  I.crearSnapshot = crearSnapshot;
  I.prepararPaquete = prepararPaquete;
  I.compararSnapshots = compararSnapshots;
  I.similitudNombres = similitudNombres;
  I.estimarBytes = estimarBytes;
})(window);
