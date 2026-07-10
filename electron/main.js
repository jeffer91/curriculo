/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /Curriculo/electron/main.js
Función o funciones:
- Crear la ventana principal de la app Curriculo en Electron.
- Cargar las pantallas internas: Inicio, Subir ZIP, BDLocal y Comunicados.
- Exponer IPC seguros para navegación interna, enlaces externos y archivos.
- Generar PDF desde HTML usando una ventana temporal y printToPDF.
- Guardar y verificar los PDF directamente en la carpeta Descargas.
- Mostrar en el Explorador de archivos el PDF generado.
========================================================= */

"use strict";

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu
} = require("electron");

const APP_NAME = "Curriculo";
const PDF_BRIDGE_VERSION = "2.0.0";
const ROOT_DIR = path.resolve(__dirname, "..");
const PRELOAD_PATH = path.join(__dirname, "preload.js");

const RUTAS = Object.freeze({
  inicio: path.join(ROOT_DIR, "index.html"),
  subir: path.join(ROOT_DIR, "subir", "subir.html"),
  bdlocal: path.join(ROOT_DIR, "bdlocal", "bdlocal.html"),
  comunicados: path.join(ROOT_DIR, "comunicados", "comunicados.html")
});

let mainWindow = null;

function normalizarRuta(nombreRuta) {
  const clave = String(nombreRuta || "inicio").trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(RUTAS, clave)) {
    return "inicio";
  }

  return clave;
}

function archivoExiste(rutaArchivo) {
  try {
    return fs.existsSync(rutaArchivo);
  } catch (error) {
    return false;
  }
}

function crearVentanaPrincipal() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#f4f7fb",
    autoHideMenuBar: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.once("ready-to-show", function () {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  mainWindow.loadFile(RUTAS.inicio).catch(function (error) {
    console.error("[Curriculo] No se pudo abrir la pantalla inicial:", error);
  });
}

async function navegar(nombreRuta) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      ok: false,
      mensaje: "La ventana principal no está disponible."
    };
  }

  const clave = normalizarRuta(nombreRuta);
  const rutaArchivo = RUTAS[clave];

  if (!archivoExiste(rutaArchivo)) {
    return {
      ok: false,
      ruta: clave,
      archivo: rutaArchivo,
      mensaje: "No existe el archivo de la pantalla solicitada."
    };
  }

  try {
    await mainWindow.loadFile(rutaArchivo);

    return {
      ok: true,
      ruta: clave,
      archivo: rutaArchivo
    };
  } catch (error) {
    return {
      ok: false,
      ruta: clave,
      archivo: rutaArchivo,
      mensaje: error && error.message ? error.message : "No se pudo abrir la pantalla."
    };
  }
}

function limpiarNombreArchivo(valor) {
  return String(valor || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/[^\w\s.()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_")
    .replace(/\.+$/g, "")
    .slice(0, 150) || "archivo";
}

function asegurarExtension(nombreArchivo, extension) {
  const ext = String(extension || ".pdf").startsWith(".")
    ? String(extension || ".pdf")
    : "." + String(extension || "pdf");

  let nombre = limpiarNombreArchivo(nombreArchivo || "archivo" + ext);

  if (!nombre.toLowerCase().endsWith(ext.toLowerCase())) {
    nombre += ext;
  }

  return nombre;
}

function obtenerRutaUnica(carpeta, nombreArchivo) {
  const extension = path.extname(nombreArchivo) || ".pdf";
  const base = path.basename(nombreArchivo, extension);

  let rutaFinal = path.join(carpeta, nombreArchivo);
  let contador = 1;

  while (fs.existsSync(rutaFinal)) {
    rutaFinal = path.join(carpeta, base + "_" + contador + extension);
    contador += 1;
  }

  return rutaFinal;
}

function insertarBaseHref(html, carpetaBase) {
  const baseHref = pathToFileURL(carpetaBase + path.sep).href;

  if (/<base\s/i.test(html)) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1><base href="' + baseHref + '">');
  }

  return '<base href="' + baseHref + '">' + html;
}

function crearRutaTemporalHTML() {
  const carpeta = path.join(app.getPath("temp"), "curriculo-pdf");
  fs.mkdirSync(carpeta, { recursive: true });

  const nombre = [
    "comunicado",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10)
  ].join("_") + ".html";

  return path.join(carpeta, nombre);
}

