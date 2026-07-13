/* =========================================================
Nombre completo: bdlocal.importador.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.importador.js
Funciones:
- Importar el paquete curricular validado a IndexedDB.
- Persistir únicamente PEA leídos y con contenido curricular útil.
- Verificar que los registros realmente guardados coincidan con lo esperado.
- Calcular el estado de cada materia desde los datos persistidos, no desde nombres de archivos.
- Detener la importación cuando IndexedDB no confirma un guardado esperado.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;
  var Core = NS.Core;

  if (!Schema) {
    console.error("[BDLocalCCC.Importador] Falta cargar primero bdlocal.schema.js");
    return;
  }

  if (!Core) {
    console.error("[BDLocalCCC.Importador] Falta cargar primero bdlocal.core.js");
    return;
  }

  var TIPOS_PEA = Schema.TIPOS_PEA || {
    BASE: "pea_base",
    UNIDADES: "pea_unidades",
    ACTIVIDADES: "pea_actividades"
  };

  var ESTADOS = Schema.ESTADOS_VALIDACION || {
    COMPLETO: "completo",
    INCOMPLETO: "incompleto",
    PENDIENTE: "pendiente",
    REVISION: "revision",
    ERROR: "error"
  };

  var SEVERIDADES = Schema.SEVERIDADES || {
    INFO: "info",
    ADVERTENCIA: "advertencia",
    ERROR: "error",
    CRITICO: "critico"
  };

  var TIPOS_OBLIGATORIOS = [
    TIPOS_PEA.BASE,
    TIPOS_PEA.UNIDADES,
    TIPOS_PEA.ACTIVIDADES
  ];

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function esObjeto(valor) {
    return !!valor && typeof valor === "object" && !Array.isArray(valor);
  }

  function fecha() {
    return Schema.fechaISO ? Schema.fechaISO() : new Date().toISOString();
  }

  function normalizarTexto(valor) {
    if (Schema.normalizarTexto) return Schema.normalizarTexto(valor);
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-]+/g, " ")
      .replace(/[^\w\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizarCodigo(valor) {
    if (Schema.normalizarCodigo) return Schema.normalizarCodigo(valor);
    return texto(valor)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");
  }

  function slug(valor) {
    if (Schema.slug) return Schema.slug(valor);
    return normalizarTexto(valor)
      .replace(/\./g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function uid(prefijo) {
    if (Schema.uid) return Schema.uid(prefijo);
    return String(prefijo || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function detectarExtension(nombreArchivo) {
    var partes = texto(nombreArchivo).toLowerCase().split(".");
    return partes.length > 1 ? partes.pop() : "";
  }

  function esExcel(nombreArchivo) {
    return ["xlsx", "xls", "xlsm", "csv"].indexOf(detectarExtension(nombreArchivo)) !== -1;
  }

  function nombreTipo(tipo) {
    if (tipo === TIPOS_PEA.BASE) return "PEA Base";
    if (tipo === TIPOS_PEA.UNIDADES) return "PEA Unidades";
    if (tipo === TIPOS_PEA.ACTIVIDADES) return "PEA Actividades";
    return "No identificado";
  }

  function normalizarTipoArchivo(valor, nombreArchivo, rutaOriginal) {
    var directo = texto(valor);
    if (TIPOS_OBLIGATORIOS.indexOf(directo) !== -1) return directo;

    var base = " " + normalizarTexto(
      directo + " " + texto(nombreArchivo) + " " + texto(rutaOriginal)
    ) + " ";

    if (
      base.includes(" pea base ") || base.includes(" base pea ") ||
      base.includes(" redes base ") || base.includes(" red base ") ||
      base.includes(" datos base ") || base.includes(" base datos ") ||
      base.includes(" pea general ") || base.includes(" informacion base ")
    ) return TIPOS_PEA.BASE;

    if (
      base.includes(" pea unidades ") || base.includes(" unidades pea ") ||
      base.includes(" unidad pea ") || base.includes(" unidades logros ") ||
      base.includes(" unidades de aprendizaje ") ||
      base.includes(" contenido por unidad ") || base.includes(" contenidos por unidad ")
    ) return TIPOS_PEA.UNIDADES;

    if (
      base.includes(" pea actividades ") || base.includes(" actividades pea ") ||
      base.includes(" actividad pea ") || base.includes(" actividades logros ") ||
      base.includes(" plan actividades ") || base.includes(" plan de actividades ") ||
      base.includes(" actividades de aprendizaje ")
    ) return TIPOS_PEA.ACTIVIDADES;

    return "";
  }

  function crearIdCarrera(nombre) {
    return Schema.crearIdCarrera ? Schema.crearIdCarrera(nombre) : "carrera_" + slug(nombre);
  }

  function crearIdMatriz(carreraId, nombre) {
    return Schema.crearIdMatriz
      ? Schema.crearIdMatriz(carreraId, nombre)
      : "matriz_" + slug(carreraId) + "_" + slug(nombre || "ccc");
  }

  function crearIdNivel(carreraId, numeroNivel, nombre) {
    return Schema.crearIdNivel
      ? Schema.crearIdNivel(carreraId, numeroNivel || nombre)
      : "nivel_" + slug(carreraId) + "_" + slug(numeroNivel || nombre || "sn");
  }

  function crearIdMateria(carreraId, nivelId, codigo, nombre) {
    if (Schema.crearIdMateria) return Schema.crearIdMateria(carreraId, nivelId, codigo, nombre);
    return "materia_" + slug(carreraId) + "_" + (normalizarCodigo(codigo) || slug(nivelId + "_" + nombre));
  }

  function crearIdArchivo(materiaId, tipo, ruta) {
    if (Schema.crearIdArchivo) return Schema.crearIdArchivo(materiaId, tipo, ruta);
    return "archivo_" + slug(materiaId) + "_" + slug(tipo || "sin_tipo") + "_" + slug(ruta).slice(0, 90);
  }

  async function asegurarStore(storeName) {
    var db = await Core.getDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error("La tabla IndexedDB '" + storeName + "' no existe.");
    }
    return true;
  }

  async function putEstricto(storeName, record, contexto) {
    await asegurarStore(storeName);
    var resultado = await Core.put(storeName, record);
    if (resultado === null || typeof resultado === "undefined") {
      throw new Error("IndexedDB no confirmó " + (contexto || ("el guardado en " + storeName)) + ".");
    }
    return resultado;
  }

  async function addEstricto(storeName, record, contexto) {
    await asegurarStore(storeName);
    var resultado = await Core.add(storeName, record);
    if (resultado === null || typeof resultado === "undefined") {
      throw new Error("IndexedDB no confirmó " + (contexto || ("la inserción en " + storeName)) + ".");
    }
    return resultado;
  }

  async function bulkPutEstricto(storeName, records, contexto) {
    records = arr(records);
    if (!records.length) return { storeName: storeName, total: 0, guardados: 0 };
    await asegurarStore(storeName);
    var resultado = await Core.bulkPut(storeName, records);
    var guardados = numero(resultado && resultado.guardados, 0);
    if (guardados !== records.length) {
      throw new Error(
        "Guardado incompleto en '" + storeName + "' durante " + (contexto || "la importación") +
        ": se esperaban " + records.length + " registros y se confirmaron " + guardados + "."
      );
    }
    return resultado;
  }

  async function getAllByIndexEstricto(storeName, indexName, value) {
    await asegurarStore(storeName);
    return await Core.getAllByIndex(storeName, indexName, value);
  }

  async function logSeguro(payload) {
    try {
      return Core.log ? await Core.log(payload || {}) : null;
    } catch (error) {
      console.warn("[BDLocalCCC.Importador] No se pudo guardar log:", error);
      return null;
    }
  }

  function crearCargaInicial(paquete) {
    var carga = paquete && paquete.carga ? paquete.carga : {};
    return {
      nombreZip: texto(carga.nombreZip || paquete.nombreZip || "carga-ccc.zip"),
      fechaCarga: carga.fechaCarga || fecha(),
      estado: "procesando",
      origen: "subir",
      totalCarreras: numero(carga.totalCarreras, 0),
      totalMatrices: numero(carga.totalMatrices, 0),
      totalNiveles: numero(carga.totalNiveles, 0),
      totalMaterias: numero(carga.totalMaterias, 0),
      totalArchivos: numero(carga.totalArchivos, 0),
      materiasCompletas: numero(carga.materiasCompletas, 0),
      materiasIncompletas: numero(carga.materiasIncompletas, 0),
      materiasRevision: numero(carga.materiasRevision, 0),
      observaciones: texto(carga.observaciones || ""),
      resumenValidacion: paquete.resumenValidacion || null,
      diagnostico: paquete.diagnostico || null,
      diagnosticoExcel: paquete.diagnosticoExcel || null,
      creadoEn: fecha(),
      actualizadoEn: fecha()
    };
  }

  function prepararCarrera(data) {
    data = data || {};
    var nombre = texto(data.nombre || data.carrera || data.nombreCarrera);
    if (!nombre) throw new Error("Se encontró una carrera sin nombre.");
    return Object.assign({}, data, {
      id: data.id || crearIdCarrera(nombre),
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      estado: data.estado || "activo",
      origen: data.origen || "importacion_zip",
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function prepararMatriz(data, carreraId) {
    data = data || {};
    var nombre = texto(data.nombre || data.matriz || data.nombreMatriz || "Matriz CCC");
    return Object.assign({}, data, {
      id: data.id || crearIdMatriz(carreraId, nombre),
      carreraId: data.carreraId || carreraId,
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      tipo: data.tipo || "ccc",
      estado: data.estado || "activo",
      origen: data.origen || "importacion_zip",
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function prepararNivel(data, carreraId, matrizId) {
    data = data || {};
    var numeroNivel = numero(data.numero || data.numeroNivel || data.nivelNumero, 0);
    var nombre = texto(data.nombre || data.nivel || data.nombreNivel || (numeroNivel ? numeroNivel + ". Nivel" : "Nivel sin número"));
    return Object.assign({}, data, {
      id: data.id || crearIdNivel(carreraId, numeroNivel, nombre),
      carreraId: data.carreraId || carreraId,
      matrizId: data.matrizId || matrizId,
      numero: numeroNivel,
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      estado: data.estado || "activo",
      origen: data.origen || "importacion_zip",
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function prepararMateria(data, carreraId, matrizId, nivelId) {
    data = data || {};
    var codigo = normalizarCodigo(data.codigo || data.codigoMateria || "");
    var nombre = texto(data.nombre || data.materia || data.nombreMateria);
    if (!nombre) throw new Error("Se encontró una materia sin nombre.");
    return Object.assign({}, data, {
      id: data.id || crearIdMateria(carreraId, nivelId, codigo, nombre),
      carreraId: data.carreraId || carreraId,
      matrizId: data.matrizId || matrizId,
      nivelId: data.nivelId || nivelId,
      codigo: codigo,
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      estadoValidacion: data.estadoValidacion || ESTADOS.PENDIENTE,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: numero(data.totalArchivosEncontrados, 0),
      totalArchivosPersistidos: 0,
      archivosFaltantes: arr(data.archivosFaltantes),
      archivosSinContenido: arr(data.archivosSinContenido),
      archivosDuplicados: arr(data.archivosDuplicados),
      resumenValidacion: data.resumenValidacion || null,
      resumenArchivos: data.resumenArchivos || null,
      origen: data.origen || "importacion_zip",
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function prepararArchivo(data, contexto) {
    data = data || {};
    contexto = contexto || {};
    var nombreArchivo = texto(data.nombreArchivo || data.nombre || data.fileName || "");
    var rutaOriginal = texto(data.rutaOriginal || data.ruta || data.path || nombreArchivo);
    var tipo = normalizarTipoArchivo(data.tipo || data.tipoSugerido, nombreArchivo, rutaOriginal);
    var materiaId = data.materiaId || contexto.materiaId || "";
    var copia = Object.assign({}, data);

    delete copia.archivoOriginal;
    delete copia.file;
    delete copia.blob;
    delete copia.raw;
    delete copia.workbook;
    delete copia.contenidoBinario;

    return Object.assign({}, copia, {
      id: data.id || crearIdArchivo(materiaId || "sin_materia", tipo || "sin_tipo", rutaOriginal),
      cargaId: contexto.cargaId,
      carreraId: data.carreraId || contexto.carreraId || "",
      matrizId: data.matrizId || contexto.matrizId || "",
      nivelId: data.nivelId || contexto.nivelId || "",
      materiaId: materiaId,
      tipo: tipo,
      tipoSugerido: data.tipoSugerido || tipo,
      tipoLabel: data.tipoLabel || nombreTipo(tipo),
      nombreArchivo: nombreArchivo,
      rutaOriginal: rutaOriginal,
      extension: data.extension || detectarExtension(nombreArchivo),
      estado: tipo ? (data.estado || "detectado") : "no_identificado",
      confianza: typeof data.confianza === "number" ? data.confianza : (tipo ? 100 : 0),
      esExcel: data.esExcel !== false && esExcel(nombreArchivo),
      excelLeido: data.excelLeido === true,
      excelResumen: data.excelResumen || null,
      errorExcel: texto(data.errorExcel || data.errorLectura),
      tieneContenidoBinario: false,
      contenidoBinario: null,
      datosProcesados: typeof data.datosProcesados !== "undefined" ? data.datosProcesados : (data.datos || null),
      razonesDeteccion: arr(data.razonesDeteccion),
      puntajesDeteccion: arr(data.puntajesDeteccion),
      tamanoBytes: numero(data.tamanoBytes, 0),
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function resolverPorIdONombre(data, lista, opciones) {
    data = data || {};
    lista = arr(lista);
    opciones = opciones || {};
    var id = texto(data[opciones.idCampo || "id"]);
    if (id) {
      var porId = lista.find(function (item) { return item.id === id; });
      if (porId) return porId;
    }
    var nombre = texto(
      data[opciones.nombreCampo || "nombre"] ||
      data[opciones.nombreAlterno || "nombre"] ||
      data[opciones.nombreAlterno2 || "nombre"]
    );
    var normalizado = normalizarTexto(nombre);
    if (normalizado) {
      var porNombre = lista.find(function (item) { return item.nombreNormalizado === normalizado; });
      if (porNombre) return porNombre;
    }
    return lista.length === 1 ? lista[0] : null;
  }

  function resolverCarrera(data, carreras) {
    return resolverPorIdONombre(data, carreras, {
      idCampo: "carreraId",
      nombreCampo: "carrera",
      nombreAlterno: "nombreCarrera",
      nombreAlterno2: "carreraNombre"
    });
  }

  function resolverMatriz(data, matrices, carreraId) {
    data = data || {};
    var porId = texto(data.matrizId)
      ? arr(matrices).find(function (item) { return item.id === data.matrizId; })
      : null;
    if (porId) return porId;
    return arr(matrices).find(function (item) { return item.carreraId === carreraId; }) ||
      (arr(matrices).length === 1 ? arr(matrices)[0] : null);
  }

  function resolverNivel(data, niveles, carreraId) {
    data = data || {};
    var porId = texto(data.nivelId)
      ? arr(niveles).find(function (item) { return item.id === data.nivelId; })
      : null;
    if (porId) return porId;
    var numeroNivel = numero(data.numero || data.numeroNivel || data.nivelNumero, 0);
    if (numeroNivel) {
      var porNumero = arr(niveles).find(function (item) {
        return item.carreraId === carreraId && Number(item.numero) === numeroNivel;
      });
      if (porNumero) return porNumero;
    }
    var nombre = normalizarTexto(data.nivel || data.nombreNivel || data.nivelNombre || "");
    if (nombre) {
      var porNombre = arr(niveles).find(function (item) {
        return item.carreraId === carreraId && item.nombreNormalizado === nombre;
      });
      if (porNombre) return porNombre;
    }
    var candidatos = arr(niveles).filter(function (item) { return item.carreraId === carreraId; });
    return candidatos.length === 1 ? candidatos[0] : null;
  }

  function resolverMateria(data, materias) {
    data = data || {};
    var porId = texto(data.materiaId)
      ? arr(materias).find(function (item) { return item.id === data.materiaId; })
      : null;
    if (porId) return porId;
    var codigo = normalizarCodigo(data.codigo || data.codigoMateria || "");
    if (codigo) {
      var porCodigo = arr(materias).find(function (item) { return item.codigo === codigo; });
      if (porCodigo) return porCodigo;
    }
    var nombre = normalizarTexto(data.materia || data.nombreMateria || data.materiaNombre || data.nombre || "");
    return nombre
      ? arr(materias).find(function (item) { return item.nombreNormalizado === nombre; }) || null
      : null;
  }

  function tieneValor(valor) {
    if (Array.isArray(valor)) return valor.some(tieneValor);
    if (esObjeto(valor)) return Object.keys(valor).some(function (clave) { return tieneValor(valor[clave]); });
    return texto(valor) !== "";
  }

  function contenidoBaseValido(datos) {
    if (!esObjeto(datos)) return false;
    return !!(
      texto(datos.descripcion) || texto(datos.objetivo) ||
      tieneValor(datos.campos) || tieneValor(datos.hojas) ||
      tieneValor(datos.filas) || tieneValor(datos.unidadesBase) ||
      tieneValor(datos.bibliografia)
    );
  }

  function extraerRegistros(datos, clave) {
    if (Array.isArray(datos)) return datos;
    return esObjeto(datos) ? arr(datos[clave]) : [];
  }

  function unidadValida(unidad) {
    if (!esObjeto(unidad)) return false;
    return !!(
      arr(unidad.contenidos).some(function (item) { return texto(item); }) ||
      texto(unidad.temaDetectado || unidad.tema || unidad.contenido || unidad.titulo ||
        unidad.resultadoDetectado || unidad.resultadoAprendizaje || unidad.competencia)
    );
  }

  function actividadValida(actividad) {
    return esObjeto(actividad) && !!texto(
      actividad.actividadDetectada || actividad.actividad || actividad.descripcion ||
      actividad.tema || actividad.titulo || actividad.contenido ||
      actividad.taller || actividad.proyecto
    );
  }

  function contenidoArchivoValido(archivo) {
    if (!archivo || archivo.excelLeido !== true || texto(archivo.errorExcel || archivo.errorLectura)) return false;
    if (archivo.tipo === TIPOS_PEA.BASE) return contenidoBaseValido(archivo.datosProcesados);
    if (archivo.tipo === TIPOS_PEA.UNIDADES) {
      return extraerRegistros(archivo.datosProcesados, "unidades").some(unidadValida);
    }
    if (archivo.tipo === TIPOS_PEA.ACTIVIDADES) {
      return extraerRegistros(archivo.datosProcesados, "actividades").some(actividadValida);
    }
    return false;
  }

  function agruparPorTipo(archivos) {
    var mapa = {};
    arr(archivos).forEach(function (archivo) {
      if (!mapa[archivo.tipo || ""]) mapa[archivo.tipo || ""] = [];
      mapa[archivo.tipo || ""].push(archivo);
    });
    return mapa;
  }

  function seleccionarPrincipal(archivos, tipo) {
    var candidatos = arr(archivos).filter(function (archivo) {
      return archivo.tipo === tipo && contenidoArchivoValido(archivo);
    });
    candidatos.sort(function (a, b) {
      return Number(b.confianza || 0) - Number(a.confianza || 0);
    });
    return candidatos[0] || null;
  }

  function validarMateriaConArchivos(materia, archivos) {
    materia = materia || {};
    archivos = arr(archivos);
    var porTipo = agruparPorTipo(archivos);
    var faltantes = [];
    var sinContenido = [];
    var duplicados = [];
    var validos = {};

    TIPOS_OBLIGATORIOS.forEach(function (tipo) {
      var encontrados = porTipo[tipo] || [];
      validos[tipo] = encontrados.filter(contenidoArchivoValido);
      if (!encontrados.length) faltantes.push(tipo);
      else if (!validos[tipo].length) sinContenido.push(tipo);
      if (encontrados.length > 1) duplicados.push(tipo);
    });

    var totalValidos = TIPOS_OBLIGATORIOS.filter(function (tipo) {
      return validos[tipo].length > 0;
    }).length;

    var estado = totalValidos === 3
      ? (duplicados.length ? ESTADOS.REVISION : ESTADOS.COMPLETO)
      : ESTADOS.INCOMPLETO;

    return Object.assign({}, materia, {
      estadoValidacion: estado,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: totalValidos,
      totalArchivosValidos: totalValidos,
      archivosFaltantes: faltantes,
      archivosSinContenido: sinContenido,
      archivosDuplicados: duplicados,
      actualizadoEn: fecha()
    });
  }

  function prepararBase(archivo, materia) {
    var datos = archivo.datosProcesados;
    if (!contenidoBaseValido(datos)) return null;
    return {
      materiaId: materia.id,
      cargaId: archivo.cargaId,
      carreraId: materia.carreraId,
      matrizId: materia.matrizId,
      nivelId: materia.nivelId,
      codigoMateria: materia.codigo,
      nombreMateria: materia.nombre,
      archivoId: archivo.id,
      nombreArchivo: archivo.nombreArchivo,
      rutaOriginal: archivo.rutaOriginal,
      campos: esObjeto(datos.campos) ? datos.campos : {},
      hojas: esObjeto(datos.hojas) ? datos.hojas : {},
      datos: datos,
      totalHojas: numero(archivo.excelResumen && archivo.excelResumen.totalHojas, 0),
      creadoEn: fecha(),
      actualizadoEn: fecha()
    };
  }

  function prepararUnidades(archivo, materia) {
    return extraerRegistros(archivo.datosProcesados, "unidades")
      .filter(unidadValida)
      .map(function (fila, index) {
        var unidadNumero = numero(
          fila.unidadNumero || fila.unidad || fila.numeroUnidad ||
          fila.numero_unidad || fila.n_unidad,
          index + 1
        );
        return Object.assign({}, fila, {
          id: uid("unidad"),
          cargaId: archivo.cargaId,
          carreraId: materia.carreraId,
          matrizId: materia.matrizId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          codigoMateria: materia.codigo,
          nombreMateria: materia.nombre,
          archivoId: archivo.id,
          nombreArchivo: archivo.nombreArchivo,
          rutaOriginal: archivo.rutaOriginal,
          unidadNumero: unidadNumero,
          temaDetectado: texto(fila.temaDetectado || fila.tema || fila.contenido || fila.titulo || arr(fila.contenidos)[0] || ""),
          subtemaDetectado: texto(fila.subtemaDetectado || fila.subtema || fila.sub_tema || ""),
          resultadoDetectado: texto(fila.resultadoDetectado || fila.resultado || fila.aprendizaje || fila.logro || ""),
          creadoEn: fecha(),
          actualizadoEn: fecha()
        });
      });
  }

  function prepararActividades(archivo, materia) {
    return extraerRegistros(archivo.datosProcesados, "actividades")
      .filter(actividadValida)
      .map(function (fila) {
        return Object.assign({}, fila, {
          id: uid("actividad"),
          cargaId: archivo.cargaId,
          carreraId: materia.carreraId,
          matrizId: materia.matrizId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          codigoMateria: materia.codigo,
          nombreMateria: materia.nombre,
          archivoId: archivo.id,
          nombreArchivo: archivo.nombreArchivo,
          rutaOriginal: archivo.rutaOriginal,
          unidadNumero: numero(
            fila.unidadNumero || fila.unidad || fila.numeroUnidad ||
            fila.numero_unidad || fila.n_unidad,
            0
          ),
          actividadDetectada: texto(
            fila.actividadDetectada || fila.actividad || fila.descripcion ||
            fila.tema || fila.titulo || fila.contenido || fila.taller || fila.proyecto || ""
          ),
          tipoActividad: texto(fila.tipoActividad || fila.tipo || fila.modalidad || fila.componente || "actividad"),
          creadoEn: fecha(),
          actualizadoEn: fecha()
        });
      });
  }

  async function borrarPorIndice(storeName, indexName, value) {
    await asegurarStore(storeName);
    return await Core.runTransaction(storeName, "readwrite", function (stores) {
      return new Promise(function (resolve, reject) {
        var store = stores[storeName];
        if (!store.indexNames.contains(indexName)) {
          reject(new Error("El índice '" + indexName + "' no existe en '" + storeName + "'."));
          return;
        }
        var request = store.index(indexName).openCursor(value);
        var eliminados = 0;
        request.onerror = function () {
          reject(request.error || new Error("No se pudo limpiar '" + storeName + "'."));
        };
        request.onsuccess = function (event) {
          var cursor = event.target.result;
          if (!cursor) {
            resolve(eliminados);
            return;
          }
          var borrar = cursor.delete();
          borrar.onerror = function () {
            reject(borrar.error || new Error("No se pudo eliminar un registro de '" + storeName + "'."));
          };
          borrar.onsuccess = function () {
            eliminados += 1;
            cursor.continue();
          };
        };
      });
    }, { contexto: "limpiar " + storeName + " para " + value, timeoutMs: 60000 });
  }

  async function limpiarDatosPEAPorMateria(materiaId) {
    await asegurarStore(Schema.STORES.PEA_BASE);
    await Core.remove(Schema.STORES.PEA_BASE, materiaId);
    await borrarPorIndice(Schema.STORES.PEA_UNIDADES, "materiaId", materiaId);
    await borrarPorIndice(Schema.STORES.PEA_ACTIVIDADES, "materiaId", materiaId);
  }

  async function verificarPersistenciaMateria(materia, esperado) {
    var base = await Core.get(Schema.STORES.PEA_BASE, materia.id);
    var unidades = await getAllByIndexEstricto(Schema.STORES.PEA_UNIDADES, "materiaId", materia.id);
    var actividades = await getAllByIndexEstricto(Schema.STORES.PEA_ACTIVIDADES, "materiaId", materia.id);

    var actual = {
      baseGuardada: !!base,
      unidadesGuardadas: unidades.length,
      actividadesGuardadas: actividades.length
    };

    if (esperado.baseGuardada !== actual.baseGuardada) {
      throw new Error("Verificación fallida para " + materia.nombre + ": el PEA Base persistido no coincide con lo esperado.");
    }
    if (esperado.unidadesGuardadas !== actual.unidadesGuardadas) {
      throw new Error(
        "Verificación fallida para " + materia.nombre + ": se esperaban " +
        esperado.unidadesGuardadas + " unidades y se encontraron " + actual.unidadesGuardadas + "."
      );
    }
    if (esperado.actividadesGuardadas !== actual.actividadesGuardadas) {
      throw new Error(
        "Verificación fallida para " + materia.nombre + ": se esperaban " +
        esperado.actividadesGuardadas + " actividades y se encontraron " + actual.actividadesGuardadas + "."
      );
    }

    return actual;
  }

  async function guardarDatosMateria(materia, archivosMateria) {
    var baseArchivo = seleccionarPrincipal(archivosMateria, TIPOS_PEA.BASE);
    var unidadesArchivo = seleccionarPrincipal(archivosMateria, TIPOS_PEA.UNIDADES);
    var actividadesArchivo = seleccionarPrincipal(archivosMateria, TIPOS_PEA.ACTIVIDADES);

    var base = baseArchivo ? prepararBase(baseArchivo, materia) : null;
    var unidades = unidadesArchivo ? prepararUnidades(unidadesArchivo, materia) : [];
    var actividades = actividadesArchivo ? prepararActividades(actividadesArchivo, materia) : [];

    var esperado = {
      baseGuardada: !!base,
      unidadesGuardadas: unidades.length,
      actividadesGuardadas: actividades.length
    };

    await limpiarDatosPEAPorMateria(materia.id);

    if (base) {
      await putEstricto(Schema.STORES.PEA_BASE, base, "el PEA Base de " + materia.nombre);
    }
    if (unidades.length) {
      await bulkPutEstricto(Schema.STORES.PEA_UNIDADES, unidades, "las unidades de " + materia.nombre);
    }
    if (actividades.length) {
      await bulkPutEstricto(Schema.STORES.PEA_ACTIVIDADES, actividades, "las actividades de " + materia.nombre);
    }

    var verificado = await verificarPersistenciaMateria(materia, esperado);
    return {
      baseArchivo: baseArchivo,
      unidadesArchivo: unidadesArchivo,
      actividadesArchivo: actividadesArchivo,
      esperado: esperado,
      verificado: verificado
    };
  }

  async function guardarDatosProcesadosPorMaterias(materias, archivos) {
    var resumen = {
      basesGuardadas: 0,
      unidadesGuardadas: 0,
      actividadesGuardadas: 0,
      materiasConBase: 0,
      materiasConUnidades: 0,
      materiasConActividades: 0,
      materiasVerificadas: 0,
      porMateria: {}
    };

    for (var i = 0; i < materias.length; i += 1) {
      var materia = materias[i];
      var archivosMateria = arr(archivos).filter(function (archivo) {
        return archivo.materiaId === materia.id;
      });
      var resultado = await guardarDatosMateria(materia, archivosMateria);
      var real = resultado.verificado;

      resumen.basesGuardadas += real.baseGuardada ? 1 : 0;
      resumen.unidadesGuardadas += real.unidadesGuardadas;
      resumen.actividadesGuardadas += real.actividadesGuardadas;
      resumen.materiasConBase += real.baseGuardada ? 1 : 0;
      resumen.materiasConUnidades += real.unidadesGuardadas > 0 ? 1 : 0;
      resumen.materiasConActividades += real.actividadesGuardadas > 0 ? 1 : 0;
      resumen.materiasVerificadas += 1;
      resumen.porMateria[materia.id] = real;
    }

    return resumen;
  }

  function firmaValidacion(data) {
    return [
      texto(data.tipo),
      texto(data.materiaId),
      texto(data.archivoId),
      texto(data.mensaje)
    ].join("|");
  }

  async function registrarValidacion(payload, firmas) {
    payload = payload || {};
    var data = Object.assign({
      cargaId: null,
      carreraId: "",
      matrizId: "",
      nivelId: "",
      materiaId: "",
      archivoId: "",
      tipo: "general",
      severidad: SEVERIDADES.ADVERTENCIA,
      estado: "activo",
      mensaje: "",
      detalle: null,
      creadoEn: fecha()
    }, payload);

    var firma = firmaValidacion(data);
    if (firmas && firmas[firma]) return null;
    if (firmas) firmas[firma] = true;
    return await addEstricto(Schema.STORES.VALIDACIONES, data, "la validación " + data.tipo);
  }

  async function registrarValidacionesSubida(cargaId, paquete, firmas) {
    var validaciones = arr(paquete.validacionesSubida);
    for (var i = 0; i < validaciones.length; i += 1) {
      var v = validaciones[i];
      await registrarValidacion({
        cargaId: cargaId,
        carreraId: v.carreraId || "",
        matrizId: v.matrizId || "",
        nivelId: v.nivelId || "",
        materiaId: v.materiaId || "",
        archivoId: v.archivoId || "",
        tipo: v.tipo || "validacion_subida",
        severidad: v.severidad || SEVERIDADES.ADVERTENCIA,
        estado: "activo",
        mensaje: v.mensaje || "",
        detalle: v.detalle || v,
        creadoEn: v.creadoEn || fecha()
      }, firmas);
    }
  }

  async function registrarValidacionesMateria(cargaId, materia, archivos, evaluacion, firmas) {
    var base = {
      cargaId: cargaId,
      carreraId: materia.carreraId,
      matrizId: materia.matrizId,
      nivelId: materia.nivelId,
      materiaId: materia.id
    };

    if (evaluacion.archivosFaltantes.length) {
      await registrarValidacion(Object.assign({}, base, {
        tipo: "archivos_faltantes",
        severidad: SEVERIDADES.ERROR,
        mensaje: "La materia no tiene los 3 archivos PEA obligatorios.",
        detalle: {
          materia: materia.nombre,
          codigo: materia.codigo,
          faltantes: evaluacion.archivosFaltantes.map(nombreTipo)
        }
      }), firmas);
    }

    if (evaluacion.archivosSinContenido.length) {
      await registrarValidacion(Object.assign({}, base, {
        tipo: "contenido_pea_invalido",
        severidad: SEVERIDADES.ERROR,
        mensaje: "Hay archivos PEA presentes que no produjeron contenido curricular persistible.",
        detalle: {
          materia: materia.nombre,
          codigo: materia.codigo,
          tipos: evaluacion.archivosSinContenido.map(nombreTipo)
        }
      }), firmas);
    }

    if (evaluacion.archivosDuplicados.length) {
      await registrarValidacion(Object.assign({}, base, {
        tipo: "archivos_duplicados",
        severidad: SEVERIDADES.ADVERTENCIA,
        mensaje: "La materia tiene archivos PEA duplicados.",
        detalle: {
          materia: materia.nombre,
          codigo: materia.codigo,
          duplicados: evaluacion.archivosDuplicados.map(nombreTipo)
        }
      }), firmas);
    }

    for (var i = 0; i < archivos.length; i += 1) {
      var archivo = archivos[i];
      if (!archivo.tipo) {
        await registrarValidacion(Object.assign({}, base, {
          archivoId: archivo.id,
          tipo: "archivo_no_identificado",
          severidad: SEVERIDADES.ADVERTENCIA,
          mensaje: "Un archivo de la materia no pudo clasificarse como PEA Base, Unidades o Actividades.",
          detalle: { archivo: archivo.nombreArchivo, rutaOriginal: archivo.rutaOriginal }
        }), firmas);
      }
      if (archivo.errorExcel || archivo.errorLectura || (archivo.esExcel && archivo.excelLeido !== true)) {
        await registrarValidacion(Object.assign({}, base, {
          archivoId: archivo.id,
          tipo: "excel_no_leido",
          severidad: SEVERIDADES.ERROR,
          mensaje: "Un Excel curricular no pudo leerse o no quedó procesado.",
          detalle: {
            archivo: archivo.nombreArchivo,
            error: archivo.errorExcel || archivo.errorLectura || "excel_no_procesado"
          }
        }), firmas);
      }
    }
  }

  async function importarCarreras(paquete) {
    var entrada = arr(paquete.carreras);
    if (!entrada.length) throw new Error("No hay carreras válidas para importar.");
    var carreras = entrada.map(prepararCarrera);
    await bulkPutEstricto(Schema.STORES.CARRERAS, carreras, "las carreras");
    return carreras;
  }

  async function importarMatrices(paquete, carreras) {
    var entrada = arr(paquete.matrices);
    if (!entrada.length) {
      entrada = carreras.map(function (carrera) {
        return { carreraId: carrera.id, nombre: "Matriz CCC", tipo: "ccc" };
      });
    }
    var matrices = entrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras);
      if (!carrera) throw new Error("No se pudo asociar una matriz con su carrera.");
      return prepararMatriz(item, carrera.id);
    });
    await bulkPutEstricto(Schema.STORES.MATRICES, matrices, "las matrices");
    return matrices;
  }

  async function importarNiveles(paquete, carreras, matrices) {
    var entrada = arr(paquete.niveles);
    if (!entrada.length) throw new Error("No hay niveles válidos para importar.");
    var niveles = entrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras);
      if (!carrera) throw new Error("No se pudo asociar un nivel con su carrera.");
      var matriz = resolverMatriz(item, matrices, carrera.id);
      if (!matriz) throw new Error("No se pudo asociar un nivel con su matriz.");
      return prepararNivel(item, carrera.id, matriz.id);
    });
    await bulkPutEstricto(Schema.STORES.NIVELES, niveles, "los niveles");
    return niveles;
  }

  async function importarMaterias(paquete, carreras, matrices, niveles) {
    var entrada = arr(paquete.materias);
    if (!entrada.length) throw new Error("No hay materias válidas para importar.");
    var materias = entrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras);
      if (!carrera) throw new Error("No se pudo asociar la materia '" + texto(item.nombre || item.materia) + "' con una carrera.");
      var matriz = resolverMatriz(item, matrices, carrera.id);
      var nivel = resolverNivel(item, niveles, carrera.id);
      if (!matriz || !nivel) {
        throw new Error("No se pudo asociar la materia '" + texto(item.nombre || item.materia) + "' con su matriz y nivel.");
      }
      return prepararMateria(item, carrera.id, matriz.id, nivel.id);
    });
    await bulkPutEstricto(Schema.STORES.MATERIAS, materias, "las materias");
    return materias;
  }

  async function importarArchivos(paquete, cargaId, carreras, matrices, niveles, materias) {
    var archivos = arr(paquete.archivos).map(function (item) {
      var materia = resolverMateria(item, materias);
      if (!materia && materias.length === 1) materia = materias[0];
      if (!materia) {
        throw new Error("No se pudo asociar el archivo '" + texto(item.nombreArchivo || item.nombre) + "' con una materia.");
      }
      var carrera = carreras.find(function (c) { return c.id === materia.carreraId; });
      var matriz = matrices.find(function (m) { return m.id === materia.matrizId; });
      var nivel = niveles.find(function (n) { return n.id === materia.nivelId; });
      return prepararArchivo(item, {
        cargaId: cargaId,
        carreraId: carrera ? carrera.id : materia.carreraId,
        matrizId: matriz ? matriz.id : materia.matrizId,
        nivelId: nivel ? nivel.id : materia.nivelId,
        materiaId: materia.id
      });
    });
    await bulkPutEstricto(Schema.STORES.PEA_ARCHIVOS, archivos, "los archivos PEA");
    return archivos;
  }

  async function actualizarEstadosMaterias(cargaId, materias, archivos, resumenPersistencia, firmas) {
    var actualizadas = [];
    for (var i = 0; i < materias.length; i += 1) {
      var materia = materias[i];
      var archivosMateria = archivos.filter(function (archivo) { return archivo.materiaId === materia.id; });
      var evaluacion = validarMateriaConArchivos(materia, archivosMateria);
      var persistencia = resumenPersistencia.porMateria[materia.id] || {
        baseGuardada: false,
        unidadesGuardadas: 0,
        actividadesGuardadas: 0
      };
      var tiposPersistidos =
        (persistencia.baseGuardada ? 1 : 0) +
        (persistencia.unidadesGuardadas > 0 ? 1 : 0) +
        (persistencia.actividadesGuardadas > 0 ? 1 : 0);

      var estado = tiposPersistidos === 3
        ? (evaluacion.archivosDuplicados.length ? ESTADOS.REVISION : ESTADOS.COMPLETO)
        : ESTADOS.INCOMPLETO;

      var actualizada = Object.assign({}, evaluacion, {
        estadoValidacion: estado,
        totalArchivosEncontrados: tiposPersistidos,
        totalArchivosPersistidos: tiposPersistidos,
        persistenciaPEA: persistencia,
        resumenValidacion: Object.assign({}, evaluacion.resumenValidacion || {}, {
          basePersistida: persistencia.baseGuardada,
          unidadesPersistidas: persistencia.unidadesGuardadas,
          actividadesPersistidas: persistencia.actividadesGuardadas,
          verificadoEn: fecha()
        }),
        actualizadoEn: fecha()
      });

      await putEstricto(Schema.STORES.MATERIAS, actualizada, "el estado de " + materia.nombre);
      await registrarValidacionesMateria(cargaId, materia, archivosMateria, evaluacion, firmas);
      actualizadas.push(actualizada);
    }
    return actualizadas;
  }

  function construirResumen(carreras, niveles, materias, archivos, validaciones, persistencia) {
    var completas = materias.filter(function (m) { return m.estadoValidacion === ESTADOS.COMPLETO; }).length;
    var incompletas = materias.filter(function (m) { return m.estadoValidacion === ESTADOS.INCOMPLETO; }).length;
    var revision = materias.filter(function (m) { return m.estadoValidacion === ESTADOS.REVISION; }).length;
    return {
      generadoEn: fecha(),
      totalCarreras: carreras.length,
      totalNiveles: niveles.length,
      totalMaterias: materias.length,
      materiasCompletas: completas,
      materiasIncompletas: incompletas,
      materiasRevision: revision,
      totalArchivos: archivos.length,
      archivosBase: archivos.filter(function (a) { return a.tipo === TIPOS_PEA.BASE; }).length,
      archivosUnidades: archivos.filter(function (a) { return a.tipo === TIPOS_PEA.UNIDADES; }).length,
      archivosActividades: archivos.filter(function (a) { return a.tipo === TIPOS_PEA.ACTIVIDADES; }).length,
      archivosNoIdentificados: archivos.filter(function (a) { return !a.tipo; }).length,
      excelLeidos: archivos.filter(function (a) { return a.excelLeido === true && !a.errorExcel; }).length,
      excelConError: archivos.filter(function (a) { return !!(a.errorExcel || a.errorLectura); }).length,
      validacionesGeneradas: validaciones.length,
      peaBaseGuardados: persistencia.basesGuardadas,
      peaUnidadesGuardadas: persistencia.unidadesGuardadas,
      peaActividadesGuardadas: persistencia.actividadesGuardadas,
      materiasPersistenciaVerificada: persistencia.materiasVerificadas,
      persistenciaCompleta: persistencia.materiasVerificadas === materias.length,
      tieneObservaciones: incompletas > 0 || revision > 0 || validaciones.length > 0
    };
  }

  function validarBloqueosPrevios(paquete) {
    var resumen = paquete && paquete.resumenValidacion || {};
    var control = paquete && paquete.diagnosticoExcel && paquete.diagnosticoExcel.controlLectura || {};
    if (resumen.bloqueaImportacion === true || control.bloqueaImportacion === true) {
      throw new Error("El paquete tiene errores críticos de lectura o validación y no puede persistirse.");
    }
  }

  async function importarPaqueteCCC(paqueteNormalizado) {
    await Core.ready();
    if (!paqueteNormalizado || typeof paqueteNormalizado !== "object") {
      throw new Error("No se recibió un paquete válido para importar.");
    }
    validarBloqueosPrevios(paqueteNormalizado);

    var carga = crearCargaInicial(paqueteNormalizado);
    var cargaId = await addEstricto(Schema.STORES.CARGAS_ZIP, carga, "el registro de carga ZIP");
    var firmas = {};

    await logSeguro({
      cargaId: cargaId,
      tipo: "importacion",
      nivel: "info",
      mensaje: "Inicio de importación CCC con verificación de persistencia."
    });

    try {
      await registrarValidacionesSubida(cargaId, paqueteNormalizado, firmas);
      var carreras = await importarCarreras(paqueteNormalizado);
      var matrices = await importarMatrices(paqueteNormalizado, carreras);
      var niveles = await importarNiveles(paqueteNormalizado, carreras, matrices);
      var materias = await importarMaterias(paqueteNormalizado, carreras, matrices, niveles);
      var archivos = await importarArchivos(paqueteNormalizado, cargaId, carreras, matrices, niveles, materias);
      var persistencia = await guardarDatosProcesadosPorMaterias(materias, archivos);
      var materiasActualizadas = await actualizarEstadosMaterias(
        cargaId, materias, archivos, persistencia, firmas
      );
      var validaciones = await getAllByIndexEstricto(Schema.STORES.VALIDACIONES, "cargaId", cargaId);
      var resumen = construirResumen(
        carreras, niveles, materiasActualizadas, archivos, validaciones, persistencia
      );

      var cargaFinal = Object.assign({}, carga, {
        id: cargaId,
        estado: "completado",
        resultado: resumen.tieneObservaciones ? "con_observaciones" : "correcto",
        totalCarreras: resumen.totalCarreras,
        totalNiveles: resumen.totalNiveles,
        totalMaterias: resumen.totalMaterias,
        totalArchivos: resumen.totalArchivos,
        materiasCompletas: resumen.materiasCompletas,
        materiasIncompletas: resumen.materiasIncompletas,
        materiasRevision: resumen.materiasRevision,
        resumen: resumen,
        actualizadoEn: fecha()
      });

      await putEstricto(Schema.STORES.CARGAS_ZIP, cargaFinal, "el cierre de la carga ZIP");
      await logSeguro({
        cargaId: cargaId,
        tipo: "importacion",
        nivel: "info",
        mensaje: "Importación CCC completada y persistencia verificada.",
        detalle: resumen
      });

      return {
        ok: true,
        cargaId: cargaId,
        estado: "completado",
        resumen: resumen,
        carreras: carreras,
        matrices: matrices,
        niveles: niveles,
        materias: materiasActualizadas,
        archivos: archivos,
        validaciones: validaciones,
        resumenExcel: persistencia,
        persistenciaVerificada: true
      };
    } catch (error) {
      try {
        await putEstricto(Schema.STORES.CARGAS_ZIP, Object.assign({}, carga, {
          id: cargaId,
          estado: "error",
          error: error.message,
          actualizadoEn: fecha()
        }), "el registro del error de importación");
      } catch (errorCarga) {
        console.error("[BDLocalCCC.Importador] No se pudo registrar el error de carga:", errorCarga);
      }

      await logSeguro({
        cargaId: cargaId,
        tipo: "importacion",
        nivel: "error",
        mensaje: "Error durante la importación CCC.",
        detalle: { error: error.message, stack: error.stack || "" }
      });
      throw error;
    }
  }

  NS.Importador = {
    importarPaqueteCCC: importarPaqueteCCC,
    normalizarTipoArchivo: normalizarTipoArchivo,
    validarMateriaConArchivos: validarMateriaConArchivos,
    contenidoArchivoValido: contenidoArchivoValido,
    guardarDatosProcesadosPorMaterias: guardarDatosProcesadosPorMaterias,
    verificarPersistenciaMateria: verificarPersistenciaMateria,
    registrarValidacion: registrarValidacion
  };

  NS.importarPaqueteCCC = importarPaqueteCCC;

  console.info("[BDLocalCCC.Importador] Cargado con persistencia verificada.");
})(window);
