/* =========================================================
Nombre completo: bdlocal.validaciones.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.validaciones.js
Función o funciones:
- Validar que cada materia tenga PEA Base, PEA Unidades y PEA Actividades.
- Detectar archivos faltantes, duplicados, no identificados o con baja confianza.
- Recalcular el estado de una materia después de una importación o corrección manual.
- Guardar validaciones consultables por futuras pantallas.
- Exponer funciones de diagnóstico de calidad de la base local CCC.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;
  var Core = NS.Core;

  if (!Schema) {
    console.error("[BDLocalCCC.Validaciones] Falta cargar primero bdlocal.schema.js");
    return;
  }

  if (!Core) {
    console.error("[BDLocalCCC.Validaciones] Falta cargar primero bdlocal.core.js");
    return;
  }

  var TIPOS_OBLIGATORIOS = [
    Schema.TIPOS_PEA.BASE,
    Schema.TIPOS_PEA.UNIDADES,
    Schema.TIPOS_PEA.ACTIVIDADES
  ];

  function fecha() {
    return Schema.fechaISO();
  }

  function nombreTipo(tipo) {
    if (tipo === Schema.TIPOS_PEA.BASE) return "PEA Base";
    if (tipo === Schema.TIPOS_PEA.UNIDADES) return "PEA Unidades";
    if (tipo === Schema.TIPOS_PEA.ACTIVIDADES) return "PEA Actividades";
    return tipo || "No identificado";
  }

  function agruparArchivosPorTipo(archivos) {
    var grupos = {};

    archivos.forEach(function (archivo) {
      var tipo = archivo.tipo || "";

      if (!grupos[tipo]) {
        grupos[tipo] = [];
      }

      grupos[tipo].push(archivo);
    });

    return grupos;
  }

  function evaluarArchivosMateria(archivos) {
    archivos = Array.isArray(archivos) ? archivos : [];

    var grupos = agruparArchivosPorTipo(archivos);
    var faltantes = [];
    var duplicados = [];
    var bajaConfianza = [];
    var noIdentificados = [];
    var noExcel = [];

    TIPOS_OBLIGATORIOS.forEach(function (tipo) {
      var encontrados = grupos[tipo] || [];

      if (!encontrados.length) {
        faltantes.push(tipo);
      }

      if (encontrados.length > 1) {
        duplicados.push({
          tipo: tipo,
          cantidad: encontrados.length,
          archivos: encontrados.map(function (archivo) {
            return archivo.nombreArchivo;
          })
        });
      }
    });

    archivos.forEach(function (archivo) {
      if (!archivo.tipo) {
        noIdentificados.push(archivo);
      }

      if (typeof archivo.confianza === "number" && archivo.confianza > 0 && archivo.confianza < 70) {
        bajaConfianza.push(archivo);
      }

      if (archivo.extension && ["xlsx", "xls", "xlsm", "csv"].indexOf(String(archivo.extension).toLowerCase()) === -1) {
        noExcel.push(archivo);
      }
    });

    var tiposEncontrados = TIPOS_OBLIGATORIOS.filter(function (tipo) {
      return (grupos[tipo] || []).length > 0;
    });

    var estado = Schema.ESTADOS_VALIDACION.COMPLETO;

    if (faltantes.length) {
      estado = Schema.ESTADOS_VALIDACION.INCOMPLETO;
    } else if (duplicados.length || bajaConfianza.length || noIdentificados.length || noExcel.length) {
      estado = Schema.ESTADOS_VALIDACION.REVISION;
    }

    return {
      estado: estado,
      totalArchivosEsperados: TIPOS_OBLIGATORIOS.length,
      totalArchivosEncontrados: tiposEncontrados.length,
      faltantes: faltantes,
      duplicados: duplicados,
      bajaConfianza: bajaConfianza,
      noIdentificados: noIdentificados,
      noExcel: noExcel,
      tiposEncontrados: tiposEncontrados
    };
  }

  function crearValidacionBase(materia, tipo, severidad, mensaje, detalle) {
    return {
      cargaId: detalle && detalle.cargaId ? detalle.cargaId : null,
      carreraId: materia && materia.carreraId ? materia.carreraId : "",
      nivelId: materia && materia.nivelId ? materia.nivelId : "",
      materiaId: materia && materia.id ? materia.id : "",
      tipo: tipo,
      severidad: severidad,
      estado: "activo",
      mensaje: mensaje,
      detalle: detalle || null,
      creadoEn: fecha()
    };
  }

  async function guardarValidacion(validacion) {
    return await Core.add(Schema.STORES.VALIDACIONES, validacion);
  }

  async function guardarValidaciones(validaciones) {
    validaciones = Array.isArray(validaciones) ? validaciones : [];

    if (!validaciones.length) {
      return {
        total: 0,
        guardadas: 0
      };
    }

    var resultado = await Core.bulkAdd(Schema.STORES.VALIDACIONES, validaciones);

    return {
      total: resultado.total,
      guardadas: resultado.guardados
    };
  }

  function construirValidacionesMateria(materia, archivos, evaluacion, cargaId) {
    var validaciones = [];

    if (evaluacion.faltantes.length) {
      validaciones.push(crearValidacionBase(
        materia,
        "archivos_faltantes",
        Schema.SEVERIDADES.ERROR,
        "Faltan archivos obligatorios en la materia.",
        {
          cargaId: cargaId || null,
          codigo: materia.codigo,
          materia: materia.nombre,
          faltantes: evaluacion.faltantes.map(nombreTipo)
        }
      ));
    }

    if (evaluacion.duplicados.length) {
      validaciones.push(crearValidacionBase(
        materia,
        "archivos_duplicados",
        Schema.SEVERIDADES.ADVERTENCIA,
        "Hay archivos duplicados para uno o más tipos PEA.",
        {
          cargaId: cargaId || null,
          codigo: materia.codigo,
          materia: materia.nombre,
          duplicados: evaluacion.duplicados.map(function (item) {
            return {
              tipo: nombreTipo(item.tipo),
              cantidad: item.cantidad,
              archivos: item.archivos
            };
          })
        }
      ));
    }

    if (evaluacion.noIdentificados.length) {
      validaciones.push(crearValidacionBase(
        materia,
        "archivos_no_identificados",
        Schema.SEVERIDADES.ADVERTENCIA,
        "Hay archivos que no fueron clasificados automáticamente.",
        {
          cargaId: cargaId || null,
          codigo: materia.codigo,
          materia: materia.nombre,
          archivos: evaluacion.noIdentificados.map(function (archivo) {
            return {
              nombreArchivo: archivo.nombreArchivo,
              rutaOriginal: archivo.rutaOriginal
            };
          })
        }
      ));
    }

    if (evaluacion.bajaConfianza.length) {
      validaciones.push(crearValidacionBase(
        materia,
        "baja_confianza",
        Schema.SEVERIDADES.ADVERTENCIA,
        "Hay archivos clasificados con baja confianza.",
        {
          cargaId: cargaId || null,
          codigo: materia.codigo,
          materia: materia.nombre,
          archivos: evaluacion.bajaConfianza.map(function (archivo) {
            return {
              nombreArchivo: archivo.nombreArchivo,
              tipo: nombreTipo(archivo.tipo),
              confianza: archivo.confianza
            };
          })
        }
      ));
    }

    if (evaluacion.noExcel.length) {
      validaciones.push(crearValidacionBase(
        materia,
        "archivo_no_excel",
        Schema.SEVERIDADES.ADVERTENCIA,
        "Hay archivos asociados a la materia que no parecen ser Excel.",
        {
          cargaId: cargaId || null,
          codigo: materia.codigo,
          materia: materia.nombre,
          archivos: evaluacion.noExcel.map(function (archivo) {
            return {
              nombreArchivo: archivo.nombreArchivo,
              extension: archivo.extension
            };
          })
        }
      ));
    }

    return validaciones;
  }

  async function validarMateria(materiaId, opciones) {
    opciones = opciones || {};

    var materia = await Core.get(Schema.STORES.MATERIAS, materiaId);

    if (!materia) {
      throw new Error("No se encontró la materia con id: " + materiaId);
    }

    var archivos = await Core.getAllByIndex(Schema.STORES.PEA_ARCHIVOS, "materiaId", materiaId);
    var evaluacion = evaluarArchivosMateria(archivos);

    var materiaActualizada = Object.assign({}, materia, {
      estadoValidacion: evaluacion.estado,
      totalArchivosEsperados: evaluacion.totalArchivosEsperados,
      totalArchivosEncontrados: evaluacion.totalArchivosEncontrados,
      archivosFaltantes: evaluacion.faltantes,
      archivosDuplicados: evaluacion.duplicados.map(function (item) {
        return item.tipo;
      }),
      actualizadoEn: fecha()
    });

    await Core.put(Schema.STORES.MATERIAS, materiaActualizada);

    var validaciones = construirValidacionesMateria(
      materiaActualizada,
      archivos,
      evaluacion,
      opciones.cargaId || null
    );

    if (opciones.guardar !== false) {
      await guardarValidaciones(validaciones);
    }

    return {
      materia: materiaActualizada,
      archivos: archivos,
      evaluacion: evaluacion,
      validaciones: validaciones
    };
  }

  async function validarTodasLasMaterias(opciones) {
    opciones = opciones || {};

    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var resultados = [];

    for (var i = 0; i < materias.length; i += 1) {
      var resultado = await validarMateria(materias[i].id, opciones);
      resultados.push(resultado);
    }

    return construirResumenValidacion(resultados);
  }

  function construirResumenValidacion(resultados) {
    resultados = Array.isArray(resultados) ? resultados : [];

    var resumen = {
      generadoEn: fecha(),
      totalMaterias: resultados.length,
      completas: 0,
      incompletas: 0,
      revision: 0,
      errores: 0,
      totalValidaciones: 0,
      materias: []
    };

    resultados.forEach(function (item) {
      var estado = item.materia.estadoValidacion;

      if (estado === Schema.ESTADOS_VALIDACION.COMPLETO) resumen.completas += 1;
      else if (estado === Schema.ESTADOS_VALIDACION.INCOMPLETO) resumen.incompletas += 1;
      else if (estado === Schema.ESTADOS_VALIDACION.REVISION) resumen.revision += 1;
      else resumen.errores += 1;

      resumen.totalValidaciones += item.validaciones.length;

      resumen.materias.push({
        materiaId: item.materia.id,
        codigo: item.materia.codigo,
        materia: item.materia.nombre,
        estado: item.materia.estadoValidacion,
        faltantes: item.evaluacion.faltantes.map(nombreTipo),
        duplicados: item.evaluacion.duplicados.map(function (d) {
          return nombreTipo(d.tipo);
        }),
        bajaConfianza: item.evaluacion.bajaConfianza.length,
        noIdentificados: item.evaluacion.noIdentificados.length
      });
    });

    return resumen;
  }

  async function obtenerValidacionesActivas() {
    var validaciones = await Core.getAll(Schema.STORES.VALIDACIONES);

    return validaciones
      .filter(function (v) {
        return v.estado !== "resuelto";
      })
      .sort(function (a, b) {
        return String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""));
      });
  }

  async function obtenerValidacionesPorMateria(materiaId) {
    var validaciones = await Core.getAllByIndex(Schema.STORES.VALIDACIONES, "materiaId", materiaId);

    return validaciones.sort(function (a, b) {
      return String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""));
    });
  }

  async function obtenerValidacionesPorCarga(cargaId) {
    var validaciones = await Core.getAllByIndex(Schema.STORES.VALIDACIONES, "cargaId", cargaId);

    return validaciones.sort(function (a, b) {
      return String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""));
    });
  }

  async function marcarValidacionResuelta(validacionId, observacion) {
    var validacion = await Core.get(Schema.STORES.VALIDACIONES, validacionId);

    if (!validacion) {
      throw new Error("No se encontró la validación con id: " + validacionId);
    }

    var actualizada = Object.assign({}, validacion, {
      estado: "resuelto",
      observacionResolucion: observacion || "",
      resueltoEn: fecha(),
      actualizadoEn: fecha()
    });

    await Core.put(Schema.STORES.VALIDACIONES, actualizada);

    return actualizada;
  }

  async function limpiarValidacionesResueltas() {
    var validaciones = await Core.getAll(Schema.STORES.VALIDACIONES);
    var resueltas = validaciones.filter(function (v) {
      return v.estado === "resuelto";
    });

    for (var i = 0; i < resueltas.length; i += 1) {
      await Core.remove(Schema.STORES.VALIDACIONES, resueltas[i].id);
    }

    return {
      eliminadas: resueltas.length
    };
  }

  async function diagnosticoCalidad() {
    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var archivos = await Core.getAll(Schema.STORES.PEA_ARCHIVOS);
    var validaciones = await obtenerValidacionesActivas();

    var resumen = {
      generadoEn: fecha(),
      totalMaterias: materias.length,
      totalArchivos: archivos.length,
      totalValidacionesActivas: validaciones.length,
      completas: 0,
      incompletas: 0,
      revision: 0,
      pendientes: 0,
      archivosNoIdentificados: 0,
      archivosBajaConfianza: 0,
      archivosDuplicadosDetectados: 0
    };

    materias.forEach(function (materia) {
      if (materia.estadoValidacion === Schema.ESTADOS_VALIDACION.COMPLETO) resumen.completas += 1;
      else if (materia.estadoValidacion === Schema.ESTADOS_VALIDACION.INCOMPLETO) resumen.incompletas += 1;
      else if (materia.estadoValidacion === Schema.ESTADOS_VALIDACION.REVISION) resumen.revision += 1;
      else resumen.pendientes += 1;

      if (Array.isArray(materia.archivosDuplicados)) {
        resumen.archivosDuplicadosDetectados += materia.archivosDuplicados.length;
      }
    });

    archivos.forEach(function (archivo) {
      if (!archivo.tipo) resumen.archivosNoIdentificados += 1;

      if (typeof archivo.confianza === "number" && archivo.confianza > 0 && archivo.confianza < 70) {
        resumen.archivosBajaConfianza += 1;
      }
    });

    return resumen;
  }

  NS.Validaciones = {
    nombreTipo: nombreTipo,
    evaluarArchivosMateria: evaluarArchivosMateria,
    validarMateria: validarMateria,
    validarTodasLasMaterias: validarTodasLasMaterias,
    guardarValidacion: guardarValidacion,
    guardarValidaciones: guardarValidaciones,
    obtenerValidacionesActivas: obtenerValidacionesActivas,
    obtenerValidacionesPorMateria: obtenerValidacionesPorMateria,
    obtenerValidacionesPorCarga: obtenerValidacionesPorCarga,
    marcarValidacionResuelta: marcarValidacionResuelta,
    limpiarValidacionesResueltas: limpiarValidacionesResueltas,
    diagnosticoCalidad: diagnosticoCalidad
  };

  NS.validarMateria = validarMateria;
  NS.validarTodasLasMaterias = validarTodasLasMaterias;
  NS.obtenerValidacionesActivas = obtenerValidacionesActivas;
  NS.diagnosticoCalidad = diagnosticoCalidad;
})(window);