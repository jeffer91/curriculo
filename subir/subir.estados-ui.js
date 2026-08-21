/* =========================================================
Nombre completo: subir.estados-ui.js
Ruta o ubicación: /Curriculo/subir/subir.estados-ui.js
Funciones:
- Mostrar contadores separados de materias completas, con advertencia y con error.
- Sustituir el estado técnico de la tabla por etiquetas comprensibles.
- Mostrar el estado específico de PEA Base, Unidades y Actividades.
- Diferenciar archivos faltantes, contenido inexistente e información incompleta.
- Mantener los estados visibles después de búsquedas o repintados.
- Diferenciar el mensaje general cuando existen errores o advertencias.
========================================================= */

(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var VERSION = "4.0.3";
  var paqueteActual = null;
  var observerTabla = null;
  var actualizando = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setTexto(id, valor) {
    var elemento = $(id);
    if (elemento) elemento.textContent = texto(valor);
  }

  function numeroResumen(resumen, campoActual, campoAnterior) {
    var valor = resumen && resumen[campoActual];

    if ((valor === null || typeof valor === "undefined") && campoAnterior) {
      valor = resumen && resumen[campoAnterior];
    }

    if (valor === null || typeof valor === "undefined" || valor === "") {
      return 0;
    }

    valor = Number(valor);
    return Number.isFinite(valor) ? valor : 0;
  }

  function obtenerMateria(paquete, materiaId) {
    return arr(paquete && paquete.materias).find(function (materia) {
      return materia && texto(materia.id) === texto(materiaId);
    }) || null;
  }

  function obtenerEvaluacionMateria(paquete, materiaId) {
    return arr(paquete && paquete.evaluacionesMaterias).find(function (evaluacion) {
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
    var contenidos = arr(unidad.contenidos).filter(function (item) {
      return texto(item) !== "";
    });

    return contenidos.length > 0 || !!texto(
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

  function estadoUnidades(resultado) {
    var datos = resultado && resultado.archivo ? resultado.archivo.datosProcesados : null;
    var registros = Array.isArray(datos)
      ? datos
      : arr(datos && datos.unidades);
    var validas = registros.filter(unidadTieneContenido);
    var numeros = [];

    validas.forEach(function (unidad) {
      var numero = numeroUnidad(unidad);
      if (numero >= 1 && numero <= 4 && numeros.indexOf(numero) === -1) numeros.push(numero);
    });

    numeros.sort(function (a, b) { return a - b; });

    if (!validas.length) {
      return {
        etiqueta: "No hay contenido",
        clase: "error",
        mensaje: "El PEA Unidades existe, pero no hay contenido en ninguna unidad."
      };
    }

    var faltantes = [1, 2, 3, 4].filter(function (numero) {
      return numeros.indexOf(numero) === -1;
    });

    if (numeros.length > 0 && faltantes.length > 0) {
      return {
        etiqueta: "Unidades incompletas",
        clase: "error",
        mensaje: "Hay contenido en " + numeros.length + " de 4 unidades. Faltan: " +
          faltantes.map(function (numero) { return "Unidad " + numero; }).join(", ") + "."
      };
    }

    if (numeros.length === 0 && validas.length < 4) {
      return {
        etiqueta: "Unidades incompletas",
        clase: "error",
        mensaje: "Se encontraron " + validas.length + " unidad(es) con contenido, pero deben existir 4 unidades completas."
      };
    }

    return {
      etiqueta: "Correctas",
      clase: "ok",
      mensaje: "Las 4 unidades tienen contenido curricular."
    };
  }

  function estadoBase(resultado) {
    var detalle = resultado && resultado.detalleContenido ? resultado.detalleContenido : {};
    var faltan = [];

    if (detalle && detalle.tieneDescripcion === false) faltan.push("descripción");
    if (detalle && detalle.tieneObjetivo === false) faltan.push("objetivo");

    if (resultado && resultado.contenidoValido !== true) {
      return {
        etiqueta: "Sin contenido",
        clase: "error",
        mensaje: "El PEA Base existe, pero no contiene información curricular válida."
      };
    }

    if (faltan.length) {
      return {
        etiqueta: "Base incompleta",
        clase: "warn",
        mensaje: "Falta " + faltan.join(" y ") + " de la asignatura."
      };
    }

    return {
      etiqueta: "Correcto",
      clase: "ok",
      mensaje: "El PEA Base contiene información curricular válida."
    };
  }

  function estadoActividades(resultado) {
    var detalle = resultado && resultado.detalleContenido ? resultado.detalleContenido : {};
    var total = Number(detalle.totalRegistros || 0);
    var validas = Number(detalle.actividadesValidas || 0);

    if (!resultado || resultado.contenidoValido !== true || validas <= 0) {
      return {
        etiqueta: "No hay actividades",
        clase: "error",
        mensaje: "El PEA Actividades existe, pero no contiene actividades curriculares válidas."
      };
    }

    if (total > validas) {
      return {
        etiqueta: "Actividades incompletas",
        clase: "warn",
        mensaje: validas + " de " + total + " actividades tienen contenido válido."
      };
    }

    return {
      etiqueta: "Correcto",
      clase: "ok",
      mensaje: validas + " actividad(es) con contenido válido."
    };
  }

  function estadoPEA(paquete, materia, tipo) {
    var evaluacion = obtenerEvaluacionMateria(paquete, materia && materia.id);
    var resultado = resultadoTipo(evaluacion, tipo);
    var nombre = tipo === "pea_base"
      ? "PEA Base"
      : (tipo === "pea_unidades" ? "PEA Unidades" : "PEA Actividades");

    if (!evaluacion || contieneTipo(evaluacion.faltantes, tipo) || !resultado) {
      return {
        etiqueta: tipo === "pea_unidades"
          ? "Faltan unidades"
          : (tipo === "pea_actividades" ? "Faltan actividades" : "Falta Base"),
        clase: "error",
        mensaje: "No existe el archivo " + nombre + "."
      };
    }

    if (resultado.error) {
      return {
        etiqueta: "Error de lectura",
        clase: "error",
        mensaje: nombre + " existe, pero no pudo leerse correctamente."
      };
    }

    if (resultado.leido !== true) {
      return {
        etiqueta: "No leído",
        clase: "error",
        mensaje: nombre + " fue detectado, pero no pudo procesarse."
      };
    }

    if (tipo === "pea_unidades") return estadoUnidades(resultado);
    if (tipo === "pea_actividades") return estadoActividades(resultado);
    return estadoBase(resultado);
  }

  function renderEstadoPEA(info) {
    info = info || { etiqueta: "Pendiente", clase: "neutral", mensaje: "Sin información." };

    return (
      '<div class="subir-pea-status subir-pea-status-' + escapar(info.clase) + '">' +
        '<span class="subir-badge subir-badge-' + escapar(info.clase) + '">' + escapar(info.etiqueta) + '</span>' +
        '<small>' + escapar(info.mensaje) + '</small>' +
      '</div>'
    );
  }

  function normalizarEstado(materia) {
    // El estado técnico proviene del análisis actual. El clasificado se usa
    // únicamente como respaldo para evitar conservar una revisión anterior.
    var estado = texto(
      materia && (
        materia.estadoValidacion ||
        materia.estadoClasificado ||
        materia.estado
      )
    ).toLowerCase();

    if (["completa", "completo", "ok", "validado", "validada"].indexOf(estado) !== -1) {
      return { codigo: "completa", etiqueta: "Completa", clase: "ok" };
    }

    if (["error", "incompleto", "critico", "bloqueado"].indexOf(estado) !== -1) {
      return { codigo: "error", etiqueta: "Error", clase: "error" };
    }

    return { codigo: "advertencia", etiqueta: "Advertencia", clase: "warn" };
  }

  function resumirMaterias(paquete) {
    var materias = arr(paquete && paquete.materias);
    var salida = {
      total: materias.length,
      completas: 0,
      advertencias: 0,
      errores: 0
    };

    materias.forEach(function (materia) {
      var estado = normalizarEstado(materia).codigo;
      if (estado === "completa") salida.completas += 1;
      else if (estado === "error") salida.errores += 1;
      else salida.advertencias += 1;
    });

    return salida;
  }

  function contarAlertasGlobales(paquete) {
    return arr(paquete && paquete.validacionesSubida).filter(function (validacion) {
      return validacion && !texto(validacion.materiaId);
    }).length;
  }

  function sincronizarResumen(paquete, conteo) {
    if (!paquete || !conteo || conteo.total <= 0) return;

    var resumen = Object.assign({}, paquete.resumenValidacion || {});
    var globales = contarAlertasGlobales(paquete);
    var bloquea = resumen.bloqueaImportacion === true;
    var requiereRevision = conteo.advertencias > 0 || conteo.errores > 0 || globales > 0;

    resumen.totalMaterias = conteo.total;
    resumen.materiasCompletas = conteo.completas;
    resumen.materiasAdvertencia = conteo.advertencias;
    resumen.materiasError = conteo.errores;
    resumen.materiasRevision = conteo.advertencias;
    resumen.materiasIncompletas = conteo.errores;
    resumen.materiasConProblemas = conteo.advertencias + conteo.errores;
    resumen.totalEstadosMaterias = conteo.completas + conteo.advertencias + conteo.errores;
    resumen.contadoresConsistentes = resumen.totalEstadosMaterias === conteo.total;
    resumen.alertasGlobales = globales;
    resumen.requiereRevision = requiereRevision;
    resumen.listoParaImportar = !bloquea && !requiereRevision;
    resumen.puedeImportarConObservaciones = !bloquea;
    paquete.resumenValidacion = resumen;

    paquete.carga = Object.assign({}, paquete.carga || {}, {
      materiasCompletas: conteo.completas,
      materiasAdvertencia: conteo.advertencias,
      materiasError: conteo.errores,
      materiasRevision: conteo.advertencias,
      materiasIncompletas: conteo.errores,
      estado: bloquea ? "bloqueado" : (requiereRevision ? "con_observaciones" : "validado")
    });
  }

  function renderBadgeEstado(materia) {
    var estado = normalizarEstado(materia);
    return '<span class="subir-badge subir-badge-' + estado.clase + '" data-estado-clasificado="' + estado.codigo + '">' + estado.etiqueta + "</span>";
  }

  function actualizarContadores(paquete) {
    var resumen = paquete && paquete.resumenValidacion ? paquete.resumenValidacion : {};
    var conteo = resumirMaterias(paquete);
    var completas;
    var advertencias;
    var errores;
    var totalMaterias;

    if (conteo.total > 0) {
      sincronizarResumen(paquete, conteo);
      completas = conteo.completas;
      advertencias = conteo.advertencias;
      errores = conteo.errores;
      totalMaterias = conteo.total;
    } else {
      completas = numeroResumen(resumen, "materiasCompletas");
      advertencias = numeroResumen(resumen, "materiasAdvertencia", "materiasRevision");
      errores = numeroResumen(resumen, "materiasError", "materiasIncompletas");
      totalMaterias = numeroResumen(resumen, "totalMaterias");
    }

    setTexto("statCompletas", completas);
    setTexto("statAdvertencias", advertencias);
    setTexto("statErrores", errores);

    var total = completas + advertencias + errores;
    var panel = $("resumenEstadosMaterias");

    if (panel) {
      panel.setAttribute("data-total-estados", String(total));
      panel.setAttribute("data-total-materias", String(totalMaterias));
      panel.classList.toggle("subir-state-summary-error", total !== totalMaterias);
      panel.title = total === totalMaterias
        ? "Los estados coinciden con el total de materias."
        : "Los contadores no coinciden con el total de materias.";
    }
  }

  function actualizarEstadoGeneral(paquete) {
    if (!NS.Preview || typeof NS.Preview.pintarEstado !== "function") return;

    var resumen = paquete && paquete.resumenValidacion ? paquete.resumenValidacion : {};
    var conteo = resumirMaterias(paquete);
    var advertencias = conteo.total > 0
      ? conteo.advertencias
      : numeroResumen(resumen, "materiasAdvertencia", "materiasRevision");
    var errores = conteo.total > 0
      ? conteo.errores
      : numeroResumen(resumen, "materiasError", "materiasIncompletas");
    var alertasGlobales = contarAlertasGlobales(paquete);

    if (resumen.bloqueaImportacion === true) {
      NS.Preview.pintarEstado(
        "error",
        "ZIP con errores críticos",
        "La importación está bloqueada hasta corregir los problemas señalados."
      );
      return;
    }

    if (errores > 0) {
      NS.Preview.pintarEstado(
        "error",
        "ZIP con errores",
        errores + " materia" + (errores === 1 ? " tiene" : "s tienen") + " archivos faltantes, ilegibles, incompletos o sin contenido."
      );
      return;
    }

    if (advertencias > 0) {
      NS.Preview.pintarEstado(
        "warn",
        "ZIP con advertencias",
        advertencias + " materia" + (advertencias === 1 ? " requiere" : "s requieren") + " revisión antes de continuar."
      );
      return;
    }

    if (alertasGlobales > 0) {
      NS.Preview.pintarEstado(
        "warn",
        alertasGlobales === 1 ? "ZIP con alerta general" : "ZIP con alertas generales",
        "Se detect" + (alertasGlobales === 1 ? "ó 1 alerta general" : "aron " + alertasGlobales + " alertas generales") + " del ZIP. Revisa el detalle antes de continuar."
      );
      return;
    }

    NS.Preview.pintarEstado(
      "ok",
      "ZIP listo para importar",
      "Todas las materias tienen los tres PEA y contenido curricular válido."
    );
  }

  function actualizarFilas(paquete) {
    var botones = document.querySelectorAll("#tablaPreview [data-detalle-materia]");

    Array.prototype.forEach.call(botones, function (boton) {
      var materiaId = boton.getAttribute("data-detalle-materia");
      var materia = obtenerMateria(paquete, materiaId);
      var fila = boton.closest ? boton.closest("tr") : null;

      if (!materia || !fila || !fila.children || fila.children.length < 8) return;

      var estado = normalizarEstado(materia);
      var celdaEstado = fila.children[7];
      var badgeActual = celdaEstado.querySelector
        ? celdaEstado.querySelector("[data-estado-clasificado]")
        : null;
      var debeRepintar = !badgeActual ||
        badgeActual.getAttribute("data-estado-clasificado") !== estado.codigo ||
        texto(badgeActual.textContent) !== estado.etiqueta;

      if (fila.children.length >= 7) {
        fila.children[4].innerHTML = renderEstadoPEA(estadoPEA(paquete, materia, "pea_base"));
        fila.children[5].innerHTML = renderEstadoPEA(estadoPEA(paquete, materia, "pea_unidades"));
        fila.children[6].innerHTML = renderEstadoPEA(estadoPEA(paquete, materia, "pea_actividades"));
      }

      if (debeRepintar) {
        celdaEstado.innerHTML = renderBadgeEstado(materia);
      }

      fila.setAttribute("data-estado-materia", estado.codigo);
      fila.classList.remove(
        "subir-row-completa",
        "subir-row-advertencia",
        "subir-row-error"
      );
      fila.classList.add("subir-row-" + estado.codigo);
    });
  }

  function actualizar(paquete) {
    if (actualizando) return;
    actualizando = true;

    try {
      paqueteActual = paquete || paqueteActual;
      if (!paqueteActual) return;
      actualizarContadores(paqueteActual);
      actualizarEstadoGeneral(paqueteActual);
      actualizarFilas(paqueteActual);
    } finally {
      actualizando = false;
    }
  }

  function observarTabla() {
    var tabla = $("tablaPreview");

    if (!tabla || typeof window.MutationObserver !== "function") return;
    if (observerTabla) observerTabla.disconnect();

    observerTabla = new window.MutationObserver(function () {
      window.setTimeout(function () {
        actualizar(paqueteActual);
      }, 0);
    });

    observerTabla.observe(tabla, { childList: true, subtree: true });
  }

  function conectarEventos() {
    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "buscadorPreview") {
        window.setTimeout(function () {
          actualizar(paqueteActual);
        }, 0);
      }
    });
  }

  function instalar() {
    if (!NS.Preview || typeof NS.Preview.pintarPaquete !== "function") {
      throw new Error("subir.estados-ui.js requiere subir.preview.js cargado previamente.");
    }

    if (NS.Preview.__estadosUI === true) return;

    var pintarOriginal = NS.Preview.pintarPaquete;
    var limpiarOriginal = NS.Preview.limpiarPreview;

    NS.Preview.pintarPaquete = function (paquete) {
      paqueteActual = paquete;
      var resultado = pintarOriginal.apply(NS.Preview, arguments);
      actualizar(paquete);
      observarTabla();
      return resultado;
    };

    NS.Preview.limpiarPreview = function () {
      paqueteActual = null;
      if (observerTabla) observerTabla.disconnect();
      setTexto("statAdvertencias", 0);
      setTexto("statErrores", 0);
      return limpiarOriginal.apply(NS.Preview, arguments);
    };

    NS.Preview.__estadosUI = true;
    conectarEventos();
  }

  NS.EstadosUI = {
    VERSION: VERSION,
    instalar: instalar,
    actualizar: actualizar,
    actualizarContadores: actualizarContadores,
    actualizarEstadoGeneral: actualizarEstadoGeneral,
    actualizarFilas: actualizarFilas,
    normalizarEstado: normalizarEstado,
    resumirMaterias: resumirMaterias,
    sincronizarResumen: sincronizarResumen,
    renderBadgeEstado: renderBadgeEstado,
    estadoPEA: estadoPEA,
    renderEstadoPEA: renderEstadoPEA
  };

  instalar();
})(window, document);