/* =========================================================
Nombre completo: bdlocal.importador.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.importador.js
Función o funciones:
- Recibir el paquete normalizado enviado desde la carpeta subir.
- Guardar cargas ZIP, carreras, matrices, niveles, materias y archivos PEA en IndexedDB.
- Guardar datos procesados desde Excel en pea_base, pea_unidades y pea_actividades.
- Limpiar datos PEA anteriores de una materia antes de guardar una nueva importación.
- Registrar validaciones de archivos faltantes, duplicados, archivos no identificados y errores de lectura Excel.
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

  function fecha() {
    return Schema.fechaISO ? Schema.fechaISO() : new Date().toISOString();
  }

  function normalizarTexto(valor) {
    if (Schema.normalizarTexto) {
      return Schema.normalizarTexto(valor);
    }

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
    if (Schema.normalizarCodigo) {
      return Schema.normalizarCodigo(valor);
    }

    return texto(valor)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");
  }

  function slug(valor) {
    if (Schema.slug) {
      return Schema.slug(valor);
    }

    return normalizarTexto(valor)
      .replace(/\./g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || "sin_nombre";
  }

  function uid(prefijo) {
    if (Schema.uid) {
      return Schema.uid(prefijo);
    }

    return String(prefijo || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function detectarExtension(nombreArchivo) {
    var limpio = texto(nombreArchivo).toLowerCase();
    var partes = limpio.split(".");

    return partes.length > 1 ? partes.pop() : "";
  }

  function esExcel(nombreArchivo) {
    var ext = detectarExtension(nombreArchivo);

    return ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "csv";
  }

  function nombreTipo(tipo) {
    if (tipo === TIPOS_PEA.BASE) return "PEA Base";
    if (tipo === TIPOS_PEA.UNIDADES) return "PEA Unidades";
    if (tipo === TIPOS_PEA.ACTIVIDADES) return "PEA Actividades";

    return "No identificado";
  }

  function normalizarTipoArchivo(valor, nombreArchivo, rutaOriginal) {
    var valorDirecto = texto(valor);

    if (valorDirecto === TIPOS_PEA.BASE) return TIPOS_PEA.BASE;
    if (valorDirecto === TIPOS_PEA.UNIDADES) return TIPOS_PEA.UNIDADES;
    if (valorDirecto === TIPOS_PEA.ACTIVIDADES) return TIPOS_PEA.ACTIVIDADES;

    var base = normalizarTexto(
      valorDirecto + " " + texto(nombreArchivo) + " " + texto(rutaOriginal)
    );

    if (
      base.includes("pea base") ||
      base.includes("base pea") ||
      base.includes("redes base") ||
      base.includes("red base") ||
      base.includes("datos base") ||
      base.includes("base datos") ||
      base.includes("pea general") ||
      base.includes("base general") ||
      base.includes("informacion base") ||
      base.includes(" base ")
    ) {
      return TIPOS_PEA.BASE;
    }

    if (
      base.includes("pea unidades") ||
      base.includes("unidades pea") ||
      base.includes("unidad pea") ||
      base.includes("unidades logros") ||
      base.includes("pea unidades logros") ||
      base.includes("unidades de aprendizaje") ||
      base.includes("contenido por unidad") ||
      base.includes("contenidos por unidad") ||
      base.includes(" unidades ") ||
      base.includes(" unidad ") ||
      base.includes(" contenidos ") ||
      base.includes(" contenido ")
    ) {
      return TIPOS_PEA.UNIDADES;
    }

    if (
      base.includes("pea actividades") ||
      base.includes("actividades pea") ||
      base.includes("actividad pea") ||
      base.includes("actividades logros") ||
      base.includes("pea actividades logros") ||
      base.includes("plan actividades") ||
      base.includes("plan de actividades") ||
      base.includes("actividades de aprendizaje") ||
      base.includes(" actividades ") ||
      base.includes(" actividad ")
    ) {
      return TIPOS_PEA.ACTIVIDADES;
    }

    return "";
  }

  function crearIdCarrera(nombreCarrera) {
    if (Schema.crearIdCarrera) {
      return Schema.crearIdCarrera(nombreCarrera);
    }

    return "carrera_" + slug(nombreCarrera);
  }

  function crearIdMatriz(carreraId, nombreMatriz) {
    if (Schema.crearIdMatriz) {
      return Schema.crearIdMatriz(carreraId, nombreMatriz);
    }

    return "matriz_" + slug(carreraId) + "_" + slug(nombreMatriz || "matriz_ccc");
  }

  function crearIdNivel(carreraId, numeroNivel, nombreNivel) {
    if (Schema.crearIdNivel) {
      return Schema.crearIdNivel(carreraId, numeroNivel || nombreNivel);
    }

    return "nivel_" + slug(carreraId) + "_" + slug(numeroNivel || nombreNivel || "sn");
  }

  function crearIdMateria(carreraId, nivelId, codigo, nombreMateria) {
    if (Schema.crearIdMateria) {
      return Schema.crearIdMateria(carreraId, nivelId, codigo, nombreMateria);
    }

    var codigoLimpio = normalizarCodigo(codigo);

    if (codigoLimpio) {
      return "materia_" + slug(carreraId) + "_" + slug(codigoLimpio);
    }

    return "materia_" + slug(carreraId) + "_" + slug(nivelId) + "_" + slug(nombreMateria);
  }

  function crearIdArchivo(materiaId, tipoArchivo, rutaOriginal) {
    if (Schema.crearIdArchivo) {
      return Schema.crearIdArchivo(materiaId, tipoArchivo, rutaOriginal);
    }

    return "archivo_" + slug(materiaId) + "_" + slug(tipoArchivo) + "_" + slug(rutaOriginal).slice(0, 90);
  }

  async function storeExiste(storeName) {
    try {
      var db = await Core.getDB();
      return db.objectStoreNames.contains(storeName);
    } catch (error) {
      return false;
    }
  }

  async function safePut(storeName, record) {
    if (!(await storeExiste(storeName))) {
      console.warn("[BDLocalCCC.Importador] La tabla no existe:", storeName);
      return null;
    }

    return await Core.put(storeName, record);
  }

  async function safeAdd(storeName, record) {
    if (!(await storeExiste(storeName))) {
      console.warn("[BDLocalCCC.Importador] La tabla no existe:", storeName);
      return null;
    }

    return await Core.add(storeName, record);
  }

  async function safeBulkPut(storeName, records) {
    records = arr(records);

    if (!records.length) {
      return {
        storeName: storeName,
        total: 0,
        guardados: 0
      };
    }

    if (!(await storeExiste(storeName))) {
      console.warn("[BDLocalCCC.Importador] La tabla no existe:", storeName);
      return {
        storeName: storeName,
        total: records.length,
        guardados: 0,
        error: "tabla_no_existe"
      };
    }

    return await Core.bulkPut(storeName, records);
  }

  async function safeGetAllByIndex(storeName, indexName, value) {
    if (!(await storeExiste(storeName))) {
      return [];
    }

    try {
      return await Core.getAllByIndex(storeName, indexName, value);
    } catch (error) {
      console.warn("[BDLocalCCC.Importador] No se pudo consultar índice:", storeName, indexName, error);
      return [];
    }
  }

  async function safeRemove(storeName, key) {
    if (!(await storeExiste(storeName))) {
      return null;
    }

    try {
      return await Core.remove(storeName, key);
    } catch (error) {
      console.warn("[BDLocalCCC.Importador] No se pudo eliminar:", storeName, key, error);
      return null;
    }
  }

  async function logSeguro(payload) {
    try {
      if (Core.log) {
        return await Core.log(payload || {});
      }
    } catch (error) {
      console.warn("[BDLocalCCC.Importador] No se pudo guardar log:", error);
    }

    return null;
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

    var nombre = texto(data.nombre || data.carrera || data.nombreCarrera || "Carrera sin nombre");
    var id = data.id || crearIdCarrera(nombre);

    return Object.assign({}, data, {
      id: id,
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
    var id = data.id || crearIdMatriz(carreraId, nombre);

    return Object.assign({}, data, {
      id: id,
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
    var id = data.id || crearIdNivel(carreraId, numeroNivel || nombre, nombre);

    return Object.assign({}, data, {
      id: id,
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
    var nombre = texto(data.nombre || data.materia || data.nombreMateria || "Materia sin nombre");
    var id = data.id || crearIdMateria(carreraId, nivelId, codigo, nombre);

    return Object.assign({}, data, {
      id: id,
      carreraId: data.carreraId || carreraId,
      matrizId: data.matrizId || matrizId,
      nivelId: data.nivelId || nivelId,
      codigo: codigo,
      nombre: nombre,
      nombreNormalizado: normalizarTexto(nombre),
      estadoValidacion: data.estadoValidacion || ESTADOS.PENDIENTE,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: numero(data.totalArchivosEncontrados, 0),
      archivosFaltantes: arr(data.archivosFaltantes),
      archivosDuplicados: arr(data.archivosDuplicados),
      resumenValidacion: data.resumenValidacion || null,
      resumenArchivos: data.resumenArchivos || null,
      origen: data.origen || "importacion_zip",
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function limpiarArchivoParaGuardar(data) {
    data = data || {};

    var copia = Object.assign({}, data);

    delete copia.archivoOriginal;
    delete copia.file;
    delete copia.blob;
    delete copia.raw;
    delete copia.workbook;

    return copia;
  }

  function prepararArchivo(data, contexto) {
    data = limpiarArchivoParaGuardar(data);
    contexto = contexto || {};

    var nombreArchivo = texto(data.nombreArchivo || data.nombre || data.fileName || "");
    var rutaOriginal = texto(data.rutaOriginal || data.ruta || data.path || nombreArchivo);
    var tipo = normalizarTipoArchivo(data.tipo || data.tipoSugerido, nombreArchivo, rutaOriginal);
    var materiaId = data.materiaId || contexto.materiaId || "";
    var id = data.id || crearIdArchivo(materiaId || "sin_materia", tipo || "sin_tipo", rutaOriginal);

    return Object.assign({}, data, {
      id: id,
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
      errorExcel: data.errorExcel || data.errorLectura || "",
      tieneContenidoBinario: !!data.contenidoBinario,
      contenidoBinario: data.contenidoBinario || null,
      datosProcesados: data.datosProcesados || data.datos || null,
      razonesDeteccion: arr(data.razonesDeteccion),
      puntajesDeteccion: arr(data.puntajesDeteccion),
      tamanoBytes: numero(data.tamanoBytes, 0),
      creadoEn: data.creadoEn || fecha(),
      actualizadoEn: fecha()
    });
  }

  function resolverPorNombreNormalizado(lista, nombre) {
    var normalizado = normalizarTexto(nombre);
    if (!normalizado) return null;

    return arr(lista).find(function (item) {
      return item.nombreNormalizado === normalizado;
    }) || null;
  }

  function resolverCarrera(data, carreras) {
    data = data || {};
    carreras = arr(carreras);

    if (data.carreraId) {
      var porId = carreras.find(function (c) {
        return c.id === data.carreraId;
      });

      if (porId) return porId;
    }

    var nombre = data.carrera || data.nombreCarrera || data.carreraNombre || data.nombre;
    var porNombre = resolverPorNombreNormalizado(carreras, nombre);

    if (porNombre) return porNombre;
    if (carreras.length === 1) return carreras[0];

    return null;
  }

  function resolverMatriz(data, matrices, carreraId) {
    data = data || {};
    matrices = arr(matrices);

    if (data.matrizId) {
      var porId = matrices.find(function (m) {
        return m.id === data.matrizId;
      });

      if (porId) return porId;
    }

    var porCarrera = matrices.find(function (m) {
      return m.carreraId === carreraId;
    });

    if (porCarrera) return porCarrera;
    if (matrices.length === 1) return matrices[0];

    return null;
  }

  function resolverNivel(data, niveles, carreraId) {
    data = data || {};
    niveles = arr(niveles);

    if (data.nivelId) {
      var porId = niveles.find(function (n) {
        return n.id === data.nivelId;
      });

      if (porId) return porId;
    }

    var numeroNivel = numero(data.numero || data.numeroNivel || data.nivelNumero, 0);

    if (numeroNivel) {
      var porNumero = niveles.find(function (n) {
        return n.carreraId === carreraId && Number(n.numero) === numeroNivel;
      });

      if (porNumero) return porNumero;
    }

    var nombre = data.nivel || data.nombreNivel || data.nivelNombre;
    var normalizado = normalizarTexto(nombre);

    if (normalizado) {
      var porNombre = niveles.find(function (n) {
        return n.carreraId === carreraId && n.nombreNormalizado === normalizado;
      });

      if (porNombre) return porNombre;
    }

    var nivelesCarrera = niveles.filter(function (n) {
      return n.carreraId === carreraId;
    });

    if (nivelesCarrera.length === 1) return nivelesCarrera[0];

    return null;
  }

  function resolverMateria(data, materias) {
    data = data || {};
    materias = arr(materias);

    if (data.materiaId) {
      var porId = materias.find(function (m) {
        return m.id === data.materiaId;
      });

      if (porId) return porId;
    }

    var codigo = normalizarCodigo(data.codigo || data.codigoMateria || "");

    if (codigo) {
      var porCodigo = materias.find(function (m) {
        return m.codigo === codigo;
      });

      if (porCodigo) return porCodigo;
    }

    var nombre = data.materia || data.nombreMateria || data.materiaNombre || data.nombre;
    var normalizado = normalizarTexto(nombre);

    if (normalizado) {
      return materias.find(function (m) {
        return m.nombreNormalizado === normalizado;
      }) || null;
    }

    return null;
  }

  function obtenerTiposEncontrados(archivos) {
    var mapa = {};

    arr(archivos).forEach(function (archivo) {
      if (!archivo.tipo) return;

      if (!mapa[archivo.tipo]) {
        mapa[archivo.tipo] = [];
      }

      mapa[archivo.tipo].push(archivo);
    });

    return mapa;
  }

  function validarMateriaConArchivos(materia, archivos) {
    materia = materia || {};
    archivos = arr(archivos);

    var porTipo = obtenerTiposEncontrados(archivos);
    var faltantes = [];
    var duplicados = [];

    TIPOS_OBLIGATORIOS.forEach(function (tipo) {
      var encontrados = porTipo[tipo] || [];

      if (!encontrados.length) {
        faltantes.push(tipo);
      }

      if (encontrados.length > 1) {
        duplicados.push(tipo);
      }
    });

    var encontradosUnicos = TIPOS_OBLIGATORIOS.filter(function (tipo) {
      return (porTipo[tipo] || []).length > 0;
    }).length;

    var estado = ESTADOS.COMPLETO;

    if (faltantes.length) {
      estado = ESTADOS.INCOMPLETO;
    } else if (duplicados.length) {
      estado = ESTADOS.REVISION;
    }

    return Object.assign({}, materia, {
      estadoValidacion: estado,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: encontradosUnicos,
      archivosFaltantes: faltantes,
      archivosDuplicados: duplicados,
      actualizadoEn: fecha()
    });
  }

  async function registrarValidacion(payload) {
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

    return await safeAdd(Schema.STORES.VALIDACIONES, data);
  }

  async function eliminarPorIndice(storeName, indexName, value) {
    if (!(await storeExiste(storeName))) {
      return 0;
    }

    try {
      return await Core.runTransaction(storeName, "readwrite", function (stores) {
        return new Promise(function (resolve, reject) {
          var store = stores[storeName];

          if (!store.indexNames.contains(indexName)) {
            resolve(0);
            return;
          }

          var index = store.index(indexName);
          var req = index.openCursor(value);
          var eliminados = 0;

          req.onsuccess = function (event) {
            var cursor = event.target.result;

            if (!cursor) {
              resolve(eliminados);
              return;
            }

            cursor.delete();
            eliminados += 1;
            cursor.continue();
          };

          req.onerror = function () {
            reject(req.error || new Error("No se pudo eliminar por índice."));
          };
        });
      });
    } catch (error) {
      console.warn("[BDLocalCCC.Importador] Error eliminando por índice:", storeName, indexName, error);
      return 0;
    }
  }

  async function limpiarDatosPEAPorMateria(materiaId) {
    if (!materiaId) return;

    await safeRemove(Schema.STORES.PEA_BASE, materiaId);
    await eliminarPorIndice(Schema.STORES.PEA_UNIDADES, "materiaId", materiaId);
    await eliminarPorIndice(Schema.STORES.PEA_ACTIVIDADES, "materiaId", materiaId);
  }

  function seleccionarPrincipal(archivos, tipo) {
    var candidatos = arr(archivos).filter(function (archivo) {
      return archivo.tipo === tipo && archivo.datosProcesados;
    });

    if (!candidatos.length) return null;

    return candidatos.sort(function (a, b) {
      return Number(b.confianza || 0) - Number(a.confianza || 0);
    })[0];
  }

  async function guardarBaseDesdeArchivo(archivo, materia) {
    var datos = archivo.datosProcesados || {};
    var campos = datos.campos || {};
    var hojas = datos.hojas || {};

    var base = {
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
      campos: campos,
      hojas: hojas,
      datos: datos,
      totalHojas: archivo.excelResumen && archivo.excelResumen.totalHojas ? archivo.excelResumen.totalHojas : 0,
      creadoEn: fecha(),
      actualizadoEn: fecha()
    };

    await safePut(Schema.STORES.PEA_BASE, base);

    return base;
  }

  async function guardarUnidadesDesdeArchivo(archivo, materia) {
    var datos = arr(archivo.datosProcesados);

    var unidades = datos.map(function (fila, index) {
      var unidadNumero = numero(
        fila.unidadNumero ||
        fila.unidad ||
        fila.numeroUnidad ||
        fila.numero_unidad ||
        fila.n_unidad,
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
        temaDetectado: texto(fila.temaDetectado || fila.tema || fila.contenido || fila.titulo || ""),
        subtemaDetectado: texto(fila.subtemaDetectado || fila.subtema || fila.sub_tema || ""),
        resultadoDetectado: texto(fila.resultadoDetectado || fila.resultado || fila.aprendizaje || fila.logro || ""),
        creadoEn: fecha(),
        actualizadoEn: fecha()
      });
    });

    await safeBulkPut(Schema.STORES.PEA_UNIDADES, unidades);

    return unidades;
  }

  async function guardarActividadesDesdeArchivo(archivo, materia) {
    var datos = arr(archivo.datosProcesados);

    var actividades = datos.map(function (fila) {
      var unidadNumero = numero(
        fila.unidadNumero ||
        fila.unidad ||
        fila.numeroUnidad ||
        fila.numero_unidad ||
        fila.n_unidad,
        0
      );

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
        unidadNumero: unidadNumero,
        actividadDetectada: texto(fila.actividadDetectada || fila.actividad || fila.descripcion || fila.taller || fila.proyecto || ""),
        tipoActividad: texto(fila.tipoActividad || fila.tipo || fila.modalidad || fila.componente || "actividad"),
        creadoEn: fecha(),
        actualizadoEn: fecha()
      });
    });

    await safeBulkPut(Schema.STORES.PEA_ACTIVIDADES, actividades);

    return actividades;
  }

  async function guardarDatosProcesadosPorMaterias(materias, archivos) {
    var resumen = {
      basesGuardadas: 0,
      unidadesGuardadas: 0,
      actividadesGuardadas: 0,
      materiasConBase: 0,
      materiasConUnidades: 0,
      materiasConActividades: 0
    };

    for (var i = 0; i < materias.length; i += 1) {
      var materia = materias[i];

      var archivosMateria = archivos.filter(function (archivo) {
        return archivo.materiaId === materia.id;
      });

      await limpiarDatosPEAPorMateria(materia.id);

      var base = seleccionarPrincipal(archivosMateria, TIPOS_PEA.BASE);
      var unidades = seleccionarPrincipal(archivosMateria, TIPOS_PEA.UNIDADES);
      var actividades = seleccionarPrincipal(archivosMateria, TIPOS_PEA.ACTIVIDADES);

      if (base) {
        await guardarBaseDesdeArchivo(base, materia);
        resumen.basesGuardadas += 1;
        resumen.materiasConBase += 1;
      }

      if (unidades) {
        var unidadesGuardadas = await guardarUnidadesDesdeArchivo(unidades, materia);
        resumen.unidadesGuardadas += unidadesGuardadas.length;
        resumen.materiasConUnidades += 1;
      }

      if (actividades) {
        var actividadesGuardadas = await guardarActividadesDesdeArchivo(actividades, materia);
        resumen.actividadesGuardadas += actividadesGuardadas.length;
        resumen.materiasConActividades += 1;
      }
    }

    return resumen;
  }

  async function registrarValidacionesMateria(cargaId, materia, archivos) {
    var actualizada = validarMateriaConArchivos(materia, archivos);

    if (actualizada.archivosFaltantes.length) {
      await registrarValidacion({
        cargaId: cargaId,
        carreraId: materia.carreraId,
        matrizId: materia.matrizId,
        nivelId: materia.nivelId,
        materiaId: materia.id,
        tipo: "archivos_faltantes",
        severidad: SEVERIDADES.ERROR,
        mensaje: "La materia no tiene los 3 archivos PEA obligatorios.",
        detalle: {
          materia: materia.nombre,
          codigo: materia.codigo,
          faltantes: actualizada.archivosFaltantes.map(nombreTipo)
        }
      });
    }

    if (actualizada.archivosDuplicados.length) {
      await registrarValidacion({
        cargaId: cargaId,
        carreraId: materia.carreraId,
        matrizId: materia.matrizId,
        nivelId: materia.nivelId,
        materiaId: materia.id,
        tipo: "archivos_duplicados",
        severidad: SEVERIDADES.ADVERTENCIA,
        mensaje: "La materia tiene archivos PEA duplicados.",
        detalle: {
          materia: materia.nombre,
          codigo: materia.codigo,
          duplicados: actualizada.archivosDuplicados.map(nombreTipo)
        }
      });
    }

    for (var i = 0; i < archivos.length; i += 1) {
      var archivo = archivos[i];

      if (!archivo.tipo) {
        await registrarValidacion({
          cargaId: cargaId,
          carreraId: materia.carreraId,
          matrizId: materia.matrizId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          archivoId: archivo.id,
          tipo: "archivo_no_identificado",
          severidad: SEVERIDADES.ADVERTENCIA,
          mensaje: "Un archivo dentro de la materia no pudo clasificarse como PEA Base, PEA Unidades o PEA Actividades.",
          detalle: {
            archivo: archivo.nombreArchivo,
            rutaOriginal: archivo.rutaOriginal
          }
        });
      }

      if (archivo.errorExcel || archivo.errorLectura) {
        await registrarValidacion({
          cargaId: cargaId,
          carreraId: materia.carreraId,
          matrizId: materia.matrizId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          archivoId: archivo.id,
          tipo: "excel_no_leido",
          severidad: SEVERIDADES.ADVERTENCIA,
          mensaje: "Un Excel fue clasificado, pero no se pudo leer internamente.",
          detalle: {
            archivo: archivo.nombreArchivo,
            error: archivo.errorExcel || archivo.errorLectura
          }
        });
      }
    }

    return actualizada;
  }

  async function registrarValidacionesSubida(cargaId, paquete) {
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
      });
    }
  }

  async function importarCarreras(paquete) {
    var carrerasEntrada = arr(paquete.carreras);

    if (!carrerasEntrada.length) {
      carrerasEntrada = [
        {
          nombre: "Carrera no identificada"
        }
      ];
    }

    var carreras = carrerasEntrada.map(prepararCarrera);

    await safeBulkPut(Schema.STORES.CARRERAS, carreras);

    return carreras;
  }

  async function importarMatrices(paquete, carreras) {
    var matricesEntrada = arr(paquete.matrices);

    if (!matricesEntrada.length) {
      matricesEntrada = carreras.map(function (carrera) {
        return {
          carreraId: carrera.id,
          nombre: "Matriz CCC",
          tipo: "ccc"
        };
      });
    }

    var matrices = matricesEntrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras) || carreras[0];

      return prepararMatriz(item, carrera ? carrera.id : "");
    });

    await safeBulkPut(Schema.STORES.MATRICES, matrices);

    return matrices;
  }

  async function importarNiveles(paquete, carreras, matrices) {
    var nivelesEntrada = arr(paquete.niveles);

    if (!nivelesEntrada.length) {
      nivelesEntrada = [
        {
          carreraId: carreras[0] ? carreras[0].id : "",
          numero: 0,
          nombre: "Nivel no identificado"
        }
      ];
    }

    var niveles = nivelesEntrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras) || carreras[0];
      var matriz = resolverMatriz(item, matrices, carrera ? carrera.id : "");

      return prepararNivel(
        item,
        carrera ? carrera.id : "",
        matriz ? matriz.id : ""
      );
    });

    await safeBulkPut(Schema.STORES.NIVELES, niveles);

    return niveles;
  }

  async function importarMaterias(paquete, carreras, matrices, niveles) {
    var materiasEntrada = arr(paquete.materias);

    var materias = materiasEntrada.map(function (item) {
      var carrera = resolverCarrera(item, carreras) || carreras[0];
      var matriz = resolverMatriz(item, matrices, carrera ? carrera.id : "");
      var nivel = resolverNivel(item, niveles, carrera ? carrera.id : "") || niveles[0];

      return prepararMateria(
        item,
        carrera ? carrera.id : "",
        matriz ? matriz.id : "",
        nivel ? nivel.id : ""
      );
    });

    await safeBulkPut(Schema.STORES.MATERIAS, materias);

    return materias;
  }

  async function importarArchivos(paquete, cargaId, carreras, matrices, niveles, materias) {
    var archivosEntrada = arr(paquete.archivos);
    var archivos = [];

    archivosEntrada.forEach(function (item) {
      var materia = resolverMateria(item, materias);

      if (!materia && item.codigo) {
        var codigo = normalizarCodigo(item.codigo);

        materia = materias.find(function (m) {
          return m.codigo === codigo;
        });
      }

      if (!materia && materias.length === 1) {
        materia = materias[0];
      }

      var carrera = materia
        ? carreras.find(function (c) { return c.id === materia.carreraId; })
        : resolverCarrera(item, carreras) || carreras[0];

      var matriz = materia
        ? matrices.find(function (m) { return m.id === materia.matrizId; })
        : resolverMatriz(item, matrices, carrera ? carrera.id : "");

      var nivel = materia
        ? niveles.find(function (n) { return n.id === materia.nivelId; })
        : resolverNivel(item, niveles, carrera ? carrera.id : "");

      archivos.push(prepararArchivo(item, {
        cargaId: cargaId,
        carreraId: carrera ? carrera.id : "",
        matrizId: matriz ? matriz.id : "",
        nivelId: nivel ? nivel.id : "",
        materiaId: materia ? materia.id : ""
      }));
    });

    await safeBulkPut(Schema.STORES.PEA_ARCHIVOS, archivos);

    return archivos;
  }

  async function actualizarEstadosMaterias(cargaId, materias, archivos) {
    var actualizadas = [];

    for (var i = 0; i < materias.length; i += 1) {
      var materia = materias[i];

      var archivosMateria = archivos.filter(function (archivo) {
        return archivo.materiaId === materia.id;
      });

      var actualizada = await registrarValidacionesMateria(cargaId, materia, archivosMateria);

      await safePut(Schema.STORES.MATERIAS, actualizada);
      actualizadas.push(actualizada);
    }

    return actualizadas;
  }

  function construirResumen(carreras, niveles, materias, archivos, validaciones, resumenExcel) {
    var completas = materias.filter(function (m) {
      return m.estadoValidacion === ESTADOS.COMPLETO;
    }).length;

    var incompletas = materias.filter(function (m) {
      return m.estadoValidacion === ESTADOS.INCOMPLETO;
    }).length;

    var revision = materias.filter(function (m) {
      return m.estadoValidacion === ESTADOS.REVISION;
    }).length;

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
      excelLeidos: archivos.filter(function (a) { return a.excelLeido === true; }).length,
      excelConError: archivos.filter(function (a) { return !!(a.errorExcel || a.errorLectura); }).length,
      validacionesGeneradas: validaciones.length,
      peaBaseGuardados: resumenExcel ? resumenExcel.basesGuardadas : 0,
      peaUnidadesGuardadas: resumenExcel ? resumenExcel.unidadesGuardadas : 0,
      peaActividadesGuardadas: resumenExcel ? resumenExcel.actividadesGuardadas : 0
    };
  }

  async function importarPaqueteCCC(paqueteNormalizado) {
    await Core.ready();

    if (!paqueteNormalizado || typeof paqueteNormalizado !== "object") {
      throw new Error("No se recibió un paquete válido para importar.");
    }

    var carga = crearCargaInicial(paqueteNormalizado);
    var cargaId = await safeAdd(Schema.STORES.CARGAS_ZIP, carga);

    if (cargaId === null || typeof cargaId === "undefined") {
      throw new Error("No se pudo crear el registro de carga ZIP. Revisa bdlocal.schema.js y bdlocal.core.js.");
    }

    await logSeguro({
      cargaId: cargaId,
      tipo: "importacion",
      nivel: "info",
      mensaje: "Inicio de importación CCC."
    });

    try {
      await registrarValidacionesSubida(cargaId, paqueteNormalizado);

      var carreras = await importarCarreras(paqueteNormalizado);
      var matrices = await importarMatrices(paqueteNormalizado, carreras);
      var niveles = await importarNiveles(paqueteNormalizado, carreras, matrices);
      var materias = await importarMaterias(paqueteNormalizado, carreras, matrices, niveles);
      var archivos = await importarArchivos(paqueteNormalizado, cargaId, carreras, matrices, niveles, materias);
      var resumenExcel = await guardarDatosProcesadosPorMaterias(materias, archivos);
      var materiasActualizadas = await actualizarEstadosMaterias(cargaId, materias, archivos);
      var validaciones = await safeGetAllByIndex(Schema.STORES.VALIDACIONES, "cargaId", cargaId);

      var resumen = construirResumen(
        carreras,
        niveles,
        materiasActualizadas,
        archivos,
        validaciones,
        resumenExcel
      );

      var cargaFinal = Object.assign({}, carga, {
        id: cargaId,
        estado: "completado",
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

      await safePut(Schema.STORES.CARGAS_ZIP, cargaFinal);

      await logSeguro({
        cargaId: cargaId,
        tipo: "importacion",
        nivel: "info",
        mensaje: "Importación CCC completada.",
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
        resumenExcel: resumenExcel
      };
    } catch (error) {
      await safePut(Schema.STORES.CARGAS_ZIP, Object.assign({}, carga, {
        id: cargaId,
        estado: "error",
        error: error.message,
        actualizadoEn: fecha()
      }));

      await logSeguro({
        cargaId: cargaId,
        tipo: "importacion",
        nivel: "error",
        mensaje: "Error durante la importación CCC.",
        detalle: {
          error: error.message,
          stack: error.stack || ""
        }
      });

      throw error;
    }
  }

  NS.Importador = {
    importarPaqueteCCC: importarPaqueteCCC,
    normalizarTipoArchivo: normalizarTipoArchivo,
    validarMateriaConArchivos: validarMateriaConArchivos,
    guardarDatosProcesadosPorMaterias: guardarDatosProcesadosPorMaterias,
    registrarValidacion: registrarValidacion
  };

  NS.importarPaqueteCCC = importarPaqueteCCC;

  console.info("[BDLocalCCC.Importador] Cargado correctamente.");
})(window);