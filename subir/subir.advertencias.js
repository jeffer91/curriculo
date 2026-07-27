/* =========================================================
Nombre completo: subir.advertencias.js
Ruta o ubicación: /Curriculo/subir/subir.advertencias.js
Funciones:
- Enriquecer cada validación con un diagnóstico entendible para el usuario.
- Asociar título, problema, solución, acción recomendada y archivo afectado.
- Evitar que una materia quede en revisión sin una explicación visible.
- Mantener compatibilidad con el validador existente sin duplicar reglas.
========================================================= */

(function (window) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;

  var CATALOGO = {
    materia_incompleta: {
      titulo: "Faltan archivos PEA obligatorios",
      solucion: "Agrega a la carpeta de la materia los archivos PEA Base, PEA Unidades y PEA Actividades que falten, vuelve a comprimir la carrera y escanea nuevamente.",
      accion: "Completar los archivos faltantes y volver a escanear."
    },
    contenido_pea_invalido: {
      titulo: "PEA sin contenido curricular válido",
      solucion: "Abre el archivo indicado y verifica que contenga información curricular reconocible. No basta con que el Excel exista: debe incluir datos en sus hojas.",
      accion: "Corregir el contenido del Excel y volver a escanear."
    },
    archivos_duplicados: {
      titulo: "Archivos PEA duplicados",
      solucion: "Conserva un solo archivo por cada tipo PEA dentro de la materia. Elimina o mueve las copias adicionales antes de volver a crear el ZIP.",
      accion: "Eliminar duplicados y volver a escanear."
    },
    archivos_no_identificados: {
      titulo: "Archivo curricular no identificado",
      solucion: "Revisa el nombre y el contenido del archivo para que pueda reconocerse como PEA Base, PEA Unidades o PEA Actividades.",
      accion: "Renombrar o corregir el archivo y volver a escanear."
    },
    error_lectura_excel: {
      titulo: "No se pudo leer un archivo Excel",
      solucion: "Abre el Excel afectado, comprueba que no esté dañado, protegido o incompleto, guárdalo nuevamente como .xlsx y repite el escaneo.",
      accion: "Reparar o reemplazar el Excel afectado."
    },
    excel_no_procesado: {
      titulo: "Excel detectado, pero no procesado",
      solucion: "Verifica que el archivo sea un Excel válido y que no esté vacío, protegido o abierto por otro programa. Después vuelve a generar el ZIP.",
      accion: "Revisar el archivo y volver a escanear."
    },
    excel_sin_contenido_curricular: {
      titulo: "Excel sin registros curriculares útiles",
      solucion: "Completa las hojas y campos correspondientes del PEA. El archivo se abrió correctamente, pero el sistema no encontró registros que pueda importar.",
      accion: "Completar el contenido curricular del Excel."
    },
    contenido_base_incompleto: {
      titulo: "PEA Base con información incompleta",
      solucion: "Completa los campos curriculares señalados, especialmente la descripción y el objetivo de la asignatura, y escanea nuevamente.",
      accion: "Completar los campos faltantes del PEA Base."
    },
    carrera_baja_confianza: {
      titulo: "Carrera detectada con baja confianza",
      solucion: "Revisa el nombre de la carpeta de la carrera y evita abreviaturas, símbolos o nombres ambiguos.",
      accion: "Confirmar o corregir el nombre de la carrera."
    },
    nivel_baja_confianza: {
      titulo: "Nivel detectado con baja confianza",
      solucion: "Revisa el nombre de la carpeta del nivel y utiliza una denominación clara, por ejemplo: NIVEL 1, NIVEL 2 o PRIMER NIVEL.",
      accion: "Confirmar o corregir el nombre del nivel."
    },
    lectura_excel_parcial: {
      titulo: "Lectura parcial de archivos Excel",
      solucion: "Revisa los archivos indicados en el diagnóstico. Al menos uno de los Excel no pudo leerse o no produjo contenido curricular válido.",
      accion: "Corregir los Excel señalados antes de importar."
    },
    lectura_excel_total_fallida: {
      titulo: "No se pudo obtener contenido curricular",
      solucion: "Comprueba la estructura completa del ZIP y reemplaza los Excel dañados, vacíos o incompatibles. Este problema debe resolverse antes de importar.",
      accion: "Corregir el ZIP completo y volver a escanear."
    },
    revision_sin_detalle: {
      titulo: "Materia pendiente de revisión",
      solucion: "Abre el detalle de la materia y revisa los tres archivos PEA. El estado requiere revisión, pero el validador original no entregó una causa específica.",
      accion: "Revisar manualmente los tres PEA de la materia."
    },
    general: {
      titulo: "Observación detectada",
      solucion: "Revisa el detalle de la observación y corrige el archivo o la estructura indicada antes de volver a escanear.",
      accion: "Revisar el detalle y corregir el origen de la observación."
    }
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function catalogoPara(tipo) {
    return CATALOGO[tipo] || CATALOGO.general;
  }

  function primerArchivo(validacion) {
    validacion = validacion || {};
    var detalle = validacion.detalle;
    var candidatos = [];

    if (Array.isArray(detalle)) {
      candidatos = detalle;
    } else if (detalle && Array.isArray(detalle.archivosProblema)) {
      candidatos = detalle.archivosProblema;
    } else if (detalle && (
      detalle.archivoId || detalle.nombreArchivo || detalle.rutaOriginal
    )) {
      candidatos = [detalle];
    }

    if (!candidatos.length && (
      validacion.archivoId || validacion.nombreArchivo || validacion.rutaOriginal
    )) {
      candidatos = [validacion];
    }

    var archivo = candidatos.find(function (item) {
      return item && (item.archivoId || item.nombreArchivo || item.rutaOriginal);
    }) || null;

    if (!archivo) return null;

    return {
      id: texto(archivo.archivoId || archivo.id),
      nombre: texto(archivo.nombreArchivo),
      ruta: texto(archivo.rutaOriginal),
      tipo: texto(archivo.tipoPEALabel || archivo.tipoLabel || archivo.tipo || archivo.tipoCodigo),
      motivo: texto(archivo.motivo || archivo.errorTecnico || archivo.error || archivo.errorExcel || archivo.errorLectura)
    };
  }

  function impactoDe(validacion) {
    if (validacion.bloqueaImportacion === true || validacion.severidad === "critico") {
      return "Debe corregirse antes de importar.";
    }
    if (validacion.severidad === "error") {
      return "La materia puede importarse únicamente con observaciones y revisión posterior.";
    }
    if (validacion.severidad === "advertencia") {
      return "No bloquea la importación, pero conviene corregirla antes de continuar.";
    }
    return "Revisión informativa.";
  }

  function enriquecerValidacion(validacion) {
    validacion = Object.assign({}, validacion || {});

    var tipo = texto(validacion.tipo || "general");
    var ficha = catalogoPara(tipo);
    var archivo = primerArchivo(validacion);
    var bloquea = validacion.bloqueaImportacion === true || validacion.severidad === "critico";
    var titulo = texto(validacion.titulo) || ficha.titulo;
    var solucion = texto(validacion.solucion) || ficha.solucion;
    var accion = texto(validacion.accionRecomendada) || ficha.accion;

    validacion.titulo = titulo;
    validacion.solucion = solucion;
    validacion.accionRecomendada = accion;
    validacion.archivoAfectado = archivo ? archivo.nombre : texto(validacion.archivoAfectado);
    validacion.rutaArchivo = archivo ? archivo.ruta : texto(validacion.rutaArchivo);
    validacion.puedeImportar = !bloquea;
    validacion.diagnosticoUsuario = {
      codigo: tipo,
      titulo: titulo,
      problema: texto(validacion.mensaje) || "Se detectó una observación que requiere revisión.",
      solucion: solucion,
      accionRecomendada: accion,
      impacto: impactoDe(validacion),
      severidad: texto(validacion.severidad || "info"),
      bloqueaImportacion: bloquea,
      puedeImportar: !bloquea,
      archivo: archivo
    };

    return validacion;
  }

  function crearValidacionesFaltantes(paquete, validaciones) {
    var existentes = {};

    validaciones.forEach(function (validacion) {
      if (validacion && validacion.materiaId) existentes[validacion.materiaId] = true;
    });

    arr(paquete.materias).forEach(function (materia) {
      var estado = texto(materia && materia.estadoValidacion).toLowerCase();
      if (!materia || !materia.id || estado === "" || estado === "completo") return;
      if (existentes[materia.id]) return;

      validaciones.push(enriquecerValidacion({
        id: "val_revision_" + materia.id,
        tipo: "revision_sin_detalle",
        severidad: estado === "incompleto" ? "error" : "advertencia",
        bloqueaImportacion: false,
        materiaId: materia.id,
        carreraId: materia.carreraId || "",
        nivelId: materia.nivelId || "",
        codigoMateria: materia.codigo || "",
        materia: materia.nombre || "",
        mensaje: "La materia quedó en estado " + estado + " y necesita una revisión específica.",
        detalle: {
          faltantes: arr(materia.archivosFaltantes),
          tiposSinContenido: arr(materia.archivosSinContenido)
        }
      }));
    });

    return validaciones;
  }

  function recalcularResumen(paquete) {
    var validaciones = arr(paquete.validacionesSubida);
    var resumen = Object.assign({}, paquete.resumenValidacion || {});
    var criticas = validaciones.filter(function (v) { return v.severidad === "critico"; }).length;
    var errores = validaciones.filter(function (v) { return v.severidad === "error"; }).length;
    var advertencias = validaciones.filter(function (v) { return v.severidad === "advertencia"; }).length;
    var bloquea = validaciones.some(function (v) {
      return v.bloqueaImportacion === true || v.severidad === "critico";
    });
    var requiereRevision = validaciones.length > 0 || Number(resumen.materiasIncompletas || 0) > 0 || Number(resumen.materiasRevision || 0) > 0;

    resumen.validacionesCriticas = criticas;
    resumen.validacionesError = errores;
    resumen.validacionesAdvertencia = advertencias;
    resumen.totalValidaciones = validaciones.length;
    resumen.bloqueaImportacion = bloquea;
    resumen.requiereRevision = requiereRevision;
    resumen.listoParaImportar = !bloquea && !requiereRevision;
    resumen.puedeImportarConObservaciones = !bloquea;
    paquete.resumenValidacion = resumen;

    if (paquete.carga) {
      paquete.carga = Object.assign({}, paquete.carga, {
        estado: bloquea ? "bloqueado" : (requiereRevision ? "con_observaciones" : "validado")
      });
    }

    return paquete;
  }

  function enriquecerPaquete(paquete) {
    if (!paquete || typeof paquete !== "object") return paquete;

    var validaciones = arr(paquete.validacionesSubida).map(enriquecerValidacion);
    validaciones = crearValidacionesFaltantes(paquete, validaciones);
    paquete.validacionesSubida = validaciones;
    paquete.diagnosticosUsuario = validaciones.map(function (validacion) {
      return validacion.diagnosticoUsuario;
    });

    return recalcularResumen(paquete);
  }

  function instalar() {
    if (!NS.Validador || typeof NS.Validador.validarPaquete !== "function") {
      throw new Error("subir.advertencias.js requiere subir.validador.js cargado previamente.");
    }

    if (NS.Validador.__advertenciasEstructuradas === true) return;

    var validarOriginal = NS.Validador.validarPaquete;

    NS.Validador.validarPaquete = function (paquete, opciones) {
      return enriquecerPaquete(validarOriginal.call(NS.Validador, paquete, opciones));
    };

    NS.Validador.__advertenciasEstructuradas = true;
  }

  NS.Advertencias = {
    VERSION: "2.0.0",
    CATALOGO: CATALOGO,
    enriquecerValidacion: enriquecerValidacion,
    enriquecerPaquete: enriquecerPaquete,
    instalar: instalar
  };

  instalar();
})(window);
