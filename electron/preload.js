/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /Curriculo/electron/preload.js
Función o funciones:
- Exponer funciones seguras desde Electron hacia las pantallas HTML.
- Permitir navegación interna a Inicio, Subir ZIP, BDLocal y Comunicados.
- Permitir consultar información y diagnóstico del puente de PDF.
- Permitir abrir enlaces externos y la carpeta Descargas.
- Permitir guardar PDF directamente en Descargas desde Comunicados.
- Permitir guardar lotes de comunicados como PDF independientes dentro de un ZIP.
- Permitir mostrar el PDF generado en el Explorador de archivos.
- Mantener nodeIntegration apagado para mayor seguridad.
========================================================= */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const BRIDGE_VERSION = "2.1.0";

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

function normalizarPayloadComunicadosZIP(payload) {
  payload = payload || {};

  const documentos = Array.isArray(payload.documentos)
    ? payload.documentos.slice(0, 500)
    : [];

  return {
    nombreArchivo: textoSeguro(payload.nombreArchivo || "Comunicados.zip"),
    documentos: documentos.map(function (documento) {
      documento = documento || {};

      return {
        html: textoSeguro(documento.html),
        titulo: textoSeguro(documento.titulo || "Comunicado institucional"),
        nombreArchivo: textoSeguro(documento.nombreArchivo || "Comunicado.pdf")
      };
    })
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

async function invocar(canal, payload) {
  try {
    return await ipcRenderer.invoke(canal, payload);
  } catch (error) {
    return {
      ok: false,
      mensaje: error && error.message ? error.message : "No se pudo comunicar con Electron.",
      canal: canal
    };
  }
}

contextBridge.exposeInMainWorld("CurriculoElectron", {
  isElectron: true,
  bridgeVersion: BRIDGE_VERSION,

  getAppInfo: async function () {
    return await invocar("curriculo:get-app-info");
  },

  diagnosticarPDF: async function () {
    return await invocar("curriculo:diagnostico-pdf");
  },

  navigate: async function (ruta) {
    return await invocar("curriculo:navigate", normalizarRuta(ruta));
  },

  openExternal: async function (url) {
    return await invocar("curriculo:open-external", textoSeguro(url));
  },

  openDownloads: async function () {
    return await invocar("curriculo:open-downloads");
  },

  mostrarArchivo: async function (rutaArchivo) {
    return await invocar("curriculo:show-item-in-folder", textoSeguro(rutaArchivo));
  },

  guardarPDFEnDescargas: async function (payload) {
    return await invocar(
      "curriculo:guardar-pdf-descargas",
      normalizarPayloadPDF(payload)
    );
  },

  guardarComunicadosZIP: async function (payload) {
    return await invocar(
      "curriculo:guardar-comunicados-zip",
      normalizarPayloadComunicadosZIP(payload)
    );
  },

  guardarArchivoEnDescargas: async function (payload) {
    return await invocar(
      "curriculo:guardar-archivo-descargas",
      normalizarPayloadArchivo(payload)
    );
  }
});

window.addEventListener("DOMContentLoaded", function () {
  try {
    document.documentElement.setAttribute("data-runtime", "electron");
    document.documentElement.setAttribute("data-electron-bridge", BRIDGE_VERSION);
  } catch (error) {
    // No bloquear la app si el DOM aún no está listo.
  }
});
