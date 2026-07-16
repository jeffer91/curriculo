/* =========================================================
Nombre completo: sincronizacion.main.js
Ruta: /Curriculo/sincronizacion/sincronizacion.main.js
Funciones:
- Administrar la configuración de conexión con Google Sheets.
- Leer el estado de BDLocal sin modificarlo.
- Crear, comparar y sincronizar registros de prueba con control de versiones.
- Mostrar pendientes, conflictos e historial.
========================================================= */
(function (window, document) {
  "use strict";

  var Sync = window.CurriculoSync;
  var BD = window.BDLocalCCC;

  if (!Sync || !Sync.Storage || !Sync.Versiones || !Sync.Client) {
    console.error("[Sincronizacion] No se cargaron los módulos requeridos.");
    return;
  }

  var Storage = Sync.Storage;
  var Versiones = Sync.Versiones;
  var Client = Sync.Client;
  var Stores = Storage.STORES;

  var config = null;
  var state = null;
  var comparacionActual = [];
  var remotoActual = [];
  var intervaloAutomatico = null;
  var operacionActiva = false;

  var el = {};

  function tomarElementos() {
    [
      "estadoPrincipal", "estadoTitulo", "estadoMensaje", "badgeEntorno",
      "kpiConexion", "kpiConexionDetalle", "kpiLocal", "kpiRemoto",
      "kpiSincronizados", "kpiPendientes", "kpiConflictos", "kpiUltima", "kpiUltimaDetalle",
      "formConfiguracion", "campoEntorno", "campoEndpoint", "campoSpreadsheetId", "campoDispositivo", "campoToken",
      "btnGuardarConfig", "btnProbarConexion", "btnAbrirSheets", "btnRecargarEstado",
      "campoValorPrueba", "versionPruebaLocal", "btnGuardarPruebaLocal",
      "btnComparar", "btnSincronizar", "resumenLocalRemoto", "resumenRemotoLocal", "resumenIguales", "resumenConflictos",
      "tablaComparacion", "campoAutomatica", "campoAlIniciar", "campoAlReconectar", "campoIntervalo", "btnGuardarAutomatica",
      "listaPendientes", "listaHistorial", "btnLimpiarHistorial"
    ].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fechaLegible(valor) {
    if (!valor) return "Nunca";
    var fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return texto(valor);
    return fecha.toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setEstado(tipo, titulo, mensaje) {
    el.estadoPrincipal.className = "sync-status sync-status-" + (tipo || "neutral");
    el.estadoTitulo.textContent = titulo || "Estado";
    el.estadoMensaje.textContent = mensaje || "";
  }

  function botonesOcupados(ocupados) {
    operacionActiva = !!ocupados;
    [
      el.btnGuardarConfig, el.btnProbarConexion, el.btnGuardarPruebaLocal,
      el.btnComparar, el.btnSincronizar, el.btnGuardarAutomatica,
      el.btnRecargarEstado
    ].forEach(function (boton) {
      if (boton) boton.disabled = !!ocupados;
    });
  }

  function normalizarDispositivo(valor) {
    return texto(valor).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "equipo_local";
  }

  function idPrueba() {
    return "sync_test_" + normalizarDispositivo(config && config.dispositivoId);
  }

  function leerFormularioConfig() {
    return {
      entorno: el.campoEntorno.value || "pruebas",
      endpoint: texto(el.campoEndpoint.value),
      spreadsheetId: texto(el.campoSpreadsheetId.value),
      dispositivoId: normalizarDispositivo(el.campoDispositivo.value),
      token: texto(el.campoToken.value)
    };
  }

  function pintarFormularioConfig() {
    el.campoEntorno.value = config.entorno || "pruebas";
    el.campoEndpoint.value = config.endpoint || "";
    el.campoSpreadsheetId.value = config.spreadsheetId || "";
    el.campoDispositivo.value = config.dispositivoId || "equipo_local";
    el.campoToken.value = config.token || "";
    el.campoAutomatica.checked = !!config.automatica;
    el.campoAlIniciar.checked = !!config.alIniciar;
    el.campoAlReconectar.checked = config.alRecuperarConexion !== false;
    el.campoIntervalo.value = String(config.intervaloMinutos || 15);
    el.badgeEntorno.textContent = texto(config.entorno || "pruebas").toUpperCase();
  }

  async function contarMateriasLocales() {
    try {
      if (!BD || !BD.Core || !BD.Schema) return 0;
      await BD.Core.ready();
      return await BD.Core.count(BD.Schema.STORES.MATERIAS);
    } catch (error) {
      console.warn("[Sincronizacion] No se pudo contar BDLocal:", error);
      return 0;
    }
  }

  async function pintarEstadoGeneral() {
    var totalLocal = await contarMateriasLocales();
    var pendientes = await Storage.count(Stores.QUEUE);
    var conflictos = (await Storage.getAll(Stores.CONFLICTS)).filter(function (item) {
      return item.estado !== "resuelto";
    }).length;

    el.kpiLocal.textContent = totalLocal;
    el.kpiRemoto.textContent = Number(state.registrosRemotos || 0);
    el.kpiSincronizados.textContent = Number(state.sincronizados || 0);
    el.kpiPendientes.textContent = pendientes;
    el.kpiConflictos.textContent = conflictos;
    el.kpiUltima.textContent = state.ultimaSincronizacionEn ? fechaLegible(state.ultimaSincronizacionEn) : "Nunca";
    el.kpiUltimaDetalle.textContent = state.ultimaSincronizacionEn ? "Última ejecución correcta" : "Sin ejecuciones";

    if (!config.endpoint || !config.spreadsheetId) {
      el.kpiConexion.textContent = "Sin configurar";
      el.kpiConexionDetalle.textContent = "Falta endpoint o ID";
      setEstado("neutral", "Sincronización sin configurar", "Guarda el endpoint y el ID del Google Sheets de pruebas.");
    } else if (state.conectado) {
      el.kpiConexion.textContent = "Conectada";
      el.kpiConexionDetalle.textContent = state.ultimaConexionEn ? fechaLegible(state.ultimaConexionEn) : "Google Sheets";
      setEstado(conflictos ? "warn" : "ok", conflictos ? "Conexión activa con conflictos" : "Conexión activa", state.mensaje || "La pantalla está lista para comparar versiones.");
    } else {
      el.kpiConexion.textContent = navigator.onLine ? "Sin probar" : "Sin internet";
      el.kpiConexionDetalle.textContent = state.mensaje || "Google Sheets";
      setEstado(navigator.onLine ? "neutral" : "error", navigator.onLine ? "Conexión pendiente de prueba" : "No hay conexión a internet", state.mensaje || "Prueba la conexión antes de sincronizar.");
    }
  }

  async function guardarConfiguracion(event) {
    if (event) event.preventDefault();
    try {
      botonesOcupados(true);
      config = await Storage.guardarConfig(leerFormularioConfig());
      state = await Storage.actualizarEstado({
        estado: config.endpoint && config.spreadsheetId ? "configurado" : "sin_configurar",
        conectado: false,
        mensaje: "Configuración guardada. Falta probar la conexión."
      });
      await Storage.registrarLog("configuracion", "Configuración de sincronización actualizada.", {
        entorno: config.entorno,
        dispositivoId: config.dispositivoId,
        tieneEndpoint: !!config.endpoint,
        tieneSpreadsheetId: !!config.spreadsheetId
      });
      pintarFormularioConfig();
      await actualizarPantalla();
      setEstado("ok", "Configuración guardada", "Ahora puedes probar la conexión con Google Sheets.");
    } catch (error) {
      setEstado("error", "No se pudo guardar", error.message || String(error));
    } finally {
      botonesOcupados(false);
    }
  }

  async function probarConexion() {
    try {
      botonesOcupados(true);
      config = await Storage.guardarConfig(leerFormularioConfig());
      setEstado("loading", "Probando conexión...", "Consultando el Google Apps Script y la hoja 99_SYNC_TEST.");
      var resultado = await Client.probarConexion(config);
      state = await Storage.actualizarEstado({
        estado: "conectado",
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        registrosRemotos: Number(resultado.registros || 0),
        mensaje: resultado.mensaje || "Conexión comprobada correctamente.",
        errores: 0
      });
      await Storage.registrarLog("conexion", "Conexión con Google Sheets comprobada.", resultado);
      setEstado("ok", "Conexión correcta", resultado.mensaje || "Google Sheets respondió correctamente.");
    } catch (error) {
      state = await Storage.actualizarEstado({
        estado: "error_conexion",
        conectado: false,
        mensaje: error.message || String(error),
        errores: Number(state.errores || 0) + 1
      });
      await Storage.registrarLog("error", "Falló la prueba de conexión.", { mensaje: error.message || String(error) });
      setEstado("error", "No se pudo conectar", error.message || String(error));
    } finally {
      botonesOcupados(false);
      await actualizarPantalla();
    }
  }

  async function obtenerRegistroPruebaLocal() {
    return await Storage.get(Stores.TEST, idPrueba());
  }

  async function pintarRegistroPrueba() {
    var registro = await obtenerRegistroPruebaLocal();
    el.versionPruebaLocal.textContent = registro ? Number(registro.version || 0) : 0;
    if (registro && !el.campoValorPrueba.value) el.campoValorPrueba.value = registro.valor || "";
  }

  async function guardarPruebaLocal() {
    try {
      botonesOcupados(true);
      config = await Storage.guardarConfig(leerFormularioConfig());
      var anterior = await obtenerRegistroPruebaLocal();
      var ahora = Storage.fechaISO();
      var registro = {
        id: idPrueba(),
        entidad: "sync_test",
        nombre: "Prueba de " + config.dispositivoId,
        valor: texto(el.campoValorPrueba.value) || "Prueba " + fechaLegible(ahora),
        version: Number(anterior && anterior.version || 0) + 1,
        actualizadoEn: ahora,
        origen: "bdlocal",
        dispositivoId: config.dispositivoId,
        activo: true
      };
      registro.hash = Versiones.calcularHash(registro);
      await Storage.put(Stores.TEST, registro);
      await Storage.put(Stores.QUEUE, {
        id: "queue_" + registro.id,
        entidad: "sync_test",
        registroId: registro.id,
        version: registro.version,
        operacion: "upsert",
        estado: "pendiente",
        intentos: 0,
        creadoEn: ahora,
        actualizadoEn: ahora
      });
      await Storage.registrarLog("cambio_local", "Se creó una nueva versión local de prueba.", registro);
      state = await Storage.actualizarEstado({ estado: "con_pendientes", mensaje: "Existe una versión local pendiente de sincronización." });
      await actualizarPantalla();
      setEstado("warn", "Versión local guardada", "La versión " + registro.version + " está pendiente de comparación o envío.");
    } catch (error) {
      setEstado("error", "No se pudo guardar la prueba", error.message || String(error));
    } finally {
      botonesOcupados(false);
    }
  }

  function resumenComparacion(lista) {
    var resumen = { localRemoto: 0, remotoLocal: 0, iguales: 0, conflictos: 0, pendientes: 0 };
    lista.forEach(function (item) {
      if (item.decision === "local_a_remoto" || item.decision === "crear_remoto") resumen.localRemoto += 1;
      else if (item.decision === "remoto_a_local" || item.decision === "crear_local") resumen.remotoLocal += 1;
      else if (item.decision === "igual") resumen.iguales += 1;
      else if (item.decision === "conflicto") resumen.conflictos += 1;
    });
    resumen.pendientes = resumen.localRemoto + resumen.remotoLocal;
    return resumen;
  }

  function etiquetaDecision(item) {
    if (item.decision === "local_a_remoto" || item.decision === "crear_remoto") return ["BDLocal → Sheets", "sync-decision-local"];
    if (item.decision === "remoto_a_local" || item.decision === "crear_local") return ["Sheets → BDLocal", "sync-decision-remoto"];
    if (item.decision === "igual") return ["Sin cambios", "sync-decision-igual"];
    if (item.decision === "conflicto") return ["Conflicto", "sync-decision-conflicto"];
    return ["Sin datos", ""];
  }

  function cajaVersion(registro, origen) {
    if (!registro) return '<span class="sync-muted">No existe</span>';
    return '<div class="sync-version-box"><strong>v' + escapar(registro.version || 0) + '</strong><span>' + escapar(registro.valor || registro.nombre || registro.id) + '</span><small>' + escapar(fechaLegible(registro.actualizadoEn)) + ' · ' + escapar(origen) + '</small></div>';
  }

  function pintarComparacion(lista) {
    comparacionActual = lista || [];
    var resumen = resumenComparacion(comparacionActual);
    el.resumenLocalRemoto.textContent = resumen.localRemoto;
    el.resumenRemotoLocal.textContent = resumen.remotoLocal;
    el.resumenIguales.textContent = resumen.iguales;
    el.resumenConflictos.textContent = resumen.conflictos;

    if (!comparacionActual.length) {
      el.tablaComparacion.innerHTML = '<tr><td colspan="4" class="sync-empty">No existen registros de prueba para comparar.</td></tr>';
      return resumen;
    }

    el.tablaComparacion.innerHTML = comparacionActual.map(function (item) {
      var etiqueta = etiquetaDecision(item);
      var nombre = item.local && (item.local.nombre || item.local.id) || item.remoto && (item.remoto.nombre || item.remoto.id) || item.id;
      return '<tr>' +
        '<td><strong>' + escapar(nombre) + '</strong><br><small>' + escapar(item.id) + '</small></td>' +
        '<td>' + cajaVersion(item.local, "BDLocal") + '</td>' +
        '<td>' + cajaVersion(item.remoto, "Google Sheets") + '</td>' +
        '<td><span class="sync-decision ' + etiqueta[1] + '">' + etiqueta[0] + '</span><br><small>' + escapar(item.motivo) + '</small></td>' +
      '</tr>';
    }).join("");

    return resumen;
  }

  async function guardarPendientesYConflictos(lista) {
    await Storage.clear(Stores.QUEUE);
    await Storage.clear(Stores.CONFLICTS);

    for (var i = 0; i < lista.length; i += 1) {
      var item = lista[i];
      if (item.decision === "conflicto") {
        await Storage.put(Stores.CONFLICTS, {
          id: "conflicto_" + item.id,
          entidad: "sync_test",
          registroId: item.id,
          versionLocal: item.local && item.local.version || 0,
          versionRemota: item.remoto && item.remoto.version || 0,
          contenidoLocal: item.local || null,
          contenidoRemoto: item.remoto || null,
          estado: "pendiente",
          motivo: item.motivo,
          creadoEn: Storage.fechaISO()
        });
      } else if (item.decision !== "igual" && item.decision !== "sin_datos") {
        await Storage.put(Stores.QUEUE, {
          id: "queue_" + item.id,
          entidad: "sync_test",
          registroId: item.id,
          operacion: item.decision,
          estado: "pendiente",
          intentos: 0,
          creadoEn: Storage.fechaISO()
        });
      }
    }
  }

  async function compararBases(opciones) {
    opciones = opciones || {};
    try {
      if (!opciones.silenciosa) botonesOcupados(true);
      config = await Storage.guardarConfig(leerFormularioConfig());
      setEstado("loading", "Comparando versiones...", "Leyendo los registros locales y la hoja 99_SYNC_TEST.");

      var locales = await Storage.getAll(Stores.TEST);
      var resultado = await Client.listarPruebas(config);
      remotoActual = Array.isArray(resultado.registros) ? resultado.registros : [];
      var comparacion = Versiones.compararListas(locales, remotoActual);
      var resumen = pintarComparacion(comparacion);
      await guardarPendientesYConflictos(comparacion);

      state = await Storage.actualizarEstado({
        estado: resumen.conflictos ? "con_conflictos" : (resumen.pendientes ? "con_pendientes" : "sincronizado"),
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        ultimaComparacionEn: Storage.fechaISO(),
        registrosRemotos: remotoActual.length,
        sincronizados: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos,
        mensaje: resumen.conflictos ? "Se detectaron conflictos de versión." : (resumen.pendientes ? "Existen cambios por sincronizar." : "Las bases de prueba están iguales.")
      });

      await Storage.registrarLog("comparacion", "Comparación de versiones finalizada.", resumen);
      setEstado(resumen.conflictos ? "warn" : "ok", "Comparación finalizada", state.mensaje);
      return { comparacion: comparacion, resumen: resumen };
    } catch (error) {
      state = await Storage.actualizarEstado({ conectado: false, estado: "error", mensaje: error.message || String(error), errores: Number(state.errores || 0) + 1 });
      await Storage.registrarLog("error", "Falló la comparación de bases.", { mensaje: error.message || String(error) });
      setEstado("error", "No se pudieron comparar las bases", error.message || String(error));
      throw error;
    } finally {
      if (!opciones.silenciosa) botonesOcupados(false);
      await actualizarPantalla({ conservarComparacion: true });
    }
  }

  async function aplicarRemotosGanadores(registrosRemotos) {
    var locales = await Storage.getAll(Stores.TEST);
    var decisiones = Versiones.compararListas(locales, registrosRemotos || []);
    var aplicados = 0;

    for (var i = 0; i < decisiones.length; i += 1) {
      var item = decisiones[i];
      if ((item.decision === "remoto_a_local" || item.decision === "crear_local") && item.remoto) {
        await Storage.put(Stores.TEST, Object.assign({}, item.remoto, { origen: "google_sheets" }));
        aplicados += 1;
      }
    }
    return aplicados;
  }

  async function sincronizarAhora(opciones) {
    opciones = opciones || {};
    if (operacionActiva && opciones.automatica) return;

    try {
      botonesOcupados(true);
      config = await Storage.guardarConfig(leerFormularioConfig());
      setEstado("loading", "Sincronizando...", "La versión más nueva actualizará a la versión anterior.");

      var locales = await Storage.getAll(Stores.TEST);
      var resultado = await Client.sincronizarPruebas(config, locales);
      var registrosFinales = Array.isArray(resultado.registros) ? resultado.registros : [];
      var recibidos = await aplicarRemotosGanadores(registrosFinales);

      remotoActual = registrosFinales;
      var localesActualizados = await Storage.getAll(Stores.TEST);
      var comparacion = Versiones.compararListas(localesActualizados, registrosFinales);
      var resumen = pintarComparacion(comparacion);
      await guardarPendientesYConflictos(comparacion);

      state = await Storage.actualizarEstado({
        estado: resumen.conflictos ? "con_conflictos" : (resumen.pendientes ? "con_pendientes" : "sincronizado"),
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        ultimaComparacionEn: Storage.fechaISO(),
        ultimaSincronizacionEn: Storage.fechaISO(),
        registrosRemotos: registrosFinales.length,
        sincronizados: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos,
        mensaje: resumen.conflictos ? "Sincronización terminada con conflictos." : "Sincronización de prueba finalizada correctamente."
      });

      await Storage.registrarLog(opciones.automatica ? "sincronizacion_automatica" : "sincronizacion_manual", state.mensaje, {
        enviados: Number(resultado.enviados || 0),
        recibidos: recibidos,
        iguales: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos
      });

      setEstado(resumen.conflictos ? "warn" : "ok", "Sincronización finalizada", state.mensaje);
    } catch (error) {
      state = await Storage.actualizarEstado({ conectado: false, estado: "error", mensaje: error.message || String(error), errores: Number(state.errores || 0) + 1 });
      await Storage.registrarLog("error", "Falló la sincronización.", { mensaje: error.message || String(error), automatica: !!opciones.automatica });
      setEstado("error", "No se pudo sincronizar", error.message || String(error));
    } finally {
      botonesOcupados(false);
      await actualizarPantalla({ conservarComparacion: true });
    }
  }

  async function pintarPendientes() {
    var pendientes = await Storage.getAll(Stores.QUEUE);
    var conflictos = (await Storage.getAll(Stores.CONFLICTS)).filter(function (item) { return item.estado !== "resuelto"; });
    var items = [];

    pendientes.forEach(function (item) {
      items.push('<div class="sync-list-item"><div><strong>' + escapar(item.registroId) + '</strong><span>' + escapar(item.operacion) + ' · pendiente</span></div><span class="sync-decision sync-decision-local">Pendiente</span></div>');
    });

    conflictos.forEach(function (item) {
      items.push('<div class="sync-list-item"><div><strong>' + escapar(item.registroId) + '</strong><span>Versión local ' + escapar(item.versionLocal) + ' · Versión remota ' + escapar(item.versionRemota) + '</span></div><span class="sync-decision sync-decision-conflicto">Conflicto</span></div>');
    });

    el.listaPendientes.innerHTML = items.length ? items.join("") : '<p class="sync-muted">Sin pendientes ni conflictos registrados.</p>';
  }

  async function pintarHistorial() {
    var logs = await Storage.getAll(Stores.LOGS);
    logs.sort(function (a, b) { return texto(b.creadoEn).localeCompare(texto(a.creadoEn)); });
    logs = logs.slice(0, 20);

    el.listaHistorial.innerHTML = logs.length ? logs.map(function (log) {
      return '<div class="sync-history-item"><div><strong>' + escapar(log.tipo) + '</strong><span>' + escapar(log.mensaje) + '</span></div><time>' + escapar(fechaLegible(log.creadoEn)) + '</time></div>';
    }).join("") : '<p class="sync-muted">Todavía no hay ejecuciones.</p>';
  }

  async function guardarAutomatica() {
    try {
      config = await Storage.guardarConfig({
        automatica: !!el.campoAutomatica.checked,
        alIniciar: !!el.campoAlIniciar.checked,
        alRecuperarConexion: !!el.campoAlReconectar.checked,
        intervaloMinutos: Number(el.campoIntervalo.value || 15)
      });
      await Storage.registrarLog("automatizacion", config.automatica ? "Sincronización automática de prueba activada." : "Sincronización automática de prueba desactivada.", {
        intervaloMinutos: config.intervaloMinutos,
        alIniciar: config.alIniciar,
        alRecuperarConexion: config.alRecuperarConexion
      });
      configurarIntervaloAutomatico();
      await actualizarPantalla();
      setEstado("ok", "Automatización guardada", config.automatica ? "La prueba automática está activa mientras esta pantalla permanezca abierta." : "La sincronización automática está desactivada.");
    } catch (error) {
      setEstado("error", "No se pudo guardar la automatización", error.message || String(error));
    }
  }

  function configurarIntervaloAutomatico() {
    if (intervaloAutomatico) {
      clearInterval(intervaloAutomatico);
      intervaloAutomatico = null;
    }
    if (!config || !config.automatica) return;
    var minutos = Math.max(5, Number(config.intervaloMinutos || 15));
    intervaloAutomatico = setInterval(function () {
      if (navigator.onLine && !operacionActiva) sincronizarAhora({ automatica: true });
    }, minutos * 60 * 1000);
  }

  async function abrirSheets() {
    config = await Storage.guardarConfig(leerFormularioConfig());
    if (!config.spreadsheetId) {
      setEstado("warn", "Falta el ID del Google Sheets", "Guarda primero el identificador del archivo.");
      return;
    }
    var url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(config.spreadsheetId) + "/edit";
    if (window.CurriculoElectron && typeof window.CurriculoElectron.openExternal === "function") {
      await window.CurriculoElectron.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  async function limpiarHistorial() {
    await Storage.clear(Stores.LOGS);
    await pintarHistorial();
    setEstado("ok", "Historial limpiado", "Se eliminaron únicamente los registros de actividad de sincronización.");
  }

  async function actualizarPantalla(opciones) {
    opciones = opciones || {};
    config = await Storage.get(Stores.CONFIG, "config") || config;
    state = await Storage.get(Stores.STATE, "estado") || state;
    pintarFormularioConfig();
    await pintarEstadoGeneral();
    await pintarRegistroPrueba();
    await pintarPendientes();
    await pintarHistorial();
    if (!opciones.conservarComparacion && !comparacionActual.length) pintarComparacion([]);
  }

  function conectarEventos() {
    el.formConfiguracion.addEventListener("submit", guardarConfiguracion);
    el.btnProbarConexion.addEventListener("click", probarConexion);
    el.btnAbrirSheets.addEventListener("click", abrirSheets);
    el.btnRecargarEstado.addEventListener("click", function () { actualizarPantalla(); });
    el.btnGuardarPruebaLocal.addEventListener("click", guardarPruebaLocal);
    el.btnComparar.addEventListener("click", function () { compararBases(); });
    el.btnSincronizar.addEventListener("click", function () { sincronizarAhora({ automatica: false }); });
    el.btnGuardarAutomatica.addEventListener("click", guardarAutomatica);
    el.btnLimpiarHistorial.addEventListener("click", limpiarHistorial);

    window.addEventListener("online", function () {
      setEstado("ok", "Conexión a internet recuperada", "Puedes volver a probar Google Sheets.");
      if (config && config.automatica && config.alRecuperarConexion && !operacionActiva) sincronizarAhora({ automatica: true });
    });

    window.addEventListener("offline", function () {
      setEstado("error", "Sin conexión a internet", "BDLocal continúa funcionando. La sincronización queda pendiente.");
    });
  }

  async function iniciar() {
    tomarElementos();
    conectarEventos();

    try {
      setEstado("loading", "Preparando sincronización...", "Creando el entorno seguro de pruebas.");
      var inicial = await Storage.inicializar();
      config = inicial.config;
      state = inicial.state;
      await actualizarPantalla();
      configurarIntervaloAutomatico();

      if (config.automatica && config.alIniciar && config.endpoint && config.spreadsheetId && navigator.onLine) {
        setTimeout(function () { sincronizarAhora({ automatica: true }); }, 1200);
      }
    } catch (error) {
      console.error("[Sincronizacion] Error iniciando pantalla:", error);
      setEstado("error", "No se pudo iniciar la pantalla", error.message || String(error));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);