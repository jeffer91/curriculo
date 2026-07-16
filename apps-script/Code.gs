/* =========================================================
Nombre completo: Code.gs
Ruta: /Curriculo/apps-script/Code.gs
Funciones:
- Crear el endpoint de prueba de sincronización para Google Apps Script.
- Trabajar únicamente con la hoja 99_SYNC_TEST.
- Comparar versiones, fechas y contenido sin tocar datos curriculares reales.
- Evitar el borrado accidental de una hoja con estructura diferente.
- Proteger las escrituras concurrentes y devolver siempre respuestas JSON.
========================================================= */

var SYNC_TEST_SHEET = "99_SYNC_TEST";
var SYNC_TEST_HEADERS = [
  "id",
  "entidad",
  "nombre",
  "valor",
  "version",
  "actualizadoEn",
  "hash",
  "origen",
  "dispositivoId",
  "activo",
  "sincronizadoEn"
];

var SYNC_HASH_EXCLUDED = {
  hash: true,
  sincronizadoEn: true,
  ultimoIntentoEn: true,
  estadoSync: true,
  origen: true,
  dispositivoId: true,
  version: true,
  actualizadoEn: true,
  updatedAt: true,
  creadoEn: true,
  createdAt: true
};

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function texto_(value) {
  return String(value === null || typeof value === "undefined" ? "" : value).trim();
}

function numero_(value) {
  var n = Number(value || 0);
  return isFinite(n) ? n : 0;
}

function fechaNumero_(value) {
  var time = new Date(texto_(value)).getTime();
  return isFinite(time) ? time : 0;
}

function serializarOrdenado_(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(serializarOrdenado_).join(",") + "]";
  }

  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().filter(function (key) {
      return !SYNC_HASH_EXCLUDED[key];
    }).map(function (key) {
      return JSON.stringify(key) + ":" + serializarOrdenado_(value[key]);
    }).join(",") + "}";
  }

  return JSON.stringify(value);
}

function hashTexto_(value) {
  var hash = 2166136261;
  var source = String(value || "");

  for (var i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

function hashRegistro_(registro) {
  return registro ? hashTexto_(serializarOrdenado_(registro)) : "";
}

function propiedades_() {
  return PropertiesService.getScriptProperties();
}

function validarToken_(token) {
  var esperado = texto_(propiedades_().getProperty("SYNC_TOKEN"));
  if (!esperado) return true;
  return texto_(token) === esperado;
}

function obtenerSpreadsheet_(spreadsheetId) {
  var configurado = texto_(propiedades_().getProperty("SPREADSHEET_ID"));
  var id = configurado || texto_(spreadsheetId);
  if (!id) throw new Error("No se configuró SPREADSHEET_ID en las propiedades del script.");
  return SpreadsheetApp.openById(id);
}

function aplicarEstiloEncabezado_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, SYNC_TEST_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0b2447")
    .setFontColor("#ffffff");
  sheet.autoResizeColumns(1, SYNC_TEST_HEADERS.length);
}

function asegurarEncabezados_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    sheet.getRange(1, 1, 1, SYNC_TEST_HEADERS.length).setValues([SYNC_TEST_HEADERS]);
    aplicarEstiloEncabezado_(sheet);
    return;
  }

  var width = Math.max(lastColumn, SYNC_TEST_HEADERS.length);
  var actuales = sheet.getRange(1, 1, 1, width).getDisplayValues()[0]
    .slice(0, SYNC_TEST_HEADERS.length)
    .map(texto_);

  if (actuales.join("|") === SYNC_TEST_HEADERS.join("|")) {
    aplicarEstiloEncabezado_(sheet);
    return;
  }

  if (lastRow <= 1) {
    sheet.getRange(1, 1, 1, width).clearContent();
    sheet.getRange(1, 1, 1, SYNC_TEST_HEADERS.length).setValues([SYNC_TEST_HEADERS]);
    aplicarEstiloEncabezado_(sheet);
    return;
  }

  throw new Error(
    "La hoja " + SYNC_TEST_SHEET + " ya contiene datos y sus columnas no coinciden. " +
    "No se modificó ninguna fila. Revisa o renombra la hoja antes de continuar."
  );
}

