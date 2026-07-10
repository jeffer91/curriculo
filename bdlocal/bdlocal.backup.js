/* =========================================================
Nombre completo: bdlocal.backup.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.backup.js
Función o funciones:
- Exportar toda la base local CCC en formato JSON.
- Descargar respaldos locales con fecha y hora.
- Importar respaldos JSON previamente generados.
- Generar diagnóstico rápido de la base local.
- Servir como herramienta de seguridad antes y después de cargas ZIP.
========================================================= */

(function (window, document) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;
  var Core = NS.Core;

  if (!Schema) {
    console.error("[BDLocalCCC.Backup] Falta cargar primero bdlocal.schema.js");
    return;
  }

  if (!Core) {
    console.error("[BDLocalCCC.Backup] Falta cargar primero bdlocal.core.js");
    return;
  }

  function fechaArchivo() {
    var d = new Date();

    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");

    return yyyy + "-" + mm + "-" + dd + "_" + hh + "-" + mi + "-" + ss;
  }

  function crearNombreBackup(prefijo) {
    return String(prefijo || "backup-bdlocal-ccc") + "_" + fechaArchivo() + ".json";
  }

  function descargarBlob(blob, nombreArchivo) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    a.href = url;
    a.download = nombreArchivo;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a && a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 300);
  }

  function descargarJSON(data, nombreArchivo) {
    var contenido = JSON.stringify(data, null, 2);
    var blob = new Blob([contenido], {
      type: "application/json;charset=utf-8"
    });

    descargarBlob(blob, nombreArchivo);
  }

  async function exportarBackupJSON(opciones) {
    opciones = opciones || {};

    await Core.ready();

    var backup = await Core.exportarJSON();

    backup.tipo = "backup_bdlocal_ccc";
    backup.descripcion = "Respaldo completo de la base local de Gestión Curricular CCC";
    backup.generadoPor = "BDLocalCCC.Backup";
    backup.exportadoEn = Schema.fechaISO();

    if (opciones.incluirDiagnostico !== false) {
      backup.diagnostico = await Core.diagnostico();
    }

    return backup;
  }

  async function descargarBackup(opciones) {
    opciones = opciones || {};

    var backup = await exportarBackupJSON(opciones);
    var nombre = opciones.nombreArchivo || crearNombreBackup("backup-bdlocal-ccc");

    descargarJSON(backup, nombre);

    await Core.log({
      tipo: "backup",
      nivel: "info",
      mensaje: "Backup descargado correctamente.",
      detalle: {
        nombreArchivo: nombre,
        exportadoEn: backup.exportadoEn
      }
    });

    return {
      ok: true,
      nombreArchivo: nombre,
      backup: backup
    };
  }

  function leerArchivoComoTexto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = function () {
        reject(reader.error || new Error("No se pudo leer el archivo."));
      };

      reader.readAsText(file, "utf-8");
    });
  }

  function validarEstructuraBackup(data) {
    if (!data || typeof data !== "object") {
      throw new Error("El archivo no contiene un JSON válido.");
    }

    if (!data.stores || typeof data.stores !== "object") {
      throw new Error("El JSON no contiene la propiedad stores.");
    }

    var storesEsperados = Object.keys(Schema.STORES).map(function (key) {
      return Schema.STORES[key];
    });

    var encontrados = Object.keys(data.stores);
    var faltantes = storesEsperados.filter(function (storeName) {
      return encontrados.indexOf(storeName) === -1;
    });

    return {
      ok: true,
      storesEsperados: storesEsperados.length,
      storesEncontrados: encontrados.length,
      faltantes: faltantes
    };
  }

  async function importarBackupDesdeJSON(data, opciones) {
    opciones = opciones || {};

    await Core.ready();

    var validacion = validarEstructuraBackup(data);
    var stores = data.stores || {};
    var storeNames = Object.keys(stores);
    var resultado = {
      ok: true,
      importadoEn: Schema.fechaISO(),
      modo: opciones.limpiarAntes ? "limpiar_y_restaurar" : "fusionar",
      stores: {},
      validacion: validacion
    };

    if (opciones.limpiarAntes === true) {
      for (var c = 0; c < storeNames.length; c += 1) {
        await Core.clear(storeNames[c]);
      }
    }

    for (var i = 0; i < storeNames.length; i += 1) {
      var storeName = storeNames[i];
      var registros = Array.isArray(stores[storeName]) ? stores[storeName] : [];

      if (!registros.length) {
        resultado.stores[storeName] = {
          total: 0,
          guardados: 0
        };
        continue;
      }

      var res = await Core.bulkPut(storeName, registros);

      resultado.stores[storeName] = {
        total: res.total,
        guardados: res.guardados
      };
    }

    await Core.log({
      tipo: "backup",
      nivel: "info",
      mensaje: "Backup importado correctamente.",
      detalle: resultado
    });

    return resultado;
  }

  async function importarBackupDesdeArchivo(file, opciones) {
    if (!file) {
      throw new Error("No se recibió ningún archivo de respaldo.");
    }

    var texto = await leerArchivoComoTexto(file);
    var data = JSON.parse(texto);

    return await importarBackupDesdeJSON(data, opciones || {});
  }

  async function descargarDiagnostico() {
    await Core.ready();

    var diagnostico = await Core.diagnostico();

    diagnostico.tipo = "diagnostico_bdlocal_ccc";
    diagnostico.generadoPor = "BDLocalCCC.Backup";
    diagnostico.exportadoEn = Schema.fechaISO();

    var nombre = crearNombreBackup("diagnostico-bdlocal-ccc");

    descargarJSON(diagnostico, nombre);

    return {
      ok: true,
      nombreArchivo: nombre,
      diagnostico: diagnostico
    };
  }

  async function generarResumenBackup() {
    await Core.ready();

    var diagnostico = await Core.diagnostico();
    var resumen = {
      generadoEn: Schema.fechaISO(),
      nombreBD: Schema.DB_NAME,
      version: Schema.DB_VERSION,
      tablas: [],
      totalRegistros: 0
    };

    Object.keys(diagnostico.tablas || {}).forEach(function (storeName) {
      var item = diagnostico.tablas[storeName];
      var total = Number(item.total || 0);

      resumen.totalRegistros += total;

      resumen.tablas.push({
        tabla: storeName,
        estado: item.estado,
        total: total,
        mensaje: item.mensaje || ""
      });
    });

    return resumen;
  }

  NS.Backup = {
    exportarBackupJSON: exportarBackupJSON,
    descargarBackup: descargarBackup,
    importarBackupDesdeJSON: importarBackupDesdeJSON,
    importarBackupDesdeArchivo: importarBackupDesdeArchivo,
    descargarDiagnostico: descargarDiagnostico,
    generarResumenBackup: generarResumenBackup,
    validarEstructuraBackup: validarEstructuraBackup
  };

  NS.exportarBackupJSON = exportarBackupJSON;
  NS.descargarBackup = descargarBackup;
  NS.importarBackupDesdeArchivo = importarBackupDesdeArchivo;
  NS.descargarDiagnostico = descargarDiagnostico;
  NS.generarResumenBackup = generarResumenBackup;
})(window, document);