/*
Nombre del archivo: carr.ui.js
Ubicación: carreras/frontend/carr.ui.js
Función:
- Centralizar utilidades visuales del formulario
- Leer datos base desde el DOM
- Mostrar mensajes de estado
- Bloquear y desbloquear el botón superior
- Gestionar el botón flotante de cambios
*/

function carrUiLimpiarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function carrUiSetEstado(mensaje, tipo = "normal") {
  const estado = document.getElementById("carrEstadoGuardado");
  if (!estado) return;

  estado.textContent = String(mensaje || "");
  estado.classList.remove("carr-status-ok", "carr-status-error");

  if (tipo === "ok") {
    estado.classList.add("carr-status-ok");
  }

  if (tipo === "error") {
    estado.classList.add("carr-status-error");
  }
}

function carrUiBloquearGuardado(bloqueado = true, texto = "Guardar carrera") {
  const boton = document.getElementById("carrBtnGuardar");
  if (!boton) return;

  boton.disabled = bloqueado;
  boton.textContent = bloqueado ? "Guardando..." : texto;
}

function carrUiRecogerFormulario() {
  return {
    nombre: carrUiLimpiarTexto(document.getElementById("carrNombre")?.value),
    tipo: carrUiLimpiarTexto(document.getElementById("carrTipo")?.value),
    estado: carrUiLimpiarTexto(document.getElementById("carrEstado")?.value || "activa") || "activa"
  };
}

function carrUiLimpiarFormulario() {
  const form = document.getElementById("carrForm");
  if (!form) return;
  form.reset();
}

function carrUiResetMensajeBase() {
  carrUiSetEstado("Formulario listo para crear una nueva carrera.");
}

function carrUiActualizarBotonFlotante(totalPendientes = 0) {
  const boton = document.getElementById("carrBtnGuardarCambios");
  const badge = document.getElementById("carrCambiosBadge");
  const texto = document.getElementById("carrFabTexto");

  if (!boton || !badge || !texto) return;

  const total = Math.max(0, Number(totalPendientes) || 0);

  badge.textContent = String(total);

  if (total > 0) {
    boton.classList.add("is-visible");
    texto.textContent = total === 1
      ? "Guardar 1 cambio"
      : `Guardar ${total} cambios`;
  } else {
    boton.classList.remove("is-visible", "is-busy");
    boton.disabled = false;
    texto.textContent = "Guardar cambios";
  }
}

function carrUiBloquearGuardadoFlotante(bloqueado = true, totalPendientes = null) {
  const boton = document.getElementById("carrBtnGuardarCambios");
  const texto = document.getElementById("carrFabTexto");

  if (!boton || !texto) return;

  if (bloqueado) {
    boton.disabled = true;
    boton.classList.add("is-visible", "is-busy");
    texto.textContent = "Guardando cambios...";
    return;
  }

  boton.disabled = false;
  boton.classList.remove("is-busy");

  if (typeof totalPendientes === "number") {
    carrUiActualizarBotonFlotante(totalPendientes);
  }
}

export {
  carrUiLimpiarTexto,
  carrUiSetEstado,
  carrUiBloquearGuardado,
  carrUiRecogerFormulario,
  carrUiLimpiarFormulario,
  carrUiResetMensajeBase,
  carrUiActualizarBotonFlotante,
  carrUiBloquearGuardadoFlotante
};