/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /Curriculo/electron/preload.js
Funciones:
- Exponer funciones seguras desde Electron hacia las pantallas HTML.
- Permitir navegación interna a Inicio, Subir ZIP, Firebase y Comunicados.
- Permitir consultar información y diagnóstico del puente de PDF.
- Permitir abrir enlaces externos y la carpeta Descargas.
- Permitir guardar PDF directamente en Descargas desde Comunicados.
- Permitir guardar lotes de comunicados como PDF independientes dentro de un ZIP.
- Permitir crear un ZIP general organizado en carpetas por carrera.
- Continuar el lote organizado cuando un PDF individual presenta errores.
- Reportar el progreso y las materias omitidas al módulo Comunicados.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { contextBridge, ipcRenderer } = require("electron");

const BRIDGE_VERSION = "2.3.0";

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

function limpiarNombreArchivo(valor, defecto) {
  return textoSeguro(valor || defecto || "archivo")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 180) || textoSeguro(defecto || "archivo");
}

function asegurarExtension(nombreArchivo, extension) {
  const ext = textoSeguro(extension || ".pdf").startsWith(".")
    ? textoSeguro(extension || ".pdf")
    : "." + textoSeguro(extension || "pdf");
  let nombre = limpiarNombreArchivo(nombreArchivo || "archivo" + ext, "archivo");
  if (!nombre.toLowerCase().endsWith(ext.toLowerCase())) nombre += ext;
  return nombre;
}

function obtenerRutaUnica(carpeta, nombreArchivo) {
  const extension = path.extname(nombreArchivo) || ".zip";
  const base = path.basename(nombreArchivo, extension);
  let ruta = path.join(carpeta, nombreArchivo);
  let contador = 1;

  while (fs.existsSync(ruta)) {
    ruta = path.join(carpeta, base + "_" + contador + extension);
    contador += 1;
  }

  return ruta;
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
        nombreArchivo: textoSeguro(documento.nombreArchivo || "Comunicado.pdf"),
        carpeta: textoSeguro(documento.carpeta || "Sin carrera"),
        referencia: textoSeguro(documento.referencia || "")
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

function reportarProgreso(callback, datos) {
  if (typeof callback !== "function") return;
  try {
    callback(Object.assign({}, datos || {}));
  } catch (error) {
    console.warn("[Curriculo ZIP] No se pudo reportar el progreso:", error);
  }
}

async function eliminarTemporal(rutaArchivo) {
  if (!rutaArchivo) return;
  try {
    await fs.promises.unlink(rutaArchivo);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("[Curriculo ZIP] No se pudo eliminar el PDF temporal:", error);
    }
  }
}

function crearReporteOmitidos(omitidos) {
  omitidos = Array.isArray(omitidos) ? omitidos : [];
  if (!omitidos.length) return "";

  return [
    "REPORTE DE COMUNICADOS OMITIDOS",
    "Generado: " + new Date().toLocaleString("es-EC"),
    "Total: " + omitidos.length,
    "",
    ...omitidos.map(function (item, indice) {
      return [
        String(indice + 1) + ". " + textoSeguro(item.carpeta || "Sin carrera") + " - " + textoSeguro(item.nombreArchivo || "Comunicado"),
        "   Motivo: " + textoSeguro(item.mensaje || "Error no identificado")
      ].join("\n");
    })
  ].join("\n");
}

