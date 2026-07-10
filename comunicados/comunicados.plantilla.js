/* =========================================================
Nombre completo: comunicados.plantilla.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.plantilla.js
Función o funciones:
- Organizar la información de PEA Base, PEA Unidades y PEA Actividades.
- Construir el contenido institucional del comunicado por materia.
- Preparar HTML imprimible para convertirlo luego a PDF.
- Usar formato institucional tipo COMUNICADO con número, fecha, unidad responsable y nota.
- Bloquear generación cuando la materia no tenga los 3 PEA obligatorios.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var NS = window.ComunicadosCCC;

  var CONFIG_DEFAULT = {
    unidadResponsable: "UNIDAD DE GESTIÓN PEDAGÓGICA ACADÉMICA",
    ciudad: "Quito, D.M.",
    nota: "Nota: Cualquier inquietud por favor acercarse a la Unidad de Gestión Pedagógica Académica.",
    titulo: "COMUNICADO",
    logoSrc: "../assets/logo-itsqmet-comunicado.png"
  };

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
      .replace(/[_\-–—]+/g, " ")
      .replace(/[^\w\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fusionarObjetos() {
    var final = {};

    for (var i = 0; i < arguments.length; i += 1) {
      var obj = arguments[i] || {};

      Object.keys(obj).forEach(function (key) {
        if (texto(obj[key]) && !texto(final[key])) {
          final[key] = obj[key];
        }
      });
    }

    return final;
  }

  function extraerCamposBase(peaBase) {
    peaBase = peaBase || {};

    var camposDirectos = peaBase.campos || {};
    var camposDatos = peaBase.datos && peaBase.datos.campos ? peaBase.datos.campos : {};
    var camposHojas = {};

    var hojas = peaBase.hojas || {};

    Object.keys(hojas).forEach(function (nombreHoja) {
      var hoja = hojas[nombreHoja] || {};
      var campos = hoja.campos || {};

      Object.keys(campos).forEach(function (key) {
        if (!camposHojas[key]) {
          camposHojas[key] = campos[key];
        }
      });
    });

    return fusionarObjetos(camposDirectos, camposDatos, camposHojas);
  }

  function buscarCampo(campos, candidatos) {
    campos = campos || {};
    candidatos = arr(candidatos);

    var keys = Object.keys(campos);

    for (var i = 0; i < candidatos.length; i += 1) {
      var cand = normalizar(candidatos[i]);

      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];

        if (normalizar(key) === cand && texto(campos[key])) {
          return texto(campos[key]);
        }
      }
    }

    for (var c = 0; c < candidatos.length; c += 1) {
      var cand2 = normalizar(candidatos[c]);

      for (var k = 0; k < keys.length; k += 1) {
        var key2 = keys[k];
        var keyNorm = normalizar(key2);

        if ((keyNorm.includes(cand2) || cand2.includes(keyNorm)) && texto(campos[key2])) {
          return texto(campos[key2]);
        }
      }
    }

    return "";
  }

  function obtenerValorFila(fila, candidatos) {
    fila = fila || {};
    candidatos = arr(candidatos);

    var keys = Object.keys(fila);

    for (var i = 0; i < candidatos.length; i += 1) {
      var candidato = normalizar(candidatos[i]);

      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var keyNorm = normalizar(key);

        if ((keyNorm === candidato || keyNorm.includes(candidato) || candidato.includes(keyNorm)) && texto(fila[key])) {
          return texto(fila[key]);
        }
      }
    }

    return "";
  }

  function ordenarPorUnidad(a, b) {
    var ua = Number(a.unidadNumero || 0);
    var ub = Number(b.unidadNumero || 0);

    if (ua !== ub) return ua - ub;

    return texto(a.temaDetectado || a.actividadDetectada || "").localeCompare(
      texto(b.temaDetectado || b.actividadDetectada || ""),
      "es"
    );
  }

  function prepararUnidades(unidades) {
    return arr(unidades)
      .map(function (unidad, index) {
        var numero = Number(
          unidad.unidadNumero ||
          obtenerValorFila(unidad, ["unidad", "n unidad", "numero unidad", "nro unidad"]) ||
          index + 1
        );

        return Object.assign({}, unidad, {
          unidadNumero: numero,
          tituloUnidad: obtenerValorFila(unidad, [
            "titulo",
            "nombre unidad",
            "unidad",
            "tema",
            "contenido"
          ]) || unidad.temaDetectado || ("Unidad " + numero),
          tema: unidad.temaDetectado || obtenerValorFila(unidad, [
            "tema",
            "contenido",
            "contenidos",
            "titulo",
            "temas"
          ]),
          subtema: unidad.subtemaDetectado || obtenerValorFila(unidad, [
            "subtema",
            "sub temas",
            "subtemas"
          ]),
          resultado: unidad.resultadoDetectado || obtenerValorFila(unidad, [
            "resultado",
            "resultado aprendizaje",
            "aprendizaje",
            "logro"
          ])
        });
      })
      .sort(ordenarPorUnidad);
  }

  function prepararActividades(actividades) {
    return arr(actividades)
      .map(function (actividad, index) {
        var numero = Number(
          actividad.unidadNumero ||
          obtenerValorFila(actividad, ["unidad", "n unidad", "numero unidad", "nro unidad"]) ||
          0
        );

        return Object.assign({}, actividad, {
          unidadNumero: numero,
          actividad: actividad.actividadDetectada || obtenerValorFila(actividad, [
            "actividad",
            "descripcion",
            "descripción",
            "taller",
            "proyecto",
            "trabajo",
            "estrategia"
          ]) || ("Actividad " + (index + 1)),
          tipoActividad: actividad.tipoActividad || obtenerValorFila(actividad, [
            "tipo",
            "modalidad",
            "componente",
            "tipo actividad"
          ]) || "Actividad",
          evaluacion: obtenerValorFila(actividad, [
            "evaluacion",
            "evaluación",
            "instrumento",
            "evidencia",
            "producto",
            "logro"
          ])
        });
      })
      .sort(ordenarPorUnidad);
  }

  function agruparActividadesPorUnidad(actividades) {
    var mapa = {};

    prepararActividades(actividades).forEach(function (actividad) {
      var key = String(Number(actividad.unidadNumero || 0));

      if (!mapa[key]) {
        mapa[key] = [];
      }

      mapa[key].push(actividad);
    });

    return mapa;
  }

  function prepararDatosMateria(detalle, reserva, config) {
    config = Object.assign({}, CONFIG_DEFAULT, config || {});

    detalle = detalle || {};
    reserva = reserva || {};

    var materia = detalle.materia || {};
    var carrera = detalle.carrera || {};
    var nivel = detalle.nivel || {};
    var peaBase = detalle.peaBase || {};
    var campos = extraerCamposBase(peaBase);

    var nombreAsignatura = buscarCampo(campos, [
      "nombre asignatura",
      "asignatura",
      "materia",
      "nombre materia",
      "nombre de la asignatura"
    ]) || materia.nombreMostrar || materia.nombreInstitucional || materia.nombre || "Asignatura sin nombre";

    var descripcion = buscarCampo(campos, [
      "descripcion asignatura",
      "descripción asignatura",
      "descripcion",
      "descripción",
      "caracterizacion",
      "caracterización",
      "presentacion",
      "presentación"
    ]);

    var objetivo = buscarCampo(campos, [
      "objetivo asignatura",
      "objetivo",
      "objetivo general",
      "proposito",
      "propósito",
      "competencia",
      "competencia general"
    ]);

    var codigo = buscarCampo(campos, [
      "codigo",
      "código",
      "codigo asignatura",
      "código asignatura"
    ]) || materia.codigo || "";

    var horas = buscarCampo(campos, [
      "horas",
      "horas asignatura",
      "total horas",
      "carga horaria"
    ]);

    var creditos = buscarCampo(campos, [
      "creditos",
      "créditos",
      "credito",
      "crédito"
    ]);

    var unidades = prepararUnidades(detalle.unidades || []);
    var actividades = prepararActividades(detalle.actividades || []);

    var estadoGeneracion = detalle.estadoGeneracion || {
      puedeGenerar: false,
      faltantes: ["PEA Base", "PEA Unidades", "PEA Actividades"]
    };

    if (!estadoGeneracion.puedeGenerar) {
      throw new Error(
        "No se puede generar el comunicado de " +
        nombreAsignatura +
        ". Faltan: " +
        arr(estadoGeneracion.faltantes).join(", ")
      );
    }

    return {
      config: config,
      numeroComunicado: reserva.numero || "",
      secuencia: reserva.secuencia || "",
      fechaTexto: reserva.fechaTexto || "",
      ciudad: config.ciudad,
      unidadResponsable: config.unidadResponsable,
      nota: config.nota,
      materiaId: materia.id || "",
      carreraId: carrera.id || "",
      nivelId: nivel.id || "",
      codigo: codigo,
      nombreAsignatura: nombreAsignatura,
      carrera: carrera.nombre || "",
      nivel: nivel.nombre || "",
      descripcion: descripcion || "No se registra descripción de la asignatura en la información procesada.",
      objetivo: objetivo || "No se registra objetivo de la asignatura en la información procesada.",
      horas: horas,
      creditos: creditos,
      unidades: unidades,
      actividades: actividades,
      actividadesPorUnidad: agruparActividadesPorUnidad(actividades),
      archivos: detalle.archivos || [],
      generadoEn: new Date().toISOString()
    };
  }

  function renderDatosGenerales(data) {
    var filas = [
      ["Carrera", data.carrera],
      ["Nivel", data.nivel],
      ["Código de asignatura", data.codigo || "No registrado"],
      ["Asignatura", data.nombreAsignatura],
      ["Horas", data.horas || "No registrado"],
      ["Créditos", data.creditos || "No registrado"]
    ];

    return (
      '<table class="com-pdf-table com-pdf-datos">' +
        '<tbody>' +
          filas.map(function (fila) {
            return (
              "<tr>" +
                "<th>" + escapar(fila[0]) + "</th>" +
                "<td>" + escapar(fila[1]) + "</td>" +
              "</tr>"
            );
          }).join("") +
        "</tbody>" +
      "</table>"
    );
  }

  function renderUnidades(data) {
    if (!data.unidades.length) {
      return '<p class="com-pdf-muted">No se registran unidades procesadas.</p>';
    }

    return (
      '<div class="com-pdf-unidades">' +
        data.unidades.map(function (unidad, index) {
          var numero = unidad.unidadNumero || index + 1;
          var actividades = data.actividadesPorUnidad[String(Number(numero || 0))] || [];

          return (
            '<section class="com-pdf-unidad">' +
              '<h4>Unidad ' + escapar(numero) + ': ' + escapar(unidad.tituloUnidad || unidad.tema || "") + '</h4>' +
              '<p><strong>Contenido / tema:</strong> ' + escapar(unidad.tema || "No registrado") + '</p>' +
              (
                unidad.subtema
                  ? '<p><strong>Subtema:</strong> ' + escapar(unidad.subtema) + '</p>'
                  : ''
              ) +
              (
                unidad.resultado
                  ? '<p><strong>Resultado de aprendizaje:</strong> ' + escapar(unidad.resultado) + '</p>'
                  : ''
              ) +
              renderActividadesUnidad(actividades) +
            '</section>'
          );
        }).join("") +
      '</div>'
    );
  }

  function renderActividadesUnidad(actividades) {
    actividades = arr(actividades);

    if (!actividades.length) {
      return '<p class="com-pdf-muted">No se registran actividades asociadas a esta unidad.</p>';
    }

    return (
      '<table class="com-pdf-table com-pdf-actividades">' +
        '<thead>' +
          '<tr>' +
            '<th>Tipo</th>' +
            '<th>Actividad</th>' +
            '<th>Evaluación / evidencia</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          actividades.map(function (actividad) {
            return (
              '<tr>' +
                '<td>' + escapar(actividad.tipoActividad || "Actividad") + '</td>' +
                '<td>' + escapar(actividad.actividad || "No registrado") + '</td>' +
                '<td>' + escapar(actividad.evaluacion || "No registrado") + '</td>' +
              '</tr>'
            );
          }).join("") +
        '</tbody>' +
      '</table>'
    );
  }

  function generarHTMLComunicado(data) {
    return (
      '<article class="com-pdf-page" data-materia-id="' + escapar(data.materiaId) + '">' +
        '<header class="com-pdf-header">' +
          '<img class="com-pdf-logo" src="' + escapar(data.config.logoSrc) + '" alt="ITSQMET" onerror="this.style.display=\'none\'" />' +
        '</header>' +

        '<h1 class="com-pdf-title">' + escapar(data.config.titulo) + '</h1>' +

        '<section class="com-pdf-body">' +
          '<p>Estimados colaboradores,</p>' +

          '<p>' +
            'Como parte del proceso institucional de gestión curricular, se comunica el detalle académico ' +
            'correspondiente a la asignatura <strong>' + escapar(data.nombreAsignatura) + '</strong>, ' +
            'perteneciente a la carrera <strong>' + escapar(data.carrera) + '</strong>, ' +
            'conforme a la información registrada en los documentos PEA procesados en la base local.' +
          '</p>' +

          '<h2>Datos generales de la asignatura</h2>' +
          renderDatosGenerales(data) +

          '<h2>Descripción de la asignatura</h2>' +
          '<p>' + escapar(data.descripcion) + '</p>' +

          '<h2>Objetivo de la asignatura</h2>' +
          '<p>' + escapar(data.objetivo) + '</p>' +

          '<h2>Unidades, contenidos y actividades</h2>' +
          renderUnidades(data) +
        '</section>' +

        '<footer class="com-pdf-footer">' +
          '<div class="com-pdf-unidad-responsable">' + escapar(data.unidadResponsable) + '</div>' +

          '<div class="com-pdf-meta">' +
            '<p>' + escapar(data.ciudad) + ', ' + escapar(data.fechaTexto) + '</p>' +
            '<p>Comunicado No. <span>' + escapar(data.numeroComunicado) + '</span></p>' +
          '</div>' +

          '<p class="com-pdf-nota"><strong>Nota:</strong> ' + escapar(data.nota.replace(/^Nota:\s*/i, "")) + '</p>' +
        '</footer>' +
      '</article>'
    );
  }

  function generarDocumento(detalle, reserva, config) {
    var data = prepararDatosMateria(detalle, reserva, config);

    return {
      materiaId: data.materiaId,
      carreraId: data.carreraId,
      nivelId: data.nivelId,
      numeroComunicado: data.numeroComunicado,
      nombreAsignatura: data.nombreAsignatura,
      fechaTexto: data.fechaTexto,
      data: data,
      html: generarHTMLComunicado(data)
    };
  }

  function generarDocumentoMultiple(items, config) {
    items = arr(items);

    var documentos = items.map(function (item) {
      return generarDocumento(item.detalle, item.reserva, config);
    });

    return {
      total: documentos.length,
      documentos: documentos,
      html: documentos.map(function (doc) {
        return doc.html;
      }).join("")
    };
  }

  NS.Plantilla = {
    CONFIG_DEFAULT: CONFIG_DEFAULT,
    extraerCamposBase: extraerCamposBase,
    buscarCampo: buscarCampo,
    prepararUnidades: prepararUnidades,
    prepararActividades: prepararActividades,
    prepararDatosMateria: prepararDatosMateria,
    generarHTMLComunicado: generarHTMLComunicado,
    generarDocumento: generarDocumento,
    generarDocumentoMultiple: generarDocumentoMultiple
  };
})(window);