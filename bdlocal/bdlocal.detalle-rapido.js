/* =========================================================
Nombre completo: bdlocal.detalle-rapido.js
Ruta: /Curriculo/bdlocal/bdlocal.detalle-rapido.js
Funciones:
- Abrir el detalle sin bloquear la interfaz ni duplicar consultas.
- Agrupar todos los registros de cada unidad y ordenar sus contenidos.
- Mostrar diagnóstico, indicadores y accesos directos a los faltantes.
- Permitir editar descripción, objetivo, unidades, contenidos y bibliografía.
- Guardar respaldo técnico, revalidar y actualizar el estado de la materia.
========================================================= */
(function (window, document) {
  "use strict";

  if (window.__BDLOCAL_DETALLE_EDITOR_V2__) return;
  window.__BDLOCAL_DETALLE_EDITOR_V2__ = true;

  var BD = window.BDLocalCCC;
  var tabla = document.getElementById("tablaMaterias");
  var modal = document.getElementById("modalDetalle");
  var modalTitulo = document.getElementById("modalTitulo");
  var modalContenido = document.getElementById("modalContenido");

  if (!BD || !BD.Core || !BD.Schema || !tabla || !modal || !modalTitulo || !modalContenido) {
    console.error("[BDLocalCCC.DetalleEditor] No se encontraron los módulos o elementos requeridos.");
    return;
  }

  var S = BD.Schema.STORES;
  var solicitudActual = 0;
  var materiaActiva = "";
  var detalleActual = null;
  var modoEdicion = false;
  var guardando = false;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    return Array.isArray(valor) ? valor : (valor === null || typeof valor === "undefined" ? [] : [valor]);
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function saltos(valor) {
    return escapar(valor).replace(/\n/g, "<br>");
  }

  function fecha() {
    return BD.Schema.fechaISO ? BD.Schema.fechaISO() : new Date().toISOString();
  }

  function uid(prefijo) {
    return BD.Schema.uid ? BD.Schema.uid(prefijo) : String(prefijo || "id") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function conTiempoLimite(promesa, ms, contexto) {
    return new Promise(function (resolve, reject) {
      var terminada = false;
      var timer = setTimeout(function () {
        if (terminada) return;
        terminada = true;
        reject(new Error("Tiempo agotado: " + contexto));
      }, Number(ms || 15000));

      Promise.resolve(promesa).then(function (resultado) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        resolve(resultado);
      }).catch(function (error) {
        if (terminada) return;
        terminada = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function clonar(valor) {
    try {
      return JSON.parse(JSON.stringify(valor));
    } catch (error) {
      return valor;
    }
  }

  function obtenerDatosBase(base) {
    base = base || {};
    return base.datos || base;
  }

  function obtenerDescripcion(base) {
    var datos = obtenerDatosBase(base);
    var campos = (base && base.campos) || datos.campos || {};
    return texto(datos.descripcion || base.descripcion || campos.descripcion_asignatura || campos.descripcion);
  }

  function obtenerObjetivo(base) {
    var datos = obtenerDatosBase(base);
    var campos = (base && base.campos) || datos.campos || {};
    return texto(datos.objetivo || base.objetivo || campos.objetivo_asignatura || campos.objetivo);
  }

  function obtenerUnidadesBase(base) {
    var datos = obtenerDatosBase(base);
    return arr(datos.unidadesBase || base.unidadesBase);
  }

  function obtenerBibliografia(base) {
    var datos = obtenerDatosBase(base);
    return arr(datos.bibliografia || base.bibliografia);
  }

  function rutaNumerica(valor) {
    var match = texto(valor).match(/^\s*(\d+(?:\.\d+)*)/);
    return match ? match[1].split(".").map(Number) : null;
  }

  function ordenarContenidos(lista) {
    return arr(lista).map(function (valor, index) {
      return { valor: texto(valor), index: index, ruta: rutaNumerica(valor) };
    }).filter(function (item) {
      return !!item.valor;
    }).sort(function (a, b) {
      if (a.ruta && b.ruta) {
        var limite = Math.max(a.ruta.length, b.ruta.length);
        for (var i = 0; i < limite; i += 1) {
          if (i >= a.ruta.length) return -1;
          if (i >= b.ruta.length) return 1;
          if (a.ruta[i] !== b.ruta[i]) return a.ruta[i] - b.ruta[i];
        }
        return a.index - b.index;
      }
      if (a.ruta) return -1;
      if (b.ruta) return 1;
      return a.index - b.index;
    }).map(function (item) {
      return item.valor;
    });
  }

  function agregarUnico(lista, valor) {
    valor = texto(valor);
    if (valor && lista.indexOf(valor) === -1) lista.push(valor);
  }

  function inferirUnidad(valor) {
    var match = texto(valor).match(/^\s*([1-4])(?:\.|\s|:|-|$)/);
    return match ? Number(match[1]) : 0;
  }

  function agruparUnidades(unidades) {
    if (BD.Integridad && typeof BD.Integridad.agruparUnidades === "function") {
      try {
        return BD.Integridad.agruparUnidades(unidades).map(function (unidad) {
          return Object.assign({}, unidad, { contenidos: ordenarContenidos(unidad.contenidos) });
        });
      } catch (errorIntegridad) {
        console.warn("[BDLocalCCC.DetalleEditor] Se usará agrupación de respaldo:", errorIntegridad);
      }
    }

    var mapa = {
      1: { unidadNumero: 1, contenidos: [], filasOriginales: [], registros: [] },
      2: { unidadNumero: 2, contenidos: [], filasOriginales: [], registros: [] },
      3: { unidadNumero: 3, contenidos: [], filasOriginales: [], registros: [] },
      4: { unidadNumero: 4, contenidos: [], filasOriginales: [], registros: [] }
    };
    var visitados = typeof WeakSet === "function" ? new WeakSet() : null;

    function procesar(registro, numeroHeredado) {
      if (!registro || typeof registro !== "object") return;
      if (visitados) {
        if (visitados.has(registro)) return;
        visitados.add(registro);
      }

      var numero = Number(registro.unidadNumero || registro.unidad || registro.numeroUnidad || registro.numero_unidad || numeroHeredado || 0);
      var contenidos = arr(registro.contenidos);
      contenidos.forEach(function (contenido) {
        var destino = inferirUnidad(contenido) || numero;
        if (mapa[destino]) agregarUnico(mapa[destino].contenidos, contenido);
      });

      var directo = texto(registro.descripcionComponente || registro.descripcion_componente || registro.temaDetectado || registro.contenido || registro.tema || registro.titulo || "");
      if (directo) {
        var destinoDirecto = inferirUnidad(directo) || numero;
        if (mapa[destinoDirecto]) agregarUnico(mapa[destinoDirecto].contenidos, directo);
      }

      if (mapa[numero]) mapa[numero].registros.push(registro);
      arr(registro.filasOriginales).forEach(function (item) { procesar(item, numero); });
      arr(registro.filas).forEach(function (item) { procesar(item, numero); });
      arr(registro.registros).forEach(function (item) { procesar(item, numero); });
    }

    arr(unidades).forEach(function (unidad) { procesar(unidad, 0); });

    return [1, 2, 3, 4].map(function (numero) {
      mapa[numero].contenidos = ordenarContenidos(mapa[numero].contenidos);
      mapa[numero].totalContenidos = mapa[numero].contenidos.length;
      mapa[numero].temaDetectado = mapa[numero].contenidos[0] || "";
      return mapa[numero];
    });
  }

  async function obtenerDetalleRapido(materiaId) {
    await conTiempoLimite(BD.Core.ready(), 8000, "abrir BDLocal");
    var materia = await conTiempoLimite(BD.Core.get(S.MATERIAS, materiaId), 8000, "leer la materia");
    if (!materia) throw new Error("No se encontró la materia seleccionada.");

    var resultados = await conTiempoLimite(Promise.all([
      materia.carreraId ? BD.Core.get(S.CARRERAS, materia.carreraId) : Promise.resolve(null),
      materia.matrizId ? BD.Core.get(S.MATRICES, materia.matrizId) : Promise.resolve(null),
      materia.nivelId ? BD.Core.get(S.NIVELES, materia.nivelId) : Promise.resolve(null),
      BD.Core.getAllByIndex(S.PEA_ARCHIVOS, "materiaId", materiaId),
      BD.Core.getAllByIndex(S.VALIDACIONES, "materiaId", materiaId),
      BD.Core.get(S.PEA_BASE, materiaId),
      BD.Core.getAllByIndex(S.PEA_UNIDADES, "materiaId", materiaId),
      BD.Core.getAllByIndex(S.PEA_ACTIVIDADES, "materiaId", materiaId)
    ]), 15000, "leer el detalle curricular");

    return {
      materia: materia,
      carrera: resultados[0],
      matriz: resultados[1],
      nivel: resultados[2],
      archivos: resultados[3] || [],
      validaciones: resultados[4] || [],
      pea: {
        base: resultados[5] || null,
        unidades: resultados[6] || [],
        actividades: resultados[7] || []
      }
    };
  }

  function resumen(detalle) {
    var base = detalle.pea && detalle.pea.base || {};
    var agrupadas = agruparUnidades(detalle.pea && detalle.pea.unidades || []);
    var bibliografia = obtenerBibliografia(base);
    var justificaciones = bibliografia.filter(function (item) {
      return texto(item && (item.justificacion || item.descripcionComponente3));
    }).length;
    var unidadesConContenido = agrupadas.filter(function (unidad) {
      return unidad.contenidos.length > 0;
    }).length;
    var totalContenidos = agrupadas.reduce(function (total, unidad) {
      return total + unidad.contenidos.length;
    }, 0);

    return {
      descripcion: !!obtenerDescripcion(base),
      objetivo: !!obtenerObjetivo(base),
      agrupadas: agrupadas,
      unidadesConContenido: unidadesConContenido,
      totalContenidos: totalContenidos,
      actividades: arr(detalle.pea && detalle.pea.actividades).length,
      bibliografias: bibliografia.length,
      justificaciones: justificaciones,
      bibliografia: bibliografia
    };
  }

  function faltantesReales(detalle, datosResumen) {
    var faltantes = [];
    var base = detalle.pea && detalle.pea.base || {};
    var metas = obtenerUnidadesBase(base);
    if (!datosResumen.descripcion) faltantes.push({ clave: "descripcion", texto: "Descripción de la asignatura", destino: "bdSeccionDescripcion" });
    if (!datosResumen.objetivo) faltantes.push({ clave: "objetivo", texto: "Objetivo de la asignatura", destino: "bdSeccionObjetivo" });
    datosResumen.agrupadas.forEach(function (unidad) {
      var numero = unidad.unidadNumero;
      var meta = metas.find(function (item) { return Number(item.unidadNumero || item.orden || 0) === numero; }) || {};
      if (!texto(meta.nombre || meta.tituloUnidad)) faltantes.push({ clave: "nombre_unidad_" + numero, texto: "Nombre de la unidad " + numero, destino: "bdUnidad" + numero });
      if (!texto(meta.competencia)) faltantes.push({ clave: "competencia_" + numero, texto: "Competencia de la unidad " + numero, destino: "bdUnidad" + numero });
      if (!texto(meta.resultadoAprendizaje || meta.resultado)) faltantes.push({ clave: "resultado_" + numero, texto: "Resultado de aprendizaje de la unidad " + numero, destino: "bdUnidad" + numero });
      if (!unidad.contenidos.length) faltantes.push({ clave: "unidad_" + numero, texto: "Contenidos de la unidad " + numero, destino: "bdUnidad" + numero });
    });
    if (!datosResumen.actividades) faltantes.push({ clave: "actividades", texto: "Actividades", destino: "bdSeccionActividades" });
    if (!datosResumen.bibliografias) faltantes.push({ clave: "bibliografia", texto: "Bibliografía", destino: "bdSeccionBibliografia" });
    if (datosResumen.bibliografias && datosResumen.justificaciones !== datosResumen.bibliografias) {
      faltantes.push({ clave: "justificaciones", texto: "Justificación de cada bibliografía", destino: "bdSeccionBibliografia" });
    }
    return faltantes;
  }

  function claseEstado(estado) {
    estado = texto(estado).toLowerCase();
    if (estado === "completo") return "bd-detalle-badge-ok";
    if (estado === "revision" || estado === "pendiente") return "bd-detalle-badge-warn";
    return "bd-detalle-badge-error";
  }

  function renderKpis(datosResumen) {
    var items = [
      ["Descripción", datosResumen.descripcion ? "Sí" : "No", datosResumen.descripcion],
      ["Objetivo", datosResumen.objetivo ? "Sí" : "No", datosResumen.objetivo],
      ["Unidades con contenido", datosResumen.unidadesConContenido + "/4", datosResumen.unidadesConContenido === 4],
      ["Contenidos", datosResumen.totalContenidos, datosResumen.totalContenidos > 0],
      ["Actividades", datosResumen.actividades, datosResumen.actividades > 0],
      ["Bibliografías", datosResumen.bibliografias, datosResumen.bibliografias > 0],
      ["Justificaciones", datosResumen.justificaciones + "/" + datosResumen.bibliografias, datosResumen.bibliografias > 0 && datosResumen.justificaciones === datosResumen.bibliografias]
    ];

    return '<div class="bd-detalle-kpis">' + items.map(function (item) {
      return '<div class="bd-detalle-kpi"><span>' + escapar(item[0]) + '</span><strong class="' + (item[2] ? "bd-detalle-valor-ok" : "bd-detalle-valor-bad") + '">' + escapar(item[1]) + '</strong></div>';
    }).join("") + '</div>';
  }

  function renderFaltantes(faltantes) {
    if (!faltantes.length) return '<div class="bd-success bd-detalle-diagnostico"><strong>Contenido curricular completo.</strong><span>No se detectaron campos obligatorios pendientes.</span></div>';
    return '<div class="bd-detalle-faltantes"><div class="bd-detalle-faltantes-titulo">Pendientes detectados</div><div class="bd-detalle-faltantes-lista">' + faltantes.map(function (item) {
      return '<button type="button" class="bd-detalle-faltante" data-scroll-target="' + escapar(item.destino) + '"><span>!</span>' + escapar(item.texto) + '</button>';
    }).join("") + '</div></div>';
  }

  function renderUnidades(detalle, datosResumen, faltantes) {
    var base = detalle.pea && detalle.pea.base || {};
    var metas = obtenerUnidadesBase(base);
    var faltantesClaves = {};
    faltantes.forEach(function (item) { faltantesClaves[item.clave] = true; });

    return datosResumen.agrupadas.map(function (unidad) {
      var numero = unidad.unidadNumero;
      var meta = metas.find(function (item) {
        return Number(item.unidadNumero || item.orden || 0) === numero;
      }) || {};
      var tieneError = !!faltantesClaves["unidad_" + numero] || !!faltantesClaves["nombre_unidad_" + numero] || !!faltantesClaves["competencia_" + numero] || !!faltantesClaves["resultado_" + numero];
      return '<details id="bdUnidad' + numero + '" class="bd-unit bd-detalle-acordeon ' + (tieneError ? "bd-detalle-acordeon-error" : "") + '" ' + (tieneError ? "open" : "") + '>' +
        '<summary><span>Unidad ' + numero + ': ' + escapar(meta.nombre || meta.tituloUnidad || "No registrada") + '</span><small>' + unidad.contenidos.length + ' contenidos</small></summary>' +
        '<div class="bd-unit-body">' +
          '<div class="bd-detalle-subcampo"><strong>Resultado de aprendizaje</strong><div class="bd-text-block">' + saltos(meta.resultadoAprendizaje || meta.resultado || "No registrado") + '</div></div>' +
          '<div class="bd-detalle-subcampo"><strong>Competencia</strong><div class="bd-text-block">' + saltos(meta.competencia || "No registrada") + '</div></div>' +
          '<div class="bd-detalle-subcampo"><strong>Contenidos</strong>' +
            (unidad.contenidos.length
              ? '<ol class="bd-content-list">' + unidad.contenidos.map(function (contenido) { return '<li>' + saltos(contenido) + '</li>'; }).join("") + '</ol>'
              : '<p class="bd-alert">No hay contenidos guardados para esta unidad.</p>') +
          '</div>' +
        '</div></details>';
    }).join("");
  }

  function renderActividades(actividades) {
    if (!arr(actividades).length) return '<p class="bd-alert">No hay actividades guardadas.</p>';
    return arr(actividades).map(function (actividad, index) {
      return '<div class="bd-activity"><h4>Actividad ' + (index + 1) + '</h4><div class="bd-activity-grid">' +
        '<strong>Mecanismo</strong><span>' + saltos(actividad.mecanismo || actividad.tipoActividad || actividad.tipo || "No registrado") + '</span>' +
        '<strong>Tema</strong><span>' + saltos(actividad.tema || actividad.titulo || "No registrado") + '</span>' +
        '<strong>Descripción</strong><span>' + saltos(actividad.descripcion || actividad.actividadDetectada || actividad.actividad || "No registrada") + '</span>' +
      '</div></div>';
    }).join("");
  }

  function renderBibliografia(items) {
    if (!items.length) return '<p class="bd-alert">No hay bibliografía guardada.</p>';
    return items.map(function (item, index) {
      return '<div class="bd-biblio"><strong>Bibliografía ' + (index + 1) + '</strong>' +
        '<p>' + saltos(item.referencia || item.bibliografia || item.descripcion) + '</p>' +
        (texto(item.codigoReferencia || item.codigo) ? '<p><strong>Código:</strong> ' + escapar(item.codigoReferencia || item.codigo) + '</p>' : '') +
        '<p><strong>Justificación:</strong><br>' + saltos(item.justificacion || item.descripcionComponente3 || "No registrada") + '</p></div>';
    }).join("");
  }

  function renderVista(detalle, mensajeFondo) {
    var materia = detalle.materia || {};
    var base = detalle.pea && detalle.pea.base || {};
    var datosResumen = resumen(detalle);
    var faltantes = faltantesReales(detalle, datosResumen);
    var estadoCalculado = faltantes.length ? "revision" : "completo";
    var estadoMostrar = texto(materia.estadoValidacion || estadoCalculado);
    var actividades = detalle.pea && detalle.pea.actividades || [];

    var nota = '<div id="bdDetalleEstadoFondo" class="bd-detalle-nota-fondo">' + escapar(mensajeFondo || "Datos listos para revisión.") + '</div>';
    var cabecera = '<div class="bd-detail-grid bd-detalle-meta">' +
      '<div><span>Carrera</span><strong>' + escapar(detalle.carrera && detalle.carrera.nombre || "No registrada") + '</strong></div>' +
      '<div><span>Nivel</span><strong>' + escapar(detalle.nivel && detalle.nivel.nombre || "No registrado") + '</strong></div>' +
      '<div><span>Estado</span><strong><span class="bd-detalle-badge ' + claseEstado(estadoMostrar) + '">' + escapar(estadoMostrar) + '</span></strong></div>' +
      '<div><span>Archivos</span><strong>' + escapar(arr(detalle.archivos).length) + '</strong></div>' +
    '</div>';

    return nota + cabecera + renderFaltantes(faltantes) + renderKpis(datosResumen) +
      '<div class="bd-detalle-control-acordeones"><button type="button" data-accordion-action="expandir">Expandir todo</button><button type="button" data-accordion-action="contraer">Contraer todo</button></div>' +
      '<section id="bdSeccionDescripcion" class="bd-detail-section bd-detalle-seccion"><h3>Descripción de la asignatura</h3><div class="bd-text-block">' + saltos(obtenerDescripcion(base) || "No registrada") + '</div></section>' +
      '<section id="bdSeccionObjetivo" class="bd-detail-section bd-detalle-seccion"><h3>Objetivo de la asignatura</h3><div class="bd-text-block">' + saltos(obtenerObjetivo(base) || "No registrado") + '</div></section>' +
      '<section class="bd-detail-section bd-detalle-seccion"><h3>Unidades, resultados, competencias y contenidos</h3>' + renderUnidades(detalle, datosResumen, faltantes) + '</section>' +
      '<details id="bdSeccionActividades" class="bd-detail-section bd-detalle-seccion bd-detalle-bloque-colapsable" ' + (!datosResumen.actividades ? "open" : "") + '><summary><strong>Actividades · ' + datosResumen.actividades + '</strong></summary><div class="bd-detalle-details-body">' + renderActividades(actividades) + '</div></details>' +
      '<details id="bdSeccionBibliografia" class="bd-detail-section bd-detalle-seccion bd-detalle-bloque-colapsable" ' + (!datosResumen.bibliografias || datosResumen.justificaciones !== datosResumen.bibliografias ? "open" : "") + '><summary><strong>Bibliografía y justificación · ' + datosResumen.bibliografias + '</strong></summary><div class="bd-detalle-details-body">' + renderBibliografia(datosResumen.bibliografia) + '</div></details>' +
      '<details class="bd-detail-section bd-detalle-seccion bd-detalle-bloque-colapsable"><summary><strong>Archivos detectados · ' + arr(detalle.archivos).length + '</strong></summary><div class="bd-detalle-details-body bd-file-list">' + arr(detalle.archivos).map(function (archivo) {
        return '<div class="bd-file-item"><strong>' + escapar(archivo.nombreArchivo) + '</strong><span>' + escapar(archivo.tipo) + ' · Confianza ' + escapar(archivo.confianza || 0) + '%</span><small>' + escapar(archivo.rutaOriginal) + '</small></div>';
      }).join("") + '</div></details>' +
      '<div class="bd-detalle-barra">' +
        '<button type="button" class="bd-btn bd-btn-light" data-detalle-action="validar">Validar ahora</button>' +
        '<button type="button" class="bd-btn bd-btn-primary" data-detalle-action="editar">Editar contenido</button>' +
      '</div>';
  }

  function valorInput(selector) {
    var campo = modalContenido.querySelector(selector);
    return campo ? texto(campo.value) : "";
  }

  function renderEditorBibliografia(items) {
    var lista = items.length ? items : [{ referencia: "", codigoReferencia: "", justificacion: "" }];
    return '<div id="bdEditorBibliografias">' + lista.map(function (item, index) {
      return '<div class="bd-editor-biblio" data-biblio-index="' + index + '">' +
        '<div class="bd-editor-biblio-head"><strong>Bibliografía ' + (index + 1) + '</strong><button type="button" data-detalle-action="quitar-biblio">Quitar</button></div>' +
        '<label>Referencia<textarea data-biblio-campo="referencia" rows="3">' + escapar(item.referencia || item.bibliografia || item.descripcion) + '</textarea></label>' +
        '<label>Código<input data-biblio-campo="codigo" type="text" value="' + escapar(item.codigoReferencia || item.codigo || "") + '"></label>' +
        '<label>Justificación<textarea data-biblio-campo="justificacion" rows="3">' + escapar(item.justificacion || item.descripcionComponente3 || "") + '</textarea></label>' +
      '</div>';
    }).join("") + '</div><button type="button" class="bd-detalle-add" data-detalle-action="agregar-biblio">+ Agregar bibliografía</button>';
  }

  function renderEdicion(detalle) {
    var base = detalle.pea && detalle.pea.base || {};
    var datosResumen = resumen(detalle);
    var metas = obtenerUnidadesBase(base);

    return '<div class="bd-editor-aviso"><strong>Edición segura en BDLocal</strong><span>Al guardar se registra un respaldo técnico y se vuelve a validar la materia.</span></div>' +
      '<section class="bd-detail-section bd-editor-seccion"><h3>Información general</h3>' +
        '<label>Descripción de la asignatura<textarea id="bdEditDescripcion" rows="6">' + escapar(obtenerDescripcion(base)) + '</textarea></label>' +
        '<label>Objetivo de la asignatura<textarea id="bdEditObjetivo" rows="5">' + escapar(obtenerObjetivo(base)) + '</textarea></label>' +
      '</section>' +
      '<section class="bd-detail-section bd-editor-seccion"><h3>Unidades curriculares</h3>' + datosResumen.agrupadas.map(function (unidad) {
        var numero = unidad.unidadNumero;
        var meta = metas.find(function (item) { return Number(item.unidadNumero || item.orden || 0) === numero; }) || {};
        return '<details class="bd-editor-unidad" open data-editor-unidad="' + numero + '"><summary><strong>Unidad ' + numero + '</strong><span>' + unidad.contenidos.length + ' contenidos actuales</span></summary><div>' +
          '<label>Nombre de la unidad<input data-unidad-campo="nombre" type="text" value="' + escapar(meta.nombre || meta.tituloUnidad || "") + '"></label>' +
          '<label>Resultado de aprendizaje<textarea data-unidad-campo="resultado" rows="3">' + escapar(meta.resultadoAprendizaje || meta.resultado || "") + '</textarea></label>' +
          '<label>Competencia<textarea data-unidad-campo="competencia" rows="3">' + escapar(meta.competencia || "") + '</textarea></label>' +
          '<label>Contenidos <small>Uno por línea; se ordenarán automáticamente por numeración.</small><textarea data-unidad-campo="contenidos" rows="10">' + escapar(unidad.contenidos.join("\n")) + '</textarea></label>' +
        '</div></details>';
      }).join("") + '</section>' +
      '<section class="bd-detail-section bd-editor-seccion"><h3>Bibliografía y justificación</h3>' + renderEditorBibliografia(datosResumen.bibliografia) + '</section>' +
      '<div class="bd-detalle-barra">' +
        '<button type="button" class="bd-btn bd-btn-light" data-detalle-action="cancelar-edicion">Cancelar</button>' +
        '<button type="button" class="bd-btn bd-btn-primary" data-detalle-action="guardar">Guardar y validar</button>' +
      '</div>';
  }

  function recolectarEdicion() {
    var unidadesBase = [];
    var contenidosPorUnidad = {};
    modalContenido.querySelectorAll("[data-editor-unidad]").forEach(function (bloque) {
      var numero = Number(bloque.getAttribute("data-editor-unidad"));
      var campoNombre = bloque.querySelector('[data-unidad-campo="nombre"]');
      var campoResultado = bloque.querySelector('[data-unidad-campo="resultado"]');
      var campoCompetencia = bloque.querySelector('[data-unidad-campo="competencia"]');
      var campoContenidos = bloque.querySelector('[data-unidad-campo="contenidos"]');
      var contenidos = ordenarContenidos(texto(campoContenidos && campoContenidos.value).split(/\r?\n/).map(texto).filter(Boolean));

      unidadesBase.push({
        unidadNumero: numero,
        nombre: texto(campoNombre && campoNombre.value),
        resultadoAprendizaje: texto(campoResultado && campoResultado.value),
        competencia: texto(campoCompetencia && campoCompetencia.value)
      });
      contenidosPorUnidad[numero] = contenidos;
    });

    var bibliografia = [];
    modalContenido.querySelectorAll(".bd-editor-biblio").forEach(function (bloque, index) {
      var referencia = texto(bloque.querySelector('[data-biblio-campo="referencia"]') && bloque.querySelector('[data-biblio-campo="referencia"]').value);
      var codigo = texto(bloque.querySelector('[data-biblio-campo="codigo"]') && bloque.querySelector('[data-biblio-campo="codigo"]').value);
      var justificacion = texto(bloque.querySelector('[data-biblio-campo="justificacion"]') && bloque.querySelector('[data-biblio-campo="justificacion"]').value);
      if (!referencia && !codigo && !justificacion) return;
      bibliografia.push({ orden: index + 1, referencia: referencia, codigoReferencia: codigo, justificacion: justificacion });
    });

    return {
      descripcion: valorInput("#bdEditDescripcion"),
      objetivo: valorInput("#bdEditObjetivo"),
      unidadesBase: unidadesBase,
      contenidosPorUnidad: contenidosPorUnidad,
      bibliografia: bibliografia
    };
  }

  async function respaldarAntesDeEditar(detalle) {
    if (!BD.Core.log) return;
    await BD.Core.log({
      cargaId: detalle.materia && detalle.materia.cargaId || null,
      tipo: "backup_edicion_bdlocal",
      nivel: "info",
      mensaje: "Respaldo previo a edición manual de " + texto(detalle.materia && detalle.materia.nombre),
      detalle: {
        materia: clonar(detalle.materia),
        peaBase: clonar(detalle.pea && detalle.pea.base),
        peaUnidades: clonar(detalle.pea && detalle.pea.unidades)
      }
    });
  }

  function construirBaseActualizada(detalle, edicion) {
    var baseAnterior = detalle.pea && detalle.pea.base || {};
    var datosAnteriores = baseAnterior.datos || {};
    var ahora = fecha();
    var datosNuevos = Object.assign({}, datosAnteriores, {
      descripcion: edicion.descripcion,
      objetivo: edicion.objetivo,
      unidadesBase: edicion.unidadesBase,
      bibliografia: edicion.bibliografia,
      actualizadoManualmenteEn: ahora
    });

    return Object.assign({}, baseAnterior, {
      materiaId: detalle.materia.id,
      cargaId: baseAnterior.cargaId || detalle.materia.cargaId || null,
      carreraId: baseAnterior.carreraId || detalle.materia.carreraId || "",
      matrizId: baseAnterior.matrizId || detalle.materia.matrizId || "",
      nivelId: baseAnterior.nivelId || detalle.materia.nivelId || "",
      codigoMateria: baseAnterior.codigoMateria || detalle.materia.codigo || "",
      nombreMateria: baseAnterior.nombreMateria || detalle.materia.nombre || "",
      descripcion: edicion.descripcion,
      objetivo: edicion.objetivo,
      unidadesBase: edicion.unidadesBase,
      bibliografia: edicion.bibliografia,
      datos: datosNuevos,
      edicionManual: true,
      actualizadoEn: ahora
    });
  }

  function construirUnidadesActualizadas(detalle, edicion) {
    var existentes = arr(detalle.pea && detalle.pea.unidades);
    var agrupadas = agruparUnidades(existentes);
    var primera = existentes[0] || {};
    var porNumero = {};
    existentes.forEach(function (unidad) {
      var numero = Number(unidad.unidadNumero || 0);
      if (numero >= 1 && numero <= 4 && !porNumero[numero]) porNumero[numero] = unidad;
    });
    var ahora = fecha();

    return [1, 2, 3, 4].map(function (numero) {
      var previa = porNumero[numero] || {};
      var agrupada = agrupadas[numero - 1] || {};
      var contenidos = edicion.contenidosPorUnidad[numero] || [];
      return Object.assign({}, previa, {
        id: previa.id || uid("unidad"),
        cargaId: previa.cargaId || primera.cargaId || detalle.materia.cargaId || null,
        carreraId: previa.carreraId || detalle.materia.carreraId || "",
        matrizId: previa.matrizId || detalle.materia.matrizId || "",
        nivelId: previa.nivelId || detalle.materia.nivelId || "",
        materiaId: detalle.materia.id,
        codigoMateria: previa.codigoMateria || detalle.materia.codigo || "",
        nombreMateria: previa.nombreMateria || detalle.materia.nombre || "",
        archivoId: previa.archivoId || primera.archivoId || "",
        nombreArchivo: previa.nombreArchivo || primera.nombreArchivo || "",
        rutaOriginal: previa.rutaOriginal || primera.rutaOriginal || "",
        unidadNumero: numero,
        contenidos: contenidos,
        totalContenidos: contenidos.length,
        filasOriginales: arr(agrupada.filasOriginales || previa.filasOriginales),
        temaDetectado: contenidos[0] || "",
        subtemaDetectado: "",
        resultadoDetectado: "",
        edicionManual: true,
        creadoEn: previa.creadoEn || ahora,
        actualizadoEn: ahora
      });
    });
  }

  async function reemplazarUnidades(materiaId, nuevas) {
    var actuales = await BD.Core.getAllByIndex(S.PEA_UNIDADES, "materiaId", materiaId);
    for (var i = 0; i < actuales.length; i += 1) {
      if (actuales[i] && actuales[i].id) await BD.Core.remove(S.PEA_UNIDADES, actuales[i].id);
    }
    var resultado = await BD.Core.bulkPut(S.PEA_UNIDADES, nuevas);
    if (!resultado || Number(resultado.guardados) !== nuevas.length) {
      throw new Error("No se confirmaron las cuatro unidades guardadas.");
    }
    return resultado;
  }

  async function guardarEdicion() {
    if (guardando || !detalleActual) return;
    guardando = true;
    var botonGuardar = modalContenido.querySelector('[data-detalle-action="guardar"]');
    if (botonGuardar) {
      botonGuardar.disabled = true;
      botonGuardar.textContent = "Guardando...";
    }

    var detalleAnterior = clonar(detalleActual);
    var edicion = recolectarEdicion();
    var baseNueva = construirBaseActualizada(detalleActual, edicion);
    var unidadesNuevas = construirUnidadesActualizadas(detalleActual, edicion);

    try {
      await respaldarAntesDeEditar(detalleActual);
      await BD.Core.put(S.PEA_BASE, baseNueva);
      await reemplazarUnidades(detalleActual.materia.id, unidadesNuevas);

      var materiaPendiente = Object.assign({}, detalleActual.materia, {
        estadoValidacion: "revision",
        inteligenciaVersion: 0,
        actualizadoEn: fecha()
      });
      await BD.Core.put(S.MATERIAS, materiaPendiente);

      modoEdicion = false;
      modalContenido.innerHTML = '<div class="bd-editor-aviso"><strong>Cambios guardados.</strong><span>Validando la materia con la información actualizada...</span></div>';

      var advertencia = "";
      if (BD.Inteligencia && typeof BD.Inteligencia.repararMateria === "function") {
        try {
          await conTiempoLimite(BD.Inteligencia.repararMateria(detalleActual.materia.id, { force: true }), 35000, "validar la materia guardada");
        } catch (errorValidacion) {
          advertencia = " Los cambios se guardaron, pero la validación automática no terminó: " + (errorValidacion.message || errorValidacion);
        }
      }

      detalleActual = await obtenerDetalleRapido(detalleActual.materia.id);
      modalTitulo.textContent = (detalleActual.materia.codigo ? detalleActual.materia.codigo + " · " : "") + (detalleActual.materia.nombre || "Materia");
      modalContenido.innerHTML = renderVista(detalleActual, "Cambios guardados y datos actualizados." + advertencia);
      actualizarFilaTabla(detalleActual);
    } catch (error) {
      console.error("[BDLocalCCC.DetalleEditor] Error guardando edición:", error);
      try {
        if (detalleAnterior.pea && detalleAnterior.pea.base) await BD.Core.put(S.PEA_BASE, detalleAnterior.pea.base);
        if (detalleAnterior.pea) await reemplazarUnidades(detalleAnterior.materia.id, detalleAnterior.pea.unidades || []);
        if (detalleAnterior.materia) await BD.Core.put(S.MATERIAS, detalleAnterior.materia);
      } catch (errorRollback) {
        console.error("[BDLocalCCC.DetalleEditor] También falló la restauración:", errorRollback);
      }
      modalContenido.insertAdjacentHTML("afterbegin", '<div class="bd-alert"><strong>No se pudieron guardar los cambios.</strong><br>' + escapar(error.message || error) + '</div>');
      if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar y validar";
      }
    } finally {
      guardando = false;
    }
  }

  function actualizarFilaTabla(detalle) {
    var boton = Array.prototype.find.call(tabla.querySelectorAll("[data-materia-id]"), function (item) {
      return item.getAttribute("data-materia-id") === detalle.materia.id;
    });
    var fila = boton && boton.closest("tr");
    if (!fila) return;
    var celdaEstado = fila.querySelector("td:nth-child(8)");
    if (celdaEstado) {
      var estado = texto(detalle.materia.estadoValidacion || "revision");
      var cls = estado === "completo" ? "bd-badge bd-badge-ok" : "bd-badge bd-badge-warn";
      celdaEstado.innerHTML = '<span class="' + cls + '">' + escapar(estado) + '</span>';
    }
  }

  async function validarActual() {
    if (!detalleActual || guardando) return;
    var estado = document.getElementById("bdDetalleEstadoFondo");
    if (estado) estado.textContent = "Validando la materia...";
    try {
      if (!BD.Inteligencia || typeof BD.Inteligencia.repararMateria !== "function") {
        throw new Error("No está disponible el módulo de validación.");
      }
      await conTiempoLimite(BD.Inteligencia.repararMateria(detalleActual.materia.id, { force: true }), 35000, "validar la materia");
      detalleActual = await obtenerDetalleRapido(detalleActual.materia.id);
      modalContenido.innerHTML = renderVista(detalleActual, "Validación finalizada. Se muestran los datos actualizados.");
      actualizarFilaTabla(detalleActual);
    } catch (error) {
      if (estado) estado.textContent = "La validación no terminó: " + (error.message || error);
    }
  }

  async function abrirDetalle(id, boton) {
    var solicitud = ++solicitudActual;
    materiaActiva = id;
    modoEdicion = false;
    detalleActual = null;
    var fila = boton && boton.closest("tr");
    var nombreInicial = fila ? texto(fila.querySelector("td:nth-child(4)") && fila.querySelector("td:nth-child(4)").textContent) : "Materia";
    var codigoInicial = fila ? texto(fila.querySelector("td:nth-child(3)") && fila.querySelector("td:nth-child(3)").textContent) : "";

    modalTitulo.textContent = (codigoInicial ? codigoInicial + " · " : "") + (nombreInicial || "Materia");
    modalContenido.innerHTML = '<div class="bd-detalle-cargando"><strong>Consultando información guardada...</strong><span>Esta operación no modifica la materia.</span></div>';
    if (!modal.open) modal.showModal();

    if (boton) {
      boton.disabled = true;
      boton.dataset.textoOriginal = boton.textContent;
      boton.textContent = "Abriendo...";
    }

    try {
      var detalle = await obtenerDetalleRapido(id);
      if (solicitud !== solicitudActual || materiaActiva !== id || !modal.open) return;
      detalleActual = detalle;
      modalTitulo.textContent = (detalle.materia.codigo ? detalle.materia.codigo + " · " : "") + (detalle.materia.nombre || "Materia");
      modalContenido.innerHTML = renderVista(detalle, "Datos mostrados. Puedes revisar, editar o validar esta materia.");
    } catch (error) {
      if (solicitud !== solicitudActual) return;
      modalContenido.innerHTML = '<p class="bd-alert">' + escapar(error.message || error) + '</p>';
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = boton.dataset.textoOriginal || "Ver todo";
      }
    }
  }

  function agregarBibliografiaEditor() {
    var contenedor = document.getElementById("bdEditorBibliografias");
    if (!contenedor) return;
    var index = contenedor.querySelectorAll(".bd-editor-biblio").length;
    contenedor.insertAdjacentHTML("beforeend", '<div class="bd-editor-biblio" data-biblio-index="' + index + '">' +
      '<div class="bd-editor-biblio-head"><strong>Bibliografía ' + (index + 1) + '</strong><button type="button" data-detalle-action="quitar-biblio">Quitar</button></div>' +
      '<label>Referencia<textarea data-biblio-campo="referencia" rows="3"></textarea></label>' +
      '<label>Código<input data-biblio-campo="codigo" type="text"></label>' +
      '<label>Justificación<textarea data-biblio-campo="justificacion" rows="3"></textarea></label>' +
    '</div>');
    contenedor.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function inyectarEstilos() {
    if (document.getElementById("bd-detalle-editor-v2-css")) return;
    var style = document.createElement("style");
    style.id = "bd-detalle-editor-v2-css";
    style.textContent = `
      #modalDetalle .bd-modal-head{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #d8e2ef}
      #modalDetalle .bd-modal-content{padding-bottom:80px}
      .bd-detalle-nota-fondo{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:#eef5ff;color:#31557d;font-size:12px;font-weight:600}
      .bd-detalle-meta{margin-bottom:10px}.bd-detalle-badge{display:inline-flex;padding:4px 10px;border-radius:999px;font-size:12px;text-transform:capitalize}
      .bd-detalle-badge-ok{background:#dcfae6;color:#067647}.bd-detalle-badge-warn{background:#fff3d6;color:#935f00}.bd-detalle-badge-error{background:#fee4e2;color:#b42318}
      .bd-detalle-faltantes{padding:12px;border:1px solid #fed7aa;border-radius:12px;background:#fff8ed;margin:10px 0 14px}.bd-detalle-faltantes-titulo{font-weight:800;color:#9a3412;margin-bottom:8px}
      .bd-detalle-faltantes-lista{display:flex;gap:8px;flex-wrap:wrap}.bd-detalle-faltante{display:inline-flex;align-items:center;gap:7px;border:1px solid #fdba74;background:#fff;color:#9a3412;border-radius:999px;padding:7px 11px;cursor:pointer}.bd-detalle-faltante span{font-weight:900}
      .bd-detalle-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin:12px 0}.bd-detalle-kpi{padding:10px 12px;border:1px solid #d8e2ef;border-radius:12px;background:#f8fafc}.bd-detalle-kpi span{display:block;font-size:11px;color:#64748b}.bd-detalle-kpi strong{font-size:17px}.bd-detalle-valor-ok{color:#087f5b}.bd-detalle-valor-bad{color:#b42318}
      .bd-detalle-control-acordeones{display:flex;justify-content:flex-end;gap:8px;margin:8px 0}.bd-detalle-control-acordeones button,.bd-detalle-add,.bd-editor-biblio-head button{border:1px solid #cbd8e8;background:#fff;color:#184f90;border-radius:8px;padding:7px 10px;cursor:pointer}
      .bd-detalle-seccion{scroll-margin-top:90px}.bd-detalle-acordeon summary{display:flex;justify-content:space-between;gap:16px;align-items:center}.bd-detalle-acordeon summary small{color:#64748b}.bd-detalle-acordeon-error{border-color:#fdba74!important}.bd-detalle-acordeon-error summary{background:#fff7ed!important;color:#9a3412}
      .bd-detalle-subcampo{margin-bottom:14px}.bd-detalle-subcampo>strong{display:block;margin-bottom:7px}.bd-detalle-bloque-colapsable{border:1px solid #d8e2ef!important;border-radius:12px;padding:0!important;overflow:hidden}.bd-detalle-bloque-colapsable>summary{cursor:pointer;padding:13px 15px;background:#f5f8fc}.bd-detalle-details-body{padding:14px}
      .bd-detalle-barra{position:sticky;bottom:-1px;z-index:18;display:flex;justify-content:flex-end;gap:10px;margin:22px -2px -2px;padding:13px 2px 2px;background:linear-gradient(transparent,#fff 30%)}
      .bd-editor-aviso{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1px solid #b9d3f0;border-radius:12px;background:#eef6ff;color:#184f90}.bd-editor-aviso span{font-size:12px}
      .bd-editor-seccion label,.bd-editor-unidad label,.bd-editor-biblio label{display:block;margin:12px 0;font-weight:700;color:#334155}.bd-editor-seccion textarea,.bd-editor-seccion input,.bd-editor-unidad textarea,.bd-editor-unidad input,.bd-editor-biblio textarea,.bd-editor-biblio input{width:100%;margin-top:6px;padding:10px 12px;border:1px solid #cbd8e8;border-radius:10px;background:#fff;color:#111827;font:inherit;font-weight:400;resize:vertical}.bd-editor-seccion textarea:focus,.bd-editor-seccion input:focus,.bd-editor-unidad textarea:focus,.bd-editor-unidad input:focus,.bd-editor-biblio textarea:focus,.bd-editor-biblio input:focus{outline:2px solid #93bce8;border-color:#184f90}
      .bd-editor-unidad{border:1px solid #d8e2ef;border-radius:12px;margin:10px 0;overflow:hidden}.bd-editor-unidad>summary{display:flex;justify-content:space-between;padding:13px 15px;background:#f5f8fc;cursor:pointer}.bd-editor-unidad>div{padding:14px}.bd-editor-unidad small{display:block;color:#64748b;font-weight:400;margin-top:3px}
      .bd-editor-biblio{border:1px solid #d8e2ef;border-radius:12px;padding:13px;margin:10px 0;background:#fbfdff}.bd-editor-biblio-head{display:flex;align-items:center;justify-content:space-between}.bd-editor-biblio-head button{color:#b42318;border-color:#fecaca}
      .bd-detalle-cargando{display:flex;flex-direction:column;gap:5px;padding:18px;border-radius:12px;background:#f8fafc}.bd-detalle-cargando span{color:#64748b;font-size:12px}
      @media(max-width:720px){.bd-detalle-meta{grid-template-columns:1fr 1fr}.bd-detalle-barra{flex-direction:column}.bd-detalle-barra .bd-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  tabla.addEventListener("click", function (event) {
    var boton = event.target.closest("[data-materia-id]");
    if (!boton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    abrirDetalle(boton.getAttribute("data-materia-id"), boton);
  }, true);

  modalContenido.addEventListener("click", function (event) {
    var scroll = event.target.closest("[data-scroll-target]");
    if (scroll) {
      var destino = document.getElementById(scroll.getAttribute("data-scroll-target"));
      if (destino && destino.tagName === "DETAILS") destino.open = true;
      if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    var acordeon = event.target.closest("[data-accordion-action]");
    if (acordeon) {
      var abrir = acordeon.getAttribute("data-accordion-action") === "expandir";
      modalContenido.querySelectorAll("details").forEach(function (detalle) { detalle.open = abrir; });
      return;
    }

    var accion = event.target.closest("[data-detalle-action]");
    if (!accion) return;
    var nombre = accion.getAttribute("data-detalle-action");

    if (nombre === "editar" && detalleActual) {
      modoEdicion = true;
      modalContenido.innerHTML = renderEdicion(detalleActual);
    } else if (nombre === "cancelar-edicion" && detalleActual) {
      modoEdicion = false;
      modalContenido.innerHTML = renderVista(detalleActual, "Edición cancelada. No se realizaron cambios.");
    } else if (nombre === "guardar") {
      guardarEdicion();
    } else if (nombre === "validar") {
      validarActual();
    } else if (nombre === "agregar-biblio") {
      agregarBibliografiaEditor();
    } else if (nombre === "quitar-biblio") {
      var bloque = accion.closest(".bd-editor-biblio");
      if (bloque) bloque.remove();
    }
  });

  modal.addEventListener("cancel", function (event) {
    if (guardando) event.preventDefault();
  });

  modal.addEventListener("close", function () {
    solicitudActual += 1;
    materiaActiva = "";
    detalleActual = null;
    modoEdicion = false;
    guardando = false;
  });

  inyectarEstilos();
  console.info("[BDLocalCCC.DetalleEditor] Revisión y edición segura V2 activadas.");
})(window, document);