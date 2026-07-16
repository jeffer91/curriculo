/* =========================================================
Nombre completo: Code.gs
Ruta: /Curriculo/apps-script/Code.gs
Funciones:
- Crear el endpoint de prueba de sincronización para Google Apps Script.
- Trabajar únicamente con la hoja 99_SYNC_TEST.
- Comparar versiones, fechas y hashes sin tocar datos curriculares reales.
- Devolver siempre respuestas JSON.
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

function obtenerHojaPrueba_(spreadsheetId) {
  var ss = obtenerSpreadsheet_(spreadsheetId);
  var sheet = ss.getSheetByName(SYNC_TEST_SHEET);
  if (!sheet) sheet = ss.insertSheet(SYNC_TEST_SHEET);

  var encabezadosActuales = [];
  if (sheet.getLastColumn() > 0) {
    encabezadosActuales = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  }

  if (encabezadosActuales.join("|") !== SYNC_TEST_HEADERS.join("|")) {
    sheet.clear();
    sheet.getRange(1, 1, 1, SYNC_TEST_HEADERS.length).setValues([SYNC_TEST_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SYNC_TEST_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#0b2447")
      .setFontColor("#ffffff");
    sheet.autoResizeColumns(1, SYNC_TEST_HEADERS.length);
  }

  return sheet;
}

function filaARegistro_(row) {
  var registro = {};
  SYNC_TEST_HEADERS.forEach(function (header, index) {
    registro[header] = row[index];
  });
  registro.id = texto_(registro.id);
  registro.version = numero_(registro.version);
  registro.actualizadoEn = texto_(registro.actualizadoEn);
  registro.hash = texto_(registro.hash);
  registro.activo = String(registro.activo).toLowerCase() !== "false";
  return registro;
}

function registroAFila_(registro) {
  return SYNC_TEST_HEADERS.map(function (header) {
    if (header === "version") return numero_(registro[header]);
    if (header === "activo") return registro[header] !== false;
    return registro[header] === null || typeof registro[header] === "undefined" ? "" : registro[header];
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
    if (registro && texto_(registro.id)) map[texto_(registro.id)] = registro;
  });
  return map;
}

function compararRegistro_(local, remoto) {
  if (!local && !remoto) return { decision: "sin_datos", ganador: "ninguno" };
  if (local && !remoto) return { decision: "crear_remoto", ganador: "local" };
  if (!local && remoto) return { decision: "crear_local", ganador: "remoto" };

  var versionLocal = numero_(local.version);
  var versionRemota = numero_(remoto.version);

  if (versionLocal > versionRemota) return { decision: "local_a_remoto", ganador: "local" };
  if (versionRemota > versionLocal) return { decision: "remoto_a_local", ganador: "remoto" };

  var fechaLocal = fechaNumero_(local.actualizadoEn);
  var fechaRemota = fechaNumero_(remoto.actualizadoEn);

  if (fechaLocal > fechaRemota) return { decision: "local_a_remoto", ganador: "local" };
  if (fechaRemota > fechaLocal) return { decision: "remoto_a_local", ganador: "remoto" };

  if (texto_(local.hash) === texto_(remoto.hash)) return { decision: "igual", ganador: "ambos" };
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
  var lastRow = sheet.getLastRow();
  var rowNumber = -1;

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i += 1) {
      if (texto_(ids[i][0]) === texto_(registro.id)) {
        rowNumber = i + 2;
        break;
      }
    }
  }

  var nuevo = Object.assign({}, registro, {
    sincronizadoEn: new Date().toISOString()
  });
  var fila = registroAFila_(nuevo);

  if (rowNumber === -1) {
    sheet.appendRow(fila);
    rowNumber = sheet.getLastRow();
  } else {
    sheet.getRange(rowNumber, 1, 1, SYNC_TEST_HEADERS.length).setValues([fila]);
  }

  return nuevo;
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
    var comparacion = compararListas_(locales, remotos);
    return {
      ok: true,
      hoja: SYNC_TEST_SHEET,
      comparacion: comparacion,
      registros: remotos
    };
  }

  if (action === "sincronizar_test") {
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
  }

  return { ok: false, codigo: "ACCION_NO_VALIDA", mensaje: "La acción solicitada no existe." };
}

function doGet(e) {
  try {
    return json_(ejecut_(e && e.parameter || {}));
  } catch (error) {
    return json_({ ok: false, mensaje: error && error.message ? error.message : String(error) });
  }
}

function doPost(e) {
  try {
    return json_(ejecut_(leerRequest_(e)));
  } catch (error) {
    return json_({ ok: false, mensaje: error && error.message ? error.message : String(error) });
  }
}

function ejecutarPruebaLocal() {
  var resultado = ejecutar_({ action: "ping", token: propiedades_().getProperty("SYNC_TOKEN") || "" });
  Logger.log(JSON.stringify(resultado));
  return resultado;
}