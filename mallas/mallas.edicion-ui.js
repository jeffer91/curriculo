/* =========================================================
Nombre completo: mallas.edicion-ui.js
Ruta o ubicación: /Curriculo/mallas/mallas.edicion-ui.js
Funciones:
- Mantener habilitados los campos de nombres de materias.
- Sincronizar cualquier edición antes de guardar, ordenar o mover.
- Evitar que una edición hecha con teclado, pegado o autocompletado se pierda.
========================================================= */
(function (window, document) {
  "use strict";

  if (window.__mallasEdicionUI) return;
  window.__mallasEdicionUI = true;

  var sincronizando = false;

  function esNombreMateria(elemento) {
    return !!(elemento && elemento.matches && elemento.matches('#listaMateriasMalla [data-campo="nombreOficial"]'));
  }

  function habilitarCampo(campo) {
    if (!esNombreMateria(campo)) return;
    campo.removeAttribute("readonly");
    campo.removeAttribute("disabled");
    campo.readOnly = false;
    campo.disabled = false;
    campo.setAttribute("aria-readonly", "false");
    campo.style.pointerEvents = "auto";
    campo.style.userSelect = "text";
  }

  function habilitarTodos() {
    document.querySelectorAll('#listaMateriasMalla [data-campo="nombreOficial"]').forEach(habilitarCampo);
  }

  function notificarEdicion(campo) {
    if (!esNombreMateria(campo)) return;
    habilitarCampo(campo);
    campo.dataset.editado = "true";
  }

  function reenviarInput(campo) {
    if (!esNombreMateria(campo) || sincronizando) return;
    sincronizando = true;
    try {
      habilitarCampo(campo);
      campo.dispatchEvent(new window.Event("input", { bubbles: true }));
    } finally {
      sincronizando = false;
    }
  }

  function sincronizarTodos() {
    document.querySelectorAll('#listaMateriasMalla [data-campo="nombreOficial"]').forEach(function (campo) {
      reenviarInput(campo);
    });
  }

  function iniciar() {
    var lista = document.getElementById("listaMateriasMalla");
    if (!lista) return;

    habilitarTodos();

    lista.addEventListener("focusin", function (event) {
      habilitarCampo(event.target);
    }, true);

    lista.addEventListener("input", function (event) {
      notificarEdicion(event.target);
    }, true);

    lista.addEventListener("change", function (event) {
      reenviarInput(event.target);
    }, true);

    lista.addEventListener("focusout", function (event) {
      reenviarInput(event.target);
    }, true);

    lista.addEventListener("paste", function (event) {
      if (!esNombreMateria(event.target)) return;
      window.setTimeout(function () { reenviarInput(event.target); }, 0);
    }, true);

    var observador = new MutationObserver(function () {
      habilitarTodos();
    });
    observador.observe(lista, { childList: true, subtree: true });

    document.addEventListener("click", function (event) {
      var accion = event.target && event.target.closest
        ? event.target.closest("#btnGuardarMalla, #btnOrdenarMaterias, [data-mover], [data-eliminar-materia]")
        : null;
      if (accion) sincronizarTodos();
    }, true);

    var guardar = document.getElementById("btnGuardarMalla");
    if (guardar) {
      guardar.addEventListener("pointerdown", sincronizarTodos, true);
      guardar.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") sincronizarTodos();
      }, true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})(window, document);
