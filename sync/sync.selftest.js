/* =========================================================
Nombre completo: sync.selftest.js
Ruta: /Curriculo/sync/sync.selftest.js
Funciones:
- Probar automáticamente las reglas de versión, fecha, hash y conflicto.
- Verificar que los metadatos de transporte no alteren el contenido.
- Exponer el resultado para el diagnóstico de la pantalla.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoSync = window.CurriculoSync || {};
  var NS = window.CurriculoSync;

  function ejecutar() {
    var errores = [];
    var pruebas = 0;
    var V = NS.Versiones;

    function verificar(condicion, mensaje) {
      pruebas += 1;
      if (!condicion) errores.push(mensaje);
    }

    if (!V || typeof V.comparar !== "function" || typeof V.calcularHash !== "function") {
      return {
        ok: false,
        pruebas: 0,
        errores: ["El módulo de versiones no está disponible."],
        ejecutadoEn: new Date().toISOString()
      };
    }

    var fecha1 = "2026-07-16T10:00:00.000Z";
    var fecha2 = "2026-07-16T11:00:00.000Z";
    var base = {
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

    var mismaInformacionOtroOrigen = Object.assign({}, base, {
      origen: "google_sheets",
      dispositivoId: "equipo_b",
      sincronizadoEn: fecha2,
      hash: "hash_antiguo"
    });

    verificar(
      V.calcularHash(base) === V.calcularHash(mismaInformacionOtroOrigen),
      "El hash cambia por metadatos de transporte."
    );

    verificar(
      V.calcularHash(base) !== V.calcularHash(Object.assign({}, base, { valor: "B" })),
      "El hash no detecta cambios en el contenido."
    );

    verificar(
      V.comparar(Object.assign({}, base, { version: 2 }), base).decision === "local_a_remoto",
      "No gana la versión local mayor."
    );

    verificar(
      V.comparar(base, Object.assign({}, base, { version: 2 })).decision === "remoto_a_local",
      "No gana la versión remota mayor."
    );

    verificar(
      V.comparar(Object.assign({}, base, { actualizadoEn: fecha2 }), base).decision === "local_a_remoto",
      "No gana la fecha local más reciente cuando la versión coincide."
    );

    verificar(
      V.comparar(base, Object.assign({}, base, { actualizadoEn: fecha2 })).decision === "remoto_a_local",
      "No gana la fecha remota más reciente cuando la versión coincide."
    );

    verificar(
      V.comparar(base, mismaInformacionOtroOrigen).decision === "igual",
      "Dos copias iguales se detectan como diferentes."
    );

    verificar(
      V.comparar(base, Object.assign({}, base, { valor: "B" })).decision === "conflicto",
      "No se detecta el conflicto con versión y fecha iguales."
    );

    verificar(
      V.comparar(base, null).decision === "crear_remoto",
      "No se detecta un registro que existe solo en BDLocal."
    );

    verificar(
      V.comparar(null, base).decision === "crear_local",
      "No se detecta un registro que existe solo en Google Sheets."
    );

    return {
      ok: errores.length === 0,
      pruebas: pruebas,
      errores: errores,
      ejecutadoEn: new Date().toISOString()
    };
  }

  NS.SelfTest = { ejecutar: ejecutar };
  NS.selfTestResultado = ejecutar();

  if (NS.selfTestResultado.ok) {
    console.info("[Sync.SelfTest] " + NS.selfTestResultado.pruebas + " pruebas internas superadas.");
  } else {
    console.error("[Sync.SelfTest] Fallaron pruebas internas:", NS.selfTestResultado.errores);
  }
})(window);