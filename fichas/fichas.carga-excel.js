/* Carga individual de los tres PEA directamente desde Fichas.
   Reutiliza el lector y validador de Subir; escribe una sola materia en Firebase. */
(function (window, document) {
  "use strict";

  var T = [
    { tipo: "pea_base", id: "materiaExcelBase", estado: "materiaExcelBaseEstado", label: "PEA Base" },
    { tipo: "pea_unidades", id: "materiaExcelUnidades", estado: "materiaExcelUnidadesEstado", label: "PEA Unidades" },
    { tipo: "pea_actividades", id: "materiaExcelActividades", estado: "materiaExcelActividadesEstado", label: "PEA Actividades" }
  ];
  var opciones = null;
  var activo = null;
  var candidatos = [];
  var detalles = {};
  var ocupado = false;
  var solicitud = 0;
  function $(id) { return document.getElementById(id); }
  function texto(v) { return String(v == null ? "" : v).trim(); }
  function nivelNombre(n) { return ["", "Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto"][n] || ("Nivel " + n); }
  function ponerEstado(msg, error, ok) {
    var el = $("materiaExcelEstado");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-error", !!error);
    el.classList.toggle("is-ok", !!ok);
  }
  function fijarOcupado(valor) {
    ocupado = !!valor;
    ["btnGuardarMateriaExcel", "btnCancelarMateriaExcel", "btnCerrarMateriaExcel",
      "materiaExcelVincular"].concat(T.map(function (t) { return t.id; })).forEach(function (id) {
      if ($(id)) $(id).disabled = ocupado;
    });
  }
  function cerrar() {
    if (ocupado) return;
    solicitud += 1;
    activo = null;
    detalles = {};
    var modal = $("materiaExcelModal");
    if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
    T.forEach(function (t) { if ($(t.id)) $(t.id).value = ""; });
  }
  function contextoVigente() {
    if (!activo || !opciones) return false;
    var actual = opciones.getContexto();
    return actual && actual.token === activo.token &&
      actual.carrera && actual.carrera.id === activo.carrera.id &&
      actual.nivelNumero === activo.nivelNumero && actual.periodo === activo.periodo;
  }
  function registroSeleccionado() {
    var id = texto($("materiaExcelVincular").value);
    return candidatos.find(function (x) { return x.id === id; }) || null;
  }
  function datosPrevios(tipo, detalle) {
    if (!detalle) return null;
    if (tipo === "pea_base") {
      var b = detalle.peaBase || null;
      if (!b || !(texto(b.descripcion) || texto(b.objetivo) || (b.campos && Object.keys(b.campos).length))) return null;
      return b;
    }
    if (tipo === "pea_unidades") {
      if (!Array.isArray(detalle.unidades) || !detalle.unidades.length) return null;
      return detalle.unidades.map(function (u) {
        return {
          unidadNumero: u.unidadNumero, contenidos: u.contenidos,
          filasOriginales: u.filas, temaDetectado: u.titulo,
          resultadoDetectado: u.resultadoAprendizaje
        };
      });
    }
    if (tipo === "pea_actividades") return Array.isArray(detalle.actividades) && detalle.actividades.length ? detalle.actividades : null;
    return null;
  }
  function pintarPrevios(detalle) {
    T.forEach(function (t) {
      var existe = !!datosPrevios(t.tipo, detalle);
      $(t.estado).textContent = existe
        ? "Ya existe un PEA en Firebase. Puedes conservarlo o elegir un Excel para reemplazarlo."
        : "Este PEA es obligatorio; selecciona su archivo Excel.";
    });
  }
  async function actualizarDetalle() {
    var pedido = ++solicitud;
    var registro = registroSeleccionado();
    if (!registro) {
      pintarPrevios(null);
      ponerEstado("Nueva materia: selecciona sus tres Excel.");
      return;
    }
    ponerEstado("Consultando los PEA existentes de " + registro.nombreMostrar + "...");
    try {
      var FB = window.CurriculoFirebase;
      var d = detalles[registro.id] || await FB.obtenerDetalleMateria(registro.id);
      if (pedido !== solicitud || !contextoVigente()) return;
      detalles[registro.id] = d;
      pintarPrevios(d);
      ponerEstado("Registro seleccionado: " + (registro.nombreMostrar || registro.nombre) +
        ". Los Excel que no reemplaces se conservarán, siempre que tengan datos válidos.");
    } catch (error) {
      if (pedido === solicitud) ponerEstado("No se pudo leer la materia existente: " + texto(error.message || error), true);
    }
  }
  async function abrir(item) {
    if (ocupado || !opciones) return;
    var ctx = opciones.getContexto();
    if (!ctx || !ctx.carrera || !ctx.nivelNumero || !ctx.periodo || !item || !item.esperada) return;
    var esperada = item.esperada;
    activo = {
      carrera: ctx.carrera, nivelNumero: ctx.nivelNumero, periodo: ctx.periodo,
      token: ctx.token, esperada: esperada, actual: item.actual || null
    };
    detalles = {};
    candidatos = [];
    T.forEach(function (t) { $(t.id).value = ""; });
    $("materiaExcelTitulo").textContent = "Cargar PEA: " + esperada.nombreOficial;
    $("materiaExcelContexto").textContent = ctx.carrera.nombre + " · " + nivelNombre(ctx.nivelNumero) +
      " nivel · " + ctx.periodo;
    $("materiaExcelModal").classList.add("open");
    $("materiaExcelModal").setAttribute("aria-hidden", "false");
    ponerEstado("Buscando registros existentes de este nivel en Firebase...");
    var pedido = ++solicitud;
    try {
      var materias = await window.CurriculoFirebase.obtenerMateriasPorCarrera(ctx.carrera.id, {
        soloCompletas: false, incluirRetiradas: false
      });
      if (pedido !== solicitud || !contextoVigente()) return;
      // No sugerir registros ya vinculados a otra asignatura del mismo nivel.
      var usados = (ctx.materiasEstado || []).filter(function (m) {
        return m.esperada !== esperada && m.actual;
      }).map(function (m) { return m.actual.id; });
      candidatos = materias.filter(function (m) {
        return Number(m.nivelNumero) === Number(ctx.nivelNumero) &&
          (usados.indexOf(m.id) === -1 || (item.actual && m.id === item.actual.id));
      });
      var select = $("materiaExcelVincular");
      select.innerHTML = "";
      var nuevo = document.createElement("option");
      nuevo.value = ""; nuevo.textContent = "Crear registro nuevo (si no existe)";
      select.appendChild(nuevo);
      candidatos.forEach(function (m) {
        var option = document.createElement("option");
        option.value = m.id;
        option.textContent = (m.nombreMostrar || m.nombre || "Sin nombre") +
          " · " + texto(m.estadoValidacion || "sin estado");
        select.appendChild(option);
      });
      if (item.actual && candidatos.some(function (m) { return m.id === item.actual.id; })) {
        select.value = item.actual.id;
      }
      await actualizarDetalle();
    } catch (error) {
      if (pedido === solicitud) ponerEstado("Error consultando Firebase: " + texto(error.message || error), true);
    }
  }
  function extension(file) { return texto(file && file.name).split(".").pop().toLowerCase(); }
  async function prepararArchivo(t, file, datos, ctx) {
    var nombre = file ? file.name : "PEA " + t.label + " previamente guardado.xlsx";
    var ext = file ? extension(file) : "xlsx";
    if (file && ["xlsx", "xls", "xlsm", "csv"].indexOf(ext) === -1) {
      throw new Error("El archivo " + nombre + " no es un Excel válido.");
    }
    if (file && file.size > 15 * 1024 * 1024) {
      throw new Error("El archivo " + nombre + " supera 15 MB.");
    }
    return {
      id: "excel_" + t.tipo, tipo: t.tipo, tipoLabel: t.label,
      materiaId: ctx.materiaId, carreraId: ctx.carrera.id, nivelId: ctx.nivelId,
      nombreArchivo: nombre, rutaOriginal: nombre, extension: ext,
      esExcel: true, confianza: 100, tamanoBytes: file ? file.size : 0,
      origenArchivo: file ? "nuevo" : "existente",
      contenidoBinario: file ? new Uint8Array(await file.arrayBuffer()) : null,
      excelLeido: !file, datosProcesados: file ? null : datos
    };
  }
  async function guardar() {
    if (ocupado || !contextoVigente()) {
      ponerEstado("La selección cambió. Pulsa Revisar y vuelve a seleccionar la materia.", true);
      return;
    }
    var ctx = activo;
    var selected = registroSeleccionado();
    var detail = selected && detalles[selected.id];
    if (selected && !detail) { ponerEstado("Todavía no se pudo consultar el registro existente.", true); return; }
    var archivos = [];
    var nuevos = 0;
    fijarOcupado(true);
    try {
      ponerEstado("Leyendo los tres PEA...");
      for (var i = 0; i < T.length; i += 1) {
        var t = T[i], file = $(t.id).files[0] || null;
        var anterior = file ? null : datosPrevios(t.tipo, detail);
        if (!file && !anterior) throw new Error("Falta " + t.label + ". Selecciona el Excel correspondiente.");
        if (file) nuevos++;
        archivos.push(await prepararArchivo(t, file, anterior, {
          materiaId: "materia_fichas_1", carrera: ctx.carrera, nivelId: "nivel_fichas_" + ctx.nivelNumero
        }));
      }
      var estadoActual = opciones.getContexto();
      if (!contextoVigente()) throw new Error("Cambió la selección durante la lectura. Vuelve a Revisar.");
      var nivelId = "nivel_fichas_" + ctx.carrera.id + "_" + ctx.nivelNumero;
      archivos.forEach(function (a) { a.nivelId = nivelId; });
      var paquete = {
        carga: { nombreZip: "", origen: "fichas_excel_individual" },
        carreras: [{ id: ctx.carrera.id, nombre: ctx.carrera.nombre, confianza: 100 }],
        niveles: [{ id: nivelId, carreraId: ctx.carrera.id, numero: ctx.nivelNumero,
          nombre: nivelNombre(ctx.nivelNumero) + " nivel", confianza: 100 }],
        materias: [{ id: "materia_fichas_1", carreraId: ctx.carrera.id, nivelId: nivelId,
          codigo: selected && selected.codigo || "", nombre: ctx.esperada.nombreOficial }],
        archivos: archivos,
        advertencias: []
      };
      var NS = window.SubirCCC || {};
      if (!NS.Excel || !NS.Validador || !window.XLSX) {
        throw new Error("No se cargó el lector o el validador de Excel.");
      }
      paquete = await NS.Excel.enriquecerPaqueteConExcel(paquete);
      if (!contextoVigente()) throw new Error("Cambió la selección durante el análisis.");
      var lectura = paquete.archivos.filter(function (a) {
        return a.excelLeido !== true || !!a.errorExcel;
      });
      if (lectura.length) throw new Error("No se pudieron leer: " +
        lectura.map(function (a) { return a.nombreArchivo + " (" + texto(a.errorExcel) + ")"; }).join("; "));
      paquete = NS.Validador.validarPaquete(paquete);
      if (paquete.evaluacionesMaterias.length !== 1 ||
          paquete.evaluacionesMaterias[0].estado !== "completo") {
        var mensajes = (paquete.validacionesSubida || []).map(function (v) { return texto(v.mensaje); }).filter(Boolean);
        throw new Error("Los PEA requieren correcciones: " + (mensajes.slice(0, 5).join(" · ") ||
          "Revisa encabezados, datos y contenido de los tres archivos."));
      }
      ponerEstado("Los tres PEA son válidos. Guardando únicamente " + ctx.esperada.nombreOficial + "...");
      if (!contextoVigente()) throw new Error("Cambió la selección antes de guardar.");
      var resultado = await window.CurriculoFirebase.importarMateriaDesdeFichas(paquete, {
        materiaFirebaseId: selected && selected.id || ""
      });
      ponerEstado("Materia " + resultado.tipo + " en Firebase. Versión " + resultado.version + ".", false, true);
      // Refrescar para que Fichas confirme el estado realmente almacenado.
      if (contextoVigente() && opciones.onGuardado) await opciones.onGuardado(resultado);
      cerrar();
    } catch (error) {
      ponerEstado(texto(error && error.message || error), true);
    } finally {
      fijarOcupado(false);
    }
  }
  function instalar(config) {
    opciones = config;
    var modal = $("materiaExcelModal");
    if (!modal) throw new Error("No existe la ventana de carga de PEA.");
    ["btnCerrarMateriaExcel", "btnCancelarMateriaExcel"].forEach(function (id) {
      $(id).addEventListener("click", cerrar);
    });
    $("btnGuardarMateriaExcel").addEventListener("click", guardar);
    $("materiaExcelVincular").addEventListener("change", actualizarDetalle);
    modal.addEventListener("click", function (event) { if (event.target === modal) cerrar(); });
  }
  window.CurriculoFichasCargaExcel = Object.freeze({
    instalar: instalar, abrir: abrir, cerrar: cerrar
  });
})(window, document);
