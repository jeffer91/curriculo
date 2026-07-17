/* =========================================================
Nombre completo: subir.validador.js
Ruta o ubicación: /Curriculo/subir/subir.validador.js
Funciones:
- Validar estructura, lectura y contenido real de los tres PEA por materia.
- Impedir que un archivo presente pero vacío cuente como PEA válido.
- Registrar faltantes, duplicados, errores, contenido vacío y observaciones.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var N = NS.Normalizador || null;
  var TIPOS = {
    BASE: "pea_base",
    UNIDADES: "pea_unidades",
    ACTIVIDADES: "pea_actividades"
  };
  var TIPOS_OBLIGATORIOS = [TIPOS.BASE, TIPOS.UNIDADES, TIPOS.ACTIVIDADES];

  function fechaISO() { return new Date().toISOString(); }
  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }
  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    return valor === null || typeof valor === "undefined" ? [] : [valor];
  }
  function esObjeto(valor) {
    return !!valor && typeof valor === "object" && !Array.isArray(valor);
  }
  function normalizadorDisponible() {
    if (!N && NS.Normalizador) N = NS.Normalizador;
    if (!N) throw new Error("Falta cargar primero subir.normalizador.js.");
    return N;
  }
  function nombreTipo(tipo) {
    if (tipo === TIPOS.BASE) return "PEA Base";
    if (tipo === TIPOS.UNIDADES) return "PEA Unidades";
    if (tipo === TIPOS.ACTIVIDADES) return "PEA Actividades";
    return "No identificado";
  }
  function crearValidacion(data) {
    return Object.assign({
      id: "val_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
      tipo: "general",
      severidad: "info",
      bloqueaImportacion: false,
      mensaje: "",
      detalle: null,
      creadoEn: fechaISO()
    }, data || {});
  }

  function agrupar(archivos, campo, defecto) {
    var mapa = {};
    arr(archivos).forEach(function (archivo) {
      var clave = archivo[campo] || defecto || "";
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(archivo);
    });
    return mapa;
  }
  function agruparArchivosPorMateria(archivos) {
    return agrupar(archivos, "materiaId", "sin_materia");
  }
  function agruparArchivosPorTipo(archivos) {
    return agrupar(archivos, "tipo", "");
  }

  function tieneValor(valor) {
    if (Array.isArray(valor)) return valor.some(tieneValor);
    if (esObjeto(valor)) {
      return Object.keys(valor).some(function (clave) { return tieneValor(valor[clave]); });
    }
    return texto(valor) !== "";
  }
  function contarCamposConValor(objeto) {
    if (!esObjeto(objeto)) return 0;
    return Object.keys(objeto).filter(function (clave) {
      return tieneValor(objeto[clave]);
    }).length;
  }
  function obtenerPrimerValor(objeto, claves) {
    objeto = esObjeto(objeto) ? objeto : {};
    for (var i = 0; i < claves.length; i += 1) {
      var valor = texto(objeto[claves[i]]);
      if (valor) return valor;
    }
    return "";
  }
  function filaTieneContenido(fila) {
    return esObjeto(fila) && Object.keys(fila).some(function (clave) {
      return tieneValor(fila[clave]);
    });
  }

  function evaluarContenidoBase(datos) {
    datos = esObjeto(datos) ? datos : {};
    var campos = esObjeto(datos.campos) ? datos.campos : {};
    var hojas = esObjeto(datos.hojas) ? datos.hojas : {};
    var descripcion = texto(datos.descripcion) || obtenerPrimerValor(campos, [
      "descripcion_asignatura", "descripcionAsignatura", "descripcion",
      "descripcion_de_la_asignatura"
    ]);
    var objetivo = texto(datos.objetivo) || obtenerPrimerValor(campos, [
      "objetivo_asignatura", "objetivoAsignatura", "objetivo",
      "objetivo_de_la_asignatura"
    ]);
    var detalle = {
      tieneDescripcion: !!descripcion,
      tieneObjetivo: !!objetivo,
      camposConValor: contarCamposConValor(campos),
      filasConContenido: arr(datos.filas).filter(filaTieneContenido).length,
      unidadesBase: arr(datos.unidadesBase).filter(tieneValor).length,
      bibliografia: arr(datos.bibliografia).filter(tieneValor).length,
      hojasConContenido: Object.keys(hojas).filter(function (nombre) {
        var hoja = hojas[nombre] || {};
        return Number(hoja.totalFilas || 0) > 0 ||
          contarCamposConValor(hoja.campos) > 0 ||
          arr(hoja.filas).some(filaTieneContenido);
      }).length
    };
    var valido = !!(
      descripcion || objetivo || detalle.camposConValor || detalle.filasConContenido ||
      detalle.unidadesBase || detalle.bibliografia || detalle.hojasConContenido
    );
    var observaciones = [];
    if (valido && !descripcion) observaciones.push("No se identificó la descripción de la asignatura.");
    if (valido && !objetivo) observaciones.push("No se identificó el objetivo de la asignatura.");
    return { valido: valido, observaciones: observaciones, detalle: detalle };
  }

  function evaluarContenidoUnidades(datos) {
    var registros = Array.isArray(datos) ? datos : arr(esObjeto(datos) ? datos.unidades : []);
    var validos = registros.filter(function (unidad) {
      if (!esObjeto(unidad)) return false;
      var contenidos = arr(unidad.contenidos).filter(function (item) { return texto(item); });
      return contenidos.length > 0 || !!texto(
        unidad.temaDetectado || unidad.tema || unidad.contenido || unidad.titulo ||
        unidad.resultadoDetectado || unidad.resultadoAprendizaje || unidad.competencia
      );
    });
    return {
      valido: validos.length > 0,
      observaciones: [],
      detalle: { totalRegistros: registros.length, unidadesValidas: validos.length }
    };
  }

  function evaluarContenidoActividades(datos) {
    var registros = Array.isArray(datos) ? datos : arr(esObjeto(datos) ? datos.actividades : []);
    var validos = registros.filter(function (actividad) {
      return esObjeto(actividad) && !!texto(
        actividad.actividadDetectada || actividad.actividad || actividad.descripcion ||
        actividad.tema || actividad.titulo || actividad.contenido ||
        actividad.taller || actividad.proyecto
      );
    });
    return {
      valido: validos.length > 0,
      observaciones: [],
      detalle: { totalRegistros: registros.length, actividadesValidas: validos.length }
    };
  }

  function evaluarContenidoPorTipo(tipo, datos) {
    if (tipo === TIPOS.BASE) return evaluarContenidoBase(datos);
    if (tipo === TIPOS.UNIDADES) return evaluarContenidoUnidades(datos);
    if (tipo === TIPOS.ACTIVIDADES) return evaluarContenidoActividades(datos);
    return { valido: tieneValor(datos), observaciones: [], detalle: null };
  }

  function evaluarArchivo(archivo) {
    archivo = archivo || {};
    var error = texto(archivo.errorExcel || archivo.errorLectura);
    var leido = archivo.excelLeido === true;
    var tieneDatos = archivo.datosProcesados !== null &&
      typeof archivo.datosProcesados !== "undefined";
    var contenido = tieneDatos
      ? evaluarContenidoPorTipo(archivo.tipo, archivo.datosProcesados)
      : { valido: false, observaciones: [], detalle: null };
    return {
      archivoId: archivo.id || "",
      nombreArchivo: archivo.nombreArchivo || "",
      tipo: archivo.tipo || "",
      esExcel: archivo.esExcel !== false,
      leido: leido,
      error: error,
      tieneDatosProcesados: tieneDatos,
      contenidoValido: leido && !error && contenido.valido === true,
      observacionesContenido: contenido.observaciones || [],
      detalleContenido: contenido.detalle || null,
      archivo: archivo
    };
  }

  function evaluarMateria(materia, archivosMateria) {
    archivosMateria = arr(archivosMateria);
    var porTipo = agruparArchivosPorTipo(archivosMateria);
    var resultados = archivosMateria.map(evaluarArchivo);
    var salida = {
      materiaId: materia.id,
      codigo: materia.codigo || "",
      materia: materia.nombre || "",
      estado: "completo",
      totalArchivos: archivosMateria.length,
      totalArchivosEsperados: 3,
      totalArchivosDetectados: 0,
      totalArchivosEncontrados: 0,
      totalArchivosValidos: 0,
      faltantes: [],
      tiposSinContenido: [],
      duplicados: [],
      bajaConfianza: [],
      noIdentificados: [],
      noExcel: [],
      erroresLectura: [],
      noLeidos: [],
      contenidoVacio: [],
      observacionesContenido: [],
      resultadosArchivos: resultados
    };
    var tiposValidos = {};

    TIPOS_OBLIGATORIOS.forEach(function (tipo) {
      var archivosTipo = porTipo[tipo] || [];
      var validos = resultados.filter(function (resultado) {
        return resultado.tipo === tipo && resultado.contenidoValido;
      });
      tiposValidos[tipo] = validos.length > 0;
      if (archivosTipo.length) salida.totalArchivosDetectados += 1;
      if (validos.length) salida.totalArchivosValidos += 1;
      if (!archivosTipo.length) salida.faltantes.push(tipo);
      else if (!validos.length) salida.tiposSinContenido.push(tipo);
      if (archivosTipo.length > 1) {
        salida.duplicados.push({
          tipo: tipo,
          cantidad: archivosTipo.length,
          archivos: archivosTipo.map(function (archivo) { return archivo.nombreArchivo; })
        });
      }
    });
    salida.totalArchivosEncontrados = salida.totalArchivosValidos;

    resultados.forEach(function (resultado) {
      var archivo = resultado.archivo;
      if (!resultado.tipo) salida.noIdentificados.push(archivo);
      if (!resultado.esExcel || archivo.estado === "no_excel") salida.noExcel.push(archivo);
      if (resultado.error) salida.erroresLectura.push(archivo);
      else if (resultado.esExcel && !resultado.leido) salida.noLeidos.push(archivo);
      if (
        TIPOS_OBLIGATORIOS.indexOf(resultado.tipo) !== -1 &&
        resultado.leido && !resultado.error && !resultado.contenidoValido
      ) salida.contenidoVacio.push(archivo);
      if (resultado.observacionesContenido.length) {
        salida.observacionesContenido.push({
          archivoId: resultado.archivoId,
          nombreArchivo: resultado.nombreArchivo,
          tipo: resultado.tipo,
          observaciones: resultado.observacionesContenido,
          detalle: resultado.detalleContenido
        });
      }
      if (typeof archivo.confianza === "number" && archivo.confianza > 0 && archivo.confianza < 70) {
        salida.bajaConfianza.push(archivo);
      }
    });

    salida.tieneBase = tiposValidos[TIPOS.BASE] === true;
    salida.tieneUnidades = tiposValidos[TIPOS.UNIDADES] === true;
    salida.tieneActividades = tiposValidos[TIPOS.ACTIVIDADES] === true;
    salida.tieneArchivoBase = (porTipo[TIPOS.BASE] || []).length > 0;
    salida.tieneArchivoUnidades = (porTipo[TIPOS.UNIDADES] || []).length > 0;
    salida.tieneArchivoActividades = (porTipo[TIPOS.ACTIVIDADES] || []).length > 0;

    if (salida.faltantes.length || salida.tiposSinContenido.length) salida.estado = "incompleto";
    else if (
      salida.duplicados.length || salida.noIdentificados.length || salida.noExcel.length ||
      salida.erroresLectura.length || salida.noLeidos.length ||
      salida.contenidoVacio.length || salida.observacionesContenido.length
    ) salida.estado = "revision";
    return salida;
  }

  function validarEstructuraMinima(paquete, validaciones) {
    [
      ["carreras", "sin_carreras", "No se detectaron carreras dentro de MATRIZ CCC."],
      ["niveles", "sin_niveles", "No se detectaron niveles dentro de MATRIZ CCC."],
      ["materias", "sin_materias", "No se detectaron materias dentro de MATRIZ CCC / NIVEL."],
      ["archivos", "sin_archivos_curriculares", "No se detectaron archivos Excel curriculares dentro de MATRIZ CCC / NIVEL / MATERIA."]
    ].forEach(function (regla) {
      if (!arr(paquete[regla[0]]).length) {
        validaciones.push(crearValidacion({
          tipo: regla[1], severidad: "critico", bloqueaImportacion: true, mensaje: regla[2]
        }));
      }
    });
  }

  function validarConfianzaEstructura(paquete, validaciones) {
    arr(paquete.carreras).forEach(function (carrera) {
      if (typeof carrera.confianza === "number" && carrera.confianza < 70) {
        validaciones.push(crearValidacion({
          tipo: "carrera_baja_confianza", severidad: "advertencia",
          mensaje: "Una carrera fue detectada con baja confianza.",
          carreraId: carrera.id,
          detalle: { carrera: carrera.nombre, confianza: carrera.confianza }
        }));
      }
    });
    arr(paquete.niveles).forEach(function (nivel) {
      if (typeof nivel.confianza === "number" && nivel.confianza < 70) {
        validaciones.push(crearValidacion({
          tipo: "nivel_baja_confianza", severidad: "advertencia",
          mensaje: "Un nivel fue detectado con baja confianza.",
          carreraId: nivel.carreraId, nivelId: nivel.id,
          detalle: { nivel: nivel.nombre, confianza: nivel.confianza }
        }));
      }
    });
  }

  function fusionarAdvertenciasComoValidaciones(paquete, validaciones) {
    var regeneradasPorMateria = {
      materia_incompleta: true,
      archivos_duplicados: true,
      archivos_no_identificados: true,
      excel_con_error_lectura: true,
      excel_no_leido: true
    };

    arr(paquete.advertencias).forEach(function (advertencia) {
      if (
        advertencia.tipo === "archivos_baja_confianza" ||
        regeneradasPorMateria[advertencia.tipo]
      ) return;

      validaciones.push(crearValidacion({
        tipo: advertencia.tipo || "advertencia_previa",
        severidad: advertencia.severidad || "advertencia",
        bloqueaImportacion: advertencia.bloqueaImportacion === true ||
          advertencia.severidad === "critico",
        mensaje: advertencia.mensaje || "Advertencia detectada durante la lectura del ZIP.",
        carreraId: advertencia.carreraId || "",
        nivelId: advertencia.nivelId || "",
        materiaId: advertencia.materiaId || "",
        detalle: advertencia
      }));
    });
  }

  function validarControlLecturaGlobal(paquete, validaciones) {
    var control = paquete && paquete.diagnosticoExcel
      ? paquete.diagnosticoExcel.controlLectura || {}
      : {};
    if (control.bloqueaImportacion !== true) return;
    var existe = validaciones.some(function (item) {
      return item.tipo === "lectura_excel_total_fallida";
    });
    if (!existe) {
      validaciones.push(crearValidacion({
        tipo: "lectura_excel_total_fallida", severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "La lectura general de los Excel no produjo contenido curricular importable.",
        detalle: control
      }));
    }
  }

  function detalleArchivos(archivos, estado, motivo) {
    return arr(archivos).map(function (archivo) {
      return {
        archivoId: archivo.id || "",
        nombreArchivo: archivo.nombreArchivo || "",
        tipo: nombreTipo(archivo.tipo),
        tipoCodigo: archivo.tipo || "",
        rutaOriginal: archivo.rutaOriginal || "",
        estado: estado || (archivo.excelLeido === true ? "leido" : "no_leido"),
        motivo: motivo || "",
        excelLeido: archivo.excelLeido === true,
        error: archivo.errorExcel || archivo.errorLectura || ""
      };
    });
  }

  function validarMaterias(paquete, validaciones) {
    var porMateria = agruparArchivosPorMateria(paquete.archivos);
    return arr(paquete.materias).map(function (materia) {
      var evaluacion = evaluarMateria(materia, porMateria[materia.id] || []);
      var carrera = arr(paquete.carreras).find(function (item) {
        return item.id === materia.carreraId;
      }) || {};
      var nivel = arr(paquete.niveles).find(function (item) {
        return item.id === materia.nivelId;
      }) || {};
      var base = {
        carreraId: materia.carreraId,
        nivelId: materia.nivelId,
        materiaId: materia.id,
        carrera: carrera.nombre || "",
        nivel: nivel.nombre || "",
        codigoMateria: materia.codigo || "",
        materia: materia.nombre || ""
      };
      function agregar(data) {
        validaciones.push(crearValidacion(Object.assign({}, base, data)));
      }

      if (evaluacion.faltantes.length) agregar({
        tipo: "materia_incompleta", severidad: "error",
        mensaje: "La materia no tiene los 3 Excel PEA obligatorios.",
        detalle: { codigo: materia.codigo, materia: materia.nombre, faltantes: evaluacion.faltantes.map(nombreTipo) }
      });
      if (evaluacion.tiposSinContenido.length) agregar({
        tipo: "contenido_pea_invalido", severidad: "error",
        mensaje: "La materia tiene archivos PEA presentes, pero sin contenido curricular válido.",
        detalle: { codigo: materia.codigo, materia: materia.nombre, tiposSinContenido: evaluacion.tiposSinContenido.map(nombreTipo) }
      });
      if (evaluacion.duplicados.length) agregar({
        tipo: "archivos_duplicados", severidad: "advertencia",
        mensaje: "La materia tiene archivos duplicados para un mismo tipo PEA.",
        detalle: evaluacion.duplicados.map(function (item) {
          return { tipo: nombreTipo(item.tipo), cantidad: item.cantidad, archivos: item.archivos };
        })
      });
      if (evaluacion.noIdentificados.length) agregar({
        tipo: "archivos_no_identificados", severidad: "advertencia",
        mensaje: "Hay archivos dentro de una materia que no pudieron clasificarse automáticamente.",
        detalle: detalleArchivos(
          evaluacion.noIdentificados,
          "no_identificado",
          "No se pudo determinar si corresponde a PEA Base, Unidades o Actividades."
        )
      });
      if (evaluacion.erroresLectura.length) agregar({
        tipo: "error_lectura_excel", severidad: "error",
        mensaje: "Hay Excel clasificados que no pudieron leerse internamente.",
        detalle: detalleArchivos(
          evaluacion.erroresLectura,
          "error_lectura",
          "El lector de Excel devolvió un error al abrir el archivo."
        )
      });
      if (evaluacion.noLeidos.length) agregar({
        tipo: "excel_no_procesado", severidad: "error",
        mensaje: "Hay Excel curriculares detectados que no quedaron marcados como leídos.",
        detalle: detalleArchivos(
          evaluacion.noLeidos,
          "no_leido",
          "El archivo fue detectado dentro del ZIP, pero no fue procesado."
        )
      });
      if (evaluacion.contenidoVacio.length) agregar({
        tipo: "excel_sin_contenido_curricular", severidad: "error",
        mensaje: "Hay Excel leídos que no produjeron registros curriculares útiles.",
        detalle: detalleArchivos(
          evaluacion.contenidoVacio,
          "sin_contenido_curricular",
          "El archivo se abrió, pero no contiene registros curriculares reconocibles."
        )
      });
      if (evaluacion.observacionesContenido.length) agregar({
        tipo: "contenido_base_incompleto", severidad: "advertencia",
        mensaje: "El PEA Base tiene contenido, pero faltan campos curriculares relevantes.",
        detalle: evaluacion.observacionesContenido
      });
      return evaluacion;
    });
  }

  function actualizarMaterias(paquete, evaluaciones) {
    var mapa = {};
    evaluaciones.forEach(function (item) { mapa[item.materiaId] = item; });
    return arr(paquete.materias).map(function (materia) {
      var e = mapa[materia.id];
      if (!e) return materia;
      return Object.assign({}, materia, {
        estadoValidacion: e.estado,
        totalArchivosEsperados: e.totalArchivosEsperados,
        totalArchivosDetectados: e.totalArchivosDetectados,
        totalArchivosEncontrados: e.totalArchivosEncontrados,
        totalArchivosValidos: e.totalArchivosValidos,
        archivosFaltantes: e.faltantes,
        archivosSinContenido: e.tiposSinContenido,
        archivosDuplicados: e.duplicados.map(function (item) { return item.tipo; }),
        resumenValidacion: {
          tieneBase: e.tieneBase,
          tieneUnidades: e.tieneUnidades,
          tieneActividades: e.tieneActividades,
          tieneArchivoBase: e.tieneArchivoBase,
          tieneArchivoUnidades: e.tieneArchivoUnidades,
          tieneArchivoActividades: e.tieneArchivoActividades,
          noIdentificados: e.noIdentificados.length,
          bajaConfianza: e.bajaConfianza.length,
          erroresLectura: e.erroresLectura.length,
          noLeidos: e.noLeidos.length,
          contenidoVacio: e.contenidoVacio.length,
          observacionesContenido: e.observacionesContenido.length
        },
        actualizadoEn: fechaISO()
      });
    });
  }

  function construirResumen(paquete, evaluaciones, validaciones) {
    var archivos = arr(paquete.archivos);
    var completas = evaluaciones.filter(function (e) { return e.estado === "completo"; }).length;
    var incompletas = evaluaciones.filter(function (e) { return e.estado === "incompleto"; }).length;
    var revision = evaluaciones.filter(function (e) { return e.estado === "revision"; }).length;
    var criticas = validaciones.filter(function (v) { return v.severidad === "critico"; }).length;
    var errores = validaciones.filter(function (v) { return v.severidad === "error"; }).length;
    var advertencias = validaciones.filter(function (v) { return v.severidad === "advertencia"; }).length;
    var bloquea = validaciones.some(function (v) { return v.bloqueaImportacion === true; });
    var requiereRevision = errores > 0 || advertencias > 0 || incompletas > 0 || revision > 0;
    return {
      generadoEn: fechaISO(),
      totalCarreras: arr(paquete.carreras).length,
      totalNiveles: arr(paquete.niveles).length,
      totalMaterias: arr(paquete.materias).length,
      totalArchivos: archivos.length,
      totalExcel: archivos.filter(function (a) { return a.esExcel !== false; }).length,
      totalExcelLeidos: archivos.filter(function (a) {
        return a.excelLeido === true && !a.errorExcel && !a.errorLectura;
      }).length,
      totalExcelValidos: evaluaciones.reduce(function (total, e) {
        return total + Number(e.totalArchivosValidos || 0);
      }, 0),
      materiasCompletas: completas,
      materiasIncompletas: incompletas,
      materiasRevision: revision,
      validacionesCriticas: criticas,
      validacionesError: errores,
      validacionesAdvertencia: advertencias,
      totalValidaciones: validaciones.length,
      bloqueaImportacion: bloquea,
      listoParaImportar: !bloquea && !requiereRevision,
      puedeImportarConObservaciones: !bloquea,
      requiereRevision: requiereRevision
    };
  }

  function validarPaquete(paquete, opciones) {
    opciones = opciones || {};
    normalizadorDisponible();
    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para validar.");
    }

    var validaciones = [];
    validarEstructuraMinima(paquete, validaciones);
    validarConfianzaEstructura(paquete, validaciones);
    fusionarAdvertenciasComoValidaciones(paquete, validaciones);
    validarControlLecturaGlobal(paquete, validaciones);

    var evaluaciones = validarMaterias(paquete, validaciones);
    var materias = actualizarMaterias(paquete, evaluaciones);
    var resumen = construirResumen(
      Object.assign({}, paquete, { materias: materias }), evaluaciones, validaciones
    );
    var actualizado = Object.assign({}, paquete, {
      materias: materias,
      validacionesSubida: validaciones,
      evaluacionesMaterias: evaluaciones,
      resumenValidacion: resumen,
      validadoEn: fechaISO()
    });
    actualizado.carga = Object.assign({}, actualizado.carga || {}, {
      estado: resumen.bloqueaImportacion
        ? "bloqueado"
        : (resumen.listoParaImportar ? "validado" : "con_observaciones"),
      totalCarreras: resumen.totalCarreras,
      totalNiveles: resumen.totalNiveles,
      totalMaterias: resumen.totalMaterias,
      totalArchivos: resumen.totalArchivos,
      materiasCompletas: resumen.materiasCompletas,
      materiasIncompletas: resumen.materiasIncompletas,
      materiasRevision: resumen.materiasRevision,
      actualizadoEn: fechaISO()
    });
    if (opciones.lanzarSiBloquea === true && resumen.bloqueaImportacion) {
      throw new Error("El paquete tiene errores críticos y no puede importarse.");
    }
    return actualizado;
  }

  function obtenerResumenVisual(paqueteValidado) {
    var r = paqueteValidado && paqueteValidado.resumenValidacion
      ? paqueteValidado.resumenValidacion
      : construirResumen(paqueteValidado || {}, [], []);
    var titulo = r.bloqueaImportacion
      ? "ZIP no importable"
      : (r.requiereRevision ? "ZIP requiere revisión" : "ZIP listo para importar");
    return {
      titulo: titulo,
      estado: r.bloqueaImportacion ? "error" : (r.requiereRevision ? "revision" : "ok"),
      totalCarreras: r.totalCarreras,
      totalNiveles: r.totalNiveles,
      totalMaterias: r.totalMaterias,
      totalArchivos: r.totalArchivos,
      totalExcelLeidos: r.totalExcelLeidos,
      totalExcelValidos: r.totalExcelValidos,
      materiasCompletas: r.materiasCompletas,
      materiasIncompletas: r.materiasIncompletas,
      materiasRevision: r.materiasRevision,
      totalValidaciones: r.totalValidaciones,
      requiereRevision: r.requiereRevision,
      bloqueaImportacion: r.bloqueaImportacion
    };
  }

  function esImportable(paqueteValidado) {
    return !!(
      paqueteValidado && paqueteValidado.resumenValidacion &&
      paqueteValidado.resumenValidacion.listoParaImportar === true
    );
  }
  function obtenerValidacionesPorSeveridad(paqueteValidado, severidad) {
    return arr(paqueteValidado && paqueteValidado.validacionesSubida).filter(function (item) {
      return item.severidad === severidad;
    });
  }

  NS.Validador = {
    TIPOS: TIPOS,
    TIPOS_OBLIGATORIOS: TIPOS_OBLIGATORIOS,
    nombreTipo: nombreTipo,
    evaluarArchivo: evaluarArchivo,
    evaluarMateria: evaluarMateria,
    validarPaquete: validarPaquete,
    obtenerResumenVisual: obtenerResumenVisual,
    esImportable: esImportable,
    obtenerValidacionesPorSeveridad: obtenerValidacionesPorSeveridad,
    agruparArchivosPorMateria: agruparArchivosPorMateria
  };
})(window);
