/* =========================================================
Nombre completo: firebase.inteligencia.js
Ruta o ubicación: /Curriculo/firebase/firebase.inteligencia.js
Funciones:
- Convertir el paquete ZIP validado al modelo plano de Firestore.
- Generar identificadores deterministas para carreras, materias y unidades.
- Eliminar datos temporales para evitar versiones falsas.
- Calcular huellas estables del contenido curricular.
- Comparar dos versiones y describir únicamente los cambios reales.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;
  var VERSION = "1.0.0";

  var CLAVES_VOLATILES = Object.freeze({
    id: true,
    creadoEn: true,
    actualizadoEn: true,
    procesadoEn: true,
    leidoEn: true,
    validadoEn: true,
    generadoEn: true,
    fechaCarga: true,
    cargaId: true,
    ultimaCargaId: true,
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
    __hoja: true
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

  function normalizarTexto(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-–—]+/g, " ")
      .replace(/[^a-zA-Z0-9\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizarCodigo(valor) {
    var codigo = texto(valor).toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
    return /^(S\/?C|SINCODIGO|SIN-CODIGO)$/i.test(codigo) ? "" : codigo;
  }

  function slug(valor) {
    return normalizarTexto(valor)
      .replace(/\./g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function pad(valor, longitud) {
    return String(Math.max(0, numero(valor, 0))).padStart(Number(longitud || 2), "0");
  }

  function limpiarProfundo(valor, opciones) {
    opciones = opciones || {};

    if (valor === null || typeof valor === "undefined") return null;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    if (typeof valor === "boolean") return valor;
    if (typeof valor === "string") return valor.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    if (Array.isArray(valor)) {
      return valor.map(function (item) {
        return limpiarProfundo(item, opciones);
      }).filter(function (item) {
        return item !== null && typeof item !== "undefined";
      });
    }

    if (!esObjeto(valor)) return texto(valor);

    var salida = {};
    Object.keys(valor).sort().forEach(function (clave) {
      if (CLAVES_VOLATILES[clave] && opciones.conservarVolatiles !== true) return;
      var limpio = limpiarProfundo(valor[clave], opciones);
      if (limpio === null || typeof limpio === "undefined") return;
      salida[clave] = limpio;
    });
    return salida;
  }

  function ordenarEstable(valor) {
    if (Array.isArray(valor)) return valor.map(ordenarEstable);
    if (!esObjeto(valor)) return valor;
    var salida = {};
    Object.keys(valor).sort().forEach(function (clave) {
      salida[clave] = ordenarEstable(valor[clave]);
    });
    return salida;
  }

  function stringifyEstable(valor) {
    return JSON.stringify(ordenarEstable(limpiarProfundo(valor)));
  }

  function hashContenido(valor) {
    var cadena = stringifyEstable(valor);
    var h1 = 0xdeadbeef ^ cadena.length;
    var h2 = 0x41c6ce57 ^ cadena.length;
    var i;
    var ch;

    for (i = 0; i < cadena.length; i += 1) {
      ch = cadena.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(11, "0");
  }

  function crearIdCarrera(nombre, idSugerido) {
    var sugerido = texto(idSugerido);
    if (/^carrera_[a-z0-9_]+$/i.test(sugerido)) return sugerido.toLowerCase();
    return "carrera_" + slug(nombre);
  }

  function crearIdMateria(carreraId, nivelNumero, codigo, nombre) {
    var codigoLimpio = normalizarCodigo(codigo);
    if (codigoLimpio) return "materia_" + slug(carreraId) + "_" + slug(codigoLimpio);
    return "materia_" + slug(carreraId) + "_n" + pad(nivelNumero, 2) + "_" + slug(nombre);
  }

  function crearIdUnidad(materiaId, unidadNumero) {
    return texto(materiaId) + "__u" + pad(unidadNumero, 3);
  }

  function mapaPorId(lista) {
    var mapa = {};
    arr(lista).forEach(function (item) {
      if (item && texto(item.id)) mapa[texto(item.id)] = item;
    });
    return mapa;
  }

  function valorPrimero(objeto, claves) {
    objeto = objeto || {};
    for (var i = 0; i < claves.length; i += 1) {
      if (texto(objeto[claves[i]])) return texto(objeto[claves[i]]);
    }
    return "";
  }

  function metadatosArchivo(archivo) {
    if (!archivo) return null;
    var datos = archivo.datosProcesados;
    var registros = Array.isArray(datos)
      ? datos.length
      : numero(
          archivo.excelResumen && archivo.excelResumen.totalRegistros,
          esObjeto(datos) && Array.isArray(datos.filas) ? datos.filas.length : 0
        );

    return {
      nombre: texto(archivo.nombreArchivo || archivo.nombre),
      extension: texto(archivo.extension).toLowerCase(),
      registros: registros,
      estado: texto(archivo.errorExcel || archivo.errorLectura) ? "error" : (archivo.excelLeido === true ? "correcto" : "no_procesado"),
      confianza: numero(archivo.confianza, 0),
      tamanoBytes: numero(archivo.tamanoBytes, 0),
      error: texto(archivo.errorExcel || archivo.errorLectura)
    };
  }

  function sanitizarCampos(campos) {
    var salida = {};
    if (!esObjeto(campos)) return salida;
    Object.keys(campos).sort().forEach(function (clave) {
      var valor = limpiarProfundo(campos[clave]);
      if (valor === "" || valor === null) return;
      salida[clave] = valor;
    });
    return salida;
  }

  function sanitizarUnidadesBase(unidades) {
    return arr(unidades).map(function (unidad, indice) {
      unidad = unidad || {};
      return {
        unidadNumero: numero(unidad.unidadNumero || unidad.numero || unidad.orden, indice + 1),
        nombre: texto(unidad.nombre || unidad.titulo || unidad.tema),
        competencia: texto(unidad.competencia),
        resultadoAprendizaje: texto(unidad.resultadoAprendizaje || unidad.resultado)
      };
    }).filter(function (unidad) {
      return unidad.unidadNumero > 0;
    }).sort(function (a, b) {
      return a.unidadNumero - b.unidadNumero;
    });
  }

  function sanitizarBibliografia(bibliografia) {
    return arr(bibliografia).map(function (item, indice) {
      if (typeof item === "string") {
        return { orden: indice + 1, referencia: texto(item), codigoReferencia: "", justificacion: "" };
      }
      item = item || {};
      return {
        orden: numero(item.orden, indice + 1),
        referencia: texto(item.referencia || item.descripcion || item.titulo),
        codigoReferencia: texto(item.codigoReferencia || item.codigo),
        justificacion: texto(item.justificacion)
      };
    }).filter(function (item) {
      return !!item.referencia;
    }).sort(function (a, b) {
      return a.orden - b.orden;
    });
  }

  function sanitizarBase(datos, contexto) {
    datos = esObjeto(datos) ? datos : {};
    contexto = contexto || {};
    var campos = sanitizarCampos(datos.campos);
    var descripcion = texto(datos.descripcion) || valorPrimero(campos, [
      "descripcion_asignatura", "descripcionAsignatura", "descripcion_de_la_asignatura", "descripcion"
    ]);
    var objetivo = texto(datos.objetivo) || valorPrimero(campos, [
      "objetivo_asignatura", "objetivoAsignatura", "objetivo_de_la_asignatura", "objetivo"
    ]);

    return {
      materiaId: contexto.materiaId,
      carreraId: contexto.carreraId,
      carreraNombre: contexto.carreraNombre,
      codigoMateria: contexto.codigo,
      nombreMateria: contexto.nombre,
      nivelNumero: contexto.nivelNumero,
      nivelNombre: contexto.nivelNombre,
      descripcion: descripcion,
      objetivo: objetivo,
      unidadesBase: sanitizarUnidadesBase(datos.unidadesBase),
      bibliografia: sanitizarBibliografia(datos.bibliografia),
      campos: campos,
      estado: descripcion || objetivo || Object.keys(campos).length ? "valido" : "vacio"
    };
  }

  function quitarDuplicadosTextos(lista) {
    var vistos = {};
    return arr(lista).map(texto).filter(function (item) {
      if (!item) return false;
      var clave = normalizarTexto(item);
      if (vistos[clave]) return false;
      vistos[clave] = true;
      return true;
    });
  }

  function sanitizarFilas(filas) {
    return arr(filas).map(function (fila) {
      return limpiarProfundo(fila);
    }).filter(function (fila) {
      return fila && Object.keys(fila).length > 0;
    });
  }

  function sanitizarUnidades(datos, contexto, peaBase) {
    contexto = contexto || {};
    var basePorNumero = {};
    arr(peaBase && peaBase.unidadesBase).forEach(function (unidad) {
      basePorNumero[numero(unidad.unidadNumero, 0)] = unidad;
    });

    return arr(datos).map(function (unidad, indice) {
      unidad = unidad || {};
      var n = numero(unidad.unidadNumero || unidad.numero || unidad.orden, indice + 1);
      var base = basePorNumero[n] || {};
      var contenidos = quitarDuplicadosTextos(unidad.contenidos || [unidad.contenido || unidad.temaDetectado || unidad.tema]);
      return {
        id: crearIdUnidad(contexto.materiaId, n),
        materiaId: contexto.materiaId,
        carreraId: contexto.carreraId,
        carreraNombre: contexto.carreraNombre,
        codigoMateria: contexto.codigo,
        nombreMateria: contexto.nombre,
        nivelNumero: contexto.nivelNumero,
        nivelNombre: contexto.nivelNombre,
        unidadNumero: n,
        titulo: texto(base.nombre || unidad.titulo || unidad.temaDetectado || contenidos[0]),
        competencia: texto(base.competencia || unidad.competencia),
        resultadoAprendizaje: texto(base.resultadoAprendizaje || unidad.resultadoDetectado || unidad.resultadoAprendizaje),
        subtema: texto(unidad.subtemaDetectado || unidad.subtema),
        contenidos: contenidos,
        filas: sanitizarFilas(unidad.filasOriginales),
        totalContenidos: contenidos.length,
        estado: contenidos.length ? "activo" : "vacio"
      };
    }).filter(function (unidad) {
      return unidad.unidadNumero > 0 && (unidad.contenidos.length || unidad.titulo || unidad.resultadoAprendizaje);
    }).sort(function (a, b) {
      return a.unidadNumero - b.unidadNumero;
    });
  }

  function sanitizarActividad(item, indice) {
    item = item || {};
    var conocidos = {
      nivel: true,
      unidadNumero: true,
      unidad: true,
      mecanismo: true,
      tipoActividad: true,
      tipo_actividad: true,
      tipo: true,
      modalidad: true,
      tema: true,
      titulo: true,
      descripcion: true,
      actividad: true,
      actividadDetectada: true,
      contenido: true,
      evaluacion: true,
      horas: true,
      orden: true
    };
    var adicionales = {};
    Object.keys(item).sort().forEach(function (clave) {
      if (conocidos[clave] || CLAVES_VOLATILES[clave]) return;
      var valor = limpiarProfundo(item[clave]);
      if (valor === "" || valor === null) return;
      adicionales[clave] = valor;
    });

    return {
      orden: numero(item.orden, indice + 1),
      unidadNumero: numero(item.unidadNumero || item.nivel || item.unidad, 0),
      tipoActividad: texto(item.tipoActividad || item.tipo_actividad || item.mecanismo || item.tipo || item.modalidad || "Actividad"),
      mecanismo: texto(item.mecanismo || item.modalidad),
      tema: texto(item.tema || item.titulo),
      descripcion: texto(item.descripcion || item.actividad || item.actividadDetectada || item.contenido),
      evaluacion: texto(item.evaluacion),
      horas: numero(item.horas, 0),
      campos: adicionales
    };
  }

  function sanitizarActividades(datos, contexto) {
    contexto = contexto || {};
    var actividades = arr(datos).map(sanitizarActividad).filter(function (item) {
      return item.descripcion || item.tema || item.mecanismo;
    }).sort(function (a, b) {
      if (a.unidadNumero !== b.unidadNumero) return a.unidadNumero - b.unidadNumero;
      if (a.orden !== b.orden) return a.orden - b.orden;
      return (a.tipoActividad + a.tema + a.descripcion).localeCompare(b.tipoActividad + b.tema + b.descripcion, "es");
    });

    actividades.forEach(function (item, indice) {
      item.orden = indice + 1;
    });

    return {
      materiaId: contexto.materiaId,
      carreraId: contexto.carreraId,
      carreraNombre: contexto.carreraNombre,
      codigoMateria: contexto.codigo,
      nombreMateria: contexto.nombre,
      nivelNumero: contexto.nivelNumero,
      nivelNombre: contexto.nivelNombre,
      actividades: actividades,
      totalActividades: actividades.length,
      estado: actividades.length ? "activo" : "vacio"
    };
  }

  function crearSnapshot(materia, peaBase, unidades, peaActividades) {
    return limpiarProfundo({
      materia: {
        carreraId: materia.carreraId,
        carreraNombre: materia.carreraNombre,
        nivelNumero: materia.nivelNumero,
        nivelNombre: materia.nivelNombre,
        codigo: materia.codigo,
        nombre: materia.nombre,
        nombreNormalizado: materia.nombreNormalizado,
        estadoValidacion: materia.estadoValidacion,
        activo: materia.activo !== false
      },
      peaBase: {
        descripcion: peaBase.descripcion,
        objetivo: peaBase.objetivo,
        unidadesBase: peaBase.unidadesBase,
        bibliografia: peaBase.bibliografia,
        campos: peaBase.campos,
        estado: peaBase.estado
      },
      unidades: arr(unidades).map(function (unidad) {
        return {
          unidadNumero: unidad.unidadNumero,
          titulo: unidad.titulo,
          competencia: unidad.competencia,
          resultadoAprendizaje: unidad.resultadoAprendizaje,
          subtema: unidad.subtema,
          contenidos: unidad.contenidos,
          filas: unidad.filas,
          estado: unidad.estado
        };
      }),
      actividades: arr(peaActividades && peaActividades.actividades)
    });
  }

  function prepararMateria(materia, contexto) {
    materia = materia || {};
    contexto = contexto || {};
    var archivos = arr(contexto.archivosMateria);
    var archivoBase = archivos.find(function (a) { return a.tipo === "pea_base"; }) || null;
    var archivoUnidades = archivos.find(function (a) { return a.tipo === "pea_unidades"; }) || null;
    var archivoActividades = archivos.find(function (a) { return a.tipo === "pea_actividades"; }) || null;
    var codigo = normalizarCodigo(materia.codigo || materia.codigoMateria);
    var nombre = texto(materia.nombre || materia.materia || materia.nombreMateria);
    var materiaId = crearIdMateria(contexto.carreraId, contexto.nivelNumero, codigo, nombre);
    var contextoMateria = {
      materiaId: materiaId,
      carreraId: contexto.carreraId,
      carreraNombre: contexto.carreraNombre,
      nivelNumero: contexto.nivelNumero,
      nivelNombre: contexto.nivelNombre,
      codigo: codigo,
      nombre: nombre
    };
    var peaBase = sanitizarBase(archivoBase && archivoBase.datosProcesados, contextoMateria);
    var unidades = sanitizarUnidades(archivoUnidades && archivoUnidades.datosProcesados, contextoMateria, peaBase);
    var actividades = sanitizarActividades(archivoActividades && archivoActividades.datosProcesados, contextoMateria);
    var documentoMateria = {
      id: materiaId,
      carreraId: contexto.carreraId,
      carreraNombre: contexto.carreraNombre,
      nivelNumero: contexto.nivelNumero,
      nivelNombre: contexto.nivelNombre,
      codigo: codigo,
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      nombreOriginalImportado: nombre,
      estadoValidacion: texto(materia.estadoValidacion || materia.estadoClasificado || "pendiente"),
      activo: true,
      pea: {
        base: !!archivoBase && peaBase.estado === "valido",
        unidades: !!archivoUnidades && unidades.length > 0,
        actividades: !!archivoActividades && actividades.totalActividades > 0,
        totalUnidades: unidades.length,
        totalContenidos: unidades.reduce(function (total, unidad) { return total + numero(unidad.totalContenidos, 0); }, 0),
        totalActividades: actividades.totalActividades
      },
      archivos: {
        base: metadatosArchivo(archivoBase),
        unidades: metadatosArchivo(archivoUnidades),
        actividades: metadatosArchivo(archivoActividades)
      },
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: [archivoBase, archivoUnidades, archivoActividades].filter(Boolean).length,
      origen: "importacion_zip"
    };
    var snapshot = crearSnapshot(documentoMateria, peaBase, unidades, actividades);
    documentoMateria.hashContenido = hashContenido(snapshot);
    documentoMateria.hashSecciones = {
      materia: hashContenido(snapshot.materia),
      peaBase: hashContenido(snapshot.peaBase),
      unidades: hashContenido(snapshot.unidades),
      actividades: hashContenido(snapshot.actividades)
    };

    return {
      materia: documentoMateria,
      peaBase: peaBase,
      unidades: unidades,
      actividades: actividades,
      snapshot: snapshot
    };
  }

  function prepararPaquete(paquete, cargaId) {
    paquete = paquete || {};
    var carrerasOriginales = arr(paquete.carreras);
    var nivelesPorId = mapaPorId(paquete.niveles);
    var materias = arr(paquete.materias);
    var archivosPorMateria = {};
    arr(paquete.archivos).forEach(function (archivo) {
      var materiaId = texto(archivo && archivo.materiaId);
      if (!archivosPorMateria[materiaId]) archivosPorMateria[materiaId] = [];
      archivosPorMateria[materiaId].push(archivo);
    });

    var carreraMap = {};
    carrerasOriginales.forEach(function (carrera) {
      var id = crearIdCarrera(carrera.nombre || carrera.carrera, carrera.id);
      carreraMap[texto(carrera.id)] = {
        id: id,
        nombre: texto(carrera.nombre || carrera.carrera),
        nombreNormalizado: normalizarTexto(carrera.nombre || carrera.carrera),
        estado: "activo"
      };
    });

    var preparadas = [];
    materias.forEach(function (materia) {
      var carreraOriginal = carreraMap[texto(materia.carreraId)] || null;
      if (!carreraOriginal && carrerasOriginales.length === 1) {
        carreraOriginal = carreraMap[texto(carrerasOriginales[0].id)];
      }
      if (!carreraOriginal) return;
      var nivel = nivelesPorId[texto(materia.nivelId)] || {};
      var nivelNumero = numero(nivel.numero || materia.numeroNivel || materia.nivelNumero, 0);
      var nivelNombre = texto(nivel.nombre || materia.nivel || materia.nivelNombre || (nivelNumero ? nivelNumero + ". Nivel" : "Nivel"));
      preparadas.push(prepararMateria(materia, {
        carreraId: carreraOriginal.id,
        carreraNombre: carreraOriginal.nombre,
        nivelNumero: nivelNumero,
        nivelNombre: nivelNombre,
        archivosMateria: archivosPorMateria[texto(materia.id)] || []
      }));
    });

    var carreras = Object.keys(carreraMap).map(function (clave) {
      var carrera = carreraMap[clave];
      var materiasCarrera = preparadas.filter(function (item) {
        return item.materia.carreraId === carrera.id;
      });
      var niveles = {};
      materiasCarrera.forEach(function (item) {
        if (item.materia.nivelNumero > 0) niveles[item.materia.nivelNumero] = true;
      });
      return Object.assign({}, carrera, {
        niveles: Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; }),
        totalNiveles: Object.keys(niveles).length,
        totalMaterias: materiasCarrera.length,
        cargaId: cargaId || ""
      });
    }).filter(function (carrera) {
      return carrera.totalMaterias > 0;
    });

    return {
      cargaId: cargaId || "",
      carreras: carreras,
      materias: preparadas,
      resumenOriginal: limpiarProfundo(paquete.resumenValidacion || {}),
      observaciones: arr(paquete.validacionesSubida).slice(0, 100).map(function (item) {
        return limpiarProfundo({
          materiaId: item.materiaId || "",
          tipo: item.tipo || "general",
          severidad: item.severidad || "info",
          mensaje: item.mensaje || "",
          titulo: item.titulo || ""
        });
      })
    };
  }

  function camposDiferentes(anterior, nuevo) {
    anterior = esObjeto(anterior) ? anterior : {};
    nuevo = esObjeto(nuevo) ? nuevo : {};
    var claves = {};
    Object.keys(anterior).forEach(function (k) { claves[k] = true; });
    Object.keys(nuevo).forEach(function (k) { claves[k] = true; });
    return Object.keys(claves).sort().filter(function (clave) {
      return hashContenido(anterior[clave]) !== hashContenido(nuevo[clave]);
    });
  }

  function mapaUnidades(unidades) {
    var mapa = {};
    arr(unidades).forEach(function (unidad) {
      mapa[String(numero(unidad.unidadNumero, 0))] = unidad;
    });
    return mapa;
  }

  function firmaActividad(actividad) {
    return hashContenido({
      unidadNumero: actividad.unidadNumero,
      tipoActividad: actividad.tipoActividad,
      mecanismo: actividad.mecanismo,
      tema: actividad.tema,
      descripcion: actividad.descripcion,
      evaluacion: actividad.evaluacion,
      horas: actividad.horas,
      campos: actividad.campos
    });
  }

  function compararActividades(anterior, nuevo) {
    var a = arr(anterior);
    var n = arr(nuevo);
    var mapaA = {};
    var mapaN = {};
    a.forEach(function (item) { mapaA[firmaActividad(item)] = item; });
    n.forEach(function (item) { mapaN[firmaActividad(item)] = item; });
    return {
      totalAnterior: a.length,
      totalNuevo: n.length,
      agregadas: Object.keys(mapaN).filter(function (k) { return !mapaA[k]; }).length,
      eliminadas: Object.keys(mapaA).filter(function (k) { return !mapaN[k]; }).length,
      modificadas: hashContenido(a) === hashContenido(n) ? 0 : Math.min(a.length, n.length)
    };
  }

  function compararSnapshots(anterior, nuevo) {
    anterior = anterior || {};
    nuevo = nuevo || {};
    var detalle = {
      materia: { campos: camposDiferentes(anterior.materia, nuevo.materia) },
      peaBase: { campos: camposDiferentes(anterior.peaBase, nuevo.peaBase) },
      unidades: { agregadas: [], eliminadas: [], modificadas: [] },
      actividades: compararActividades(anterior.actividades, nuevo.actividades)
    };
    var mapaA = mapaUnidades(anterior.unidades);
    var mapaN = mapaUnidades(nuevo.unidades);

    Object.keys(mapaN).sort().forEach(function (n) {
      if (!mapaA[n]) detalle.unidades.agregadas.push(Number(n));
      else if (hashContenido(mapaA[n]) !== hashContenido(mapaN[n])) detalle.unidades.modificadas.push(Number(n));
    });
    Object.keys(mapaA).sort().forEach(function (n) {
      if (!mapaN[n]) detalle.unidades.eliminadas.push(Number(n));
    });

    var secciones = [];
    if (detalle.materia.campos.length) secciones.push("materia");
    if (detalle.peaBase.campos.length) secciones.push("pea_base");
    if (detalle.unidades.agregadas.length || detalle.unidades.eliminadas.length || detalle.unidades.modificadas.length) secciones.push("pea_unidades");
    if (detalle.actividades.agregadas || detalle.actividades.eliminadas || hashContenido(anterior.actividades) !== hashContenido(nuevo.actividades)) secciones.push("pea_actividades");

    var frases = [];
    if (detalle.materia.campos.length) frases.push("Datos de la materia: " + detalle.materia.campos.join(", "));
    if (detalle.peaBase.campos.length) frases.push("PEA Base: " + detalle.peaBase.campos.join(", "));
    if (detalle.unidades.agregadas.length) frases.push("Unidades añadidas: " + detalle.unidades.agregadas.join(", "));
    if (detalle.unidades.modificadas.length) frases.push("Unidades modificadas: " + detalle.unidades.modificadas.join(", "));
    if (detalle.unidades.eliminadas.length) frases.push("Unidades eliminadas: " + detalle.unidades.eliminadas.join(", "));
    if (detalle.actividades.agregadas) frases.push("Actividades añadidas: " + detalle.actividades.agregadas);
    if (detalle.actividades.eliminadas) frases.push("Actividades eliminadas: " + detalle.actividades.eliminadas);
    if (!frases.length && hashContenido(anterior) !== hashContenido(nuevo)) frases.push("Se detectaron cambios internos en el contenido curricular.");

    return {
      cambioReal: hashContenido(anterior) !== hashContenido(nuevo),
      seccionesCambiadas: secciones,
      resumen: frases.join(" · ") || "Sin cambios curriculares.",
      detalle: detalle,
      hashAnterior: hashContenido(anterior),
      hashNuevo: hashContenido(nuevo)
    };
  }

  function estimarBytes(valor) {
    try {
      return new Blob([JSON.stringify(valor)]).size;
    } catch (error) {
      return JSON.stringify(valor || {}).length * 2;
    }
  }

  NS.Inteligencia = {
    VERSION: VERSION,
    limpiarProfundo: limpiarProfundo,
    stringifyEstable: stringifyEstable,
    hashContenido: hashContenido,
    normalizarTexto: normalizarTexto,
    normalizarCodigo: normalizarCodigo,
    slug: slug,
    crearIdCarrera: crearIdCarrera,
    crearIdMateria: crearIdMateria,
    crearIdUnidad: crearIdUnidad,
    prepararMateria: prepararMateria,
    prepararPaquete: prepararPaquete,
    crearSnapshot: crearSnapshot,
    compararSnapshots: compararSnapshots,
    estimarBytes: estimarBytes
  };
})(typeof window !== "undefined" ? window : globalThis);
