/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /Curriculo/electron/main.js
Función o funciones:
- Crear la ventana principal de la app Curriculo en Electron.
- Cargar las pantallas internas: Inicio, Subir ZIP, BDLocal y Comunicados.
- Exponer IPC seguros para navegación interna y enlaces externos.
- Generar PDF desde HTML usando printToPDF.
- Guardar los PDF directamente en la carpeta Descargas sin pedir ubicación.
========================================================= */

"use strict";

const path = require("path");
const fs = require("fs");
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu
} = require("electron");

const APP_NAME = "Curriculo";
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
    if (!mainWindow) return;
    mainWindow.show();
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  mainWindow.loadFile(RUTAS.inicio);
}

function navegar(nombreRuta) {
  if (!mainWindow) {
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

  mainWindow.loadFile(rutaArchivo);

  return {
    ok: true,
    ruta: clave,
    archivo: rutaArchivo
  };
}

function limpiarNombreArchivo(valor) {
  return String(valor || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_")
    .slice(0, 140) || "archivo";
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
  const baseHref = "file:///" + carpetaBase.replace(/\\/g, "/").replace(/\/?$/, "/");

  if (/<base\s/i.test(html)) {
    return html;
  }

  if (/<head>/i.test(html)) {
    return html.replace(/<head>/i, '<head><base href="' + baseHref + '">');
  }

  return '<base href="' + baseHref + '">' + html;
}

async function esperarImagenes(webContents) {
  await webContents.executeJavaScript(`
    new Promise(function(resolve) {
      try {
        var imgs = Array.prototype.slice.call(document.images || []);

        if (!imgs.length) {
          setTimeout(resolve, 350);
          return;
        }

        var pendientes = imgs.length;

        function listo() {
          pendientes -= 1;

          if (pendientes <= 0) {
            setTimeout(resolve, 350);
          }
        }

        imgs.forEach(function(img) {
          if (img.complete) {
            listo();
          } else {
            img.onload = listo;
            img.onerror = listo;
          }
        });

        setTimeout(resolve, 2200);
      } catch (error) {
        setTimeout(resolve, 500);
      }
    });
  `);
}

async function guardarPDFEnDescargas(payload) {
  payload = payload || {};

  let pdfWindow = null;

  try {
    const htmlOriginal = String(payload.html || "").trim();

    if (!htmlOriginal) {
      return {
        ok: false,
        mensaje: "No se recibió HTML para generar el PDF."
      };
    }

    const nombreArchivo = asegurarExtension(payload.nombreArchivo || "comunicado.pdf", ".pdf");
    const carpetaDescargas = app.getPath("downloads");
    const rutaFinal = obtenerRutaUnica(carpetaDescargas, nombreArchivo);

    const carpetaBaseComunicados = path.join(ROOT_DIR, "comunicados");
    const htmlFinal = insertarBaseHref(htmlOriginal, carpetaBaseComunicados);

    pdfWindow = new BrowserWindow({
      show: false,
      width: 1240,
      height: 1754,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false
      }
    });

    await pdfWindow.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(htmlFinal)
    );

    await esperarImagenes(pdfWindow.webContents);

    const buffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "A4",
      preferCSSPageSize: true,
      marginsType: 0
    });

    fs.writeFileSync(rutaFinal, buffer);

    return {
      ok: true,
      nombreArchivo: path.basename(rutaFinal),
      ruta: rutaFinal,
      carpeta: carpetaDescargas,
      mensaje: "PDF generado directamente en Descargas."
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: error && error.message ? error.message : "Error generando PDF directo en Descargas."
    };
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
  }
}

async function guardarArchivoEnDescargas(payload) {
  payload = payload || {};

  try {
    const contenido = String(payload.contenido || "");
    const extension = String(payload.extension || ".txt");
    const nombreArchivo = asegurarExtension(payload.nombreArchivo || "archivo" + extension, extension);
    const carpetaDescargas = app.getPath("downloads");
    const rutaFinal = obtenerRutaUnica(carpetaDescargas, nombreArchivo);

    fs.writeFileSync(rutaFinal, contenido, "utf8");

    return {
      ok: true,
      nombreArchivo: path.basename(rutaFinal),
      ruta: rutaFinal,
      carpeta: carpetaDescargas,
      mensaje: "Archivo generado directamente en Descargas."
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: error && error.message ? error.message : "Error guardando archivo en Descargas."
    };
  }
}

function configurarIPC() {
  ipcMain.handle("curriculo:get-app-info", async function () {
    return {
      ok: true,
      appName: APP_NAME,
      version: app.getVersion(),
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

  ipcMain.handle("curriculo:navigate", async function (_event, nombreRuta) {
    return navegar(nombreRuta);
  });

  ipcMain.handle("curriculo:open-external", async function (_event, url) {
    const safeUrl = String(url || "").trim();

    if (!/^https?:\/\//i.test(safeUrl)) {
      return {
        ok: false,
        mensaje: "URL externa no permitida."
      };
    }

    await shell.openExternal(safeUrl);

    return {
      ok: true
    };
  });

  ipcMain.handle("curriculo:open-downloads", async function () {
    const carpetaDescargas = app.getPath("downloads");
    const resultado = await shell.openPath(carpetaDescargas);

    return {
      ok: !resultado,
      carpeta: carpetaDescargas,
      mensaje: resultado || "Carpeta Descargas abierta."
    };
  });

  ipcMain.handle("curriculo:guardar-pdf-descargas", async function (_event, payload) {
    return await guardarPDFEnDescargas(payload);
  });

  ipcMain.handle("curriculo:guardar-archivo-descargas", async function (_event, payload) {
    return await guardarArchivoEnDescargas(payload);
  });
}

function crearMenuNativo() {
  const template = [
    {
      label: "Archivo",
      submenu: [
        {
          label: "Inicio",
          click: function () {
            navegar("inicio");
          }
        },
        {
          label: "Subir ZIP",
          click: function () {
            navegar("subir");
          }
        },
        {
          label: "BDLocal",
          click: function () {
            navegar("bdlocal");
          }
        },
        {
          label: "Comunicados",
          click: function () {
            navegar("comunicados");
          }
        },
        { type: "separator" },
        {
          label: "Abrir Descargas",
          click: function () {
            shell.openPath(app.getPath("downloads"));
          }
        },
        { type: "separator" },
        {
          label: "Salir",
          role: "quit"
        }
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
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

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