async function eliminarTemporalSeguro(rutaArchivo) {
  if (!rutaArchivo) return;

  try {
    await fs.promises.unlink(rutaArchivo);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("[Curriculo PDF] No se pudo eliminar el HTML temporal:", error);
    }
  }
}

async function esperarDocumentoListo(webContents) {
  await webContents.executeJavaScript(`
    (async function () {
      function pausa(ms) {
        return new Promise(function (resolve) {
          setTimeout(resolve, ms);
        });
      }

      try {
        if (document.fonts && document.fonts.ready) {
          await Promise.race([document.fonts.ready, pausa(3000)]);
        }

        var imagenes = Array.prototype.slice.call(document.images || []);

        await Promise.all(imagenes.map(function (img) {
          if (img.complete) return Promise.resolve();

          return Promise.race([
            new Promise(function (resolve) {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
            pausa(3500)
          ]);
        }));

        await pausa(250);
        return {
          ok: true,
          imagenes: imagenes.length,
          titulo: document.title || ""
        };
      } catch (error) {
        await pausa(250);
        return {
          ok: false,
          mensaje: error && error.message ? error.message : String(error)
        };
      }
    })();
  `, true);
}

function validarBufferPDF(buffer) {
  if (!buffer || typeof buffer.length !== "number" || buffer.length < 100) {
    throw new Error("Electron devolvió un PDF vacío o incompleto.");
  }

  const cabecera = Buffer.from(buffer).subarray(0, 5).toString("ascii");

  if (cabecera !== "%PDF-") {
    throw new Error("El archivo generado no tiene una cabecera PDF válida.");
  }
}

async function guardarPDFEnDescargas(payload) {
  payload = payload || {};

  let pdfWindow = null;
  let rutaTemporal = "";

  try {
    const htmlOriginal = String(payload.html || "").trim();

    if (!htmlOriginal) {
      return {
        ok: false,
        codigo: "HTML_VACIO",
        mensaje: "No se recibió HTML para generar el PDF."
      };
    }

    const nombreArchivo = asegurarExtension(payload.nombreArchivo || "comunicado.pdf", ".pdf");
    const carpetaDescargas = app.getPath("downloads");

    await fs.promises.mkdir(carpetaDescargas, { recursive: true });

    const rutaFinal = obtenerRutaUnica(carpetaDescargas, nombreArchivo);
    const carpetaBaseComunicados = path.join(ROOT_DIR, "comunicados");
    const htmlFinal = insertarBaseHref(htmlOriginal, carpetaBaseComunicados);

    rutaTemporal = crearRutaTemporalHTML();
    await fs.promises.writeFile(rutaTemporal, htmlFinal, "utf8");

    pdfWindow = new BrowserWindow({
      show: false,
      width: 1240,
      height: 1754,
      backgroundColor: "#ffffff",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        backgroundThrottling: false
      }
    });

    pdfWindow.webContents.setWindowOpenHandler(function () {
      return { action: "deny" };
    });

    await pdfWindow.loadFile(rutaTemporal);
    await esperarDocumentoListo(pdfWindow.webContents);

    const buffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "A4",
      preferCSSPageSize: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    validarBufferPDF(buffer);
    await fs.promises.writeFile(rutaFinal, buffer);

    const info = await fs.promises.stat(rutaFinal);

    if (!info.isFile() || info.size < 100) {
      throw new Error("El PDF fue creado, pero el archivo quedó vacío.");
    }

    return {
      ok: true,
      modo: "electron",
      nombreArchivo: path.basename(rutaFinal),
      ruta: rutaFinal,
      carpeta: carpetaDescargas,
      bytes: info.size,
      bridgeVersion: PDF_BRIDGE_VERSION,
      mensaje: "PDF generado y verificado correctamente en Descargas."
    };
  } catch (error) {
    console.error("[Curriculo PDF] Error generando PDF:", error);

    return {
      ok: false,
      codigo: error && error.code ? error.code : "ERROR_PDF",
      mensaje: error && error.message ? error.message : "Error generando PDF directo en Descargas."
    };
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }

    await eliminarTemporalSeguro(rutaTemporal);
  }
}

