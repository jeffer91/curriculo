"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
}

let ultimo = 0;
let confirmadas = [];
let canceladas = [];

const context = {
  window: {
    ComunicadosCCC: {},
    CurriculoFirebase: {
      async ready() {
        return true;
      },
      async obtenerContadorComunicados() {
        return { ultimo };
      },
      async reservarBloqueComunicados(fecha, cantidad) {
        const inicio = ultimo + 1;
        ultimo += cantidad;
        return Array.from({ length: cantidad }, (_, indice) => {
          const secuencia = inicio + indice;
          return {
            secuencia,
            numero: "COM-ITSQMET-UGPA-2026-07-" +
              String(secuencia).padStart(2, "0"),
            mesKey: "2026-07",
            fecha: "2026-07-28T00:00:00.000Z",
            comunicadoId: "com_" + secuencia,
            reservaToken: "token_" + secuencia,
            estado: "reservado"
          };
        });
      },
      async confirmarReservaComunicado(reserva, datos) {
        confirmadas.push({ reserva, datos });
        return Object.assign({}, reserva, datos, { estado: "confirmado" });
      },
      async cancelarReservasComunicados(reservas) {
        canceladas = canceladas.concat(reservas);
        return reservas.map(() => true);
      },
      async registrarNumeroComunicado(fecha, secuencia, datos) {
        return { secuencia, datos };
      }
    }
  },
  console,
  Date,
  Math
};

vm.createContext(context);
vm.runInContext(leer("comunicados/comunicados.contador.js"), context, {
  filename: "comunicados.contador.js"
});

async function ejecutar() {
  const Contador = context.window.ComunicadosCCC.Contador;
  assert.strictEqual(Contador.VERSION, "4.0.0");

  const reservas = await Contador.preReservarBloque(
    "2026-07-28",
    3,
    { origen: "prueba" }
  );

  assert.deepStrictEqual(
    reservas.map((item) => item.secuencia),
    [1, 2, 3]
  );

  const siguiente = await Contador.obtenerSiguienteNumero("2026-07-28");
  assert.strictEqual(siguiente.secuencia, 1);

  await Contador.registrarNumeroManual(
    "2026-07-28",
    1,
    { materiaId: "m1" }
  );

  assert.strictEqual(confirmadas.length, 1);
  assert.strictEqual(confirmadas[0].reserva.reservaToken, "token_1");

  const pendientesAntes = Contador.getReservasActivas()
    .filter((item) => item.estado === "reservado");
  assert.strictEqual(pendientesAntes.length, 2);

  await Contador.cancelarReservasPendientes("Prueba terminada");
  assert.strictEqual(canceladas.length, 2);
  assert.strictEqual(
    Contador.getReservasActivas().length,
    0
  );

  const nueva = await Contador.obtenerSiguienteNumero("2026-07-28");
  assert.strictEqual(nueva.secuencia, 4);
  assert.strictEqual(ultimo, 4);

  console.log(
    "Comunicados: reserva transaccional y cancelación de números superadas."
  );
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