async function guardarComunicadosZIPOrganizado(payload, onProgress) {
  const datos = normalizarPayloadComunicadosZIP(payload);
  const documentos = datos.documentos;
  const temporales = [];

  if (!documentos.length) {
    return { ok: false, codigo: "LOTE_VACIO", mensaje: "No se recibieron comunicados." };
  }

  try {
    const info = await invocar("curriculo:get-app-info");
    if (!info || info.ok !== true || !info.downloadsDir) {
      throw new Error("No se pudo localizar la carpeta Descargas.");
    }

    const zip = new JSZip();
    const nombresUsados = Object.create(null);
    const archivos = [];
    const omitidos = [];

    reportarProgreso(onProgress, {
      fase: "inicio",
      actual: 0,
      total: documentos.length,
      porcentaje: 0,
      titulo: "Generando PDF",
      mensaje: "Preparando " + documentos.length + " comunicados."
    });

    for (let i = 0; i < documentos.length; i += 1) {
      const documento = documentos[i];
      const carpetaSolicitada = limpiarNombreArchivo(documento.carpeta, "Sin carrera");
      const nombreSolicitado = asegurarExtension(
        documento.nombreArchivo || "Comunicado " + (i + 1) + ".pdf",
        ".pdf"
      );

      reportarProgreso(onProgress, {
        fase: "pdf",
        actual: i,
        total: documentos.length,
        porcentaje: Math.round((i / documentos.length) * 92),
        titulo: "Generando PDF",
        mensaje: "Archivo " + (i + 1) + " de " + documentos.length + ": " + nombreSolicitado
      });

      try {
        const resultadoPDF = await invocar(
          "curriculo:guardar-pdf-descargas",
          normalizarPayloadPDF(documento)
        );

        if (!resultadoPDF || resultadoPDF.ok !== true || !resultadoPDF.ruta) {
          throw new Error(
            resultadoPDF && resultadoPDF.mensaje
              ? resultadoPDF.mensaje
              : "No se pudo generar el comunicado."
          );
        }

        temporales.push(resultadoPDF.ruta);
        const buffer = await fs.promises.readFile(resultadoPDF.ruta);
        if (buffer.length < 100 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new Error("El PDF generado no es válido.");
        }

        const claveBase = carpetaSolicitada + "|" + nombreSolicitado.toLowerCase();
        let nombrePDF = nombreSolicitado;
        const repeticion = nombresUsados[claveBase] || 0;

        if (repeticion > 0) {
          const ext = path.extname(nombreSolicitado);
          const base = path.basename(nombreSolicitado, ext);
          nombrePDF = base + "_" + (repeticion + 1) + ext;
        }
        nombresUsados[claveBase] = repeticion + 1;

        zip.folder(carpetaSolicitada).file(nombrePDF, buffer, { binary: true });
        archivos.push({
          carpeta: carpetaSolicitada,
          nombreArchivo: nombrePDF,
          rutaZIP: carpetaSolicitada + "/" + nombrePDF,
          referencia: documento.referencia,
          bytes: buffer.length
        });
      } catch (error) {
        omitidos.push({
          carpeta: carpetaSolicitada,
          nombreArchivo: nombreSolicitado,
          referencia: documento.referencia,
          mensaje: error && error.message ? error.message : "No se pudo crear el PDF."
        });
      }

      reportarProgreso(onProgress, {
        fase: "pdf",
        actual: i + 1,
        total: documentos.length,
        porcentaje: Math.round(((i + 1) / documentos.length) * 92),
        titulo: "Generando PDF",
        mensaje: archivos.length + " creados y " + omitidos.length + " omitidos."
      });
    }

    if (!archivos.length) {
      const primerError = omitidos[0] && omitidos[0].mensaje
        ? omitidos[0].mensaje
        : "Ningún PDF pudo generarse.";
      throw new Error("No se pudo crear ningún comunicado. " + primerError);
    }

    const reporte = crearReporteOmitidos(omitidos);
    if (reporte) {
      zip.file("REPORTE DE OMITIDOS.txt", reporte);
    }

    reportarProgreso(onProgress, {
      fase: "zip",
      actual: archivos.length,
      total: documentos.length,
      porcentaje: 95,
      titulo: "Comprimiendo ZIP",
      mensaje: "Organizando " + archivos.length + " PDF por carrera."
    });

    const bufferZIP = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    if (!bufferZIP || bufferZIP.length < 100 || bufferZIP.subarray(0, 2).toString("ascii") !== "PK") {
      throw new Error("El ZIP generado está vacío o no es válido.");
    }

    await fs.promises.mkdir(info.downloadsDir, { recursive: true });
    const nombreZIP = asegurarExtension(datos.nombreArchivo || "Comunicados todas las carreras.zip", ".zip");
    const rutaZIP = obtenerRutaUnica(info.downloadsDir, nombreZIP);
    await fs.promises.writeFile(rutaZIP, bufferZIP);
    const estadistica = await fs.promises.stat(rutaZIP);

    if (!estadistica.isFile() || estadistica.size < 100) {
      throw new Error("El ZIP fue creado, pero quedó vacío.");
    }

    reportarProgreso(onProgress, {
      fase: "fin",
      actual: archivos.length,
      total: documentos.length,
      porcentaje: 100,
      titulo: "ZIP listo",
      mensaje: archivos.length + " PDF guardados y " + omitidos.length + " omitidos."
    });

    return {
      ok: true,
      modo: "electron",
      nombreArchivo: path.basename(rutaZIP),
      ruta: rutaZIP,
      carpeta: info.downloadsDir,
      bytes: estadistica.size,
      cantidad: archivos.length,
      archivos: archivos,
      omitidos: omitidos,
      bridgeVersion: BRIDGE_VERSION,
      mensaje: omitidos.length
        ? "ZIP generado con los comunicados válidos y un reporte de omitidos."
        : "ZIP organizado por carreras generado correctamente."
    };
  } catch (error) {
    console.error("[Curriculo ZIP] Error generando ZIP organizado:", error);
    reportarProgreso(onProgress, {
      fase: "error",
      porcentaje: 100,
      titulo: "No se pudo completar",
      mensaje: error && error.message ? error.message : "No se pudo generar el ZIP organizado."
    });
    return {
      ok: false,
      codigo: error && error.code ? error.code : "ERROR_ZIP_ORGANIZADO",
      mensaje: error && error.message ? error.message : "No se pudo generar el ZIP organizado."
    };
  } finally {
    for (let i = 0; i < temporales.length; i += 1) {
      await eliminarTemporal(temporales[i]);
    }
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

  guardarComunicadosZIPOrganizado: async function (payload, onProgress) {
    return await guardarComunicadosZIPOrganizado(
      payload,
      typeof onProgress === "function" ? onProgress : null
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
