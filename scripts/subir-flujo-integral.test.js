"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

const context = {
  window: {
    SubirCCC: {
      Validador: {
        validarPaquete(paquete) {
          return paquete;
        }
      }
    }
  },
  console
};

vm.createContext(context);
vm.runInContext(leer("subir/subir.estados.js"), context, {
  filename: "subir.estados.js"
});

const Estados = context.window.SubirCCC.Estados;

function ejecutarEscenario(nombre, estadoOriginal, validaciones, esperado) {
  const materiaId = "materia_" + nombre.replace(/\W+/g, "_").toLowerCase();
  const paquete = Estados.clasificarPaquete({
    materias: [{
      id: materiaId,
      nombre,
      estadoValidacion: estadoOriginal
    }],
    validacionesSubida: (validaciones || []).map((validacion) => ({
      ...validacion,
      materiaId
    })),
    resumenValidacion: {},
    carga: {}
  });

  const materia = paquete.materias[0];
  assert.strictEqual(materia.estadoClasificado, esperado.estado, nombre);
  assert.strictEqual(materia.puedeImportar, esperado.puedeImportar, nombre);
  assert.strictEqual(paquete.resumenValidacion.bloqueaImportacion, esperado.bloquea, nombre);
  assert.strictEqual(
    paquete.resumenValidacion.materiasCompletas +
      paquete.resumenValidacion.materiasAdvertencia +
      paquete.resumenValidacion.materiasError,
    1,
    nombre + ": los contadores deben sumar el total de materias"
  );

  return paquete;
}

assert.ok(Estados, "Debe exponerse SubirCCC.Estados.");

// 1. Los tres archivos y contenidos correctos.
ejecutarEscenario("Tres PEA correctos", "completo", [], {
  estado: "completa",
  puedeImportar: true,
  bloquea: false
});

// 2. Falta un archivo obligatorio.
ejecutarEscenario("Falta un archivo", "incompleto", [{
  tipo: "materia_incompleta",
  severidad: "error",
  bloqueaImportacion: false
}], {
  estado: "error",
  puedeImportar: true,
  bloquea: false
});

// 3. Archivo duplicado.
ejecutarEscenario("Archivo duplicado", "revision", [{
  tipo: "archivos_duplicados",
  severidad: "advertencia",
  bloqueaImportacion: false
}], {
  estado: "advertencia",
  puedeImportar: true,
  bloquea: false
});

// 4. PEA Base sin objetivo.
ejecutarEscenario("PEA Base sin objetivo", "revision", [{
  tipo: "contenido_base_incompleto",
  severidad: "advertencia",
  bloqueaImportacion: false
}], {
  estado: "advertencia",
  puedeImportar: true,
  bloquea: false
});

// 5. PEA Base sin descripción.
ejecutarEscenario("PEA Base sin descripción", "revision", [{
  tipo: "contenido_base_incompleto",
  severidad: "advertencia",
  bloqueaImportacion: false
}], {
  estado: "advertencia",
  puedeImportar: true,
  bloquea: false
});

// 6. Excel vacío.
ejecutarEscenario("Excel vacío", "incompleto", [{
  tipo: "excel_sin_contenido_curricular",
  severidad: "error",
  bloqueaImportacion: false
}], {
  estado: "error",
  puedeImportar: true,
  bloquea: false
});

// 7. Excel dañado o ilegible.
ejecutarEscenario("Excel dañado", "incompleto", [{
  tipo: "error_lectura_excel",
  severidad: "error",
  bloqueaImportacion: false
}], {
  estado: "error",
  puedeImportar: true,
  bloquea: false
});

// 8. Archivo no identificado automáticamente.
ejecutarEscenario("Archivo no identificado", "revision", [{
  tipo: "archivos_no_identificados",
  severidad: "advertencia",
  bloqueaImportacion: false
}], {
  estado: "advertencia",
  puedeImportar: true,
  bloquea: false
});

// 9. Advertencia no bloqueante.
ejecutarEscenario("Baja confianza", "revision", [{
  tipo: "nivel_baja_confianza",
  severidad: "advertencia",
  bloqueaImportacion: false
}], {
  estado: "advertencia",
  puedeImportar: true,
  bloquea: false
});

// 10. Error crítico que bloquea la importación.
ejecutarEscenario("Lectura total fallida", "revision", [{
  tipo: "lectura_excel_total_fallida",
  severidad: "critico",
  bloqueaImportacion: true
}], {
  estado: "error",
  puedeImportar: false,
  bloquea: true
});

console.log("Subir ZIP: diez escenarios integrales superados.");
