/* =========================================================
Nombre completo: comunicados.plantilla.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.plantilla.js
Función o funciones:
- Recuperar información curricular nueva y datos heredados ya guardados en BDLocal.
- Interpretar descripción, objetivo, cuatro unidades, resultados y competencias.
- Agrupar correctamente todos los contenidos en las unidades 1, 2, 3 y 4.
- Mostrar todas las actividades del PEA Actividades.
- Mostrar bibliografía y justificación individual de cada referencia.
- Construir el comunicado institucional con el logo oficial sin modificarlo.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  var CONFIG_DEFAULT = {
    logoSrc: "../assets/logo-itsqmet-comunicado-oficial.svg",
    numeroFijo: "01"
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escaparConSaltos(valor) {
    return escapar(valor).replace(/\n/g, "<br>");
  }

  function normalizarCampo(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function obtenerValor(obj, aliases) {
    obj = obj || {};
    aliases = arr(aliases).map(normalizarCampo);
    var keys = Object.keys(obj);

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (aliases.indexOf(normalizarCampo(key)) !== -1 && texto(obj[key])) {
        return texto(obj[key]);
      }
    }

    return "";
  }

  function obtenerNumero(obj, aliases, defecto) {
    var valor = obtenerValor(obj, aliases);
    var match = valor.match(/-?\d+/);
    return match ? Number(match[0]) : Number(defecto || 0);
  }

  function agregarFilasHojas(destino, hojas) {
    hojas = hojas || {};

    Object.keys(hojas).forEach(function (nombre) {
      arr(hojas[nombre] && hojas[nombre].filas).forEach(function (fila) {
        destino.push(fila);
      });
    });
  }

  function obtenerFilasBase(peaBase) {
    peaBase = peaBase || {};
    var datos = peaBase.datos || {};
    var filas = [];

    arr(datos.filas).forEach(function (fila) { filas.push(fila); });
    arr(peaBase.filas).forEach(function (fila) { filas.push(fila); });
    agregarFilasHojas(filas, datos.hojas);
    agregarFilasHojas(filas, peaBase.hojas);

    return filas;
  }

  function crearMapaUnidadesBase() {
    return {
      1: { unidadNumero: 1, nombre: "", competencia: "", resultadoAprendizaje: "" },
      2: { unidadNumero: 2, nombre: "", competencia: "", resultadoAprendizaje: "" },
      3: { unidadNumero: 3, nombre: "", competencia: "", resultadoAprendizaje: "" },
      4: { unidadNumero: 4, nombre: "", competencia: "", resultadoAprendizaje: "" }
    };
  }

  function interpretarBase(peaBase) {
    peaBase = peaBase || {};
    var datos = peaBase.datos || peaBase;
    var campos = peaBase.campos || datos.campos || {};
    var mapaUnidades = crearMapaUnidadesBase();
    var bibliografia = [];
    var descripcion = texto(datos.descripcion || peaBase.descripcion || campos.descripcion_asignatura || campos.descripcion);
    var objetivo = texto(datos.objetivo || peaBase.objetivo || campos.objetivo_asignatura || campos.objetivo);

    arr(datos.unidadesBase || peaBase.unidadesBase).forEach(function (unidad) {
      var numero = Number(unidad.unidadNumero || unidad.orden || 0);
      if (!mapaUnidades[numero]) return;

      mapaUnidades[numero].nombre = texto(unidad.nombre || unidad.tituloUnidad);
      mapaUnidades[numero].competencia = texto(unidad.competencia);
      mapaUnidades[numero].resultadoAprendizaje = texto(
        unidad.resultadoAprendizaje || unidad.resultado
      );
    });

    arr(datos.bibliografia || peaBase.bibliografia).forEach(function (item, index) {
      var referencia = texto(item.referencia || item.bibliografia || item.descripcion);
      if (!referencia) return;

      bibliografia.push({
        orden: Number(item.orden || index + 1),
        referencia: referencia,
        codigoReferencia: texto(item.codigoReferencia || item.codigo || ""),
        justificacion: texto(item.justificacion || item.descripcionComponente3 || "")
      });
    });

    obtenerFilasBase(peaBase).forEach(function (fila) {
      var codigo = obtenerNumero(fila, ["codigoComponente", "codigo_componente"], 0);
      var orden = obtenerNumero(fila, ["ordenComponente", "orden_componente"], 0);
      var descripcion1 = obtenerValor(fila, ["descripcionComponente", "descripcion_componente"]);
      var descripcion2 = obtenerValor(fila, ["descripcionComponente2", "descripcion_componente_2"]);
      var descripcion3 = obtenerValor(fila, ["descripcionComponente3", "descripcion_componente_3"]);

      if (codigo === 1 && !descripcion) descripcion = descripcion1;
      if (codigo === 2 && !objetivo) objetivo = descripcion1;

      if (orden >= 1 && orden <= 4) {
        if (codigo === 3 && !mapaUnidades[orden].nombre) {
          mapaUnidades[orden].nombre = descripcion1;
        }
        if (codigo === 4 && !mapaUnidades[orden].competencia) {
          mapaUnidades[orden].competencia = descripcion1;
        }
        if (codigo === 5 && !mapaUnidades[orden].resultadoAprendizaje) {
          mapaUnidades[orden].resultadoAprendizaje = descripcion1;
        }
      }

      if (codigo === 8 && descripcion1) {
        var yaExiste = bibliografia.some(function (item) {
          return item.referencia === descripcion1;
        });

        if (!yaExiste) {
          bibliografia.push({
            orden: orden || bibliografia.length + 1,
            referencia: descripcion1,
            codigoReferencia: descripcion2,
            justificacion: descripcion3
          });
        }
      }
    });

    return {
      descripcion: descripcion,
      objetivo: objetivo,
      unidadesBase: [
        mapaUnidades[1],
        mapaUnidades[2],
        mapaUnidades[3],
        mapaUnidades[4]
      ],
      bibliografia: bibliografia.sort(function (a, b) {
        return Number(a.orden || 0) - Number(b.orden || 0);
      })
    };
  }

  function agregarContenido(unidad, contenido) {
    contenido = texto(contenido);
    if (!contenido) return;

    if (unidad.contenidos.indexOf(contenido) === -1) {
      unidad.contenidos.push(contenido);
    }
  }

  function prepararUnidades(unidadesGuardadas, unidadesBase) {
    var unidades = {};

    for (var i = 1; i <= 4; i += 1) {
      var base = arr(unidadesBase).find(function (item) {
        return Number(item.unidadNumero || 0) === i;
      }) || {};

      unidades[i] = {
        unidadNumero: i,
        nombre: texto(base.nombre || base.tituloUnidad || ""),
        resultadoAprendizaje: texto(base.resultadoAprendizaje || base.resultado || ""),
        competencia: texto(base.competencia || ""),
        contenidos: []
      };
    }

    arr(unidadesGuardadas).forEach(function (registro) {
      var numero = Number(
        registro.unidadNumero ||
        registro.ordenComponente ||
        registro.orden_componente ||
        registro.unidad ||
        0
      );

      if (!unidades[numero]) return;

      arr(registro.contenidos).forEach(function (contenido) {
        agregarContenido(unidades[numero], contenido);
      });

      arr(registro.filasOriginales).forEach(function (fila) {
        agregarContenido(
          unidades[numero],
          obtenerValor(fila, ["descripcionComponente", "descripcion_componente", "contenido", "tema"])
        );
      });

      agregarContenido(
        unidades[numero],
        obtenerValor(registro, [
          "descripcionComponente",
          "descripcion_componente",
          "contenido",
          "temaDetectado",
          "tema",
          "titulo"
        ])
      );
    });

    return [unidades[1], unidades[2], unidades[3], unidades[4]];
  }

  function prepararActividades(actividades) {
    return arr(actividades).map(function (actividad, index) {
      return {
        orden: index + 1,
        mecanismo: texto(
          actividad.mecanismo ||
          actividad.tipoActividad ||
          actividad.tipo_actividad ||
          actividad.tipo ||
          actividad.modalidad ||
          "Actividad"
        ),
        tema: texto(actividad.tema || actividad.titulo || ""),
        descripcion: texto(
          actividad.descripcion ||
          actividad.actividadDetectada ||
          actividad.actividad ||
          actividad.contenido ||
          ""
        )
      };
    }).filter(function (actividad) {
      return actividad.mecanismo || actividad.tema || actividad.descripcion;
    });
  }

  function prepararDatosMateria(detalle, reserva, config) {
    detalle = detalle || {};
    reserva = reserva || {};
    config = Object.assign({}, CONFIG_DEFAULT, config || {});

    config.logoSrc = CONFIG_DEFAULT.logoSrc;
    config.numeroFijo = CONFIG_DEFAULT.numeroFijo;

    var materia = detalle.materia || {};
    var carrera = detalle.carrera || {};
    var base = interpretarBase(detalle.peaBase || {});
    var unidades = prepararUnidades(detalle.unidades || [], base.unidadesBase);
    var actividades = prepararActividades(detalle.actividades || []);
    var estadoGeneracion = detalle.estadoGeneracion || {};

    if (estadoGeneracion.puedeGenerar === false) {
      throw new Error(
        "No se puede generar el comunicado. Faltan: " +
        arr(estadoGeneracion.faltantes).join(", ")
      );
    }

    return {
      config: config,
      materiaId: texto(materia.id),
      carreraId: texto(carrera.id),
      numeroComunicado: texto(reserva.numero),
      numeroFijo: "01",
      carrera: texto(carrera.nombre || "No registrada"),
      nombreAsignatura: texto(
        materia.nombreMostrar ||
        materia.nombreInstitucional ||
        materia.nombreCorregido ||
        materia.nombre ||
        "Asignatura sin nombre"
      ),
      descripcion: base.descripcion || "No se registra descripción de la asignatura.",
      objetivo: base.objetivo || "No se registra objetivo de la asignatura.",
      unidades: unidades,
      actividades: actividades,
      bibliografia: base.bibliografia,
      generadoEn: new Date().toISOString()
    };
  }

  function renderContenidos(unidad) {
    if (!unidad.contenidos.length) {
      return '<p class="com-pdf-vacio">No se registran contenidos para esta unidad.</p>';
    }

    return (
      '<ol class="com-pdf-lista-contenidos">' +
        unidad.contenidos.map(function (contenido) {
          return "<li>" + escaparConSaltos(contenido) + "</li>";
        }).join("") +
      "</ol>"
    );
  }

  function renderUnidades(data) {
    return data.unidades.map(function (unidad) {
      var numero = unidad.unidadNumero;

      return (
        '<section class="com-pdf-unidad">' +
          '<h2>Unidad ' + escapar(numero) + ': ' + escapar(unidad.nombre || "No registrada") + "</h2>" +
          '<div class="com-pdf-campo">' +
            '<strong>Resultados de aprendizaje de la unidad ' + escapar(numero) + ':</strong>' +
            '<p>' + escaparConSaltos(unidad.resultadoAprendizaje || "No registrado") + "</p>" +
          "</div>" +
          '<div class="com-pdf-campo">' +
            '<strong>Competencias de la unidad ' + escapar(numero) + ':</strong>' +
            '<p>' + escaparConSaltos(unidad.competencia || "No registrada") + "</p>" +
          "</div>" +
          '<div class="com-pdf-campo">' +
            '<strong>Contenidos de la unidad ' + escapar(numero) + ':</strong>' +
            renderContenidos(unidad) +
          "</div>" +
        "</section>"
      );
    }).join("");
  }

  function renderActividades(data) {
    if (!data.actividades.length) {
      return '<p class="com-pdf-vacio">No se registran actividades.</p>';
    }

    return (
      '<table class="com-pdf-table com-pdf-actividades">' +
        "<thead><tr>" +
          "<th>No.</th>" +
          "<th>Mecanismo</th>" +
          "<th>Tema</th>" +
          "<th>Descripción</th>" +
        "</tr></thead>" +
        "<tbody>" +
          data.actividades.map(function (actividad) {
            return (
              "<tr>" +
                "<td>" + escapar(actividad.orden) + "</td>" +
                "<td>" + escaparConSaltos(actividad.mecanismo) + "</td>" +
                "<td>" + escaparConSaltos(actividad.tema || "No registrado") + "</td>" +
                "<td>" + escaparConSaltos(actividad.descripcion || "No registrada") + "</td>" +
              "</tr>"
            );
          }).join("") +
        "</tbody>" +
      "</table>"
    );
  }

  function renderBibliografia(data) {
    if (!data.bibliografia.length) {
      return '<p class="com-pdf-vacio">No se registra bibliografía.</p>';
    }

    return data.bibliografia.map(function (item, index) {
      return (
        '<section class="com-pdf-bibliografia-item">' +
          '<p><strong>Bibliografía ' + escapar(index + 1) + ':</strong> ' +
            escaparConSaltos(item.referencia) + "</p>" +
          '<p><strong>Justificación de la bibliografía ' + escapar(index + 1) + ':</strong> ' +
            escaparConSaltos(item.justificacion || "No registrada") + "</p>" +
        "</section>"
      );
    }).join("");
  }

  function generarHTMLComunicado(data) {
    return (
      '<article class="com-pdf-page" data-materia-id="' + escapar(data.materiaId) + '">' +
        '<header class="com-pdf-header">' +
          '<img class="com-pdf-logo" src="' + escapar(data.config.logoSrc) + '" alt="ITSQMET" />' +
          '<div class="com-pdf-numero">Comunicado No. 01 ' + escapar(data.numeroComunicado) + "</div>" +
        "</header>" +

        '<main class="com-pdf-body">' +
          '<section class="com-pdf-resumen">' +
            '<p><strong>Carrera:</strong> ' + escapar(data.carrera) + "</p>" +
            '<p><strong>Asignatura:</strong> ' + escapar(data.nombreAsignatura) + "</p>" +
          "</section>" +

          '<section class="com-pdf-seccion">' +
            "<h1>Descripción de la asignatura:</h1>" +
            "<p>" + escaparConSaltos(data.descripcion) + "</p>" +
          "</section>" +

          '<section class="com-pdf-seccion">' +
            "<h1>Objetivo de la asignatura:</h1>" +
            "<p>" + escaparConSaltos(data.objetivo) + "</p>" +
          "</section>" +

          renderUnidades(data) +

          '<section class="com-pdf-seccion com-pdf-salto-preferido">' +
            "<h1>Actividades:</h1>" +
            renderActividades(data) +
          "</section>" +

          '<section class="com-pdf-seccion com-pdf-salto-preferido">' +
            "<h1>Bibliografía y justificación:</h1>" +
            renderBibliografia(data) +
          "</section>" +
        "</main>" +
      "</article>"
    );
  }

  function generarDocumento(detalle, reserva, config) {
    var data = prepararDatosMateria(detalle, reserva, config);

    return {
      materiaId: data.materiaId,
      carreraId: data.carreraId,
      numeroComunicado: data.numeroComunicado,
      nombreAsignatura: data.nombreAsignatura,
      data: data,
      html: generarHTMLComunicado(data)
    };
  }

  function generarDocumentoMultiple(items, config) {
    var documentos = arr(items).map(function (item) {
      return generarDocumento(item.detalle, item.reserva, config);
    });

    return {
      total: documentos.length,
      documentos: documentos,
      html: documentos.map(function (documento) {
        return documento.html;
      }).join("")
    };
  }

  NS.Plantilla = {
    CONFIG_DEFAULT: CONFIG_DEFAULT,
    interpretarBase: interpretarBase,
    prepararUnidades: prepararUnidades,
    prepararActividades: prepararActividades,
    prepararDatosMateria: prepararDatosMateria,
    generarHTMLComunicado: generarHTMLComunicado,
    generarDocumento: generarDocumento,
    generarDocumentoMultiple: generarDocumentoMultiple
  };
})(window);
