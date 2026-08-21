/* =========================================================
Nombre completo: subir.estados.js
Ruta o ubicación: /Curriculo/subir/subir.estados.js
Funciones:
- Clasificar cada materia como Completa, Advertencia o Error.
- Separar el número de materias afectadas del número de observaciones técnicas.
- Detectar PEA Base, Unidades y Actividades incompletos por su contenido real.
- Mantener compatibilidad con los estados anteriores del validador.
- Recalcular contadores consistentes para la vista previa y la importación.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "4.0.2";

  var ESTADOS = Object.freeze({
    COMPLETA: "completa",
    ADVERTENCIA: "advertencia",
    ERROR: "error"
  });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function esSeveridadError(severidad) {
    severidad = normalizar(severidad);
    return severidad === "error" || severidad === "critico";
  }

  function esSeveridadAdvertencia(severidad) {
    severidad = normalizar(severidad);
    return severidad === "advertencia" || severidad === "revision";
  }

  function estadoDesdeOriginal(estado) {
    estado = normalizar(estado);

    if (["incompleto", "error", "critico", "bloqueado"].indexOf(estado) !== -1) {
      return ESTADOS.ERROR;
    }

    if (["revision", "advertencia", "con_observaciones", "pendiente_revision"].indexOf(estado) !== -1) {
      return ESTADOS.ADVERTENCIA;
    }

    if (["completo", "completa", "ok", "validado", "validada"].indexOf(estado) !== -1) {
      return ESTADOS.COMPLETA;
    }

    return "";
  }

  function prioridadEstado(estado) {
    if (estado === ESTADOS.ERROR) return 3;
    if (estado === ESTADOS.ADVERTENCIA) return 2;
    if (estado === ESTADOS.COMPLETA) return 1;
    return 0;
  }

  function mayorEstado(a, b) {
    return prioridadEstado(a) >= prioridadEstado(b) ? a : b;
  }

  function validacionesDeMateria(validaciones, materiaId) {
    return arr(validaciones).filter(function (validacion) {
      return validacion && texto(validacion.materiaId) === texto(materiaId);
    });
  }

  function evaluacionDeMateria(evaluaciones, materiaId) {
    return arr(evaluaciones).find(function (evaluacion) {
      return evaluacion && texto(evaluacion.materiaId) === texto(materiaId);
    }) || null;
  }

  function resultadoTipo(evaluacion, tipo) {
    var resultados = arr(evaluacion && evaluacion.resultadosArchivos).filter(function (resultado) {
      return resultado && texto(resultado.tipo) === tipo;
    });

    return resultados.find(function (resultado) {
      return resultado.contenidoValido === true;
    }) || resultados[0] || null;
  }

  function contieneTipo(lista, tipo) {
    return arr(lista).some(function (item) {
      return texto(item) === tipo;
    });
  }

  function unidadTieneContenido(unidad) {
    unidad = unidad || {};
    return arr(unidad.contenidos).some(function (item) {
      return texto(item) !== "";
    }) || !!texto(
      unidad.temaDetectado ||
      unidad.tema ||
      unidad.contenido ||
      unidad.titulo ||
      unidad.resultadoDetectado ||
      unidad.resultadoAprendizaje ||
      unidad.competencia
    );
  }

  function numeroUnidad(unidad) {
    var numero = Number(
      unidad && (
        unidad.unidadNumero ||
        unidad.numeroUnidad ||
        unidad.nivel ||
        unidad.ordenComponente ||
        unidad.unidad
      )
    );
    return Number.isFinite(numero) ? numero : 0;
  }

  function diagnosticarIntegridadPEA(evaluacion) {
    if (!evaluacion) return { estado: "", motivos: [] };

    var estado = "";
    var motivos = [];

    if (contieneTipo(evaluacion.faltantes, "pea_base")) {
      estado = mayorEstado(estado, ESTADOS.ERROR);
      motivos.push("Falta el PEA Base.");
    }
    if (contieneTipo(evaluacion.faltantes, "pea_unidades")) {
      estado = mayorEstado(estado, ESTADOS.ERROR);
      motivos.push("Falta el PEA Unidades.");
    }
    if (contieneTipo(evaluacion.faltantes, "pea_actividades")) {
      estado = mayorEstado(estado, ESTADOS.ERROR);
      motivos.push("Falta el PEA Actividades.");
    }

    var base = resultadoTipo(evaluacion, "pea_base");
    if (base && base.leido === true && !base.error && base.contenidoValido === true) {
      var detalleBase = base.detalleContenido || {};
      if (detalleBase.tieneDescripcion === false || detalleBase.tieneObjetivo === false) {
        estado = mayorEstado(estado, ESTADOS.ADVERTENCIA);
        motivos.push("El PEA Base está incompleto: falta descripción u objetivo de la asignatura.");
      }
    }

    var unidades = resultadoTipo(evaluacion, "pea_unidades");
    if (unidades && unidades.leido === true && !unidades.error) {
      var datosUnidades = unidades.archivo && unidades.archivo.datosProcesados;
      var registrosUnidades = Array.isArray(datosUnidades)
        ? datosUnidades
        : arr(datosUnidades && datosUnidades.unidades);
      var unidadesValidas = registrosUnidades.filter(unidadTieneContenido);
      var numeros = [];

      unidadesValidas.forEach(function (unidad) {
        var numero = numeroUnidad(unidad);
        if (numero >= 1 && numero <= 4 && numeros.indexOf(numero) === -1) numeros.push(numero);
      });

      if (!unidadesValidas.length) {
        estado = mayorEstado(estado, ESTADOS.ERROR);
        motivos.push("El PEA Unidades no tiene contenido en ninguna unidad.");
      } else if (numeros.length > 0 && numeros.length < 4) {
        var faltantes = [1, 2, 3, 4].filter(function (numero) {
          return numeros.indexOf(numero) === -1;
        });
        estado = mayorEstado(estado, ESTADOS.ERROR);
        motivos.push("Unidades incompletas. Faltan: " + faltantes.map(function (numero) {
          return "Unidad " + numero;
        }).join(", ") + ".");
      } else if (numeros.length === 0 && unidadesValidas.length < 4) {
        estado = mayorEstado(estado, ESTADOS.ERROR);
        motivos.push("Unidades incompletas: solo se encontraron " + unidadesValidas.length + " de 4 unidades con contenido.");
      }
    }

    var actividades = resultadoTipo(evaluacion, "pea_actividades");
    if (actividades && actividades.leido === true && !actividades.error && actividades.contenidoValido === true) {
      var detalleActividades = actividades.detalleContenido || {};
      var totalActividades = Number(detalleActividades.totalRegistros || 0);
      var actividadesValidas = Number(detalleActividades.actividadesValidas || 0);

      if (totalActividades > actividadesValidas && actividadesValidas > 0) {
        estado = mayorEstado(estado, ESTADOS.ADVERTENCIA);
        motivos.push("El PEA Actividades está incompleto: " + actividadesValidas + " de " + totalActividades + " actividades tienen contenido válido.");
      }
    }

    return { estado: estado, motivos: motivos };
  }

  function clasificarMateria(materia, validaciones, evaluacion) {
    materia = Object.assign({}, materia || {});
    validaciones = arr(validaciones);

    var estadoTecnico = texto(materia.estadoValidacion || materia.estado || "");
    var estadoAnterior = texto(materia.estadoValidacionOriginal || "");
    var integridadPEA = diagnosticarIntegridadPEA(evaluacion);
    var estadoTecnicoAjustado = estadoTecnico;
    var estadoActual = estadoDesdeOriginal(estadoTecnicoAjustado || estadoAnterior);

    if (integridadPEA.estado === ESTADOS.ERROR && estadoActual !== ESTADOS.ERROR) {
      estadoTecnicoAjustado = "incompleto";
    } else if (
      integridadPEA.estado === ESTADOS.ADVERTENCIA &&
      [ESTADOS.ERROR, ESTADOS.ADVERTENCIA].indexOf(estadoActual) === -1
    ) {
      estadoTecnicoAjustado = "revision";
    }

    var estadoFuente = estadoTecnicoAjustado || estadoAnterior;
    var estado = estadoDesdeOriginal(estadoFuente) || ESTADOS.COMPLETA;
    estado = mayorEstado(estado, integridadPEA.estado);

    var errores = validaciones.filter(function (validacion) {
      return esSeveridadError(validacion && validacion.severidad);
    });
    var advertencias = validaciones.filter(function (validacion) {
      return esSeveridadAdvertencia(validacion && validacion.severidad);
    });
    var bloquea = validaciones.some(function (validacion) {
      return validacion && (
        validacion.bloqueaImportacion === true ||
        normalizar(validacion.severidad) === "critico"
      );
    });

    if (errores.length) estado = mayorEstado(estado, ESTADOS.ERROR);
    else if (advertencias.length) estado = mayorEstado(estado, ESTADOS.ADVERTENCIA);

    var motivos = validaciones.map(function (validacion) {
      return texto(
        validacion && (
          validacion.titulo ||
          (validacion.diagnosticoUsuario && validacion.diagnosticoUsuario.titulo) ||
          validacion.mensaje ||
          validacion.tipo
        )
      );
    }).filter(Boolean).concat(integridadPEA.motivos);

    return Object.assign({}, materia, {
      estadoValidacion: estadoTecnicoAjustado || materia.estadoValidacion,
      // Siempre se conserva como referencia el estado técnico más reciente.
      // Solo se usa el valor anterior cuando el validador no entregó estado.
      estadoValidacionOriginal: estadoTecnicoAjustado || estadoAnterior,
      estadoValidacionTecnico: estadoTecnicoAjustado,
      estadoClasificado: estado,
      etiquetaEstado: estado === ESTADOS.COMPLETA
        ? "Completa"
        : (estado === ESTADOS.ADVERTENCIA ? "Advertencia" : "Error"),
      severidadEstado: estado === ESTADOS.COMPLETA
        ? "ok"
        : (estado === ESTADOS.ADVERTENCIA ? "warn" : "error"),
      totalValidacionesMateria: validaciones.length,
      totalAdvertenciasMateria: advertencias.length,
      totalErroresMateria: errores.length,
      motivosEstado: motivos,
      diagnosticoIntegridadPEA: integridadPEA,
      bloqueaImportacion: bloquea,
      puedeImportar: !bloquea,
      requiereRevision: estado !== ESTADOS.COMPLETA
    });
  }

  function recalcularResumen(paquete, materias) {
    var validaciones = arr(paquete.validacionesSubida);
    var resumen = Object.assign({}, paquete.resumenValidacion || {});
    var completas = materias.filter(function (materia) {
      return materia.estadoClasificado === ESTADOS.COMPLETA;
    }).length;
    var advertencias = materias.filter(function (materia) {
      return materia.estadoClasificado === ESTADOS.ADVERTENCIA;
    }).length;
    var errores = materias.filter(function (materia) {
      return materia.estadoClasificado === ESTADOS.ERROR;
    }).length;
    var validacionesGlobales = validaciones.filter(function (validacion) {
      return !texto(validacion && validacion.materiaId);
    });
    var advertenciasGlobales = validacionesGlobales.filter(function (validacion) {
      return esSeveridadAdvertencia(validacion && validacion.severidad);
    }).length;
    var erroresGlobales = validacionesGlobales.filter(function (validacion) {
      return esSeveridadError(validacion && validacion.severidad);
    }).length;
    var bloquea = validaciones.some(function (validacion) {
      return validacion && (
        validacion.bloqueaImportacion === true ||
        normalizar(validacion.severidad) === "critico"
      );
    });
    var requiereRevision = advertencias > 0 || errores > 0 ||
      advertenciasGlobales > 0 || erroresGlobales > 0;

    resumen.totalMaterias = materias.length;
    resumen.materiasCompletas = completas;
    resumen.materiasAdvertencia = advertencias;
    resumen.materiasError = errores;
    resumen.materiasConProblemas = advertencias + errores;

    // Alias para no romper módulos anteriores.
    resumen.materiasRevision = advertencias;
    resumen.materiasIncompletas = errores;

    resumen.alertasGlobales = validacionesGlobales.length;
    resumen.advertenciasGlobales = advertenciasGlobales;
    resumen.erroresGlobales = erroresGlobales;
    resumen.totalValidaciones = validaciones.length;
    resumen.totalEstadosMaterias = completas + advertencias + errores;
    resumen.contadoresConsistentes = resumen.totalEstadosMaterias === materias.length;
    resumen.bloqueaImportacion = bloquea;
    resumen.requiereRevision = requiereRevision;
    resumen.listoParaImportar = !bloquea && !requiereRevision;
    resumen.puedeImportarConObservaciones = !bloquea;

    return resumen;
  }

  function clasificarPaquete(paquete) {
    if (!paquete || typeof paquete !== "object") return paquete;

    var validaciones = arr(paquete.validacionesSubida);
    var evaluaciones = arr(paquete.evaluacionesMaterias);
    var materias = arr(paquete.materias).map(function (materia) {
      return clasificarMateria(
        materia,
        validacionesDeMateria(validaciones, materia && materia.id),
        evaluacionDeMateria(evaluaciones, materia && materia.id)
      );
    });
    var resumen = recalcularResumen(paquete, materias);

    paquete.materias = materias;
    paquete.resumenValidacion = resumen;
    paquete.estadosMaterias = materias.map(function (materia) {
      return {
        materiaId: materia.id,
        estado: materia.estadoClasificado,
        etiqueta: materia.etiquetaEstado,
        advertencias: materia.totalAdvertenciasMateria,
        errores: materia.totalErroresMateria,
        bloqueaImportacion: materia.bloqueaImportacion
      };
    });

    paquete.carga = Object.assign({}, paquete.carga || {}, {
      materiasCompletas: resumen.materiasCompletas,
      materiasAdvertencia: resumen.materiasAdvertencia,
      materiasError: resumen.materiasError,
      materiasRevision: resumen.materiasAdvertencia,
      materiasIncompletas: resumen.materiasError,
      estado: resumen.bloqueaImportacion
        ? "bloqueado"
        : (resumen.requiereRevision ? "con_observaciones" : "validado")
    });

    return paquete;
  }

  function instalar() {
    if (!NS.Validador || typeof NS.Validador.validarPaquete !== "function") {
      throw new Error("subir.estados.js requiere subir.validador.js y subir.advertencias.js cargados previamente.");
    }

    if (NS.Validador.__estadosClasificados === true) return;

    var validarOriginal = NS.Validador.validarPaquete;

    NS.Validador.validarPaquete = function (paquete, opciones) {
      return clasificarPaquete(validarOriginal.call(NS.Validador, paquete, opciones));
    };

    NS.Validador.__estadosClasificados = true;
  }

  NS.Estados = {
    VERSION: VERSION,
    ESTADOS: ESTADOS,
    clasificarMateria: clasificarMateria,
    clasificarPaquete: clasificarPaquete,
    recalcularResumen: recalcularResumen,
    diagnosticarIntegridadPEA: diagnosticarIntegridadPEA,
    instalar: instalar
  };

  instalar();
})(window);