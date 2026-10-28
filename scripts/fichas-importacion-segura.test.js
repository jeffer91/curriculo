"use strict";
/* Integración de importación puntual con emulador de Firestore en memoria.
   Asegura que reemplazos parciales no cambien otros PEA ni creen versiones falsas. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const tables = Object.create(null);
const writes = [];
const clone = x => JSON.parse(JSON.stringify(x));
const table = col => tables[col] || (tables[col] = Object.create(null));
const snapshot = (ref, row) => ({
  id: ref.id, exists() { return row !== undefined; },
  data() { return clone(row); }
});
const sdk = {
  initializeFirestore() { return {}; }, getFirestore() { return {}; },
  serverTimestamp() { return "2026-10-27T00:00:00.000Z"; },
  doc(db, col, id) { return { col, id }; },
  collection(db, col) { return { col }; },
  query(collection, ...filters) { return { col: collection.col, filters }; },
  where(key, op, value) { return { key, op, value }; },
  limit(n) { return { limit: n }; },
  async getDoc(ref) { return snapshot(ref, table(ref.col)[ref.id]); },
  async getDocs(query) {
    const docs = Object.entries(table(query.col)).filter(([id, row]) => {
      return (query.filters || []).every(c => !c.key || row[c.key] === c.value);
    }).map(([id, row]) => snapshot({ id }, row));
    return { docs, size: docs.length };
  },
  async setDoc(ref, data, opts) {
    table(ref.col)[ref.id] = opts && opts.merge
      ? Object.assign({}, table(ref.col)[ref.id] || {}, clone(data)) : clone(data);
    writes.push([ref.col, ref.id]);
  },
  async updateDoc(ref, data) {
    if (!table(ref.col)[ref.id]) throw new Error("No such doc " + ref.id);
    table(ref.col)[ref.id] = Object.assign({}, table(ref.col)[ref.id], clone(data));
    writes.push([ref.col, ref.id]);
  },
  writeBatch() {
    const jobs = [];
    return {
      set(ref, data, opts) { jobs.push(["set", ref, data, opts]); },
      delete(ref) { jobs.push(["delete", ref]); },
      async commit() {
        jobs.forEach(([op, ref, data, opts]) => {
          if (op === "delete") delete table(ref.col)[ref.id];
          else table(ref.col)[ref.id] = opts && opts.merge
            ? Object.assign({}, table(ref.col)[ref.id] || {}, clone(data)) : clone(data);
          writes.push([ref.col, ref.id]);
        });
      }
    };
  }
};
const app = {
  getApps() { return []; }, getApp() { return {}; },
  initializeApp() { return {}; }
};
const win = {
  SubirCCC: {}, CurriculoFirebase: {}, __app: app, __sdk: sdk,
  CurriculoMallasOficiales: {
    obtenerPorCarrera() { return { materias: [
      { nombreOficial: "Office Essentials", nivelNumero: 1 },
      { nombreOficial: "Sistemas Operativos", nivelNumero: 1 }
    ] }; }
  }
};
const context = vm.createContext({
  window: win, console, Date, Math, Number, String, Object, Array,
  Promise, JSON, Blob, TextEncoder, encodeURIComponent, unescape
});
vm.runInContext(read("subir/subir.normalizador.js"), context);
vm.runInContext(read("subir/subir.validador.js"), context);
vm.runInContext(read("firebase/firebase.inteligencia.js"), context);
const originalBackend = read("firebase/firebase.curriculo.js");
const importer = [
  '  function importarModulo(url) {',
  '    var dinamico = new Function("url", "return import(url);");',
  '    return dinamico(url);',
  '  }'
].join("\n");
assert.ok(originalBackend.includes(importer), "Firebase importer changed; update test harness");
vm.runInContext(originalBackend.replace(importer, [
  '  function importarModulo(url) {',
  '    return Promise.resolve(url.indexOf("firebase-app.js") >= 0 ? window.__app : window.__sdk);',
  '  }'
].join("\n")), context);
const I = win.CurriculoFirebase.Inteligencia;
const FB = win.CurriculoFirebase;
const cid = "carrera_redes", lid = "nivel_carrera_redes_1";
const types = ["pea_base","pea_unidades","pea_actividades"];
const sourceDocs = {
  pea_base: {
    descripcion: "Descripción válida", objetivo: "Objetivo original",
    unidadesBase: [{ unidadNumero: 1, nombre: "Fundamentos" }],
    campos: { descripcion_asignatura: "Descripción válida" }
  },
  pea_unidades: [{ unidadNumero: 1, contenidos: ["Tema A", "Tema B"], filasOriginales: [
    { codigoComponente: "3", descripcionComponente: "Tema A" }
  ] }],
  pea_actividades: [{
    unidadNumero: 1, mecanismo: "Taller", tema: "Ejercicio",
    descripcion: "Resolver actividad", campos: { recurso: "Libro" }
  }]
};
function paquete(nombre, docs, nuevos, codigo = "") {
  const pid = "temporal", files = types.map(tipo => ({
    id: "archivo_" + tipo, materiaId: pid, carreraId: cid, nivelId: lid,
    tipo, extension: "xlsx", nombreArchivo: tipo + ".xlsx",
    excelLeido: true, esExcel: true, confianza: 100,
    origenArchivo: nuevos.includes(tipo) ? "nuevo" : "existente",
    datosProcesados: clone(docs[tipo])
  }));
  return win.SubirCCC.Validador.validarPaquete({
    carga: { nombreZip: "" },
    carreras: [{ id: cid, nombre: "Redes y Telecomunicaciones", confianza: 100 }],
    niveles: [{ id: lid, carreraId: cid, numero: 1, nombre: "Primer nivel", confianza: 100 }],
    materias: [{ id: pid, carreraId: cid, nivelId: lid, nombre, codigo }],
    archivos: files, advertencias: []
  });
}
function initial(nombre) {
  const p = paquete(nombre, sourceDocs, types);
  const item = I.prepararPaquete(p, "carga_inicial").materias[0];
  const row = clone(item.materia);
  row.versionActual = 1; row.cargaId = "carga_inicial";
  table("materias")[row.id] = row;
  table("pea_base")[row.id] = clone(item.peaBase);
  table("pea_actividades")[row.id] = clone(item.actividades);
  item.unidades.forEach(u => { table("pea_unidades")[u.id] = clone(u); });
  return row;
}
function currentDocs(m) {
  return {
    pea_base: clone(table("pea_base")[m.id]),
    pea_unidades: Object.values(table("pea_unidades")).filter(u => u.materiaId === m.id).map(u => ({
      unidadNumero: u.unidadNumero, contenidos: u.contenidos,
      filasOriginales: u.filas, temaDetectado: u.titulo
    })),
    pea_actividades: clone(table("pea_actividades")[m.id].actividades)
  };
}
async function run() {
  table("carreras")[cid] = { id: cid, nombre: "Redes y Telecomunicaciones", estado: "activo" };
  const office = initial("Office Essentials");
  const originalActivities = clone(table("pea_actividades")[office.id]);
  const originalUnits = clone(Object.values(table("pea_unidades")).filter(u => u.materiaId === office.id));
  const previous = currentDocs(office);
  const changed = Object.assign({}, previous, {
    pea_base: Object.assign({}, previous.pea_base, { objetivo: "Objetivo realmente actualizado" })
  });
  const res = await FB.importarMateriaDesdeFichas(
    paquete("Office Essentials", changed, ["pea_base"]),
    { materiaFirebaseId: office.id }
  );
  assert.strictEqual(res.tipo, "actualizada");
  assert.strictEqual(table("materias")[office.id].versionActual, 2);
  assert.strictEqual(table("pea_base")[office.id].objetivo, "Objetivo realmente actualizado");
  assert.deepStrictEqual(clone(table("pea_actividades")[office.id]), originalActivities,
    "La actividad no reemplazada debe conservarse byte a byte");
  assert.deepStrictEqual(clone(Object.values(table("pea_unidades")).filter(u => u.materiaId === office.id)), originalUnits,
    "Las unidades que no se reemplazaron deben conservarse íntegras");
  assert.strictEqual(Object.keys(table("materias")).length, 1);

  const second = currentDocs(office);
  const versionsBefore = Object.keys(table("materia_versiones")).length;
  const noOp = await FB.importarMateriaDesdeFichas(
    paquete("Office Essentials", second, []), { materiaFirebaseId: office.id }
  );
  assert.strictEqual(noOp.tipo, "sin_cambios");
  assert.strictEqual(table("materias")[office.id].versionActual, 2);
  assert.strictEqual(Object.keys(table("materia_versiones")).length, versionsBefore,
    "Sin PEA nuevos no debe generarse una versión artificial");

  const other = initial("Sistemas Operativos");
  const otherData = clone(table("materias")[other.id]);
  const bad = paquete("Office Essentials", currentDocs(other), [], other.codigo);
  await assert.rejects(FB.importarMateriaDesdeFichas(bad, {
    materiaFirebaseId: other.id,
    confirmacionVinculo: {
      materiaFirebaseId: other.id, nombreExistente: "Sistemas Operativos",
      nombreOficial: "Office Essentials"
    }
  }), /otra materia de la malla oficial/);
  assert.deepStrictEqual(clone(table("materias")[other.id]), otherData,
    "No debe modificar el registro de otra asignatura");

  const alias = initial("Office Skills");
  const withAlias = paquete("Office Essentials", currentDocs(alias), []);
  await assert.rejects(FB.importarMateriaDesdeFichas(withAlias, { materiaFirebaseId: alias.id }),
    /confirmarlo expresamente/);
  const vinculado = await FB.importarMateriaDesdeFichas(withAlias, {
    materiaFirebaseId: alias.id,
    confirmacionVinculo: {
      materiaFirebaseId: alias.id,
      nombreExistente: "Office Skills",
      nombreOficial: "Office Essentials"
    }
  });
  assert.strictEqual(vinculado.tipo, "vinculada");
  assert.strictEqual(table("materias")[alias.id].nombreInstitucional, "Office Essentials");
  assert.strictEqual(table("materias")[alias.id].versionActual, 1,
    "Vincular el alias sin modificar un PEA no debe alterar la versión");
  // Leer tres archivos XLSX reales generados en memoria, sin lectores simulados.
  const XLSX = require("xlsx");
  win.XLSX = XLSX;
  win.__XLSXReady = Promise.resolve(XLSX);
  vm.runInContext(read("subir/subir.excel.js"), context);
  vm.runInContext(read("subir/subir.excel-inteligente.js"), context);
  function fileExcel(tipo, rows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Hoja1");
    return {
      id: "xls_" + tipo, materiaId: "temporal", carreraId: cid, nivelId: lid,
      tipo, esExcel: true, extension: "xlsx", nombreArchivo: tipo + ".xlsx",
      contenidoBinario: new Uint8Array(XLSX.write(book, { bookType: "xlsx", type: "buffer" })),
      confianza: 100, origenArchivo: "nuevo"
    };
  }
  const realFiles = [
    fileExcel("pea_base", [
      ["codigoComponente","ordenComponente","descripcionComponente"],
      [1,1,"Descripción de Office Essentials"],
      [2,1,"Objetivo de Office Essentials"],
      [3,1,"Introducción a la ofimática"]
    ]),
    fileExcel("pea_unidades", [
      ["codigoComponente","ordenComponente","descripcionComponente"],
      [3,1,"1.1 Herramientas Office"],
      [3,1,"1.1.1 Uso de procesadores de texto"],
      [3,2,"2.1 Hojas de cálculo"]
    ]),
    fileExcel("pea_actividades", [
      ["nivel","mecanismo","tema","descripcion"],
      [1,"Taller Practico 1","Documentos","Crear un documento en Office"],
      [1,"Actividad Autonoma 1","Hojas de cálculo","Preparar una tabla"]
    ])
  ];
  const realPackage = await win.SubirCCC.Excel.enriquecerPaqueteConExcel({
    carga: { nombreZip: "" },
    carreras: [{ id: cid, nombre: "Redes y Telecomunicaciones", confianza: 100 }],
    niveles: [{ id: lid, carreraId: cid, numero: 1, nombre: "Primer nivel", confianza: 100 }],
    materias: [{ id: "temporal", carreraId: cid, nivelId: lid, nombre: "Office Essentials" }],
    archivos: realFiles,
    advertencias: []
  });
  const realValidation = win.SubirCCC.Validador.validarPaquete(realPackage);
  assert.strictEqual(realValidation.evaluacionesMaterias[0].totalArchivosValidos, 3,
    "Los tres libros XLSX reales deben tener datos curriculares reconocidos.");
  const realPrepared = I.prepararPaquete(realValidation, "carga_real_prueba").materias[0];
  assert.strictEqual(realPrepared.actividades.actividades.length, 2);
  assert.ok(realPrepared.unidades.length >= 2);
  console.log("XLSX reales: PEA Base, Unidades y Actividades leídos y validados.");
  console.log("Fichas: reemplazo parcial íntegro, no-op sin versiones y vínculos seguros verificados.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