async function guardarArchivoEnDescargas(payload) {
  payload = payload || {};

  try {
    const contenido = String(payload.contenido || "");
    const extension = String(payload.extension || ".txt");
    const nombreArchivo = asegurarExtension(payload.nombreArchivo || "archivo" + extension, extension);
    const carpetaDescargas = app.getPath("downloads");

    await fs.promises.mkdir(carpetaDescargas, { recursive: true });

    const rutaFinal = obtenerRutaUnica(carpetaDescargas, nombreArchivo);
    await fs.promises.writeFile(rutaFinal, contenido, "utf8");

    const info = await fs.promises.stat(rutaFinal);

    return {
      ok: true,
      nombreArchivo: path.basename(rutaFinal),
      ruta: rutaFinal,
      carpeta: carpetaDescargas,
      bytes: info.size,
      mensaje: "Archivo generado directamente en Descargas."
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: error && error.message ? error.message : "Error guardando archivo en Descargas."
    };
  }
}

function registrarHandler(canal, handler) {
  try {
    ipcMain.removeHandler(canal);
  } catch (error) {
    // No había un handler anterior.
  }

  ipcMain.handle(canal, handler);
}

function configurarIPC() {
  registrarHandler("curriculo:get-app-info", async function () {
    return {
      ok: true,
      appName: APP_NAME,
      version: app.getVersion(),
      bridgeVersion: PDF_BRIDGE_VERSION,
      rootDir: ROOT_DIR,
      downloadsDir: app.getPath("downloads"),
      isPackaged: app.isPackaged,
      platform: process.platform,
      rutas: {
        inicio: RUTAS.inicio,
        subir: RUTAS.subir,
        bdlocal: RUTAS.bdlocal,
        comunicados: RUTAS.comunicados
      }
    };
  });

  registrarHandler("curriculo:navigate", async function (_event, nombreRuta) {
    return await navegar(nombreRuta);
  });

  registrarHandler("curriculo:open-external", async function (_event, url) {
    const safeUrl = String(url || "").trim();

    if (!/^https?:\/\//i.test(safeUrl)) {
      return {
        ok: false,
        mensaje: "URL externa no permitida."
      };
    }

    await shell.openExternal(safeUrl);

    return { ok: true };
  });

  registrarHandler("curriculo:open-downloads", async function () {
    const carpetaDescargas = app.getPath("downloads");
    const resultado = await shell.openPath(carpetaDescargas);

    return {
      ok: !resultado,
      carpeta: carpetaDescargas,
      mensaje: resultado || "Carpeta Descargas abierta."
    };
  });

  registrarHandler("curriculo:show-item-in-folder", async function (_event, rutaArchivo) {
    const ruta = String(rutaArchivo || "").trim();

    if (!ruta || !path.isAbsolute(ruta) || !archivoExiste(ruta)) {
      return {
        ok: false,
        mensaje: "El archivo no existe o la ruta no es válida."
      };
    }

    shell.showItemInFolder(ruta);

    return {
      ok: true,
      ruta: ruta
    };
  });

  registrarHandler("curriculo:diagnostico-pdf", async function () {
    return {
      ok: true,
      bridgeVersion: PDF_BRIDGE_VERSION,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      downloadsDir: app.getPath("downloads"),
      printToPDFDisponible: !!(
        BrowserWindow &&
        BrowserWindow.prototype
      )
    };
  });

  registrarHandler("curriculo:guardar-pdf-descargas", async function (_event, payload) {
    return await guardarPDFEnDescargas(payload);
  });

  registrarHandler("curriculo:guardar-archivo-descargas", async function (_event, payload) {
    return await guardarArchivoEnDescargas(payload);
  });
}

function crearMenuNativo() {
  const template = [
    {
      label: "Archivo",
      submenu: [
        { label: "Inicio", click: function () { navegar("inicio"); } },
        { label: "Subir ZIP", click: function () { navegar("subir"); } },
        { label: "BDLocal", click: function () { navegar("bdlocal"); } },
        { label: "Comunicados", click: function () { navegar("comunicados"); } },
        { type: "separator" },
        {
          label: "Abrir Descargas",
          click: function () {
            shell.openPath(app.getPath("downloads"));
          }
        },
        { type: "separator" },
        { label: "Salir", role: "quit" }
      ]
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recargar" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo" },
        { type: "separator" },
        { role: "resetZoom", label: "Tamaño normal" },
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function configurarSingleInstance() {
  const gotLock = app.requestSingleInstanceLock();

  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on("second-instance", function () {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  return true;
}

function configurarApp() {
  app.name = APP_NAME;

  app.whenReady().then(function () {
    configurarIPC();
    crearMenuNativo();
    crearVentanaPrincipal();

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        crearVentanaPrincipal();
      }
    });
  }).catch(function (error) {
    console.error("[Curriculo] Error iniciando Electron:", error);
    app.quit();
  });

  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

if (configurarSingleInstance()) {
  configurarApp();
}
