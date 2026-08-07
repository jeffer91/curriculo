/* =========================================================
Nombre completo: fichas.js
Ruta o ubicación: /Curriculo/fichas/fichas.js
Funciones:
- Elegir carrera, nivel y período para una ficha.
- Tomar materias exclusivamente de la malla vigente del nivel.
- Verificar materias y PEA completos en Firebase.
- Administrar cuatro inputs institucionales por carrera y nivel.
- Leer TXT, DOCX y PDF para análisis asistido por IA.
- Guardar datos generales, inputs, tendencias y generaciones en Firebase.
- Generar una propuesta de ficha sin modificar ningún PEA.
- Crear vista previa editable y exportar a Word y PDF.
========================================================= */
(function (window, document) {
  "use strict";

  var FB = window.CurriculoFirebase;
  var Mallas = FB && FB.Mallas;
  var Fichas = FB && FB.Fichas;
  var IA = window.CurriculoIA;

  var TIPOS_INPUT = [
    { id: "graduados", nombre: "Seguimiento a graduados y egresados" },
    { id: "titulacion", nombre: "Titulación y eficiencia terminal" },
    { id: "vinculacion", nombre: "Vinculación con la sociedad" },
    { id: "practicas", nombre: "Prácticas preprofesionales" }
  ];

  var CAMPOS_DATOS = [
    "codigoDocumento",
    "coordinador",
    "docentes",
    "fechaInicio",
    "fechaFin",
    "elaboradoPor",
    "revisadoPor",
    "aprobadoPor"
  ];

  var estado = {
    carreras: [],
    carrera: null,
    malla: null,
    nivelNumero: 0,
    periodo: "",
    materiasEsperadas: [],
    materiasEstado: [],
    inputs: {},
    contexto: null,
    tendencias: [],
    iaDisponible: false,
    diagnostico: null,
    modalTipo: "",
    modalArchivo: null,
    modalAnalisis: null,
    modalHash: "",
    detallesMaterias: [],
    cambiosMaterias: [],
    generacion: null
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function arr(valor) {
    return Array.isArray(valor) ? valor : [];
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function nombreNivel(n) {
    var nombres = { 1: "Primer nivel", 2: "Segundo nivel", 3: "Tercer nivel", 4: "Cuarto nivel", 5: "Quinto nivel", 6: "Sexto nivel" };
    return nombres[numero(n, 0)] || ("Nivel " + numero(n, 0));
  }

  function hoyISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function esFechaAntigua(fecha) {
    if (!texto(fecha)) return false;
    var d = new Date(fecha + (fecha.length <= 10 ? "T23:59:59" : ""));
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  function valorCampo(id) {
    var el = document.getElementById(id);
    return el ? texto(el.value) : "";
  }

  function setCampo(id, valor) {
    var el = document.getElementById(id);
    if (el) el.value = valor === null || typeof valor === "undefined" ? "" : valor;
  }

  function cambiarTab(nombre) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-tab") === nombre);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-panel") === nombre);
    });
  }

  function conectarTabs() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () { cambiarTab(tab.getAttribute("data-tab")); });
    });
  }

  function carreraSeleccionada() {
    var id = valorCampo("carreraSelect");
    return estado.carreras.find(function (item) { return item.id === id; }) || null;
  }

  async function cargarCarreras() {
    estado.carreras = await FB.obtenerCarreras();
    var select = document.getElementById("carreraSelect");
    select.innerHTML = '<option value="">Seleccionar carrera</option>' + estado.carreras.map(function (item) {
      return '<option value="' + escapar(item.id) + '">' + escapar(item.nombreInstitucional || item.nombreCorregido || item.nombre) + '</option>';
    }).join("");
  }

  async function cargarNiveles() {
    var select = document.getElementById("nivelSelect");
    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    estado.carrera = carreraSeleccionada();
    estado.malla = null;
    estado.nivelNumero = 0;
    estado.materiasEsperadas = [];
    if (!estado.carrera) {
      select.innerHTML = '<option value="">Seleccionar nivel</option>';
      renderInicial();
      return;
    }
    try {
      estado.malla = await Mallas.obtenerMallaVigenteParaCarrera(estado.carrera);
      if (!estado.malla || !estado.malla.materias || !estado.malla.materias.length) {
        select.innerHTML = '<option value="">Sin malla vigente</option>';
        renderInicial("La carrera no tiene una malla vigente registrada.");
        return;
      }
      var niveles = {};
      estado.malla.materias.forEach(function (materia) {
        if (materia.activa === false) return;
        var n = numero(materia.nivelNumero, 0);
        if (n > 0) niveles[n] = true;
      });
      select.innerHTML = '<option value="">Seleccionar nivel</option>' + Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
        return '<option value="' + n + '">' + escapar(nombreNivel(n)) + '</option>';
      }).join("");
      select.disabled = false;
      renderInicial();
    } catch (error) {
      select.innerHTML = '<option value="">Error al cargar malla</option>';
      renderInicial(error && error.message ? error.message : "No se pudo cargar la malla.");
    }
  }

  function renderInicial(mensaje) {
    document.getElementById("materiasLista").innerHTML = '<div class="empty">' + escapar(mensaje || "Selecciona una carrera y un nivel.") + '</div>';
    document.getElementById("materiasResumen").textContent = "Sin revisar";
    document.getElementById("faltantes").innerHTML = '<div class="empty">' + escapar(mensaje || "Selecciona carrera y nivel.") + '</div>';
    document.getElementById("resumenChecks").innerHTML = "";
    document.getElementById("porcentaje").textContent = "0%";
    document.getElementById("barraProgreso").style.width = "0%";
    document.getElementById("estadoFicha").textContent = "Pendiente";
    document.getElementById("estadoFicha").className = "state neutral";
    document.getElementById("btnGenerar").disabled = true;
    renderInputs();
  }

  function encontrarMateriaFirebase(esperada, materiasFirebase) {
    var idFirebase = texto(esperada.materiaFirebaseId);
    if (idFirebase) {
      var exacta = materiasFirebase.find(function (m) { return m.id === idFirebase; });
      if (exacta) return exacta;
    }
    var clave = normalizar(esperada.nombreOficial);
    var candidatas = materiasFirebase.filter(function (m) {
      return numero(m.nivelNumero, 0) === numero(esperada.nivelNumero, 0) && normalizar(m.nombreMostrar || m.nombre) === clave;
    });
    return candidatas.length === 1 ? candidatas[0] : null;
  }

  function esMateriaCompleta(materia) {
    if (!materia) return false;
    var estadoValidacion = texto(materia.estadoValidacion).toLowerCase();
    return estadoValidacion === "completo" || estadoValidacion === "completa";
  }

  async function revisarFicha() {
    estado.carrera = carreraSeleccionada();
    estado.nivelNumero = numero(valorCampo("nivelSelect"), 0);
    estado.periodo = valorCampo("periodoInput");
    if (!estado.carrera || estado.nivelNumero < 1 || !estado.periodo) {
      alert("Selecciona carrera, nivel y período.");
      return;
    }
    var boton = document.getElementById("btnRevisar");
    boton.disabled = true;
    boton.textContent = "Revisando...";
    try {
      if (!estado.malla) estado.malla = await Mallas.obtenerMallaVigenteParaCarrera(estado.carrera);
      if (!estado.malla) throw new Error("No existe una malla vigente para esta carrera.");
      estado.materiasEsperadas = estado.malla.materias.filter(function (materia) {
        return materia.activa !== false && numero(materia.nivelNumero, 0) === estado.nivelNumero;
      });
      var resultados = await Promise.all([
        FB.obtenerMateriasPorCarrera(estado.carrera.id, { soloCompletas: false, incluirRetiradas: false }),
        Fichas.obtenerInputsActuales(estado.carrera.id, estado.nivelNumero),
        Fichas.obtenerContexto(estado.carrera.id, estado.nivelNumero, estado.periodo),
        Fichas.obtenerTendencias(estado.carrera.id, estado.nivelNumero, estado.periodo),
        IA.disponible()
      ]);
      var materiasFirebase = resultados[0];
      estado.inputs = resultados[1] || {};
      estado.contexto = resultados[2] || null;
      estado.tendencias = resultados[3] || [];
      estado.iaDisponible = resultados[4] === true;
      estado.materiasEstado = estado.materiasEsperadas.map(function (esperada) {
        var actual = encontrarMateriaFirebase(esperada, materiasFirebase);
        return {
          esperada: esperada,
          actual: actual,
          completa: esMateriaCompleta(actual),
          estado: !actual ? "faltante" : (esMateriaCompleta(actual) ? "completa" : "incompleta")
        };
      });
      cargarContextoFormulario();
      renderTodo();
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo revisar la ficha.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Revisar";
    }
  }

  function cargarContextoFormulario() {
    var c = estado.contexto || {};
    ["codigoDocumento", "coordinador", "docentes", "fechaInicio", "fechaFin", "elaboradoPor", "revisadoPor", "aprobadoPor", "cargoElaborador"].forEach(function (campo) {
      setCampo(campo, c[campo] || "");
    });
  }

  function obtenerContextoFormulario() {
    return {
      carreraId: estado.carrera ? estado.carrera.id : "",
      carreraNombre: estado.carrera ? texto(estado.carrera.nombreInstitucional || estado.carrera.nombreCorregido || estado.carrera.nombre) : "",
      nivelNumero: estado.nivelNumero,
      nivelNombre: nombreNivel(estado.nivelNumero),
      periodo: estado.periodo,
      codigoDocumento: valorCampo("codigoDocumento"),
      coordinador: valorCampo("coordinador"),
      docentes: valorCampo("docentes"),
      fechaInicio: valorCampo("fechaInicio"),
      fechaFin: valorCampo("fechaFin"),
      elaboradoPor: valorCampo("elaboradoPor"),
      revisadoPor: valorCampo("revisadoPor"),
      aprobadoPor: valorCampo("aprobadoPor"),
      cargoElaborador: valorCampo("cargoElaborador")
    };
  }

  async function guardarDatosGenerales() {
    if (!estado.carrera || estado.nivelNumero < 1 || !estado.periodo) {
      alert("Primero revisa una carrera, nivel y período.");
      return;
    }
    var datos = obtenerContextoFormulario();
    try {
      estado.contexto = await Fichas.guardarContexto(datos);
      renderTodo();
      document.getElementById("btnGuardarDatos").textContent = "Guardado";
      setTimeout(function () { document.getElementById("btnGuardarDatos").textContent = "Guardar"; }, 1200);
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudieron guardar los datos.");
    }
  }

  function inputCompleto(registro) {
    if (!registro) return false;
    if (registro.noAplica === true) return !!texto(registro.justificacionNoAplica);
    return !!(
      texto(registro.documentoNombre) ||
      texto(registro.codigoInforme) ||
      (registro.analisisIA && (texto(registro.analisisIA.resumen) || arr(registro.analisisIA.hallazgos).length))
    );
  }

  function datosCompletos() {
    var c = obtenerContextoFormulario();
    return CAMPOS_DATOS.every(function (campo) { return !!texto(c[campo]); });
  }

  function calcularDiagnostico() {
    var materiasOk = estado.materiasEsperadas.length > 0 && estado.materiasEstado.length === estado.materiasEsperadas.length && estado.materiasEstado.every(function (item) { return item.completa; });
    var inputsOk = TIPOS_INPUT.every(function (tipo) { return inputCompleto(estado.inputs[tipo.id]); });
    var datosOk = datosCompletos();
    var iaOk = estado.iaDisponible === true;
    var bloques = [materiasOk, inputsOk, datosOk, iaOk];
    var correctos = bloques.filter(Boolean).length;
    var faltantes = [];

    estado.materiasEstado.forEach(function (item) {
      if (item.estado === "faltante") faltantes.push("Falta la materia: " + item.esperada.nombreOficial + ".");
      else if (item.estado === "incompleta") faltantes.push(item.esperada.nombreOficial + ": PEA incompleto.");
    });
    if (!estado.materiasEsperadas.length) faltantes.push("No hay materias registradas en la malla para este nivel.");
    TIPOS_INPUT.forEach(function (tipo) {
      if (!inputCompleto(estado.inputs[tipo.id])) faltantes.push("Falta input: " + tipo.nombre + ".");
    });
    if (!datosOk) {
      CAMPOS_DATOS.forEach(function (campo) {
        var c = obtenerContextoFormulario();
        if (!texto(c[campo])) {
          var nombres = {
            codigoDocumento: "Código documental", coordinador: "Coordinador", docentes: "Docentes",
            fechaInicio: "Fecha de inicio", fechaFin: "Fecha de finalización", elaboradoPor: "Elaborado por",
            revisadoPor: "Revisado por", aprobadoPor: "Aprobado por"
          };
          faltantes.push("Dato general: " + (nombres[campo] || campo) + ".");
        }
      });
    }
    if (!iaOk) faltantes.push("No hay una IA activa y lista en Configuración.");

    return {
      materiasOk: materiasOk,
      inputsOk: inputsOk,
      datosOk: datosOk,
      iaOk: iaOk,
      porcentaje: Math.round((correctos / bloques.length) * 100),
      faltantes: faltantes,
      lista: faltantes.length === 0
    };
  }

  function estadoHtml(ok, textoOk, textoError, warning) {
    if (warning) return '<span class="state warn">' + escapar(warning) + '</span>';
    return ok ? '<span class="state ok">' + escapar(textoOk) + '</span>' : '<span class="state error">' + escapar(textoError) + '</span>';
  }

  function renderMaterias() {
    var listaEl = document.getElementById("materiasLista");
    var resumen = document.getElementById("materiasResumen");
    if (!estado.materiasEstado.length) {
      listaEl.innerHTML = '<div class="empty">No hay materias revisadas.</div>';
      resumen.textContent = "0 materias";
      return;
    }
    var completas = estado.materiasEstado.filter(function (x) { return x.completa; }).length;
    resumen.textContent = completas + "/" + estado.materiasEstado.length + " completas";
    listaEl.innerHTML = estado.materiasEstado.map(function (item) {
      var nombre = item.esperada.nombreOficial;
      var subtitulo = item.actual
        ? ("Firebase: " + (item.actual.nombreMostrar || item.actual.nombre) + " · " + texto(item.actual.estadoValidacion || "sin estado"))
        : "No encontrada en Firebase";
      return '<div class="subject"><div><strong>' + escapar(nombre) + '</strong><small>' + escapar(subtitulo) + '</small></div>' +
        (item.estado === "completa" ? '<span class="state ok">Completa</span>' : item.estado === "faltante" ? '<span class="state error">Faltante</span>' : '<span class="state error">PEA incompleto</span>') + '</div>';
    }).join("");
  }

  function renderInputs() {
    var grid = document.getElementById("inputsGrid");
    if (!grid) return;
    grid.innerHTML = TIPOS_INPUT.map(function (tipo) {
      var registro = estado.inputs[tipo.id];
      var completo = inputCompleto(registro);
      var aviso = registro && registro.vigenciaHasta && esFechaAntigua(registro.vigenciaHasta) ? "Vigencia vencida" : "";
      var detalle = "Sin información";
      if (registro) {
        if (registro.noAplica === true) detalle = "Marcado como No aplica: " + texto(registro.justificacionNoAplica);
        else detalle = [texto(registro.documentoNombre), texto(registro.codigoInforme), texto(registro.periodoInforme)].filter(Boolean).join(" · ") || "Información guardada";
      }
      return '<article class="input-card"><h4>' + escapar(tipo.nombre) + '</h4><p>' + escapar(detalle) + '</p><div class="input-actions">' +
        estadoHtml(completo, "Completo", "Falta", aviso) +
        '<button class="btn btn-light" type="button" data-input-tipo="' + escapar(tipo.id) + '">' + (registro ? "Revisar / actualizar" : "Cargar") + '</button></div></article>';
    }).join("");
    grid.querySelectorAll("[data-input-tipo]").forEach(function (btn) {
      btn.addEventListener("click", function () { abrirModalInput(btn.getAttribute("data-input-tipo")); });
    });
  }

  function renderDiagnostico() {
    estado.diagnostico = calcularDiagnostico();
    var d = estado.diagnostico;
    document.getElementById("porcentaje").textContent = d.porcentaje + "%";
    document.getElementById("barraProgreso").style.width = d.porcentaje + "%";
    var badge = document.getElementById("estadoFicha");
    badge.textContent = d.lista ? "Lista" : ("Faltan " + d.faltantes.length);
    badge.className = "state " + (d.lista ? "ok" : "warn");
    document.getElementById("resumenChecks").innerHTML = [
      ["Materias", d.materiasOk], ["Inputs", d.inputsOk], ["Datos generales", d.datosOk], ["IA", d.iaOk]
    ].map(function (item) {
      return '<div class="check"><span>' + escapar(item[0]) + '</span>' + estadoHtml(item[1], "Completo", "Pendiente") + '</div>';
    }).join("") + '<div class="check"><span>Tendencias</span>' + (estado.tendencias.length ? '<span class="state ok">Actualizadas</span>' : '<span class="state warn">Opcional</span>') + '</div>';

    var faltantes = document.getElementById("faltantes");
    faltantes.innerHTML = d.faltantes.length
      ? d.faltantes.map(function (item) { return '<div class="missing-item">' + escapar(item) + '</div>'; }).join("")
      : '<div class="empty">✓ No faltan elementos obligatorios.</div>';
    document.getElementById("btnGenerar").disabled = !d.lista;
    document.getElementById("iaEstado").textContent = estado.iaDisponible ? "IA disponible" : "IA no configurada";
  }

  function renderTendencias() {
    var el = document.getElementById("tendenciasResumen");
    if (!estado.tendencias.length) {
      el.textContent = "Las tendencias se actualizan solo cuando se solicita. No bloquean el diagnóstico de materias e inputs.";
      return;
    }
    el.innerHTML = '<strong>' + estado.tendencias.length + ' materias con tendencias registradas.</strong><br>' + estado.tendencias.map(function (t) {
      var a = t.analisis || {};
      return escapar(t.materiaNombre || t.materiaId) + ': ' + escapar(arr(a.tendencias).slice(0, 2).join("; ") || texto(a.resumen));
    }).join("<br>");
  }

  function renderTodo() {
    renderMaterias();
    renderInputs();
    renderDiagnostico();
    renderTendencias();
  }

  function abrirModalInput(tipoId) {
    estado.modalTipo = tipoId;
    estado.modalArchivo = null;
    estado.modalHash = "";
    estado.modalAnalisis = null;
    var tipo = TIPOS_INPUT.find(function (x) { return x.id === tipoId; });
    var registro = estado.inputs[tipoId] || {};
    document.getElementById("modalTitulo").textContent = tipo ? tipo.nombre : "Input institucional";
    document.getElementById("inputArchivo").value = "";
    document.getElementById("archivoMeta").textContent = registro.documentoNombre ? ("Guardado: " + registro.documentoNombre) : "No se ha seleccionado archivo.";
    setCampo("inputCodigo", registro.codigoInforme || "");
    setCampo("inputPeriodo", registro.periodoInforme || "");
    setCampo("inputVigenciaDesde", registro.vigenciaDesde || "");
    setCampo("inputVigenciaHasta", registro.vigenciaHasta || "");
    setCampo("inputTexto", registro.extractoFuente || "");
    document.getElementById("inputNoAplica").checked = registro.noAplica === true;
    setCampo("inputJustificacion", registro.justificacionNoAplica || "");
    estado.modalAnalisis = registro.analisisIA || null;
    renderAnalisisInput();
    var modal = document.getElementById("inputModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function cerrarModalInput() {
    var modal = document.getElementById("inputModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function decodificarXml(textoXml) {
    var textarea = document.createElement("textarea");
    textarea.innerHTML = textoXml;
    return textarea.value;
  }

  async function extraerDOCX(file) {
    if (!window.JSZip) throw new Error("JSZip no está disponible para leer DOCX.");
    var zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    var documento = zip.file("word/document.xml");
    if (!documento) throw new Error("El DOCX no contiene word/document.xml.");
    var xml = await documento.async("text");
    return decodificarXml(xml
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function extraerPDF(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no pudo cargarse. Revisa la conexión a Internet.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    var partes = [];
    for (var i = 1; i <= pdf.numPages; i += 1) {
      var pagina = await pdf.getPage(i);
      var contenido = await pagina.getTextContent();
      partes.push(contenido.items.map(function (item) { return texto(item.str); }).filter(Boolean).join(" "));
      if (partes.join("\n").length > 150000) break;
    }
    return partes.join("\n\n").trim();
  }

  async function hashArchivo(file) {
    if (!window.crypto || !window.crypto.subtle) return "";
    var buffer = await file.arrayBuffer();
    var hash = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  async function leerArchivoInput(file) {
    if (!file) return;
    var ext = texto(file.name).split(".").pop().toLowerCase();
    document.getElementById("archivoMeta").textContent = "Leyendo " + file.name + "...";
    var contenido = "";
    if (ext === "txt") contenido = await file.text();
    else if (ext === "docx") contenido = await extraerDOCX(file);
    else if (ext === "pdf") contenido = await extraerPDF(file);
    else if (ext === "doc") throw new Error("El formato DOC antiguo no se puede leer automáticamente. Convierte a DOCX o pega el texto.");
    else throw new Error("Formato no compatible para lectura automática.");
    estado.modalArchivo = file;
    estado.modalHash = await hashArchivo(file);
    setCampo("inputTexto", contenido.slice(0, 150000));
    document.getElementById("archivoMeta").textContent = file.name + " · " + Math.round(file.size / 1024) + " KB · texto extraído";
  }

  function limpiarBloqueJSON(salida) {
    var t = texto(salida).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    var inicio = t.indexOf("{");
    var fin = t.lastIndexOf("}");
    if (inicio !== -1 && fin > inicio) t = t.slice(inicio, fin + 1);
    return t;
  }

  function parseJSONIA(salida) {
    try { return JSON.parse(limpiarBloqueJSON(salida)); }
    catch (error) { return null; }
  }

  function renderAnalisisInput() {
    var el = document.getElementById("inputAnalisis");
    var a = estado.modalAnalisis;
    if (!a) {
      el.textContent = "Todavía no se ha realizado análisis.";
      return;
    }
    el.innerHTML = '<strong>Resumen</strong><br>' + escapar(a.resumen || "Sin resumen") +
      '<br><br><strong>Hallazgos</strong><br>' + (arr(a.hallazgos).length ? arr(a.hallazgos).map(function (x) { return "• " + escapar(x); }).join("<br>") : "Sin hallazgos extraídos") +
      '<br><br><strong>Datos clave</strong><br>' + (arr(a.datosClave).length ? arr(a.datosClave).map(function (x) { return "• " + escapar(typeof x === "string" ? x : JSON.stringify(x)); }).join("<br>") : "Sin datos clave") +
      '<br><br><strong>Recomendaciones del documento</strong><br>' + (arr(a.recomendaciones).length ? arr(a.recomendaciones).map(function (x) { return "• " + escapar(x); }).join("<br>") : "Sin recomendaciones extraídas");
  }

  async function analizarInputConIA() {
    var fuente = valorCampo("inputTexto");
    if (!fuente) {
      alert("Carga un documento o pega el texto que se va a analizar.");
      return;
    }
    if (!(await IA.disponible())) {
      alert("Configura y prueba una IA antes de analizar el documento.");
      return;
    }
    var boton = document.getElementById("btnAnalizarInput");
    boton.disabled = true;
    boton.textContent = "Analizando...";
    var tipo = TIPOS_INPUT.find(function (x) { return x.id === estado.modalTipo; });
    var prompt = [
      "Analiza exclusivamente el texto institucional proporcionado.",
      "No inventes cifras, códigos, períodos, nombres ni conclusiones que no aparezcan en la fuente.",
      "Devuelve SOLO JSON válido con esta estructura:",
      '{"codigo":"","periodo":"","resumen":"","hallazgos":[],"datosClave":[],"recomendaciones":[]}',
      "Tipo de informe: " + (tipo ? tipo.nombre : estado.modalTipo),
      "Carrera: " + (estado.carrera ? (estado.carrera.nombreInstitucional || estado.carrera.nombre) : ""),
      "Nivel: " + nombreNivel(estado.nivelNumero),
      "TEXTO FUENTE:",
      fuente.slice(0, 60000)
    ].join("\n\n");
    try {
      var respuesta = await IA.generar(prompt, {
        json: true,
        temperature: 0.1,
        system: "Eres un analista curricular. Usa únicamente la evidencia entregada y conserva cifras y códigos exactamente como aparecen."
      });
      if (!respuesta.ok) throw new Error(respuesta.mensaje + (respuesta.intentos && respuesta.intentos.length ? " · " + respuesta.intentos.map(function (x) { return x.proveedor + ": " + x.error; }).join(" | ") : ""));
      var parsed = parseJSONIA(respuesta.texto);
      if (!parsed) {
        estado.modalAnalisis = { resumen: respuesta.texto, hallazgos: [], datosClave: [], recomendaciones: [] };
      } else {
        estado.modalAnalisis = parsed;
        if (!valorCampo("inputCodigo") && texto(parsed.codigo)) setCampo("inputCodigo", parsed.codigo);
        if (!valorCampo("inputPeriodo") && texto(parsed.periodo)) setCampo("inputPeriodo", parsed.periodo);
      }
      renderAnalisisInput();
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo analizar el input.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Analizar con IA";
    }
  }

  async function guardarInputActual() {
    if (!estado.carrera || estado.nivelNumero < 1) return;
    var noAplica = document.getElementById("inputNoAplica").checked;
    var justificacion = valorCampo("inputJustificacion");
    if (noAplica && !justificacion) {
      alert("Escribe la justificación para marcar este input como No aplica.");
      return;
    }
    if (!noAplica && !estado.modalArchivo && !valorCampo("inputTexto") && !estado.modalAnalisis) {
      alert("Carga un documento, pega información o realiza el análisis antes de guardar.");
      return;
    }
    var previo = estado.inputs[estado.modalTipo] || {};
    var archivo = estado.modalArchivo;
    var registro = {
      carreraId: estado.carrera.id,
      carreraNombre: estado.carrera.nombreInstitucional || estado.carrera.nombreCorregido || estado.carrera.nombre,
      nivelNumero: estado.nivelNumero,
      nivelNombre: nombreNivel(estado.nivelNumero),
      tipo: estado.modalTipo,
      documentoNombre: archivo ? archivo.name : texto(previo.documentoNombre),
      documentoTipo: archivo ? archivo.type : texto(previo.documentoTipo),
      documentoBytes: archivo ? archivo.size : numero(previo.documentoBytes, 0),
      documentoHashSHA256: archivo ? estado.modalHash : texto(previo.documentoHashSHA256),
      codigoInforme: valorCampo("inputCodigo"),
      periodoInforme: valorCampo("inputPeriodo"),
      vigenciaDesde: valorCampo("inputVigenciaDesde"),
      vigenciaHasta: valorCampo("inputVigenciaHasta"),
      noAplica: noAplica,
      justificacionNoAplica: justificacion,
      extractoFuente: valorCampo("inputTexto").slice(0, 5000),
      analisisIA: estado.modalAnalisis || null
    };
    try {
      await Fichas.guardarInput(registro);
      estado.inputs = await Fichas.obtenerInputsActuales(estado.carrera.id, estado.nivelNumero);
      cerrarModalInput();
      renderTodo();
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo guardar la información del input.");
    }
  }

  function anioFuente(item) {
    var partes = item && item.published && item.published["date-parts"];
    return partes && partes[0] && partes[0][0] ? partes[0][0] : "";
  }

  async function buscarFuentesCrossref(nombreMateria) {
    var desde = new Date().getFullYear() - 2;
    var carreraNombre = estado.carrera ? (estado.carrera.nombreInstitucional || estado.carrera.nombre) : "";
    var consulta = encodeURIComponent(nombreMateria + " " + carreraNombre);
    var url = "https://api.crossref.org/works?rows=5&filter=from-pub-date:" + desde + "-01-01&query=" + consulta;
    var response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Crossref respondió HTTP " + response.status + ".");
    var data = await response.json();
    var items = data && data.message && Array.isArray(data.message.items) ? data.message.items : [];
    return items.slice(0, 5).map(function (item) {
      return {
        titulo: arr(item.title)[0] || "",
        anio: anioFuente(item),
        doi: texto(item.DOI),
        url: texto(item.URL),
        editorial: texto(item.publisher)
      };
    }).filter(function (item) { return !!item.titulo; });
  }

  async function actualizarTendencias() {
    if (!estado.materiasEstado.length) {
      alert("Primero revisa una carrera y un nivel.");
      return;
    }
    if (!(await IA.disponible())) {
      alert("Configura una IA antes de actualizar tendencias.");
      return;
    }
    var boton = document.getElementById("btnTendencias");
    var estadoTexto = document.getElementById("analisisEstado");
    boton.disabled = true;
    try {
      for (var i = 0; i < estado.materiasEstado.length; i += 1) {
        var item = estado.materiasEstado[i];
        if (!item.actual) continue;
        estadoTexto.textContent = "Tendencias " + (i + 1) + "/" + estado.materiasEstado.length + ": " + item.esperada.nombreOficial;
        var fuentes = await buscarFuentesCrossref(item.esperada.nombreOficial);
        if (!fuentes.length) continue;
        var prompt = [
          "Analiza tendencias recientes para una ficha curricular usando EXCLUSIVAMENTE los títulos y metadatos de las fuentes entregadas.",
          "No afirmes algo que las fuentes no permitan inferir razonablemente. No inventes fuentes.",
          "Devuelve SOLO JSON válido:",
          '{"resumen":"","tendencias":[],"tensiones":[],"implicacionCurricular":""}',
          "Carrera: " + (estado.carrera.nombreInstitucional || estado.carrera.nombre),
          "Materia: " + item.esperada.nombreOficial,
          "Fuentes:",
          JSON.stringify(fuentes)
        ].join("\n\n");
        var respuesta = await IA.generar(prompt, { json: true, temperature: 0.1 });
        if (!respuesta.ok) continue;
        var analisis = parseJSONIA(respuesta.texto) || { resumen: respuesta.texto, tendencias: [], tensiones: [], implicacionCurricular: "" };
        await Fichas.guardarTendencia({
          carreraId: estado.carrera.id,
          carreraNombre: estado.carrera.nombreInstitucional || estado.carrera.nombre,
          nivelNumero: estado.nivelNumero,
          periodo: estado.periodo,
          materiaId: item.actual.id,
          materiaNombre: item.esperada.nombreOficial,
          fuentes: fuentes,
          analisis: analisis,
          generadoEn: new Date().toISOString(),
          proveedorIA: respuesta.proveedor,
          modeloIA: respuesta.modelo
        });
      }
      estado.tendencias = await Fichas.obtenerTendencias(estado.carrera.id, estado.nivelNumero, estado.periodo);
      renderTodo();
      estadoTexto.textContent = estado.tendencias.length + " materias actualizadas.";
    } catch (error) {
      estadoTexto.textContent = "No se completó la actualización.";
      alert(error && error.message ? error.message : "No se pudieron actualizar las tendencias.");
    } finally {
      boton.disabled = false;
    }
  }

  function campoPorAlias(campos, palabras) {
    campos = campos || {};
    var claves = Object.keys(campos);
    for (var i = 0; i < claves.length; i += 1) {
      var n = normalizar(claves[i]);
      if (palabras.some(function (p) { return n.indexOf(normalizar(p)) !== -1; }) && texto(campos[claves[i]])) return texto(campos[claves[i]]);
    }
    return "";
  }

  function resumenMateriaParaIA(detalle) {
    var base = detalle.peaBase || {};
    return {
      materiaId: detalle.materia.id,
      nombre: detalle.materia.nombreMostrar || detalle.materia.nombre,
      descripcion: texto(base.descripcion),
      objetivo: texto(base.objetivo),
      unidades: arr(base.unidadesBase).map(function (u) {
        return { numero: u.unidadNumero, nombre: u.nombre, competencia: u.competencia, resultado: u.resultadoAprendizaje };
      }),
      contenidos: arr(detalle.unidades).map(function (u) {
        return { unidadNumero: u.unidadNumero, nombre: u.nombre, contenidos: arr(u.contenidos).slice(0, 80) };
      })
    };
  }

  function inputsParaIA() {
    var salida = {};
    TIPOS_INPUT.forEach(function (tipo) {
      var r = estado.inputs[tipo.id] || {};
      salida[tipo.id] = {
        nombre: tipo.nombre,
        noAplica: r.noAplica === true,
        justificacionNoAplica: texto(r.justificacionNoAplica),
        codigo: texto(r.codigoInforme),
        periodo: texto(r.periodoInforme),
        analisis: r.analisisIA || null,
        extracto: texto(r.extractoFuente).slice(0, 3000)
      };
    });
    return salida;
  }

  async function cargarDetallesYcambios() {
    estado.detallesMaterias = [];
    estado.cambiosMaterias = [];
    for (var i = 0; i < estado.materiasEstado.length; i += 1) {
      var item = estado.materiasEstado[i];
      if (!item.actual) continue;
      var resultados = await Promise.all([
        FB.obtenerDetalleMateria(item.actual.id),
        Fichas.obtenerCambioDetalladoMateria(item.actual.id).catch(function () { return null; })
      ]);
      estado.detallesMaterias.push(resultados[0]);
      estado.cambiosMaterias.push(resultados[1]);
    }
  }

  function tendenciasParaIA() {
    return estado.tendencias.map(function (t) {
      return {
        materiaId: t.materiaId,
        materia: t.materiaNombre,
        analisis: t.analisis || {},
        fuentes: arr(t.fuentes).map(function (f) { return { titulo: f.titulo, anio: f.anio, doi: f.doi, url: f.url }; })
      };
    });
  }

  function cambiosParaIA() {
    return estado.cambiosMaterias.filter(Boolean).map(function (c) {
      return c && c.cambio ? {
        materiaId: c.cambio.materiaId,
        versionAnterior: c.cambio.versionAnterior,
        versionNueva: c.cambio.versionNueva,
        resumen: c.cambio.resumen,
        seccionesCambiadas: c.cambio.seccionesCambiadas
      } : null;
    }).filter(Boolean);
  }

  async function generarFicha() {
    renderDiagnostico();
    if (!estado.diagnostico || !estado.diagnostico.lista) {
      alert("Completa los faltantes antes de generar la ficha.");
      return;
    }
    var boton = document.getElementById("btnGenerar");
    var estadoTexto = document.getElementById("analisisEstado");
    boton.disabled = true;
    boton.textContent = "Generando...";
    try {
      estadoTexto.textContent = "Recopilando PEA y versiones...";
      await cargarDetallesYcambios();
      var contexto = obtenerContextoFormulario();
      var materiasIA = estado.detallesMaterias.map(resumenMateriaParaIA);
      var prompt = [
        "Genera el análisis textual de una FICHA INDIVIDUAL DE ANÁLISIS POR NIVEL de Construcción Curricular Continua.",
        "REGLAS OBLIGATORIAS:",
        "1. Usa únicamente los datos entregados.",
        "2. No inventes cifras, códigos, informes, fuentes ni resultados.",
        "3. No modifiques, reescribas ni propongas cambios directos al contenido del PEA. El PEA es evidencia de solo lectura.",
        "4. Si detectas una oportunidad o brecha, escribe 'requiere revisión humana' en lugar de cambiar el PEA.",
        "5. Una materia sin cambios debe permanecer incluida y puede justificarse como pertinente.",
        "6. Conserva nombres de materias y cifras exactamente.",
        "Devuelve SOLO JSON válido con esta estructura:",
        '{"objetivo":"","inputs":{"graduados":"","titulacion":"","vinculacion":"","practicas":""},"correlaciones":[{"materiaId":"","materia":"","analisis":"","estadoCurricular":"Mantener"}],"conclusiones":[],"recomendaciones":[]}',
        "DATOS GENERALES:", JSON.stringify(contexto),
        "INPUTS:", JSON.stringify(inputsParaIA()),
        "MATERIAS Y PEA:", JSON.stringify(materiasIA),
        "CAMBIOS REGISTRADOS:", JSON.stringify(cambiosParaIA()),
        "TENDENCIAS CON FUENTES (si existen):", JSON.stringify(tendenciasParaIA())
      ].join("\n\n");
      estadoTexto.textContent = "Generando análisis con IA...";
      var respuesta = await IA.generar(prompt, {
        json: true,
        temperature: 0.15,
        system: "Eres un analista de gestión curricular. Debes preservar la evidencia y nunca alterar el contenido curricular de las materias."
      });
      if (!respuesta.ok) throw new Error(respuesta.mensaje + (respuesta.intentos && respuesta.intentos.length ? " · " + respuesta.intentos.map(function (x) { return x.proveedor + ": " + x.error; }).join(" | ") : ""));
      var analisis = parseJSONIA(respuesta.texto);
      if (!analisis) throw new Error("La IA respondió, pero no devolvió el JSON esperado.");
      estado.generacion = {
        contexto: contexto,
        analisis: analisis,
        proveedorIA: respuesta.proveedor,
        modeloIA: respuesta.modelo,
        generadoEn: new Date().toISOString()
      };
      var html = construirFichaHTML(analisis);
      document.getElementById("preview").innerHTML = html;
      document.getElementById("btnWord").disabled = false;
      document.getElementById("btnPDF").disabled = false;
      cambiarTab("vista");
      var registro = await Fichas.guardarGeneracion({
        carreraId: contexto.carreraId,
        carreraNombre: contexto.carreraNombre,
        nivelNumero: contexto.nivelNumero,
        nivelNombre: contexto.nivelNombre,
        periodo: contexto.periodo,
        contexto: contexto,
        analisis: analisis,
        inputIds: TIPOS_INPUT.map(function (tipo) { return estado.inputs[tipo.id] && estado.inputs[tipo.id].id; }).filter(Boolean),
        materias: estado.detallesMaterias.map(function (d) { return { materiaId: d.materia.id, nombre: d.materia.nombreMostrar || d.materia.nombre, version: d.materia.versionActual || 1 }; }),
        cambios: cambiosParaIA(),
        tendencias: tendenciasParaIA(),
        proveedorIA: respuesta.proveedor,
        modeloIA: respuesta.modelo
      });
      estado.generacion.registro = registro;
      estadoTexto.textContent = "Ficha generada · versión de información " + registro.version + ".";
    } catch (error) {
      estadoTexto.textContent = "No se pudo generar.";
      alert(error && error.message ? error.message : "No se pudo generar la ficha.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Generar ficha";
    }
  }

  function listaHtml(lista) {
    lista = arr(lista).filter(function (x) { return !!texto(x); });
    return lista.length ? '<ul>' + lista.map(function (x) { return '<li>' + escapar(x) + '</li>'; }).join("") + '</ul>' : '<p>Sin información registrada.</p>';
  }

  function obtenerResultadoPerfil(base) {
    return campoPorAlias(base && base.campos, ["perfil egreso", "perfil_de_egreso", "resultado perfil", "resultado_aprendizaje_perfil"]);
  }

  function obtenerSoftware(base) {
    return campoPorAlias(base && base.campos, ["software", "simulador", "herramienta tecnológica", "herramientas tecnologicas"]);
  }

  function renderMateriaMicro(detalle, indice) {
    var m = detalle.materia || {};
    var base = detalle.peaBase || {};
    var perfil = obtenerResultadoPerfil(base);
    var software = obtenerSoftware(base);
    var unidadesBase = arr(base.unidadesBase);
    var unidades = arr(detalle.unidades);
    var actividades = arr(detalle.actividades);
    var html = '<h3>' + (indice + 1) + '. ' + escapar(m.nombreMostrar || m.nombre) + '</h3>';
    html += '<p><strong>I. Descripción de la asignatura</strong></p><p>' + escapar(base.descripcion || "Sin descripción registrada.") + '</p>';
    html += '<p><strong>II. Resultado de aprendizaje que contribuye al perfil de egreso</strong></p><p>' + escapar(perfil || "No se encontró un campo específico diferenciado en el PEA cargado.") + '</p>';
    html += '<p><strong>III. Objetivo general de la asignatura</strong></p><p>' + escapar(base.objetivo || "Sin objetivo registrado.") + '</p>';
    html += '<p><strong>IV. Unidades de aprendizaje</strong></p>' + listaHtml(unidadesBase.map(function (u) { return (u.unidadNumero ? u.unidadNumero + ". " : "") + texto(u.nombre); }));
    html += '<p><strong>V. Competencias específicas</strong></p>' + listaHtml(unidadesBase.map(function (u) { return u.competencia; }));
    html += '<p><strong>VI. Resultados de aprendizaje</strong></p>' + listaHtml(unidadesBase.map(function (u) { return u.resultadoAprendizaje; }));
    html += '<p><strong>VII. Software y simuladores</strong></p><p>' + escapar(software || "No se encontró un campo específico de software/simuladores en el PEA cargado.") + '</p>';
    html += '<p><strong>VIII. Bibliografía</strong></p>';
    if (arr(base.bibliografia).length) {
      html += '<table><thead><tr><th>Bibliografía</th><th>Justificación</th></tr></thead><tbody>' + arr(base.bibliografia).map(function (b) {
        return '<tr><td>' + escapar(b.referencia) + '</td><td>' + escapar(b.justificacion || "") + '</td></tr>';
      }).join("") + '</tbody></table>';
    } else html += '<p>Sin bibliografía registrada.</p>';
    html += '<p><strong>IX. Desarrollo secuencial de la asignatura</strong></p>';
    unidades.forEach(function (u) {
      html += '<h4>Unidad ' + escapar(u.unidadNumero) + (u.nombre ? ': ' + escapar(u.nombre) : '') + '</h4>';
      html += listaHtml(arr(u.contenidos).map(function (c) { return typeof c === "string" ? c : (c.descripcion || c.contenido || c.tema || JSON.stringify(c)); }));
      var act = actividades.filter(function (a) { return numero(a.unidadNumero, 0) === numero(u.unidadNumero, 0); });
      if (act.length) {
        html += '<p><strong>Actividades</strong></p><ul>' + act.map(function (a) {
          return '<li><strong>' + escapar(a.mecanismo || a.tipoActividad || "Actividad") + ':</strong> ' + escapar(a.tema || "") + (a.descripcion ? ' — ' + escapar(a.descripcion) : '') + '</li>';
        }).join("") + '</ul>';
      }
    });
    return html;
  }

  function renderCambio(cambioDetallado, detalle) {
    if (!cambioDetallado || !cambioDetallado.cambio) return '<p>No se registran cambios previos para esta materia.</p>';
    var cambio = cambioDetallado.cambio;
    var html = '<p><strong>' + escapar(detalle.materia.nombreMostrar || detalle.materia.nombre) + ':</strong> ' + escapar(cambio.resumen || "Cambio registrado") + '</p>';
    if (cambioDetallado.anterior && cambio.detalle && cambio.detalle.peaBase && arr(cambio.detalle.peaBase.campos).length) {
      var anterior = cambioDetallado.anterior.peaBase || {};
      var actual = detalle.peaBase || {};
      var filas = [];
      arr(cambio.detalle.peaBase.campos).forEach(function (campo) {
        if (["descripcion", "objetivo"].indexOf(campo) !== -1) {
          filas.push('<tr><td>' + escapar(campo) + '</td><td>' + escapar(anterior[campo] || "") + '</td><td>' + escapar(actual[campo] || "") + '</td></tr>');
        }
      });
      if (filas.length) html += '<table><thead><tr><th>Campo</th><th>Extracto previo</th><th>Extracto actual</th></tr></thead><tbody>' + filas.join("") + '</tbody></table>';
    }
    return html;
  }

  function construirFichaHTML(analisis) {
    var c = obtenerContextoFormulario();
    var correlaciones = arr(analisis.correlaciones);
    var bibliografia = [];
    var vistos = {};
    estado.detallesMaterias.forEach(function (d) {
      arr(d.peaBase && d.peaBase.bibliografia).forEach(function (b) {
        var ref = texto(b.referencia);
        var k = normalizar(ref);
        if (ref && !vistos[k]) { vistos[k] = true; bibliografia.push(ref); }
      });
    });

    var html = '<h1>Ficha individual de análisis por nivel, Construcción Curricular Continua<br>Carrera de ' + escapar(c.carreraNombre) + '</h1>';
    html += '<h2>1. Datos de identificación</h2><table><tbody>' +
      '<tr><th>Carrera</th><td>' + escapar(c.carreraNombre) + '</td></tr>' +
      '<tr><th>Nivel analizado</th><td>' + escapar(c.nivelNombre) + '</td></tr>' +
      '<tr><th>Período</th><td>' + escapar(c.periodo) + '</td></tr>' +
      '<tr><th>Código</th><td>' + escapar(c.codigoDocumento) + '</td></tr>' +
      '<tr><th>Coordinador</th><td>' + escapar(c.coordinador) + '</td></tr>' +
      '<tr><th>Docentes</th><td>' + escapar(c.docentes).replace(/\n/g, '<br>') + '</td></tr>' +
      '<tr><th>Fecha de inicio</th><td>' + escapar(c.fechaInicio) + '</td></tr>' +
      '<tr><th>Fecha de finalización</th><td>' + escapar(c.fechaFin) + '</td></tr>' +
      '<tr><th>Elaborado por</th><td>' + escapar(c.elaboradoPor) + '</td></tr>' +
      '<tr><th>Revisado por</th><td>' + escapar(c.revisadoPor) + '</td></tr>' +
      '<tr><th>Aprobado por</th><td>' + escapar(c.aprobadoPor) + '</td></tr>' +
      '</tbody></table>';

    html += '<h2>2. Objetivo</h2><p>' + escapar(analisis.objetivo || "") + '</p>';
    html += '<h2>3. Análisis de INPUTS</h2>';
    TIPOS_INPUT.forEach(function (tipo) {
      var r = estado.inputs[tipo.id] || {};
      var textoAnalisis = analisis.inputs && analisis.inputs[tipo.id] ? analisis.inputs[tipo.id] : "";
      html += '<h3>' + escapar(tipo.nombre) + '</h3>';
      if (r.noAplica === true) html += '<p><strong>No aplica.</strong> ' + escapar(r.justificacionNoAplica) + '</p>';
      else html += '<p>' + escapar(textoAnalisis || "Sin análisis generado.") + '</p>';
      if (r.codigoInforme || r.periodoInforme) html += '<p><small>Fuente: ' + escapar([r.codigoInforme, r.periodoInforme].filter(Boolean).join(" · ")) + '</small></p>';
    });

    html += '<h2>4. Correlación del análisis de INPUTS con las asignaturas de ' + escapar(c.nivelNombre.toLowerCase()) + '</h2>';
    correlaciones.forEach(function (r) {
      html += '<h3>' + escapar(r.materia) + '</h3><p>' + escapar(r.analisis) + '</p><p><strong>Estado curricular:</strong> ' + escapar(r.estadoCurricular || "Mantener") + '</p>';
    });

    html += '<h2>5. Disgregación de contenido micro curricular por asignatura</h2>';
    estado.detallesMaterias.forEach(function (d, i) { html += renderMateriaMicro(d, i); });

    html += '<h2>6. Extractos específicos de cambio</h2>';
    estado.detallesMaterias.forEach(function (d, i) { html += renderCambio(estado.cambiosMaterias[i], d); });

    html += '<h2>7. Conclusiones</h2>' + listaHtml(analisis.conclusiones);
    html += '<h2>8. Recomendaciones</h2>' + listaHtml(analisis.recomendaciones);
    html += '<h2>9. Bibliografía</h2>' + listaHtml(bibliografia);
    return html;
  }

  function limpiarNombreArchivo(valor) {
    return texto(valor).normalize("NFC").replace(/[<>:\"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Ficha";
  }

  function nombreBaseFicha() {
    return limpiarNombreArchivo("Ficha - " + (estado.carrera ? (estado.carrera.nombreInstitucional || estado.carrera.nombre) : "Carrera") + " - " + nombreNivel(estado.nivelNumero) + " - " + estado.periodo);
  }

  function documentoHtmlCompleto(contenido) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      '@page{size:A4;margin:18mm 16mm}body{font-family:Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.4}h1{text-align:center;font-size:16pt}h2{font-size:13pt;margin-top:18pt}h3{font-size:11.5pt;margin-top:14pt}h4{font-size:10.5pt}table{width:100%;border-collapse:collapse;margin:8pt 0}th,td{border:1px solid #777;padding:5pt;vertical-align:top}ul{margin-top:4pt}p{margin:6pt 0}' +
      '</style></head><body>' + contenido + '</body></html>';
  }

  function descargarWord() {
    var contenido = document.getElementById("preview").innerHTML;
    if (!contenido || contenido.indexOf("Genera la ficha") !== -1) return;
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="ProgId" content="Word.Document"><style>' +
      'body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.4}h1{text-align:center;font-size:16pt}h2{font-size:13pt}h3{font-size:11.5pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:5pt;vertical-align:top}' +
      '</style></head><body>' + contenido + '</body></html>';
    var blob = new Blob(["\ufeff", html], { type: "application/msword" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nombreBaseFicha() + ".doc";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function descargarPDF() {
    var contenido = document.getElementById("preview").innerHTML;
    if (!contenido || contenido.indexOf("Genera la ficha") !== -1) return;
    var html = documentoHtmlCompleto(contenido);
    if (window.CurriculoElectron && typeof window.CurriculoElectron.guardarPDFEnDescargas === "function") {
      var resultado = await window.CurriculoElectron.guardarPDFEnDescargas({
        html: html,
        titulo: nombreBaseFicha(),
        nombreArchivo: nombreBaseFicha() + ".pdf"
      });
      if (!resultado || resultado.ok !== true) alert(resultado && resultado.mensaje ? resultado.mensaje : "No se pudo generar el PDF.");
      else alert("PDF guardado en Descargas: " + resultado.nombreArchivo);
      return;
    }
    var ventana = window.open("", "_blank");
    if (!ventana) return;
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  function conectarEventos() {
    document.getElementById("carreraSelect").addEventListener("change", cargarNiveles);
    document.getElementById("nivelSelect").addEventListener("change", function () { estado.nivelNumero = numero(valorCampo("nivelSelect"), 0); });
    document.getElementById("btnRevisar").addEventListener("click", revisarFicha);
    document.getElementById("btnGuardarDatos").addEventListener("click", guardarDatosGenerales);
    CAMPOS_DATOS.concat(["cargoElaborador"]).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", function () { if (estado.materiasEstado.length) renderDiagnostico(); });
    });
    document.getElementById("btnCerrarModal").addEventListener("click", cerrarModalInput);
    document.getElementById("inputModal").addEventListener("click", function (event) { if (event.target.id === "inputModal") cerrarModalInput(); });
    document.getElementById("inputArchivo").addEventListener("change", async function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      try { await leerArchivoInput(file); }
      catch (error) { alert(error && error.message ? error.message : "No se pudo leer el documento."); }
    });
    document.getElementById("btnAnalizarInput").addEventListener("click", analizarInputConIA);
    document.getElementById("btnGuardarInput").addEventListener("click", guardarInputActual);
    document.getElementById("btnTendencias").addEventListener("click", actualizarTendencias);
    document.getElementById("btnGenerar").addEventListener("click", generarFicha);
    document.getElementById("btnWord").addEventListener("click", descargarWord);
    document.getElementById("btnPDF").addEventListener("click", descargarPDF);
  }

  async function iniciar() {
    if (!FB || !Mallas || !Fichas || !IA) {
      alert("No se pudieron cargar los módulos necesarios para Fichas.");
      return;
    }
    conectarTabs();
    conectarEventos();
    renderInicial();
    try {
      await FB.ready();
      await cargarCarreras();
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo conectar con Firebase.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