function obtenerHojaPrueba_(spreadsheetId) {
  var ss = obtenerSpreadsheet_(spreadsheetId);
  var sheet = ss.getSheetByName(SYNC_TEST_SHEET);
  if (!sheet) sheet = ss.insertSheet(SYNC_TEST_SHEET);
  asegurarEncabezados_(sheet);
  return sheet;
}

function normalizarRegistro_(registro) {
  registro = registro || {};

  var normalizado = {
    id: texto_(registro.id),
    entidad: texto_(registro.entidad),
    nombre: texto_(registro.nombre),
    valor: texto_(registro.valor),
    version: numero_(registro.version),
    actualizadoEn: texto_(registro.actualizadoEn || registro.updatedAt),
    hash: "",
    origen: texto_(registro.origen),
    dispositivoId: texto_(registro.dispositivoId),
    activo: String(registro.activo).toLowerCase() !== "false",
    sincronizadoEn: texto_(registro.sincronizadoEn)
  };

  normalizado.hash = hashRegistro_(normalizado);
  return normalizado;
}

function filaARegistro_(row) {
  var registro = {};
  SYNC_TEST_HEADERS.forEach(function (header, index) {
    registro[header] = row[index];
  });
  return normalizarRegistro_(registro);
}

function registroAFila_(registro) {
  var normalizado = normalizarRegistro_(registro);
  return SYNC_TEST_HEADERS.map(function (header) {
    if (header === "version") return numero_(normalizado[header]);
    if (header === "activo") return normalizado[header] !== false;
    return normalizado[header] === null || typeof normalizado[header] === "undefined" ? "" : normalizado[header];
  });
}

function listarRegistros_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, SYNC_TEST_HEADERS.length).getValues()
    .map(filaARegistro_)
    .filter(function (registro) { return !!registro.id; });
}

function mapaRegistros_(registros) {
  var map = {};
  (registros || []).forEach(function (registro) {
    var normalizado = normalizarRegistro_(registro);
    if (normalizado.id) map[normalizado.id] = normalizado;
  });
  return map;
}

function compararRegistro_(local, remoto) {
  local = local ? normalizarRegistro_(local) : null;
  remoto = remoto ? normalizarRegistro_(remoto) : null;

  if (!local && !remoto) return { decision: "sin_datos", ganador: "ninguno" };
  if (local && !remoto) return { decision: "crear_remoto", ganador: "local" };
  if (!local && remoto) return { decision: "crear_local", ganador: "remoto" };

  if (local.version > remoto.version) return { decision: "local_a_remoto", ganador: "local" };
  if (remoto.version > local.version) return { decision: "remoto_a_local", ganador: "remoto" };

  var fechaLocal = fechaNumero_(local.actualizadoEn);
  var fechaRemota = fechaNumero_(remoto.actualizadoEn);

  if (fechaLocal > fechaRemota) return { decision: "local_a_remoto", ganador: "local" };
  if (fechaRemota > fechaLocal) return { decision: "remoto_a_local", ganador: "remoto" };

  if (local.hash === remoto.hash) return { decision: "igual", ganador: "ambos" };
  return { decision: "conflicto", ganador: "pendiente" };
}

function compararListas_(locales, remotos) {
  var localMap = mapaRegistros_(locales);
  var remotoMap = mapaRegistros_(remotos);
  var ids = {};

  Object.keys(localMap).forEach(function (id) { ids[id] = true; });
  Object.keys(remotoMap).forEach(function (id) { ids[id] = true; });

  return Object.keys(ids).sort().map(function (id) {
    var resultado = compararRegistro_(localMap[id], remotoMap[id]);
    resultado.id = id;
    resultado.local = localMap[id] || null;
    resultado.remoto = remotoMap[id] || null;
    return resultado;
  });
}

