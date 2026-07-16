"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "sync", "sync.versiones.js"),
  "utf8"
);

const context = {
  window: {},
  console
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "sync.versiones.js" });

const V = context.window.CurriculoSync.Versiones;
const fecha1 = "2026-07-16T10:00:00.000Z";
const fecha2 = "2026-07-16T11:00:00.000Z";
const base = {
  id: "sync_test_integridad",
  entidad: "sync_test",
  nombre: "Prueba de integridad",
  valor: "A",
  version: 1,
  actualizadoEn: fecha1,
  origen: "bdlocal",
  dispositivoId: "equipo_a",
  activo: true
};

const copiaRemota = {
  ...base,
  origen: "google_sheets",
  dispositivoId: "equipo_b",
  sincronizadoEn: fecha2,
  hash: "hash_antiguo"
};

assert.strictEqual(V.calcularHash(base), V.calcularHash(copiaRemota));
assert.notStrictEqual(V.calcularHash(base), V.calcularHash({ ...base, valor: "B" }));
assert.strictEqual(V.comparar({ ...base, version: 2 }, base).decision, "local_a_remoto");
assert.strictEqual(V.comparar(base, { ...base, version: 2 }).decision, "remoto_a_local");
assert.strictEqual(V.comparar({ ...base, actualizadoEn: fecha2 }, base).decision, "local_a_remoto");
assert.strictEqual(V.comparar(base, { ...base, actualizadoEn: fecha2 }).decision, "remoto_a_local");
assert.strictEqual(V.comparar(base, copiaRemota).decision, "igual");
assert.strictEqual(V.comparar(base, { ...base, valor: "B" }).decision, "conflicto");
assert.strictEqual(V.comparar(base, null).decision, "crear_remoto");
assert.strictEqual(V.comparar(null, base).decision, "crear_local");

console.log("Sincronización: 10 pruebas de reglas superadas.");