const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const window = {
  SubirCCC: {},
  MallasComparador: {
    comparar(detectadas, oficiales) {
      return {
        coincidencias: [],
        faltantes: oficiales || [],
        noVinculadas: detectadas || [],
        resumen: {
          totalDetectadas: (detectadas || []).length,
          totalOficiales: (oficiales || []).length,
          noVinculadas: (detectadas || []).length
        }
      };
    }
  },
  setInterval(fn) {
    fn();
    return 1;
  },
  clearInterval() {}
};

const contexto = {
  window,
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  JSON,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(fs.readFileSync("subir/subir.normalizador.js", "utf8"), contexto);
vm.runInNewContext(fs.readFileSync("subir/subir.detector-estructura.js", "utf8"), contexto);
vm.runInNewContext(fs.readFileSync("subir/subir.transversales.js", "utf8"), contexto);

const base = "Educación Básica/MATRIZ CCC/N DIDÁCTICA EN ACCIÓN-ELABORACIÓN DE RECURSOS TANGIBLES/";
const entradas = [
  "CCC didáctica Base.xlsx",
  "CCC didáctica Unidades.xlsx",
  "CCC didáctica Actividades.xlsx"
].map((nombre) => ({
  ruta: base + nombre,
  path: base + nombre,
  nombre,
  name: nombre,
  tipo: "archivo",
  dir: false,
  esArchivo: true,
  esExcel: true,
  extension: "xlsx",
  contenidoBinario: new ArrayBuffer(8)
}));

const paquete = window.SubirCCC.DetectorEstructura.detectarEstructura(entradas, {
  nombreZip: "transversales.zip"
});

assert.strictEqual(paquete.materias.length, 1, "Debe crear una sola materia");
assert.strictEqual(paquete.archivos.length, 3, "Debe conservar los tres Excel");
assert.strictEqual(paquete.carga.totalMateriasTransversales, 1);
assert.strictEqual(paquete.diagnostico.totalMateriasTransversales, 1);

const materia = paquete.materias[0];
assert.strictEqual(materia.esTransversal, true);
assert.strictEqual(materia.perteneceMalla, false);
assert.strictEqual(materia.tipoMateria, "transversal");
assert.strictEqual(materia.origenMateria, "institucional");
assert.strictEqual(materia.nivelNumero, 0);
assert.strictEqual(materia.numeroNivel, 0);
assert.ok(!/^N\s/i.test(materia.nombre), "La N no debe quedar en el nombre visible");
assert.ok(/Didactica|Didáctica/i.test(materia.nombre));

const nivel = paquete.niveles.find((item) => item.id === materia.nivelId);
assert.ok(nivel, "Debe existir un nivel técnico transversal");
assert.strictEqual(nivel.nombre, "Transversal");
assert.strictEqual(nivel.esTransversal, true);
assert.strictEqual(nivel.perteneceMalla, false);

paquete.archivos.forEach((archivo) => {
  assert.strictEqual(archivo.materiaId, materia.id);
  assert.strictEqual(archivo.esTransversal, true);
  assert.strictEqual(archivo.perteneceMalla, false);
  assert.strictEqual(archivo.nivel, "Transversal");
  assert.ok(!archivo.rutaOriginal.includes("Nivel Transversal"), "Debe restaurar la ruta original");
});

const curricular = { id: "normal", nombre: "Materia normal", nivelNumero: 1 };
const resultadoMalla = window.MallasComparador.comparar(
  [materia, curricular],
  [{ id: "oficial", nombreOficial: "Materia oficial", nivelNumero: 1 }]
);

assert.strictEqual(resultadoMalla.noVinculadas.length, 1, "La transversal no debe compararse con la malla");
assert.strictEqual(resultadoMalla.noVinculadas[0].id, "normal");
assert.strictEqual(resultadoMalla.transversales.length, 1);
assert.strictEqual(resultadoMalla.transversales[0].id, materia.id);
assert.strictEqual(resultadoMalla.resumen.transversales, 1);

console.log("OK: materias N reconocidas como transversales");
