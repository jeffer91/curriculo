/* =========================================================
Nombre completo: mallas-estabilidad.test.js
Ruta o ubicación: /Curriculo/scripts/mallas-estabilidad.test.js
Funciones:
- Verificar que la protección de tiempo máximo se cargue antes del módulo principal.
- Confirmar que una operación detenida termine con un error controlado.
- Evitar que dos intentos simultáneos creen dos guardados.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

(async function ejecutar() {
  const raiz = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(raiz, "mallas", "mallas.html"), "utf8");
  const codigo = fs.readFileSync(path.join(raiz, "mallas", "mallas.estabilidad.js"), "utf8");

  const posicionEstabilidad = html.indexOf("mallas.estabilidad.js");
  const posicionPrincipal = html.indexOf("mallas.main.js");
  assert.ok(posicionEstabilidad >= 0, "La pantalla debe cargar mallas.estabilidad.js");
  assert.ok(posicionPrincipal > posicionEstabilidad, "La protección debe cargarse antes de mallas.main.js");

  let guardados = 0;
  const Firebase = {
    ready: async () => true,
    obtenerCarreras: async () => [],
    obtenerMateriasPorCarrera: async () => [],
    Mallas: {
      obtenerMallas: async () => [],
      obtenerDetalleMalla: async () => null,
      obtenerMallaVigenteParaCarrera: async () => null,
      guardarMalla: async () => {
        guardados += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return { ok: true };
      }
    }
  };

  const window = {
    CurriculoFirebase: Firebase,
    navigator: { onLine: true },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(codigo, {
    window,
    Promise,
    Error,
    Number,
    String,
    Math,
    Object,
    Array
  });

  assert.ok(window.CurriculoMallasEstabilidad, "Debe exponerse la protección de estabilidad");

  const resultados = await Promise.all([
    Firebase.Mallas.guardarMalla({ carreraId: "administracion" }),
    Firebase.Mallas.guardarMalla({ carreraId: "administracion" })
  ]);
  assert.strictEqual(resultados.length, 2);
  assert.strictEqual(guardados, 1, "Dos clics simultáneos deben reutilizar el mismo guardado");

  await assert.rejects(
    window.CurriculoMallasEstabilidad.conTiempo(new Promise(() => {}), 5, "Prueba detenida"),
    /tardó más de 0 segundos|tardó más de 1 segundos/,
    "Una operación detenida debe terminar con un error controlado"
  );

  window.navigator.onLine = false;
  await assert.rejects(
    Firebase.obtenerCarreras(),
    /No hay conexión a internet/,
    "La falta de conexión debe informarse inmediatamente"
  );

  console.log("✓ Mallas: las operaciones detenidas liberan la interfaz y el guardado no se duplica");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
