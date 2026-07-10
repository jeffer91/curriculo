/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /Curriculo/electron/preload.js
Función o funciones:
- Exponer funciones seguras desde Electron hacia las pantallas HTML.
- Permitir navegación interna a Inicio, Subir ZIP, BDLocal y Comunicados.
- Permitir consultar información básica de la app.
- Permitir abrir enlaces externos de forma controlada.
- Permitir guardar PDF directamente en Descargas desde Comunicados.
- Mantener nodeIntegration apagado para mayor seguridad.
========================================================= */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const RUTAS_PERMITIDAS = Object.freeze({
  inicio: true,
  subir: true,
  bdlocal: true,
  comunicados: true
});

function normalizarRuta(ruta) {
  const clave = String(ruta || "inicio").trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(RUTAS_PERMITIDAS, clave)) {
    return "inicio";
  }

  return clave;
}

function textoSeguro(valor) {
  return String(valor === null || typeof valor === "undefined" ? "" : valor);
}

function normalizarPayloadPDF(payload) {
  payload = payload || {};

  return {
    html: textoSeguro(payload.html),
    titulo: textoSeguro(payload.titulo || "Comunicado institucional"),
    nombreArchivo: textoSeguro(payload.nombreArchivo || "comunicado.pdf")
  };
}

function normalizarPayloadArchivo(payload) {
  payload = payload || {};

  return {
    contenido: textoSeguro(payload.contenido),
    nombreArchivo: textoSeguro(payload.nombreArchivo || "archivo.txt"),
    extension: textoSeguro(payload.extension || ".txt")
  };
}

contextBridge.exposeInMainWorld("CurriculoElectron", {
  isElectron: true,

  getAppInfo: async function () {
    return await ipcRenderer.invoke("curriculo:get-app-info");
  },

  navigate: async function (ruta) {
    return await ipcRenderer.invoke("curriculo:navigate", normalizarRuta(ruta));
  },

  openExternal: async function (url) {
    return await ipcRenderer.invoke("curriculo:open-external", textoSeguro(url));
  },

  openDownloads: async function () {
    return await ipcRenderer.invoke("curriculo:open-downloads");
  },

  guardarPDFEnDescargas: async function (payload) {
    return await ipcRenderer.invoke(
      "curriculo:guardar-pdf-descargas",
      normalizarPayloadPDF(payload)
    );
  },

  guardarArchivoEnDescargas: async function (payload) {
    return await ipcRenderer.invoke(
      "curriculo:guardar-archivo-descargas",
      normalizarPayloadArchivo(payload)
    );
  }
});

window.addEventListener("DOMContentLoaded", function () {
  try {
    document.documentElement.setAttribute("data-runtime", "electron");
  } catch (error) {
    // No bloquear la app si el DOM aún no está listo.
  }
});