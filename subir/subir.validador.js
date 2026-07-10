/* =========================================================
Nombre completo: subir.validador.js
Ruta o ubicación: /Curriculo/subir/subir.validador.js
Función o funciones:
- Validar el paquete clasificado antes de enviarlo a BDLocal.
- Confirmar que cada materia tenga PEA Base, PEA Unidades y PEA Actividades.
- Marcar como completo cuando los 3 archivos obligatorios existen.
- Detectar materias incompletas, duplicados, archivos no identificados y errores de lectura.
- Evitar que baja confianza convierta una materia completa en revision si los 3 PEA están claros.
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

  var TIPOS_OBLIGATORIOS = [
    TIPOS.BASE,
    TIPOS.UNIDADES,
    TIPOS.ACTIVIDADES
  ];

  function fechaISO() {
    return new Date().toISOString();
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

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
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

  function agruparArchivosPorMateria(archivos) {
    var mapa = {};

    arr(archivos).forEach(function (archivo) {
      var materiaId = archivo.materiaId || "sin_materia";

      if (!mapa[materiaId]) {
        mapa[materiaId] = [];
      }

      mapa[materiaId].push(archivo);
    });

    return mapa;
  }

  function agruparArchivosPorTipo(archivos) {
    var mapa = {};

    arr(archivos).forEach(function (archivo) {
      var tipo = archivo.tipo || "";

      if (!mapa[tipo]) {
        mapa[tipo] = [];
      }

      mapa[tipo].push(archivo);
    });

    return mapa;
  }

  function evaluarMateria(materia, archivosMateria) {
    archivosMateria = arr(archivosMateria);

    var porTipo = agruparArchivosPorTipo(archivosMateria);

    var base = porTipo[TIPOS.BASE] || [];
    var unidades = porTipo[TIPOS.UNIDADES] || [];
    var actividades = porTipo[TIPOS.ACTIVIDADES] || [];

    var faltantes = [];
    var duplicados = [];
    var noIdentificados = [];
    var noExcel = [];
    var erroresLectura = [];
    var bajaConfianza = [];

    if (!base.length) faltantes.push(TIPOS.BASE);
    if (!unidades.length) faltantes.push(TIPOS.UNIDADES);
    if (!actividades.length) faltantes.push(TIPOS.ACTIVIDADES);

    if (base.length > 1) {
      duplicados.push({
        tipo: TIPOS.BASE,
        cantidad: base.length,
        archivos: base.map(function (a) { return a.nombreArchivo; })
      });
    }

    if (unidades.length > 1) {
      duplicados.push({
        tipo: TIPOS.UNIDADES,
        cantidad: unidades.length,
        archivos: unidades.map(function (a) { return a.nombreArchivo; })
      });
    }

    if (actividades.length > 1) {
      duplicados.push({
        tipo: TIPOS.ACTIVIDADES,
        cantidad: actividades.length,
        archivos: actividades.map(function (a) { return a.nombreArchivo; })
      });
    }

    archivosMateria.forEach(function (archivo) {
      if (!archivo.tipo) {
        noIdentificados.push(archivo);
      }

      if (archivo.esExcel === false || archivo.estado === "no_excel") {
        noExcel.push(archivo);
      }

      if (archivo.errorLectura || archivo.errorExcel) {
        erroresLectura.push(archivo);
      }

      if (typeof archivo.confianza === "number" && archivo.confianza > 0 && archivo.confianza < 70) {
        bajaConfianza.push(archivo);
      }
    });

    var encontradosUnicos =
      (base.length ? 1 : 0) +
      (unidades.length ? 1 : 0) +
      (actividades.length ? 1 : 0);

    var estado = "completo";

    if (faltantes.length) {
      estado = "incompleto";
    } else if (duplicados.length) {
      estado = "revision";
    } else {
      estado = "completo";
    }

    return {
      materiaId: materia.id,
      codigo: materia.codigo || "",
      materia: materia.nombre || "",
      estado: estado,
      totalArchivos: archivosMateria.length,
      totalArchivosEsperados: 3,
      totalArchivosEncontrados: encontradosUnicos,
      faltantes: faltantes,
      duplicados: duplicados,
      bajaConfianza: bajaConfianza,
      noIdentificados: noIdentificados,
      noExcel: noExcel,
      erroresLectura: erroresLectura,
      tieneBase: base.length > 0,
      tieneUnidades: unidades.length > 0,
      tieneActividades: actividades.length > 0
    };
  }

  function validarEstructuraMinima(paquete, validaciones) {
    var carreras = arr(paquete.carreras);
    var niveles = arr(paquete.niveles);
    var materias = arr(paquete.materias);
    var archivos = arr(paquete.archivos);

    if (!carreras.length) {
      validaciones.push(crearValidacion({
        tipo: "sin_carreras",
        severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "No se detectaron carreras dentro de MATRIZ CCC."
      }));
    }

    if (!niveles.length) {
      validaciones.push(crearValidacion({
        tipo: "sin_niveles",
        severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "No se detectaron niveles dentro de MATRIZ CCC."
      }));
    }

    if (!materias.length) {
      validaciones.push(crearValidacion({
        tipo: "sin_materias",
        severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "No se detectaron materias dentro de MATRIZ CCC / NIVEL."
      }));
    }

    if (!archivos.length) {
      validaciones.push(crearValidacion({
        tipo: "sin_archivos_curriculares",
        severidad: "critico",
        bloqueaImportacion: true,
        mensaje: "No se detectaron archivos Excel curriculares dentro de MATRIZ CCC / NIVEL / MATERIA."
      }));
    }
  }

  function validarConfianzaEstructura(paquete, validaciones) {
    arr(paquete.carreras).forEach(function (carrera) {
      if (typeof carrera.confianza === "number" && carrera.confianza < 70) {
        validaciones.push(crearValidacion({
          tipo: "carrera_baja_confianza",
          severidad: "advertencia",
          bloqueaImportacion: false,
          mensaje: "Una carrera fue detectada con baja confianza.",
          carreraId: carrera.id,
          detalle: {
            carrera: carrera.nombre,
            confianza: carrera.confianza
          }
        }));
      }
    });

    arr(paquete.niveles).forEach(function (nivel) {
      if (typeof nivel.confianza === "number" && nivel.confianza < 70) {
        validaciones.push(crearValidacion({
          tipo: "nivel_baja_confianza",
          severidad: "advertencia",
          bloqueaImportacion: false,
          mensaje: "Un nivel fue detectado con baja confianza.",
          carreraId: nivel.carreraId,
          nivelId: nivel.id,
          detalle: {
            nivel: nivel.nombre,
            confianza: nivel.confianza
          }
        }));
      }
    });
  }

  function validarMaterias(paquete, validaciones) {
    var materias = arr(paquete.materias);
    var archivos = arr(paquete.archivos);
    var porMateria = agruparArchivosPorMateria(archivos);

    return materias.map(function (materia) {
      var archivosMateria = porMateria[materia.id] || [];
      var evaluacion = evaluarMateria(materia, archivosMateria);

      if (evaluacion.faltantes.length) {
        validaciones.push(crearValidacion({
          tipo: "materia_incompleta",
          severidad: "error",
          bloqueaImportacion: false,
          mensaje: "La materia no tiene los 3 Excel PEA obligatorios.",
          carreraId: materia.carreraId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          detalle: {
            codigo: materia.codigo,
            materia: materia.nombre,
            faltantes: evaluacion.faltantes.map(nombreTipo)
          }
        }));
      }

      if (evaluacion.duplicados.length) {
        validaciones.push(crearValidacion({
          tipo: "archivos_duplicados",
          severidad: "advertencia",
          bloqueaImportacion: false,
          mensaje: "La materia tiene archivos duplicados para un mismo tipo PEA.",
          carreraId: materia.carreraId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          detalle: {
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
        }));
      }

      if (evaluacion.noIdentificados.length) {
        validaciones.push(crearValidacion({
          tipo: "archivos_no_identificados",
          severidad: "advertencia",
          bloqueaImportacion: false,
          mensaje: "Hay archivos dentro de una materia que no pudieron clasificarse automáticamente.",
          carreraId: materia.carreraId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          detalle: evaluacion.noIdentificados.map(function (archivo) {
            return {
              nombreArchivo: archivo.nombreArchivo,
              rutaOriginal: archivo.rutaOriginal
            };
          })
        }));
      }

      if (evaluacion.erroresLectura.length) {
        validaciones.push(crearValidacion({
          tipo: "error_lectura_excel",
          severidad: "advertencia",
          bloqueaImportacion: false,
          mensaje: "Hay Excel clasificados que no pudieron leerse internamente.",
          carreraId: materia.carreraId,
          nivelId: materia.nivelId,
          materiaId: materia.id,
          detalle: evaluacion.erroresLectura.map(function (archivo) {
            return {
              nombreArchivo: archivo.nombreArchivo,
              error: archivo.errorExcel || archivo.errorLectura
            };
          })
        }));
      }

      return evaluacion;
    });
  }

  function actualizarMaterias(paquete, evaluaciones) {
    var mapa = {};

    evaluaciones.forEach(function (evaluacion) {
      mapa[evaluacion.materiaId] = evaluacion;
    });

    return arr(paquete.materias).map(function (materia) {
      var evaluacion = mapa[materia.id];

      if (!evaluacion) return materia;

      return Object.assign({}, materia, {
        estadoValidacion: evaluacion.estado,
        totalArchivosEsperados: evaluacion.totalArchivosEsperados,
        totalArchivosEncontrados: evaluacion.totalArchivosEncontrados,
        archivosFaltantes: evaluacion.faltantes,
        archivosDuplicados: evaluacion.duplicados.map(function (item) {
          return item.tipo;
        }),
        resumenValidacion: {
          tieneBase: evaluacion.tieneBase,
          tieneUnidades: evaluacion.tieneUnidades,
          tieneActividades: evaluacion.tieneActividades,
          noIdentificados: evaluacion.noIdentificados.length,
          bajaConfianza: evaluacion.bajaConfianza.length,
          erroresLectura: evaluacion.erroresLectura.length
        },
        actualizadoEn: fechaISO()
      });
    });
  }

  function construirResumen(paquete, evaluaciones, validaciones) {
    var materias = arr(paquete.materias);
    var archivos = arr(paquete.archivos);

    var completas = evaluaciones.filter(function (e) {
      return e.estado === "completo";
    }).length;

    var incompletas = evaluaciones.filter(function (e) {
      return e.estado === "incompleto";
    }).length;

    var revision = evaluaciones.filter(function (e) {
      return e.estado === "revision";
    }).length;

    var criticas = validaciones.filter(function (v) {
      return v.severidad === "critico";
    }).length;

    var errores = validaciones.filter(function (v) {
      return v.severidad === "error";
    }).length;

    var advertencias = validaciones.filter(function (v) {
      return v.severidad === "advertencia";
    }).length;

    var bloquea = validaciones.some(function (v) {
      return v.bloqueaImportacion === true;
    });

    return {
      generadoEn: fechaISO(),
      totalCarreras: arr(paquete.carreras).length,
      totalNiveles: arr(paquete.niveles).length,
      totalMaterias: materias.length,
      totalArchivos: archivos.length,
      totalExcel: archivos.filter(function (a) { return a.esExcel !== false; }).length,
      materiasCompletas: completas,
      materiasIncompletas: incompletas,
      materiasRevision: revision,
      validacionesCriticas: criticas,
      validacionesError: errores,
      validacionesAdvertencia: advertencias,
      totalValidaciones: validaciones.length,
      bloqueaImportacion: bloquea,
      listoParaImportar: !bloquea,
      requiereRevision: errores > 0 || advertencias > 0 || incompletas > 0 || revision > 0
    };
  }

  function fusionarAdvertenciasComoValidaciones(paquete, validaciones) {
    arr(paquete.advertencias).forEach(function (advertencia) {
      if (advertencia.tipo === "archivos_baja_confianza") {
        return;
      }

      validaciones.push(crearValidacion({
        tipo: advertencia.tipo || "advertencia_previa",
        severidad: advertencia.severidad || "advertencia",
        bloqueaImportacion: advertencia.severidad === "critico",
        mensaje: advertencia.mensaje || "Advertencia detectada durante la lectura del ZIP.",
        carreraId: advertencia.carreraId || "",
        nivelId: advertencia.nivelId || "",
        materiaId: advertencia.materiaId || "",
        detalle: advertencia
      }));
    });
  }

  function validarPaquete(paquete, opciones) {
    opciones = opciones || {};

    normalizadorDisponible();

    if (!paquete || typeof paquete !== "object") {
      throw new Error("No se recibió un paquete válido para validar.");
    }

    var validaciones = [];
    var evaluaciones = [];

    validarEstructuraMinima(paquete, validaciones);
    validarConfianzaEstructura(paquete, validaciones);
    fusionarAdvertenciasComoValidaciones(paquete, validaciones);

    evaluaciones = validarMaterias(paquete, validaciones);

    var materiasActualizadas = actualizarMaterias(paquete, evaluaciones);

    var paqueteActualizado = Object.assign({}, paquete, {
      materias: materiasActualizadas,
      validacionesSubida: validaciones,
      evaluacionesMaterias: evaluaciones,
      resumenValidacion: construirResumen(
        Object.assign({}, paquete, { materias: materiasActualizadas }),
        evaluaciones,
        validaciones
      ),
      validadoEn: fechaISO()
    });

    paqueteActualizado.carga = Object.assign({}, paqueteActualizado.carga || {}, {
      estado: paqueteActualizado.resumenValidacion.listoParaImportar ? "validado" : "con_observaciones",
      totalCarreras: paqueteActualizado.resumenValidacion.totalCarreras,
      totalNiveles: paqueteActualizado.resumenValidacion.totalNiveles,
      totalMaterias: paqueteActualizado.resumenValidacion.totalMaterias,
      totalArchivos: paqueteActualizado.resumenValidacion.totalArchivos,
      materiasCompletas: paqueteActualizado.resumenValidacion.materiasCompletas,
      materiasIncompletas: paqueteActualizado.resumenValidacion.materiasIncompletas,
      materiasRevision: paqueteActualizado.resumenValidacion.materiasRevision,
      actualizadoEn: fechaISO()
    });

    if (opciones.lanzarSiBloquea === true && paqueteActualizado.resumenValidacion.bloqueaImportacion) {
      throw new Error("El paquete tiene errores críticos y no puede importarse.");
    }

    return paqueteActualizado;
  }

  function obtenerResumenVisual(paqueteValidado) {
    var resumen = paqueteValidado && paqueteValidado.resumenValidacion
      ? paqueteValidado.resumenValidacion
      : construirResumen(paqueteValidado || {}, [], []);

    return {
      titulo: resumen.listoParaImportar ? "ZIP listo para importar" : "ZIP requiere revisión",
      estado: resumen.listoParaImportar ? "ok" : "revision",
      totalCarreras: resumen.totalCarreras,
      totalNiveles: resumen.totalNiveles,
      totalMaterias: resumen.totalMaterias,
      totalArchivos: resumen.totalArchivos,
      materiasCompletas: resumen.materiasCompletas,
      materiasIncompletas: resumen.materiasIncompletas,
      materiasRevision: resumen.materiasRevision,
      totalValidaciones: resumen.totalValidaciones,
      requiereRevision: resumen.requiereRevision,
      bloqueaImportacion: resumen.bloqueaImportacion
    };
  }

  function esImportable(paqueteValidado) {
    if (!paqueteValidado || !paqueteValidado.resumenValidacion) {
      return false;
    }

    return paqueteValidado.resumenValidacion.listoParaImportar === true;
  }

  function obtenerValidacionesPorSeveridad(paqueteValidado, severidad) {
    return arr(paqueteValidado && paqueteValidado.validacionesSubida).filter(function (validacion) {
      return validacion.severidad === severidad;
    });
  }

  NS.Validador = {
    TIPOS: TIPOS,
    TIPOS_OBLIGATORIOS: TIPOS_OBLIGATORIOS,
    nombreTipo: nombreTipo,
    evaluarMateria: evaluarMateria,
    validarPaquete: validarPaquete,
    obtenerResumenVisual: obtenerResumenVisual,
    esImportable: esImportable,
    obtenerValidacionesPorSeveridad: obtenerValidacionesPorSeveridad,
    agruparArchivosPorMateria: agruparArchivosPorMateria
  };
})(window);