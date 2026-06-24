/*
Nombre del archivo: carr.main.js
Ubicación: carreras/frontend/carr.main.js
Función:
- Controlar el formulario principal
- Guardar una carrera nueva
- Cargar la tabla editable
- Filtrar la tabla con el buscador
- Guardar cambios de la tabla con el botón flotante
*/

import { carrGuardarCarrera } from "../backend/carr.guardar.js";
import {
  carrUiBloquearGuardado,
  carrUiBloquearGuardadoFlotante,
  carrUiRecogerFormulario,
  carrUiResetMensajeBase,
  carrUiSetEstado,
  carrUiActualizarBotonFlotante
} from "./carr.ui.js";

let carrTablaApi = null;

function carrMostrarTablaTemporal(mensaje, resumen = "Tabla no disponible", esError = false) {
  const wrap = document.getElementById("carrTablaWrap");
  const resumenNodo = document.getElementById("carrTablaResumen");

  if (resumenNodo) {
    resumenNodo.textContent = resumen;
  }

  if (!wrap) return;

  wrap.innerHTML = "";

  const estado = document.createElement("div");
  estado.className = esError
    ? "carr-tabla-empty carr-tabla-empty-error"
    : "carr-tabla-empty";
  estado.textContent = mensaje;

  wrap.appendChild(estado);
}

async function carrIntentarCargarModuloTabla() {
  if (carrTablaApi && typeof carrTablaApi.cargar === "function") {
    return true;
  }

  try {
    const modulo = await import("./carr.tabla.js");

    if (typeof modulo.carrCrearTablaCarreras !== "function") {
      return false;
    }

    carrTablaApi = modulo.carrCrearTablaCarreras({
      contenedorId: "carrTablaWrap",
      resumenId: "carrTablaResumen",
      onDirtyChange: ({ total }) => {
        carrUiActualizarBotonFlotante(total);
      }
    });

    return true;
  } catch (error) {
    console.warn("[carr] No se pudo cargar carr.tabla.js:", error);
    return false;
  }
}

async function carrRefrescarTabla() {
  const tablaLista = await carrIntentarCargarModuloTabla();

  if (!tablaLista) {
    carrMostrarTablaTemporal(
      "La tabla no se pudo inicializar.",
      "Módulo no disponible",
      true
    );

    carrUiActualizarBotonFlotante(0);

    return {
      ok: false,
      total: 0,
      items: []
    };
  }

  try {
    const resultado = await carrTablaApi.cargar();
    carrUiActualizarBotonFlotante(carrTablaApi.getPendientes());

    return resultado;
  } catch (error) {
    console.error("[carr] Error al refrescar la tabla:", error);

    carrMostrarTablaTemporal(
      "No se pudo cargar la tabla de carreras.",
      "Error de carga",
      true
    );

    carrUiActualizarBotonFlotante(0);

    return {
      ok: false,
      total: 0,
      items: []
    };
  }
}

async function carrSubmitFormulario(event) {
  event.preventDefault();

  const form = document.getElementById("carrForm");

  try {
    carrUiBloquearGuardado(true);
    carrUiSetEstado("Validando y guardando la carrera...");

    const data = carrUiRecogerFormulario();
    const resultado = await carrGuardarCarrera(data);

    if (!resultado.ok) {
      carrUiSetEstado(
        resultado.mensaje || "No se pudo guardar la carrera.",
        "error"
      );
      return;
    }

    carrUiSetEstado(
      `Carrera guardada correctamente con id: ${resultado.id}`,
      "ok"
    );

    if (form) {
      form.reset();
    }

    await carrRefrescarTabla();
  } catch (error) {
    console.error("[carr] Error inesperado al guardar:", error);

    carrUiSetEstado(
      "Ocurrió un error inesperado al guardar la carrera.",
      "error"
    );
  } finally {
    carrUiBloquearGuardado(false);
  }
}

async function carrGuardarCambiosTabla() {
  if (!carrTablaApi || typeof carrTablaApi.guardarCambios !== "function") {
    carrUiSetEstado("La tabla editable todavía no está disponible.", "error");
    return;
  }

  const pendientes = carrTablaApi.getPendientes();

  if (!pendientes) {
    carrUiSetEstado("No hay cambios pendientes en la tabla.");
    carrUiActualizarBotonFlotante(0);
    return;
  }

  try {
    carrUiBloquearGuardadoFlotante(true);
    carrUiSetEstado("Guardando cambios de la tabla...");

    const resultado = await carrTablaApi.guardarCambios();

    if (!resultado.ok) {
      carrUiSetEstado(
        resultado.mensaje || "No se pudieron guardar los cambios de la tabla.",
        "error"
      );

      if (resultado.parcial) {
        carrUiSetEstado(
          `${resultado.totalGuardados || 0} cambio(s) sí se guardaron, pero el proceso se detuvo por un error.`,
          "error"
        );
      }

      return;
    }

    carrUiSetEstado(
      `${resultado.total || 0} cambio(s) guardado(s) correctamente.`,
      "ok"
    );
  } catch (error) {
    console.error("[carr] Error inesperado al guardar cambios de tabla:", error);

    carrUiSetEstado(
      "Ocurrió un error inesperado al guardar los cambios de la tabla.",
      "error"
    );
  } finally {
    const totalPendientes = carrTablaApi && typeof carrTablaApi.getPendientes === "function"
      ? carrTablaApi.getPendientes()
      : 0;

    carrUiBloquearGuardadoFlotante(false, totalPendientes);
  }
}

function carrRegistrarEventos() {
  const form = document.getElementById("carrForm");
  const btnRecargarTabla = document.getElementById("carrBtnRecargarTabla");
  const btnGuardarCambios = document.getElementById("carrBtnGuardarCambios");
  const inputBuscar = document.getElementById("carrTablaBuscar");
  const btnLimpiarBusqueda = document.getElementById("carrBtnLimpiarBusqueda");

  if (!form) {
    console.warn("[carr] No se encontró el formulario principal.");
    return;
  }

  form.addEventListener("submit", carrSubmitFormulario);

  form.addEventListener("reset", () => {
    setTimeout(() => {
      carrUiSetEstado("Formulario limpio. Puede registrar una nueva carrera.");
    }, 0);
  });

  if (btnRecargarTabla) {
    btnRecargarTabla.addEventListener("click", async () => {
      carrUiSetEstado("Actualizando la tabla de carreras...");
      await carrRefrescarTabla();
      carrUiSetEstado("Tabla actualizada.");
    });
  }

  if (btnGuardarCambios) {
    btnGuardarCambios.addEventListener("click", carrGuardarCambiosTabla);
  }

  if (inputBuscar) {
    inputBuscar.addEventListener("input", () => {
      if (!carrTablaApi || typeof carrTablaApi.setBuscar !== "function") {
        return;
      }

      carrTablaApi.setBuscar(inputBuscar.value);
    });
  }

  if (btnLimpiarBusqueda && inputBuscar) {
    btnLimpiarBusqueda.addEventListener("click", () => {
      inputBuscar.value = "";

      if (carrTablaApi && typeof carrTablaApi.setBuscar === "function") {
        carrTablaApi.setBuscar("");
      }
    });
  }
}

async function carrIniciar() {
  carrRegistrarEventos();
  carrUiResetMensajeBase();
  carrUiActualizarBotonFlotante(0);
  await carrRefrescarTabla();
}

document.addEventListener("DOMContentLoaded", () => {
  carrIniciar();
});