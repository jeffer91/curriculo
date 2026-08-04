/* =========================================================
Nombre completo: mallas.main.js
Ruta o ubicación: /Curriculo/mallas/mallas.main.js
Funciones:
- Controlar el formulario de mallas curriculares.
- Convertir texto y Excel en una tabla editable de materias.
- Guardar versiones, requisitos y estado vigente en Firebase.
- Cargar y activar versiones registradas.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var Parser = window.MallasParser;
  var estado = {
    mallaId: "",
    carreras: [],
    mallas: [],
    materias: [],
    requisitos: [],
    fuenteTipo: "texto",
    archivoFuente: null,
    urlPreview: "",
    guardando: false
  };

  function $(id) { return document.getElementById(id); }
  function texto(valor) { return String(valor === null || typeof valor === "undefined" ? "" : valor).trim(); }
  function numero(valor, defecto) { var n = Number(valor); return Number.isFinite(n) ? n : Number(defecto || 0); }
  function escapar(valor) {
    return texto(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function setTexto(id, valor) { var el = $(id); if (el) el.textContent = texto(valor); }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("mlEstado");
    if (!el) return;
    el.className = "ml-status ml-status-" + tipo;
    el.innerHTML = "<strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span>";
  }

  function setGuardando(valor) {
    estado.guardando = !!valor;
    ["btnGuardarMalla", "btnNuevaMalla", "btnProcesarTexto", "btnProcesarExcel", "btnProcesarDocumento", "btnRecargarMallas"]
      .forEach(function (id) { var el = $(id); if (el) el.disabled = estado.guardando; });
  }

  function nombreNivel(nivel) {
    return Number(nivel || 0) > 0 ? Number(nivel) + ". Nivel" : "Nivel";
  }

  function ordenarMaterias() {
    estado.materias.sort(function (a, b) {
      return numero(a.nivelNumero, 0) - numero(b.nivelNumero, 0) ||
        numero(a.orden, 0) - numero(b.orden, 0) ||
        texto(a.nombreOficial).localeCompare(texto(b.nombreOficial), "es");
    });
    var ordenes = {};
    estado.materias.forEach(function (materia) {
      var nivel = numero(materia.nivelNumero, 0);
      ordenes[nivel] = (ordenes[nivel] || 0) + 1;
      materia.orden = ordenes[nivel];
      materia.nivelNombre = nombreNivel(nivel);
    });
    pintarMaterias();
  }

  function pintarMaterias() {
    var tbody = $("tablaMateriasMalla");
    if (!tbody) return;
    if (!estado.materias.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="ml-empty">Todavía no se han registrado materias.</td></tr>';
      actualizarEstadisticas();
      return;
    }

    tbody.innerHTML = estado.materias.map(function (materia, indice) {
      return '<tr data-index="' + indice + '">' +
        '<td><input class="ml-edit" data-campo="nivelNumero" type="number" min="1" max="20" value="' + escapar(materia.nivelNumero) + '" /></td>' +
        '<td><input class="ml-edit" data-campo="orden" type="number" min="1" value="' + escapar(materia.orden || indice + 1) + '" /></td>' +
        '<td><input class="ml-edit" data-campo="codigo" type="text" value="' + escapar(materia.codigo || "") + '" placeholder="Opcional" /></td>' +
        '<td><input class="ml-edit" data-campo="nombreOficial" type="text" value="' + escapar(materia.nombreOficial || "") + '" /></td>' +
        '<td><select class="ml-edit" data-campo="tipo"><option value="asignatura" ' + (materia.tipo === "asignatura" ? "selected" : "") + '>Asignatura</option><option value="integracion_curricular" ' + (materia.tipo === "integracion_curricular" ? "selected" : "") + '>Integración curricular</option><option value="optativa" ' + (materia.tipo === "optativa" ? "selected" : "") + '>Optativa</option></select></td>' +
        '<td><button class="ml-mini ml-mini-danger" type="button" data-eliminar="' + indice + '">Eliminar</button></td>' +
      '</tr>';
    }).join("");
    actualizarEstadisticas();
  }

  function leerRequisitosTextarea() {
    return texto($("inputRequisitos") && $("inputRequisitos").value).split(/\r?\n/).map(function (linea) { return texto(linea); })
      .filter(Boolean).map(function (nombre, indice) {
        var n = Parser.normalizar(nombre);
        return {
          orden: indice + 1,
          tipo: /idioma|nivel [a-c]\d/.test(n) ? "idioma" :
            (/digital/.test(n) ? "competencia_digital" : (/practica/.test(n) ? "practicas" : (/vinculacion/.test(n) ? "vinculacion" : "otro"))),
          nombre: nombre,
          activo: true
        };
      });
  }

  function escribirRequisitos(requisitos) {
    estado.requisitos = Array.isArray(requisitos) ? requisitos : [];
    if ($("inputRequisitos")) $("inputRequisitos").value = estado.requisitos.map(function (item) { return texto(item.nombre || item); }).join("\n");
    actualizarEstadisticas();
  }

  function actualizarEstadisticas() {
    var niveles = {};
    estado.materias.forEach(function (materia) { if (numero(materia.nivelNumero, 0) > 0) niveles[materia.nivelNumero] = true; });
    setTexto("statNivelesMalla", Object.keys(niveles).length);
    setTexto("statMateriasMalla", estado.materias.length);
    setTexto("statRequisitosMalla", leerRequisitosTextarea().length);
    setTexto("statVersionMalla", numero($("inputVersion") && $("inputVersion").value, 1));
  }

  function aplicarResultadoParser(resultado, fuenteTipo) {
    resultado = resultado || {};
    estado.materias = (resultado.materias || []).map(function (materia) {
      return Object.assign({ codigo: "", tipo: "asignatura", obligatoria: true, activa: true }, materia);
    });
    escribirRequisitos(resultado.requisitos || []);
    if (!texto($("inputCarrera").value) && texto(resultado.carreraSugerida)) $("inputCarrera").value = resultado.carreraSugerida;
    estado.fuenteTipo = fuenteTipo;
    pintarMaterias();
    pintarEstado(resultado.advertencias && resultado.advertencias.length ? "warn" : "ok", "Contenido convertido", estado.materias.length + " materias fueron cargadas en la tabla para revisión.");
  }

  function procesarTexto(inputId, fuenteTipo) {
    var contenido = texto($(inputId) && $(inputId).value);
    if (!contenido) {
      pintarEstado("warn", "Sin contenido", "Pega o transcribe la malla antes de procesarla.");
      return;
    }
    aplicarResultadoParser(Parser.parsearTexto(contenido, { carrera: texto($("inputCarrera").value) }), fuenteTipo);
  }

  async function procesarExcel() {
    var input = $("inputExcelMalla");
    var archivo = input && input.files && input.files[0];
    if (!archivo) {
      pintarEstado("warn", "Sin archivo", "Selecciona un archivo Excel.");
      return;
    }
    if (!window.XLSX) {
      pintarEstado("error", "XLSX no disponible", "No se pudo cargar el lector de Excel.");
      return;
    }

    try {
      setGuardando(true);
      pintarEstado("neutral", "Leyendo Excel", "Procesando la primera hoja del archivo.");
      var buffer = await archivo.arrayBuffer();
      var libro = window.XLSX.read(buffer, { type: "array" });
      var hoja = libro.Sheets[libro.SheetNames[0]];
      var filas = window.XLSX.utils.sheet_to_json(hoja, { defval: "", raw: false });
      estado.archivoFuente = archivo;
      aplicarResultadoParser(Parser.parsearFilasExcel(filas), "excel");
    } catch (error) {
      pintarEstado("error", "No se pudo leer el Excel", error.message || error);
    } finally {
      setGuardando(false);
    }
  }

  function cambiarFuente(tipo) {
    estado.fuenteTipo = tipo;
    document.querySelectorAll("[data-source]").forEach(function (boton) {
      boton.classList.toggle("ml-source-tab-active", boton.getAttribute("data-source") === tipo);
    });
    document.querySelectorAll("[data-pane]").forEach(function (pane) {
      pane.hidden = pane.getAttribute("data-pane") !== tipo;
    });
  }

  function mostrarPreviewDocumento(archivo) {
    var preview = $("previewDocumento");
    if (!preview) return;
    if (estado.urlPreview) URL.revokeObjectURL(estado.urlPreview);
    estado.urlPreview = archivo ? URL.createObjectURL(archivo) : "";
    if (!archivo) {
      preview.innerHTML = "<p>Selecciona un archivo para visualizarlo.</p>";
      return;
    }
    if (/^image\//i.test(archivo.type)) {
      preview.innerHTML = '<img src="' + escapar(estado.urlPreview) + '" alt="Vista previa de la malla" />';
    } else {
      preview.innerHTML = '<object data="' + escapar(estado.urlPreview) + '" type="application/pdf"><p>No se pudo mostrar el PDF.</p></object>';
    }
  }

  function agregarMateria() {
    var maxNivel = estado.materias.reduce(function (max, item) { return Math.max(max, numero(item.nivelNumero, 0)); }, 1);
    var totalNivel = estado.materias.filter(function (item) { return numero(item.nivelNumero, 0) === maxNivel; }).length;
    estado.materias.push({ nivelNumero: maxNivel, nivelNombre: nombreNivel(maxNivel), orden: totalNivel + 1, codigo: "", nombreOficial: "", tipo: "asignatura", obligatoria: true, activa: true });
    pintarMaterias();
  }

  function carreraSeleccionada() {
    var nombre = texto($("inputCarrera").value);
    var n = Parser.normalizar(nombre);
    return estado.carreras.find(function (carrera) { return Parser.normalizar(carrera.nombre) === n; }) || null;
  }

  function fuenteActual() {
    var archivo = estado.archivoFuente;
    return {
      tipo: estado.fuenteTipo,
      archivoNombre: archivo ? archivo.name : "",
      archivoTipo: archivo ? archivo.type : "",
      archivoTamano: archivo ? archivo.size : 0,
      revisadaManualmente: true
    };
  }

  async function guardarMalla() {
    if (estado.guardando) return;
    var carreraNombre = texto($("inputCarrera").value);
    var validacion = Parser.validarMaterias(estado.materias);
    if (!carreraNombre) {
      pintarEstado("error", "Carrera requerida", "Escribe o selecciona el nombre de la carrera.");
      return;
    }
    if (!validacion.ok) {
      pintarEstado("error", "Revisa las materias", validacion.errores.join(" | "));
      return;
    }

    try {
      setGuardando(true);
      pintarEstado("neutral", "Guardando malla", "Registrando la versión, materias y requisitos en Firebase.");
      var carrera = carreraSeleccionada();
      var vigente = $("checkVigente").checked && $("inputEstadoMalla").value === "vigente";
      var detalle = await Firebase.Mallas.guardarMalla({
        id: estado.mallaId,
        carreraId: carrera ? carrera.id : "",
        carreraNombre: carreraNombre,
        nombre: "Malla curricular de " + carreraNombre,
        version: numero($("inputVersion").value, 1),
        periodoInicio: texto($("inputPeriodoInicio").value),
        periodoFin: texto($("inputPeriodoFin").value),
        estado: texto($("inputEstadoMalla").value),
        vigente: vigente,
        observaciones: texto($("inputObservaciones").value),
        fuente: fuenteActual(),
        materias: estado.materias,
        requisitos: leerRequisitosTextarea()
      });
      estado.mallaId = detalle.malla.id;
      estado.materias = detalle.materias;
      escribirRequisitos(detalle.requisitos);
      pintarMaterias();
      await cargarMallas();
      pintarEstado("ok", "Malla guardada", detalle.malla.carreraNombre + " · versión " + detalle.malla.version + " · " + detalle.materias.length + " materias.");
    } catch (error) {
      pintarEstado("error", "No se pudo guardar", error.message || error);
    } finally {
      setGuardando(false);
    }
  }

  function limpiarFormulario() {
    estado.mallaId = "";
    estado.materias = [];
    estado.requisitos = [];
    estado.archivoFuente = null;
    ["inputCarrera", "inputPeriodoInicio", "inputPeriodoFin", "inputObservaciones", "inputTextoMalla", "inputTextoDocumento", "inputRequisitos"]
      .forEach(function (id) { if ($(id)) $(id).value = ""; });
    $("inputVersion").value = siguienteVersionGeneral();
    $("inputEstadoMalla").value = "vigente";
    $("checkVigente").checked = true;
    if ($("inputExcelMalla")) $("inputExcelMalla").value = "";
    if ($("inputDocumentoMalla")) $("inputDocumentoMalla").value = "";
    mostrarPreviewDocumento(null);
    cambiarFuente("texto");
    pintarMaterias();
    pintarEstado("neutral", "Nueva malla", "Ingresa la carrera y carga las materias oficiales.");
  }

  function siguienteVersionGeneral() {
    var nombre = Parser.normalizar($("inputCarrera") ? $("inputCarrera").value : "");
    var versiones = estado.mallas.filter(function (malla) { return !nombre || Parser.normalizar(malla.carreraNombre) === nombre; });
    return versiones.reduce(function (max, malla) { return Math.max(max, numero(malla.version, 0)); }, 0) + 1;
  }

  async function cargarDetalle(mallaId) {
    try {
      setGuardando(true);
      pintarEstado("neutral", "Cargando versión", "Consultando materias y requisitos en Firebase.");
      var detalle = await Firebase.Mallas.obtenerDetalleMalla(mallaId);
      estado.mallaId = detalle.malla.id;
      estado.materias = detalle.materias;
      estado.fuenteTipo = detalle.malla.fuente && detalle.malla.fuente.tipo || "texto";
      $("inputCarrera").value = detalle.malla.carreraNombre || "";
      $("inputVersion").value = detalle.malla.version || 1;
      $("inputPeriodoInicio").value = detalle.malla.periodoInicio || "";
      $("inputPeriodoFin").value = detalle.malla.periodoFin || "";
      $("inputObservaciones").value = detalle.malla.observaciones || "";
      $("inputEstadoMalla").value = detalle.malla.estado || "borrador";
      $("checkVigente").checked = detalle.malla.vigente === true;
      escribirRequisitos(detalle.requisitos);
      cambiarFuente(estado.fuenteTipo === "excel" || estado.fuenteTipo === "documento" ? estado.fuenteTipo : "texto");
      pintarMaterias();
      pintarEstado("ok", "Versión cargada", detalle.malla.carreraNombre + " · versión " + detalle.malla.version + ".");
    } catch (error) {
      pintarEstado("error", "No se pudo cargar", error.message || error);
    } finally {
      setGuardando(false);
    }
  }

  function pintarVersiones() {
    var contenedor = $("listaVersiones");
    if (!contenedor) return;
    if (!estado.mallas.length) {
      contenedor.innerHTML = '<p class="ml-muted">Todavía no existen mallas registradas.</p>';
      return;
    }
    contenedor.innerHTML = estado.mallas.map(function (malla) {
      var vigente = malla.vigente === true || malla.estado === "vigente";
      return '<article class="ml-version"><div><strong>' + escapar(malla.carreraNombre) + ' · versión ' + escapar(malla.version) +
        '<span class="ml-badge ' + (vigente ? "ml-badge-ok" : "ml-badge-off") + '">' + (vigente ? "Vigente" : escapar(malla.estado || "histórica")) + '</span></strong>' +
        '<small>' + escapar(malla.totalNiveles || 0) + ' niveles · ' + escapar(malla.totalMaterias || 0) + ' materias · ' + escapar(malla.periodoInicio || "Sin periodo") + '</small></div>' +
        '<div class="ml-row-actions"><button class="ml-mini" type="button" data-cargar-malla="' + escapar(malla.id) + '">Abrir</button>' +
        (!vigente ? '<button class="ml-mini" type="button" data-activar-malla="' + escapar(malla.id) + '">Activar</button>' : "") + '</div></article>';
    }).join("");
  }

  async function cargarMallas() {
    estado.mallas = await Firebase.Mallas.obtenerMallas();
    pintarVersiones();
    actualizarEstadisticas();
  }

  async function cargarCarreras() {
    try {
      estado.carreras = typeof Firebase.obtenerCarreras === "function" ? await Firebase.obtenerCarreras() : [];
      var datalist = $("listaCarreras");
      if (datalist) datalist.innerHTML = estado.carreras.map(function (carrera) { return '<option value="' + escapar(carrera.nombre) + '"></option>'; }).join("");
    } catch (error) {
      estado.carreras = [];
    }
  }

  function conectarEventos() {
    document.addEventListener("click", function (event) {
      var source = event.target.closest && event.target.closest("[data-source]");
      if (source) cambiarFuente(source.getAttribute("data-source"));
      var eliminar = event.target.closest && event.target.closest("[data-eliminar]");
      if (eliminar) {
        estado.materias.splice(Number(eliminar.getAttribute("data-eliminar")), 1);
        pintarMaterias();
      }
      var cargar = event.target.closest && event.target.closest("[data-cargar-malla]");
      if (cargar) cargarDetalle(cargar.getAttribute("data-cargar-malla"));
      var activar = event.target.closest && event.target.closest("[data-activar-malla]");
      if (activar) {
        Firebase.Mallas.activarMalla(activar.getAttribute("data-activar-malla")).then(cargarMallas)
          .then(function () { pintarEstado("ok", "Malla activada", "La versión seleccionada quedó como vigente."); })
          .catch(function (error) { pintarEstado("error", "No se pudo activar", error.message || error); });
      }
    });

    $("tablaMateriasMalla").addEventListener("input", function (event) {
      var campo = event.target.getAttribute("data-campo");
      var fila = event.target.closest("tr[data-index]");
      if (!campo || !fila) return;
      var materia = estado.materias[Number(fila.getAttribute("data-index"))];
      if (!materia) return;
      materia[campo] = campo === "nivelNumero" || campo === "orden" ? numero(event.target.value, 0) : event.target.value;
      if (campo === "nivelNumero") materia.nivelNombre = nombreNivel(materia.nivelNumero);
      actualizarEstadisticas();
    });
    $("tablaMateriasMalla").addEventListener("change", function (event) {
      var campo = event.target.getAttribute("data-campo");
      var fila = event.target.closest("tr[data-index]");
      if (campo && fila && estado.materias[Number(fila.getAttribute("data-index"))]) estado.materias[Number(fila.getAttribute("data-index"))][campo] = event.target.value;
    });

    $("btnProcesarTexto").addEventListener("click", function () { procesarTexto("inputTextoMalla", "texto"); });
    $("btnProcesarDocumento").addEventListener("click", function () { procesarTexto("inputTextoDocumento", "documento"); });
    $("btnProcesarExcel").addEventListener("click", procesarExcel);
    $("btnAgregarMateria").addEventListener("click", agregarMateria);
    $("btnOrdenarMaterias").addEventListener("click", ordenarMaterias);
    $("btnGuardarMalla").addEventListener("click", guardarMalla);
    $("btnNuevaMalla").addEventListener("click", limpiarFormulario);
    $("btnRecargarMallas").addEventListener("click", function () { cargarMallas().catch(function (error) { pintarEstado("error", "Error", error.message); }); });
    $("inputVersion").addEventListener("input", actualizarEstadisticas);
    $("inputRequisitos").addEventListener("input", actualizarEstadisticas);
    $("inputCarrera").addEventListener("change", function () { if (!estado.mallaId) $("inputVersion").value = siguienteVersionGeneral(); actualizarEstadisticas(); });
    $("inputDocumentoMalla").addEventListener("change", function (event) {
      estado.archivoFuente = event.target.files && event.target.files[0] || null;
      estado.fuenteTipo = "documento";
      mostrarPreviewDocumento(estado.archivoFuente);
    });
    $("inputExcelMalla").addEventListener("change", function (event) {
      estado.archivoFuente = event.target.files && event.target.files[0] || null;
      estado.fuenteTipo = "excel";
    });
  }

  async function iniciar() {
    if (!Firebase || !Firebase.Mallas || !Parser) {
      pintarEstado("error", "Módulos no disponibles", "No se cargaron Firebase Mallas o el analizador de mallas.");
      return;
    }
    try {
      conectarEventos();
      await Firebase.ready();
      await Promise.all([cargarCarreras(), cargarMallas()]);
      limpiarFormulario();
      pintarEstado("ok", "Módulo listo", "Puedes crear una malla o abrir una versión existente.");
    } catch (error) {
      pintarEstado("error", "No se pudo iniciar", error.message || error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
