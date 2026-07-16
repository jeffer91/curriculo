/* =========================================================
Nombre completo: sincronizacion.controlador.js
Ruta: /Curriculo/sincronizacion/sincronizacion.controlador.js
Funciones:
- Controlar la pantalla de sincronización sin operaciones superpuestas.
- Configurar y probar Google Sheets.
- Crear versiones locales de prueba.
- Comparar, sincronizar y registrar pendientes, conflictos e historial.
- Ejecutar sincronización automática mientras la pantalla está abierta.
========================================================= */
(function (window, document) {
  "use strict";

  var Sync = window.CurriculoSync || {};
  var BD = window.BDLocalCCC || {};

  if (!Sync.Storage || !Sync.Versiones || !Sync.Client) {
    console.error("[Sincronizacion.Controlador] Faltan módulos obligatorios.");
    return;
  }

  var Storage = Sync.Storage;
  var Versiones = Sync.Versiones;
  var Client = Sync.Client;
  var Stores = Storage.STORES;
  var elementos = {};
  var config = null;
  var estado = null;
  var comparacionActual = [];
  var intervaloAutomatico = null;
  var ocupada = false;

  var IDS = [
    "estadoPrincipal", "estadoTitulo", "estadoMensaje", "badgeEntorno",
    "kpiConexion", "kpiConexionDetalle", "kpiLocal", "kpiRemoto",
    "kpiSincronizados", "kpiPendientes", "kpiConflictos", "kpiUltima", "kpiUltimaDetalle",
    "formConfiguracion", "campoEntorno", "campoEndpoint", "campoSpreadsheetId", "campoDispositivo", "campoToken",
    "btnGuardarConfig", "btnProbarConexion", "btnAbrirSheets", "btnRecargarEstado",
    "campoValorPrueba", "versionPruebaLocal", "btnGuardarPruebaLocal",
    "btnComparar", "btnSincronizar", "resumenLocalRemoto", "resumenRemotoLocal", "resumenIguales", "resumenConflictos",
    "tablaComparacion", "campoAutomatica", "campoAlIniciar", "campoAlReconectar", "campoIntervalo", "btnGuardarAutomatica",
    "listaPendientes", "listaHistorial", "btnLimpiarHistorial"
  ];

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

  function tomarElementos() {
    var faltantes = [];
    IDS.forEach(function (id) {
      elementos[id] = document.getElementById(id);
      if (!elementos[id]) faltantes.push(id);
    });
    if (faltantes.length) throw new Error("Faltan elementos de interfaz: " + faltantes.join(", "));
  }

  function setEstado(tipo, titulo, mensaje) {
    elementos.estadoPrincipal.className = "sync-status sync-status-" + (tipo || "neutral");
    elementos.estadoTitulo.textContent = titulo || "Estado";
    elementos.estadoMensaje.textContent = mensaje || "";
  }

  function setOcupada(valor) {
    ocupada = !!valor;
    [
      "btnGuardarConfig", "btnProbarConexion", "btnGuardarPruebaLocal",
      "btnComparar", "btnSincronizar", "btnGuardarAutomatica", "btnRecargarEstado"
    ].forEach(function (id) {
      elementos[id].disabled = ocupada;
    });
  }

  function normalizarDispositivo(valor) {
    return texto(valor).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "equipo_local";
  }

  function leerConfiguracionFormulario() {
    return {
      entorno: elementos.campoEntorno.value || "pruebas",
      endpoint: texto(elementos.campoEndpoint.value),
      spreadsheetId: texto(elementos.campoSpreadsheetId.value),
      dispositivoId: normalizarDispositivo(elementos.campoDispositivo.value),
      token: texto(elementos.campoToken.value)
    };
  }

  function validarConfiguracion(actual) {
    actual = actual || {};
    if (!texto(actual.endpoint)) throw new Error("Falta la URL del Google Apps Script.");
    if (!/^https:\/\//i.test(texto(actual.endpoint))) throw new Error("La URL del Apps Script debe comenzar con https://");
    if (!texto(actual.spreadsheetId)) throw new Error("Falta el ID del Google Sheets.");
    return actual;
  }

  function pintarConfiguracion() {
    elementos.campoEntorno.value = config.entorno || "pruebas";
    elementos.campoEndpoint.value = config.endpoint || "";
    elementos.campoSpreadsheetId.value = config.spreadsheetId || "";
    elementos.campoDispositivo.value = config.dispositivoId || "equipo_local";
    elementos.campoToken.value = config.token || "";
    elementos.campoAutomatica.checked = !!config.automatica;
    elementos.campoAlIniciar.checked = !!config.alIniciar;
    elementos.campoAlReconectar.checked = config.alRecuperarConexion !== false;
    elementos.campoIntervalo.value = String(config.intervaloMinutos || 15);
    elementos.badgeEntorno.textContent = texto(config.entorno || "pruebas").toUpperCase();
  }

  async function contarMateriasLocales() {
    try {
      if (!BD.Core || !BD.Schema) return 0;
      await BD.Core.ready();
      return await BD.Core.count(BD.Schema.STORES.MATERIAS);
    } catch (error) {
      console.warn("[Sincronizacion.Controlador] No se pudo contar BDLocal:", error);
      return 0;
    }
  }

  function idPrueba() {
    return "sync_test_" + normalizarDispositivo(config && config.dispositivoId);
  }

  async function obtenerRegistroPrueba() {
    return await Storage.get(Stores.TEST, idPrueba());
  }

  async function pintarKPIs() {
    var totalLocal = await contarMateriasLocales();
    var pendientes = await Storage.count(Stores.QUEUE);
    var conflictos = (await Storage.getAll(Stores.CONFLICTS)).filter(function (item) {
      return item.estado !== "resuelto";
    }).length;

    elementos.kpiLocal.textContent = totalLocal;
    elementos.kpiRemoto.textContent = Number(estado.registrosRemotos || 0);
    elementos.kpiSincronizados.textContent = Number(estado.sincronizados || 0);
    elementos.kpiPendientes.textContent = pendientes;
    elementos.kpiConflictos.textContent = conflictos;
    elementos.kpiUltima.textContent = estado.ultimaSincronizacionEn ? fechaLegible(estado.ultimaSincronizacionEn) : "Nunca";
    elementos.kpiUltimaDetalle.textContent = estado.ultimaSincronizacionEn ? "Última ejecución correcta" : "Sin ejecuciones";

    if (!config.endpoint || !config.spreadsheetId) {
      elementos.kpiConexion.textContent = "Sin configurar";
      elementos.kpiConexionDetalle.textContent = "Falta endpoint o ID";
    } else if (!navigator.onLine) {
      elementos.kpiConexion.textContent = "Sin internet";
      elementos.kpiConexionDetalle.textContent = "La base local sigue disponible";
    } else if (estado.conectado) {
      elementos.kpiConexion.textContent = "Conectada";
      elementos.kpiConexionDetalle.textContent = estado.ultimaConexionEn ? fechaLegible(estado.ultimaConexionEn) : "Google Sheets";
    } else {
      elementos.kpiConexion.textContent = "Sin probar";
      elementos.kpiConexionDetalle.textContent = estado.mensaje || "Google Sheets";
    }
  }

  async function pintarRegistroPrueba() {
    var registro = await obtenerRegistroPrueba();
    elementos.versionPruebaLocal.textContent = registro ? Number(registro.version || 0) : 0;
    if (registro && document.activeElement !== elementos.campoValorPrueba) {
      elementos.campoValorPrueba.value = registro.valor || "";
    }
  }

  function resumenComparacion(lista) {
    var resumen = { localRemoto: 0, remotoLocal: 0, iguales: 0, conflictos: 0, pendientes: 0 };
    (lista || []).forEach(function (item) {
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
    return '<div class="sync-version-box"><strong>v' + escapar(registro.version || 0) + '</strong><span>' +
      escapar(registro.valor || registro.nombre || registro.id) + '</span><small>' +
      escapar(fechaLegible(registro.actualizadoEn)) + ' · ' + escapar(origen) + '</small></div>';
  }

  function pintarComparacion(lista) {
    comparacionActual = Array.isArray(lista) ? lista : [];
    var resumen = resumenComparacion(comparacionActual);

    elementos.resumenLocalRemoto.textContent = resumen.localRemoto;
    elementos.resumenRemotoLocal.textContent = resumen.remotoLocal;
    elementos.resumenIguales.textContent = resumen.iguales;
    elementos.resumenConflictos.textContent = resumen.conflictos;

    if (!comparacionActual.length) {
      elementos.tablaComparacion.innerHTML = '<tr><td colspan="4" class="sync-empty">No existen registros de prueba para comparar.</td></tr>';
      return resumen;
    }

    elementos.tablaComparacion.innerHTML = comparacionActual.map(function (item) {
      var etiqueta = etiquetaDecision(item);
      var nombre = item.local && (item.local.nombre || item.local.id) ||
        item.remoto && (item.remoto.nombre || item.remoto.id) || item.id;

      return '<tr><td><strong>' + escapar(nombre) + '</strong><br><small>' + escapar(item.id) + '</small></td>' +
        '<td>' + cajaVersion(item.local, "BDLocal") + '</td>' +
        '<td>' + cajaVersion(item.remoto, "Google Sheets") + '</td>' +
        '<td><span class="sync-decision ' + etiqueta[1] + '">' + etiqueta[0] + '</span><br><small>' +
        escapar(item.motivo || "") + '</small></td></tr>';
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
          motivo: item.motivo || "Contenido diferente",
          creadoEn: Storage.fechaISO()
        });
      } else if (item.decision !== "igual" && item.decision !== "sin_datos") {
        await Storage.put(Stores.QUEUE, {
          id: "queue_" + item.id,
          entidad: "sync_test",
          registroId: item.id,
          version: item.local && item.local.version || item.remoto && item.remoto.version || 0,
          operacion: item.decision,
          estado: "pendiente",
          intentos: 0,
          creadoEn: Storage.fechaISO()
        });
      }
    }
  }

  async function pintarPendientes() {
    var pendientes = await Storage.getAll(Stores.QUEUE);
    var conflictos = (await Storage.getAll(Stores.CONFLICTS)).filter(function (item) {
      return item.estado !== "resuelto";
    });
    var items = [];

    pendientes.forEach(function (item) {
      items.push('<div class="sync-list-item"><div><strong>' + escapar(item.registroId) + '</strong><span>' +
        escapar(item.operacion) + ' · pendiente</span></div><span class="sync-decision sync-decision-local">Pendiente</span></div>');
    });

    conflictos.forEach(function (item) {
      items.push('<div class="sync-list-item"><div><strong>' + escapar(item.registroId) + '</strong><span>Versión local ' +
        escapar(item.versionLocal) + ' · Versión remota ' + escapar(item.versionRemota) +
        '</span></div><span class="sync-decision sync-decision-conflicto">Conflicto</span></div>');
    });

    elementos.listaPendientes.innerHTML = items.length ? items.join("") : '<p class="sync-muted">Sin pendientes ni conflictos registrados.</p>';
  }

  async function pintarHistorial() {
    var logs = await Storage.getAll(Stores.LOGS);
    logs.sort(function (a, b) { return texto(b.creadoEn).localeCompare(texto(a.creadoEn)); });
    logs = logs.slice(0, 20);

    elementos.listaHistorial.innerHTML = logs.length ? logs.map(function (log) {
      return '<div class="sync-history-item"><div><strong>' + escapar(log.tipo) + '</strong><span>' +
        escapar(log.mensaje) + '</span></div><time>' + escapar(fechaLegible(log.creadoEn)) + '</time></div>';
    }).join("") : '<p class="sync-muted">Todavía no hay ejecuciones.</p>';
  }

  async function refrescarPantalla(conservarComparacion) {
    config = await Storage.get(Stores.CONFIG, "config") || config;
    estado = await Storage.get(Stores.STATE, "estado") || estado;
    pintarConfiguracion();
    await pintarKPIs();
    await pintarRegistroPrueba();
    await pintarPendientes();
    await pintarHistorial();
    if (!conservarComparacion && !comparacionActual.length) pintarComparacion([]);
  }

  async function ejecutarOperacion(nombre, operacion) {
    if (ocupada) return null;
    setOcupada(true);

    try {
      return await operacion();
    } catch (error) {
      console.error("[Sincronizacion.Controlador] " + nombre + ":", error);
      estado = await Storage.actualizarEstado({
        estado: "error",
        conectado: false,
        mensaje: error.message || String(error),
        errores: Number(estado && estado.errores || 0) + 1
      });
      await Storage.registrarLog("error", "Falló " + nombre + ".", { mensaje: error.message || String(error) });
      setEstado("error", "No se pudo completar la operación", error.message || String(error));
      return null;
    } finally {
      setOcupada(false);
      await refrescarPantalla(true);
    }
  }

  async function guardarConfiguracion(event) {
    if (event) event.preventDefault();
    return await ejecutarOperacion("el guardado de configuración", async function () {
      config = await Storage.guardarConfig(leerConfiguracionFormulario());
      estado = await Storage.actualizarEstado({
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
      setEstado("ok", "Configuración guardada", "Ahora puedes probar la conexión con Google Sheets.");
    });
  }

  async function probarConexion() {
    return await ejecutarOperacion("la prueba de conexión", async function () {
      config = await Storage.guardarConfig(leerConfiguracionFormulario());
      validarConfiguracion(config);
      setEstado("loading", "Probando conexión...", "Consultando Google Apps Script y la hoja 99_SYNC_TEST.");

      var resultado = await Client.probarConexion(config);
      estado = await Storage.actualizarEstado({
        estado: "conectado",
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        registrosRemotos: Number(resultado.registros || 0),
        mensaje: resultado.mensaje || "Conexión comprobada correctamente.",
        errores: 0
      });
      await Storage.registrarLog("conexion", "Conexión con Google Sheets comprobada.", resultado);
      setEstado("ok", "Conexión correcta", resultado.mensaje || "Google Sheets respondió correctamente.");
    });
  }

  async function guardarPruebaLocal() {
    return await ejecutarOperacion("el guardado de la versión local", async function () {
      config = await Storage.guardarConfig(leerConfiguracionFormulario());
      var anterior = await obtenerRegistroPrueba();
      var ahora = Storage.fechaISO();
      var registro = {
        id: idPrueba(),
        entidad: "sync_test",
        nombre: "Prueba de " + config.dispositivoId,
        valor: texto(elementos.campoValorPrueba.value) || "Prueba " + fechaLegible(ahora),
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
      await Storage.registrarLog("cambio_local", "Se creó una nueva versión local de prueba.", {
        registroId: registro.id,
        version: registro.version,
        actualizadoEn: registro.actualizadoEn
      });
      estado = await Storage.actualizarEstado({
        estado: "con_pendientes",
        mensaje: "Existe una versión local pendiente de sincronización."
      });
      setEstado("warn", "Versión local guardada", "La versión " + registro.version + " está pendiente de sincronización.");
    });
  }

  async function compararBases(silenciosa) {
    return await ejecutarOperacion("la comparación de bases", async function () {
      config = await Storage.guardarConfig(leerConfiguracionFormulario());
      validarConfiguracion(config);
      if (!silenciosa) setEstado("loading", "Comparando versiones...", "Leyendo BDLocal y 99_SYNC_TEST.");

      var locales = await Storage.getAll(Stores.TEST);
      var resultado = await Client.listarPruebas(config);
      var remotos = Array.isArray(resultado.registros) ? resultado.registros : [];
      var comparacion = Versiones.compararListas(locales, remotos);
      var resumen = pintarComparacion(comparacion);
      await guardarPendientesYConflictos(comparacion);

      estado = await Storage.actualizarEstado({
        estado: resumen.conflictos ? "con_conflictos" : (resumen.pendientes ? "con_pendientes" : "sincronizado"),
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        ultimaComparacionEn: Storage.fechaISO(),
        registrosRemotos: remotos.length,
        sincronizados: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos,
        mensaje: resumen.conflictos ? "Se detectaron conflictos de versión." :
          (resumen.pendientes ? "Existen cambios por sincronizar." : "Las bases de prueba están iguales.")
      });
      await Storage.registrarLog("comparacion", "Comparación de versiones finalizada.", resumen);
      setEstado(resumen.conflictos ? "warn" : "ok", "Comparación finalizada", estado.mensaje);
      return { comparacion: comparacion, resumen: resumen };
    });
  }

  async function aplicarRemotosGanadores(remotos) {
    var locales = await Storage.getAll(Stores.TEST);
    var decisiones = Versiones.compararListas(locales, remotos || []);
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

  async function sincronizarAhora(automatica) {
    if (automatica && ocupada) return null;

    return await ejecutarOperacion(automatica ? "la sincronización automática" : "la sincronización manual", async function () {
      config = await Storage.guardarConfig(leerConfiguracionFormulario());
      validarConfiguracion(config);
      if (!navigator.onLine) throw new Error("No hay conexión a internet. La sincronización queda pendiente.");

      setEstado("loading", "Sincronizando...", "La versión más nueva actualizará a la versión anterior.");
      var locales = await Storage.getAll(Stores.TEST);
      var resultado = await Client.sincronizarPruebas(config, locales);
      var remotos = Array.isArray(resultado.registros) ? resultado.registros : [];
      var recibidos = await aplicarRemotosGanadores(remotos);
      var localesActualizados = await Storage.getAll(Stores.TEST);
      var comparacion = Versiones.compararListas(localesActualizados, remotos);
      var resumen = pintarComparacion(comparacion);
      await guardarPendientesYConflictos(comparacion);

      estado = await Storage.actualizarEstado({
        estado: resumen.conflictos ? "con_conflictos" : (resumen.pendientes ? "con_pendientes" : "sincronizado"),
        conectado: true,
        ultimaConexionEn: Storage.fechaISO(),
        ultimaComparacionEn: Storage.fechaISO(),
        ultimaSincronizacionEn: Storage.fechaISO(),
        registrosRemotos: remotos.length,
        sincronizados: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos,
        mensaje: resumen.conflictos ? "Sincronización terminada con conflictos." :
          (resumen.pendientes ? "La sincronización terminó con cambios pendientes." : "Sincronización de prueba finalizada correctamente.")
      });
      await Storage.registrarLog(automatica ? "sincronizacion_automatica" : "sincronizacion_manual", estado.mensaje, {
        enviados: Number(resultado.enviados || 0),
        recibidos: recibidos,
        iguales: resumen.iguales,
        pendientes: resumen.pendientes,
        conflictos: resumen.conflictos
      });
      setEstado(resumen.conflictos ? "warn" : (resumen.pendientes ? "warn" : "ok"), "Sincronización finalizada", estado.mensaje);
      return { enviados: Number(resultado.enviados || 0), recibidos: recibidos, resumen: resumen };
    });
  }

  function configurarIntervaloAutomatico() {
    if (intervaloAutomatico) {
      clearInterval(intervaloAutomatico);
      intervaloAutomatico = null;
    }
    if (!config || !config.automatica) return;

    var minutos = Math.max(5, Number(config.intervaloMinutos || 15));
    intervaloAutomatico = setInterval(function () {
      if (navigator.onLine && !ocupada) sincronizarAhora(true);
    }, minutos * 60 * 1000);
  }

  async function guardarAutomatica() {
    return await ejecutarOperacion("el guardado de automatización", async function () {
      config = await Storage.guardarConfig({
        automatica: !!elementos.campoAutomatica.checked,
        alIniciar: !!elementos.campoAlIniciar.checked,
        alRecuperarConexion: !!elementos.campoAlReconectar.checked,
        intervaloMinutos: Number(elementos.campoIntervalo.value || 15)
      });
      await Storage.registrarLog("automatizacion", config.automatica ?
        "Sincronización automática de prueba activada." : "Sincronización automática de prueba desactivada.", {
        intervaloMinutos: config.intervaloMinutos,
        alIniciar: config.alIniciar,
        alRecuperarConexion: config.alRecuperarConexion
      });
      configurarIntervaloAutomatico();
      setEstado("ok", "Automatización guardada", config.automatica ?
        "La prueba automática está activa mientras esta pantalla permanezca abierta." : "La sincronización automática está desactivada.");
    });
  }

  async function abrirSheets() {
    config = await Storage.guardarConfig(leerConfiguracionFormulario());
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
    return await ejecutarOperacion("la limpieza del historial visible", async function () {
      await Storage.clear(Stores.LOGS);
      setEstado("ok", "Historial limpiado", "Las versiones técnicas se conservaron en su base independiente.");
    });
  }

  function conectarEventos() {
    elementos.formConfiguracion.addEventListener("submit", guardarConfiguracion);
    elementos.btnProbarConexion.addEventListener("click", probarConexion);
    elementos.btnAbrirSheets.addEventListener("click", abrirSheets);
    elementos.btnRecargarEstado.addEventListener("click", function () { refrescarPantalla(true); });
    elementos.btnGuardarPruebaLocal.addEventListener("click", guardarPruebaLocal);
    elementos.btnComparar.addEventListener("click", function () { compararBases(false); });
    elementos.btnSincronizar.addEventListener("click", function () { sincronizarAhora(false); });
    elementos.btnGuardarAutomatica.addEventListener("click", guardarAutomatica);
    elementos.btnLimpiarHistorial.addEventListener("click", limpiarHistorial);

    window.addEventListener("online", function () {
      setEstado("ok", "Conexión a internet recuperada", "Puedes volver a utilizar Google Sheets.");
      if (config && config.automatica && config.alRecuperarConexion && !ocupada) sincronizarAhora(true);
    });

    window.addEventListener("offline", function () {
      setEstado("error", "Sin conexión a internet", "BDLocal continúa funcionando. La sincronización queda pendiente.");
    });
  }

  async function iniciar() {
    try {
      tomarElementos();
      conectarEventos();
      setEstado("loading", "Preparando sincronización...", "Creando el entorno seguro de pruebas.");

      var inicial = await Storage.inicializar();
      config = inicial.config;
      estado = inicial.state;
      await refrescarPantalla(false);
      configurarIntervaloAutomatico();

      if (!config.endpoint || !config.spreadsheetId) {
        setEstado("neutral", "Sincronización sin configurar", "Guarda el endpoint y el ID del Google Sheets de pruebas.");
      } else if (!navigator.onLine) {
        setEstado("error", "No hay conexión a internet", "BDLocal continúa disponible.");
      } else if (estado.conectado) {
        setEstado("ok", "Pantalla lista", estado.mensaje || "Puedes comparar o sincronizar las versiones.");
      } else {
        setEstado("neutral", "Conexión pendiente de prueba", "Pulsa Probar conexión antes de sincronizar.");
      }

      if (config.automatica && config.alIniciar && config.endpoint && config.spreadsheetId && navigator.onLine) {
        setTimeout(function () { sincronizarAhora(true); }, 1200);
      }
    } catch (error) {
      console.error("[Sincronizacion.Controlador] No se pudo iniciar:", error);
      if (elementos.estadoPrincipal) setEstado("error", "No se pudo iniciar la pantalla", error.message || String(error));
    }
  }

  Sync.Screen = {
    refrescar: function () { return refrescarPantalla(true); },
    comparar: function () { return compararBases(false); },
    sincronizar: function () { return sincronizarAhora(false); },
    obtenerEstado: function () {
      return {
        ocupada: ocupada,
        config: config,
        estado: estado,
        comparacion: comparacionActual.slice()
      };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);