function upsert_(sheet, registro) {
  var normalizado = normalizarRegistro_(registro);
  if (!normalizado.id) throw new Error("No se puede sincronizar un registro sin id.");

  normalizado.sincronizadoEn = new Date().toISOString();
  normalizado.hash = hashRegistro_(normalizado);

  var lastRow = sheet.getLastRow();
  var rowNumber = -1;

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i += 1) {
      if (texto_(ids[i][0]) === normalizado.id) {
        rowNumber = i + 2;
        break;
      }
    }
  }

  var fila = registroAFila_(normalizado);

  if (rowNumber === -1) {
    sheet.appendRow(fila);
  } else {
    sheet.getRange(rowNumber, 1, 1, SYNC_TEST_HEADERS.length).setValues([fila]);
  }

  return normalizado;
}

function leerRequest_(e) {
  var data = {};

  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error("El cuerpo enviado no contiene JSON válido.");
    }
  }

  return data || {};
}

function ejecutar_(request) {
  request = request || {};
  var action = texto_(request.action || "ping");

  if (!validarToken_(request.token)) {
    return { ok: false, codigo: "TOKEN_INVALIDO", mensaje: "El token de sincronización no es válido." };
  }

  var sheet = obtenerHojaPrueba_(request.spreadsheetId);
  var remotos = listarRegistros_(sheet);

  if (action === "ping") {
    return {
      ok: true,
      mensaje: "Conexión correcta con Google Sheets.",
      hoja: SYNC_TEST_SHEET,
      registros: remotos.length,
      servidorEn: new Date().toISOString()
    };
  }

  if (action === "listar_test") {
    return {
      ok: true,
      hoja: SYNC_TEST_SHEET,
      registros: remotos,
      total: remotos.length
    };
  }

  var payload = request.payload || {};
  var locales = Array.isArray(payload.registros) ? payload.registros : [];

  if (action === "comparar_test") {
    return {
      ok: true,
      hoja: SYNC_TEST_SHEET,
      comparacion: compararListas_(locales, remotos),
      registros: remotos
    };
  }

  if (action === "sincronizar_test") {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      return { ok: false, codigo: "SYNC_OCUPADA", mensaje: "Ya existe otra sincronización en ejecución." };
    }

    try {
      remotos = listarRegistros_(sheet);
      var decisiones = compararListas_(locales, remotos);
      var enviados = 0;
      var conflictos = 0;

      decisiones.forEach(function (item) {
        if ((item.decision === "local_a_remoto" || item.decision === "crear_remoto") && item.local) {
          upsert_(sheet, item.local);
          enviados += 1;
        } else if (item.decision === "conflicto") {
          conflictos += 1;
        }
      });

      var finales = listarRegistros_(sheet);
      return {
        ok: true,
        mensaje: conflictos ? "Sincronización terminada con conflictos." : "Sincronización de prueba terminada correctamente.",
        hoja: SYNC_TEST_SHEET,
        enviados: enviados,
        conflictos: conflictos,
        decisiones: decisiones,
        registros: finales,
        servidorEn: new Date().toISOString()
      };
    } finally {
      lock.releaseLock();
    }
  }

  return { ok: false, codigo: "ACCION_NO_VALIDA", mensaje: "La acción solicitada no existe." };
}

function doGet(e) {
  try {
    return json_(ejecutar_(e && e.parameter || {}));
  } catch (error) {
    return json_({ ok: false, mensaje: error && error.message ? error.message : String(error) });
  }
}

function doPost(e) {
  try {
    return json_(ejecutar_(leerRequest_(e)));
  } catch (error) {
    return json_({ ok: false, mensaje: error && error.message ? error.message : String(error) });
  }
}

function ejecutarPruebaLocal() {
  var resultado = ejecutar_({
    action: "ping",
    token: propiedades_().getProperty("SYNC_TOKEN") || ""
  });
  Logger.log(JSON.stringify(resultado));
  return resultado;
}