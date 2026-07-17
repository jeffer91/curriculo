"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

async function ejecutar() {
  let payloadPDF = null;
  let payloadZIP = null;

  const electron = {
    isElectron: true,
    bridgeVersion: "2.1.0",
    async diagnosticarPDF() {
      return { ok: true, bridgeVersion: "2.1.0" };
    },
    async guardarPDFEnDescargas(payload) {
      payloadPDF = payload;
      return {
        ok: true,
        nombreArchivo: payload.nombreArchivo,
        ruta: "C:/Descargas/" + payload.nombreArchivo,
        bytes: 1500
      };
    },
    async guardarComunicadosZIP(payload) {
      payloadZIP = payload;
      return {
        ok: true,
        nombreArchivo: payload.nombreArchivo,
        ruta: "C:/Descargas/" + payload.nombreArchivo,
        bytes: 5000,
        cantidad: payload.documentos.length,
        archivos: payload.documentos.map(function (documento) {
          return { nombreArchivo: documento.nombreArchivo, bytes: 1500 };
        })
      };
    },
    async mostrarArchivo() {
      return { ok: true };
    }
  };

  const context = {
    window: {
      ComunicadosCCC: {},
      CurriculoElectron: electron
    },
    document: {},
    navigator: { userAgent: "prueba" },
    console,
    setTimeout,
    clearTimeout
  };

  vm.createContext(context);
  vm.runInContext(leer("comunicados/comunicados.pdf.js"), context, {
    filename: "comunicados.pdf.js"
  });
  vm.runInContext(leer("comunicados/comunicados.portada-final.js"), context, {
    filename: "comunicados.portada-final.js"
  });

  const PDF = context.window.ComunicadosCCC.PDF;
  const documentos = [
    {
      numeroComunicado: "COM-ITSQMET-UGPA-2026-07-15",
      nombreAsignatura: "Contabilidad General",
      data: {
        materiaId: "materia_1",
        numeroComunicado: "COM-ITSQMET-UGPA-2026-07-15",
        nombreAsignatura: "Contabilidad General",
        carrera: "Contabilidad"
      },
      html: '<article class="com-pdf-page" data-materia-id="materia_1">Contenido 1</article>'
    },
    {
      numeroComunicado: "COM-ITSQMET-UGPA-2026-07-16",
      nombreAsignatura: "Legislación Tributaria",
      data: {
        materiaId: "materia_2",
        numeroComunicado: "COM-ITSQMET-UGPA-2026-07-16",
        nombreAsignatura: "Legislación Tributaria",
        carrera: "Contabilidad"
      },
      html: '<article class="com-pdf-page" data-materia-id="materia_2">Contenido 2</article>'
    }
  ];

  assert.strictEqual(
    PDF.nombreArchivoComunicado(documentos[0]),
    "Comunicado No. 01 COM-ITSQMET-UGPA-2026-07-15 Contabilidad General.pdf"
  );
  assert.strictEqual(
    PDF.nombreArchivoComunicado(documentos[1]),
    "Comunicado No. 01 COM-ITSQMET-UGPA-2026-07-16 Legislación Tributaria.pdf"
  );

  await PDF.generarPDFDocumento(documentos[0], { mostrarArchivo: false });
  assert.strictEqual(
    payloadPDF.nombreArchivo,
    "Comunicado No. 01 COM-ITSQMET-UGPA-2026-07-15 Contabilidad General.pdf"
  );

  const resultado = await PDF.generarZIPDocumentos(documentos, {
    nombreArchivo: "Comunicados Contabilidad",
    mostrarArchivo: false
  });

  assert.strictEqual(resultado.cantidad, 2);
  assert.strictEqual(payloadZIP.nombreArchivo, "Comunicados Contabilidad.zip");
  assert.strictEqual(payloadZIP.documentos.length, 2);
  assert.strictEqual(
    payloadZIP.documentos[0].nombreArchivo,
    "Comunicado No. 01 COM-ITSQMET-UGPA-2026-07-15 Contabilidad General.pdf"
  );
  assert.strictEqual(
    payloadZIP.documentos[1].nombreArchivo,
    "Comunicado No. 01 COM-ITSQMET-UGPA-2026-07-16 Legislación Tributaria.pdf"
  );
  assert.match(payloadZIP.documentos[0].html, /materia_1/);
  assert.doesNotMatch(payloadZIP.documentos[0].html, /materia_2/);
  assert.match(payloadZIP.documentos[1].html, /materia_2/);
  assert.doesNotMatch(payloadZIP.documentos[1].html, /materia_1/);

  await assert.rejects(
    PDF.generarZIPDocumentos([], { mostrarArchivo: false }),
    /No se recibieron comunicados/
  );

  electron.guardarComunicadosZIP = async function () {
    return { ok: false, mensaje: "Fallo controlado del ZIP" };
  };

  await assert.rejects(
    PDF.generarZIPDocumentos(documentos, {
      nombreArchivo: "Comunicados Contabilidad",
      mostrarArchivo: false
    }),
    /Fallo controlado del ZIP/
  );

  console.log("Comunicados: pruebas de PDF independientes y ZIP superadas.");
}

ejecutar().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
