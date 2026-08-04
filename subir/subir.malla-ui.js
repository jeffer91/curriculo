/* =========================================================
Nombre completo: subir.malla-ui.js
Ruta o ubicación: /Curriculo/subir/subir.malla-ui.js
Funciones:
- Comparar el ZIP validado con la malla vigente de cada carrera.
- Aplicar automáticamente coincidencias seguras por código o nombre y nivel.
- Mostrar materias faltantes y no vinculadas.
- Permitir arrastrar una materia detectada hacia su nombre oficial.
- Omitir materias no vinculadas hasta que se relacionen o aprueben como excepción.
========================================================= */
(function (window, document) {
  "use strict";

  window.SubirCCC = window.SubirCCC || {};
  var NS = window.SubirCCC;
  var Firebase = window.CurriculoFirebase;
  var Comparador = window.MallasComparador;
  var estado = {
    paquete: null,
    carreras: [],
    analizando: false,
    instalado: false,
    pintarOriginal: null,
    limpiarOriginal: null
  };

  function texto(valor) { return String(valor === null || typeof valor === "undefined" ? "" : valor).trim(); }
  function numero(valor, defecto) { var n = Number(valor); return Number.isFinite(n) ? n : Number(defecto || 0); }
  function arr(valor) { return Array.isArray(valor) ? valor : (valor === null || typeof valor === "undefined" ? [] : [valor]); }
  function escapar(valor) {
    return texto(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function insertarPanel() {
    if (document.getElementById("comparacionMallaPanel")) return;
    var referencia = document.getElementById("accionesImportacion") || document.getElementById("previewPanel");
    if (!referencia || !referencia.parentNode) return;
    var panel = document.createElement("section");
    panel.id = "comparacionMallaPanel";
    panel.className = "subir-panel subir-malla-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="subir-malla-head"><div><h2>Comparación con la malla curricular</h2><p>La aplicación usa la versión vigente para validar nombres, niveles y materias esperadas.</p></div><span id="mallaEstadoGeneral" class="subir-malla-state subir-malla-state-off">Sin análisis</span></div>' +
      '<div id="mallaResumenGeneral" class="subir-malla-stats"></div>' +
      '<div id="mallaCarreras"></div>';
    referencia.parentNode.insertBefore(panel, referencia.nextSibling);
  }

  function nivelMateria(materia) {
    return numero(materia && (materia.nivelNumero || materia.numeroNivel), 0);
  }

  function nombreMateria(materia) {
    return texto(materia && (materia.nombreOriginalDetectado || materia.nombre || materia.nombreMateria || materia.materia));
  }

  function guardarEstadoPEA(materia) {
    if (!materia || materia.__estadoPEAMalla) return;
    materia.__estadoPEAMalla = {
      estadoClasificado: materia.estadoClasificado,
      estadoValidacion: materia.estadoValidacion,
      estado: materia.estado,
      puedeImportar: materia.puedeImportar,
      subibleFirebase: materia.subibleFirebase
    };
  }

  function marcarNoVinculada(materia) {
    if (!materia) return;
    guardarEstadoPEA(materia);
    materia.estadoClasificado = "revision";
    materia.estadoValidacion = "revision";
    materia.puedeImportar = false;
    materia.subibleFirebase = false;
    materia.omitidaImportacion = true;
    materia.motivoOmisionImportacion = "La materia no está vinculada con la malla curricular vigente.";
    materia.mallaVinculada = false;
    materia.mallaEstado = "no_vinculada";
  }

  function restaurarEstadoPEA(materia) {
    if (!materia) return;
    var original = materia.__estadoPEAMalla || {};
    if (typeof original.estadoClasificado !== "undefined") materia.estadoClasificado = original.estadoClasificado;
    if (typeof original.estadoValidacion !== "undefined") materia.estadoValidacion = original.estadoValidacion;
    if (typeof original.estado !== "undefined") materia.estado = original.estado;
    materia.puedeImportar = original.puedeImportar !== false;
    materia.subibleFirebase = original.subibleFirebase !== false;
    materia.omitidaImportacion = false;
    materia.motivoOmisionImportacion = "";
  }

  function aplicarCoincidencia(coincidencia, detalle) {
    var materia = coincidencia.detectada;
    guardarEstadoPEA(materia);
    Comparador.aplicarVinculo(materia, coincidencia.oficial, {
      mallaId: detalle.malla.id,
      mallaVersion: detalle.malla.version,
      criterio: coincidencia.criterio
    });
    materia.mallaEstado = "vinculada";
    materia.mallaExcepcionAprobada = false;
    restaurarEstadoPEA(materia);
  }

  function filtrarExcepciones(resultado) {
    var excepciones = [];
    resultado.noVinculadas = resultado.noVinculadas.filter(function (item) {
      if (item.detectada && item.detectada.mallaExcepcionAprobada === true) {
        excepciones.push(item.detectada);
        restaurarEstadoPEA(item.detectada);
        item.detectada.mallaEstado = "excepcion";
        return false;
      }
      return true;
    });
    resultado.resumen.noVinculadas = resultado.noVinculadas.length;
    resultado.resumen.excepciones = excepciones.length;
    resultado.resumen.completa = resultado.faltantes.length === 0 && resultado.noVinculadas.length === 0;
    resultado.excepciones = excepciones;
    return resultado;
  }

  async function compararCarrera(paquete, carrera) {
    var detalle = await Firebase.Mallas.obtenerMallaVigenteParaCarrera(carrera);
    var materiasCarrera = arr(paquete.materias).filter(function (materia) {
      return texto(materia.carreraId) === texto(carrera.id);
    });

    if (!detalle) {
      materiasCarrera.forEach(function (materia) {
        if (materia.__estadoPEAMalla) restaurarEstadoPEA(materia);
      });
      return { carrera: carrera, detalle: null, resultado: null, materias: materiasCarrera };
    }

    var resultado = Comparador.comparar(materiasCarrera, detalle.materias, detalle.equivalencias || []);
    resultado.coincidencias.forEach(function (coincidencia) { aplicarCoincidencia(coincidencia, detalle); });
    resultado.noVinculadas.forEach(function (item) { marcarNoVinculada(item.detectada); });
    filtrarExcepciones(resultado);

    return { carrera: carrera, detalle: detalle, resultado: resultado, materias: materiasCarrera };
  }

  function construirResumenPaquete() {
    var resumen = {
      totalOficiales: 0,
      totalDetectadas: 0,
      vinculadas: 0,
      faltantes: 0,
      noVinculadas: 0,
      excepciones: 0,
      carrerasSinMalla: 0
    };

    estado.carreras.forEach(function (entrada) {
      if (!entrada.resultado) {
        resumen.carrerasSinMalla += 1;
        resumen.totalDetectadas += entrada.materias.length;
        return;
      }
      Object.keys(resumen).forEach(function (clave) {
        if (clave === "carrerasSinMalla") return;
        resumen[clave] += numero(entrada.resultado.resumen[clave], 0);
      });
    });

    estado.paquete.comparacionMalla = {
      generadoEn: new Date().toISOString(),
      mallaIncompleta: resumen.faltantes > 0 || resumen.noVinculadas > 0,
      totalOficiales: resumen.totalOficiales,
      totalDetectadas: resumen.totalDetectadas,
      totalVinculadas: resumen.vinculadas,
      totalFaltantes: resumen.faltantes,
      totalNoVinculadas: resumen.noVinculadas,
      totalExcepciones: resumen.excepciones,
      carrerasSinMalla: resumen.carrerasSinMalla,
      carreras: estado.carreras.map(function (entrada) {
        return {
          carreraId: entrada.carrera.id,
          carreraNombre: entrada.carrera.nombre,
          mallaId: entrada.detalle ? entrada.detalle.malla.id : "",
          mallaVersion: entrada.detalle ? entrada.detalle.malla.version : 0,
          resumen: entrada.resultado ? entrada.resultado.resumen : null
        };
      })
    };
    estado.paquete.resumenValidacion = Object.assign({}, estado.paquete.resumenValidacion || {}, {
      mallaComparada: estado.carreras.some(function (entrada) { return !!entrada.detalle; }),
      mallaIncompleta: estado.paquete.comparacionMalla.mallaIncompleta,
      materiasMallaFaltantes: resumen.faltantes,
      materiasMallaNoVinculadas: resumen.noVinculadas,
      materiasMallaExcepcion: resumen.excepciones
    });
    return resumen;
  }

  function stat(label, valor) {
    return '<article class="subir-malla-stat"><span>' + escapar(label) + '</span><strong>' + escapar(valor) + '</strong></article>';
  }

  function renderNoVinculada(item, entrada) {
    var detectada = item.detectada || {};
    var sugerencia = item.sugerencia;
    return '<article class="subir-malla-item subir-malla-detectada" draggable="true" data-drag-carrera="' + escapar(entrada.carrera.id) + '" data-drag-materia="' + escapar(detectada.id) + '">' +
      '<strong>' + escapar(nombreMateria(detectada)) + '</strong>' +
      '<small>Nivel detectado: ' + escapar(nivelMateria(detectada) || "Sin nivel") + (detectada.codigo ? ' · Código: ' + escapar(detectada.codigo) : "") + '</small>' +
      (sugerencia ? '<div class="subir-malla-sugerencia">Posible relación: <b>' + escapar(sugerencia.nombreOficial) + '</b> · nivel ' + escapar(sugerencia.nivelNumero) + (item.motivo === "nivel_diferente" ? " · nivel diferente" : " · similitud " + Math.round(numero(item.similitud, 0) * 100) + "%") + '</div>' : "") +
      '<div class="subir-malla-actions">' +
        (sugerencia ? '<button class="subir-malla-mini" type="button" data-confirmar-carrera="' + escapar(entrada.carrera.id) + '" data-confirmar-detectada="' + escapar(detectada.id) + '" data-confirmar-oficial="' + escapar(sugerencia.id) + '">Relacionar sugerencia</button>' : "") +
        '<button class="subir-malla-mini subir-malla-mini-warn" type="button" data-excepcion-carrera="' + escapar(entrada.carrera.id) + '" data-excepcion-detectada="' + escapar(detectada.id) + '">Aprobar excepción</button>' +
      '</div></article>';
  }

  function renderFaltante(oficial, entrada) {
    return '<article class="subir-malla-item subir-malla-faltante" data-drop-carrera="' + escapar(entrada.carrera.id) + '" data-drop-oficial="' + escapar(oficial.id) + '">' +
      '<strong>' + escapar(oficial.nombreOficial) + '</strong>' +
      '<small>Nivel oficial: ' + escapar(oficial.nivelNumero) + (oficial.codigo ? ' · Código: ' + escapar(oficial.codigo) : "") + '</small>' +
      '<small>Arrastra aquí una materia detectada para vincularla.</small>' +
    '</article>';
  }

  function renderCarrera(entrada) {
    if (!entrada.detalle) {
      return '<section class="subir-malla-career"><div class="subir-malla-career-head"><div><h3>' + escapar(entrada.carrera.nombre) + '</h3><small>' + entrada.materias.length + ' materias detectadas</small></div><span class="subir-malla-state subir-malla-state-off">Sin malla vigente</span></div>' +
        '<div class="subir-malla-no-version">Esta carrera todavía no tiene una malla curricular vigente. Las materias se mantienen con su validación PEA normal, pero no se puede comprobar si faltan asignaturas oficiales.</div></section>';
    }

    var r = entrada.resultado;
    var matches = r.coincidencias.length ? '<div class="subir-malla-match-list">' + r.coincidencias.map(function (item) {
      return '<div class="subir-malla-match"><span>' + escapar(nombreMateria(item.detectada)) + '</span><span>→</span><span>' + escapar(item.oficial.nombreOficial) + ' · nivel ' + escapar(item.oficial.nivelNumero) + '</span></div>';
    }).join("") + '</div>' : '<div class="subir-malla-empty">No existen coincidencias confirmadas.</div>';

    var noVinculadas = r.noVinculadas.length
      ? '<div class="subir-malla-list">' + r.noVinculadas.map(function (item) { return renderNoVinculada(item, entrada); }).join("") + '</div>'
      : '<div class="subir-malla-empty">Todas las materias detectadas están vinculadas o aprobadas.</div>';
    var faltantes = r.faltantes.length
      ? '<div class="subir-malla-list">' + r.faltantes.map(function (item) { return renderFaltante(item, entrada); }).join("") + '</div>'
      : '<div class="subir-malla-empty">No faltan materias oficiales.</div>';

    return '<section class="subir-malla-career"><div class="subir-malla-career-head"><div><h3>' + escapar(entrada.carrera.nombre) + '</h3><small>Malla vigente v' + escapar(entrada.detalle.malla.version) + ' · ' + escapar(entrada.detalle.malla.totalMaterias) + ' materias oficiales</small></div><span class="subir-malla-state ' + (r.resumen.completa ? "subir-malla-state-ok" : "subir-malla-state-warn") + '">' + (r.resumen.completa ? "Malla completa" : "Malla incompleta") + '</span></div>' +
      '<div class="subir-malla-columns"><div class="subir-malla-column"><h4>Materias no vinculadas</h4><p>Arrástralas hacia el nombre oficial o confirma la sugerencia.</p>' + noVinculadas + '</div><div class="subir-malla-column"><h4>Materias oficiales faltantes</h4><p>Están en la malla vigente, pero no se relacionaron con el ZIP.</p>' + faltantes + '</div></div>' +
      '<h4 style="margin:15px 0 7px">Coincidencias confirmadas</h4>' + matches +
      (r.excepciones.length ? '<div class="subir-malla-manual-note"><b>Excepciones aprobadas:</b> ' + r.excepciones.map(function (m) { return escapar(nombreMateria(m)); }).join(", ") + ". Se podrán importar, pero no reemplazan ninguna materia oficial faltante.</div>' : "") +
    '</section>';
  }

  function pintar() {
    insertarPanel();
    var panel = document.getElementById("comparacionMallaPanel");
    if (!panel) return;
    panel.hidden = false;
    var resumen = construirResumenPaquete();
    document.getElementById("mallaResumenGeneral").innerHTML =
      stat("Materias oficiales", resumen.totalOficiales) + stat("Vinculadas", resumen.vinculadas) +
      stat("Faltantes", resumen.faltantes) + stat("No vinculadas", resumen.noVinculadas) + stat("Excepciones", resumen.excepciones);
    document.getElementById("mallaCarreras").innerHTML = estado.carreras.map(renderCarrera).join("");
    var general = document.getElementById("mallaEstadoGeneral");
    var incompleta = resumen.faltantes > 0 || resumen.noVinculadas > 0;
    general.className = "subir-malla-state " + (incompleta ? "subir-malla-state-warn" : (resumen.totalOficiales ? "subir-malla-state-ok" : "subir-malla-state-off"));
    general.textContent = resumen.totalOficiales ? (incompleta ? "Malla incompleta" : "Malla completa") : "Sin mallas registradas";
  }

  async function analizar(paquete) {
    if (!paquete || estado.analizando) return;
    estado.analizando = true;
    estado.paquete = paquete;
    insertarPanel();
    var panel = document.getElementById("comparacionMallaPanel");
    if (panel) panel.hidden = false;
    var carrerasDiv = document.getElementById("mallaCarreras");
    if (carrerasDiv) carrerasDiv.innerHTML = '<div class="subir-malla-empty">Consultando las mallas vigentes en Firebase...</div>';

    try {
      estado.carreras = [];
      for (var i = 0; i < arr(paquete.carreras).length; i += 1) {
        estado.carreras.push(await compararCarrera(paquete, paquete.carreras[i]));
      }
      construirResumenPaquete();
      if (estado.pintarOriginal) estado.pintarOriginal.call(NS.Preview, paquete);
      pintar();
      if (NS.ImportacionParcialUI && typeof NS.ImportacionParcialUI.actualizarBotones === "function") {
        NS.ImportacionParcialUI.actualizarBotones(paquete);
      }
    } catch (error) {
      if (carrerasDiv) carrerasDiv.innerHTML = '<div class="subir-malla-no-version">No se pudo comparar la malla: ' + escapar(error.message || error) + '</div>';
    } finally {
      estado.analizando = false;
    }
  }

  function buscarEntrada(carreraId) {
    return estado.carreras.find(function (entrada) { return texto(entrada.carrera.id) === texto(carreraId); }) || null;
  }

  function buscarMateria(entrada, materiaId) {
    return entrada && entrada.materias.find(function (materia) { return texto(materia.id) === texto(materiaId); }) || null;
  }

  function buscarOficial(entrada, oficialId) {
    return entrada && entrada.detalle && entrada.detalle.materias.find(function (materia) { return texto(materia.id) === texto(oficialId); }) || null;
  }

  async function vincular(carreraId, materiaId, oficialId) {
    var entrada = buscarEntrada(carreraId);
    var materia = buscarMateria(entrada, materiaId);
    var oficial = buscarOficial(entrada, oficialId);
    if (!entrada || !materia || !oficial) return;

    if (nivelMateria(materia) !== numero(oficial.nivelNumero, 0)) {
      var confirmarNivel = window.confirm(
        "La materia detectada está en el nivel " + nivelMateria(materia) +
        " y la materia oficial está en el nivel " + oficial.nivelNumero +
        ".\n\n¿Deseas confirmar la relación y utilizar el nivel oficial?"
      );
      if (!confirmarNivel) return;
    }

    await Firebase.Mallas.guardarEquivalencia({
      mallaId: entrada.detalle.malla.id,
      carreraId: entrada.detalle.malla.carreraId,
      mallaMateriaId: oficial.id,
      nombreOficial: oficial.nombreOficial,
      nivelOficial: oficial.nivelNumero,
      nombreDetectado: nombreMateria(materia),
      nivelDetectado: nivelMateria(materia),
      criterio: "arrastre_manual"
    });
    materia.mallaExcepcionAprobada = false;
    await analizarForzado();
  }

  async function analizarForzado() {
    estado.analizando = false;
    await analizar(estado.paquete);
  }

  function aprobarExcepcion(carreraId, materiaId) {
    var entrada = buscarEntrada(carreraId);
    var materia = buscarMateria(entrada, materiaId);
    if (!materia) return;
    var confirma = window.confirm(
      "La materia \"" + nombreMateria(materia) + "\" podrá importarse como excepción, pero seguirá sin corresponder a ninguna materia oficial de la malla.\n\n¿Deseas continuar?"
    );
    if (!confirma) return;
    materia.mallaExcepcionAprobada = true;
    materia.mallaEstado = "excepcion";
    restaurarEstadoPEA(materia);
    analizarForzado();
  }

  function conectarArrastre(panel) {
    panel.addEventListener("dragstart", function (event) {
      var item = event.target.closest("[data-drag-materia]");
      if (!item || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
        carreraId: item.getAttribute("data-drag-carrera"),
        materiaId: item.getAttribute("data-drag-materia")
      }));
    });
    panel.addEventListener("dragover", function (event) {
      var destino = event.target.closest("[data-drop-oficial]");
      if (!destino) return;
      event.preventDefault();
      destino.setAttribute("data-drop-activo", "true");
    });
    panel.addEventListener("dragleave", function (event) {
      var destino = event.target.closest("[data-drop-oficial]");
      if (destino) destino.removeAttribute("data-drop-activo");
    });
    panel.addEventListener("drop", function (event) {
      var destino = event.target.closest("[data-drop-oficial]");
      if (!destino || !event.dataTransfer) return;
      event.preventDefault();
      destino.removeAttribute("data-drop-activo");
      try {
        var origen = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");
        if (texto(origen.carreraId) !== texto(destino.getAttribute("data-drop-carrera"))) {
          window.alert("Solo puedes relacionar materias de la misma carrera.");
          return;
        }
        vincular(origen.carreraId, origen.materiaId, destino.getAttribute("data-drop-oficial")).catch(function (error) {
          NS.Preview.pintarEstado("error", "No se pudo guardar la relación", error.message || error);
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  function conectarClicks(panel) {
    panel.addEventListener("click", function (event) {
      var confirmar = event.target.closest("[data-confirmar-oficial]");
      if (confirmar) {
        vincular(
          confirmar.getAttribute("data-confirmar-carrera"),
          confirmar.getAttribute("data-confirmar-detectada"),
          confirmar.getAttribute("data-confirmar-oficial")
        ).catch(function (error) { NS.Preview.pintarEstado("error", "No se pudo relacionar", error.message || error); });
        return;
      }
      var excepcion = event.target.closest("[data-excepcion-detectada]");
      if (excepcion) aprobarExcepcion(excepcion.getAttribute("data-excepcion-carrera"), excepcion.getAttribute("data-excepcion-detectada"));
    });
  }

  function instalar() {
    if (estado.instalado || !NS.Preview || !NS.Main || !Firebase || !Firebase.Mallas || !Comparador) return false;
    estado.instalado = true;
    insertarPanel();
    var panel = document.getElementById("comparacionMallaPanel");
    conectarArrastre(panel);
    conectarClicks(panel);

    estado.pintarOriginal = NS.Preview.pintarPaquete;
    estado.limpiarOriginal = NS.Preview.limpiarPreview;
    NS.Preview.pintarPaquete = function (paquete) {
      var resultado = estado.pintarOriginal.apply(NS.Preview, arguments);
      window.setTimeout(function () { analizar(paquete); }, 0);
      return resultado;
    };
    NS.Preview.limpiarPreview = function () {
      estado.paquete = null;
      estado.carreras = [];
      var panelActual = document.getElementById("comparacionMallaPanel");
      if (panelActual) panelActual.hidden = true;
      return estado.limpiarOriginal.apply(NS.Preview, arguments);
    };

    var actual = NS.Main.getEstado ? NS.Main.getEstado().paqueteValidado : null;
    if (actual) analizar(actual);
    return true;
  }

  function esperarInstalacion(intentos) {
    if (instalar()) return;
    if (intentos > 80) return;
    window.setTimeout(function () { esperarInstalacion(intentos + 1); }, 100);
  }

  NS.MallaUI = { instalar: instalar, analizar: analizar, getEstado: function () { return estado; } };
  esperarInstalacion(0);
})(window, document);
