/* =========================================================
Nombre completo: configuracion.js
Ruta o ubicación: /Curriculo/configuracion/configuracion.js
Funciones:
- Dibujar y editar proveedores de IA.
- Guardar orden, modelo, estado y API Key.
- Probar cada proveedor con una generación real.
========================================================= */
(function (window, document) {
  "use strict";

  var IA = window.CurriculoIA;
  var lista = [];
  var estadosPrueba = {};

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function opcionesProveedor(actual) {
    return Object.keys(IA.PROVEEDORES).map(function (id) {
      var item = IA.PROVEEDORES[id];
      return '<option value="' + escapar(id) + '" ' + (id === actual ? "selected" : "") + '>' + escapar(item.nombre) + '</option>';
    }).join("");
  }

  function badgePrincipal(item) {
    var activos = lista.filter(function (x) { return x.activo; }).sort(function (a, b) { return a.orden - b.orden; });
    return activos.length && activos[0].id === item.id
      ? '<span class="badge">Principal</span>'
      : (item.activo ? '<span class="badge warn">Respaldo</span>' : '<span class="badge">Inactiva</span>');
  }

  function render() {
    var contenedor = document.getElementById("providerList");
    if (!contenedor) return;
    lista.sort(function (a, b) { return a.orden - b.orden; });

    if (!lista.length) {
      contenedor.innerHTML = '<div class="empty">No hay proveedores configurados.<br><br><button class="btn btn-primary" id="btnPrimerProveedor" type="button">Agregar IA</button></div>';
      var primer = document.getElementById("btnPrimerProveedor");
      if (primer) primer.addEventListener("click", agregarProveedor);
      actualizarEstadoGeneral();
      return;
    }

    contenedor.innerHTML = lista.map(function (item, indice) {
      var estado = estadosPrueba[item.id] || null;
      var estadoHTML = "";
      if (estado) {
        estadoHTML = '<span class="status ' + (estado.ok ? "ok" : "error") + '">' + escapar(estado.ok ? ("✓ " + estado.mensaje + " · " + estado.latenciaMs + " ms") : ("✕ " + estado.mensaje)) + '</span>';
      }
      return '<article class="provider" data-id="' + escapar(item.id) + '">' +
        '<div class="provider-top"><div class="provider-title"><strong>IA ' + (indice + 1) + '</strong>' + badgePrincipal(item) + '</div>' +
        '<label class="switch"><input type="checkbox" data-field="activo" ' + (item.activo ? "checked" : "") + '> Activa</label></div>' +
        '<div class="grid">' +
          '<div class="field"><label>Proveedor</label><select data-field="proveedor">' + opcionesProveedor(item.proveedor) + '</select></div>' +
          '<div class="field"><label>Modelo</label><input data-field="modelo" value="' + escapar(item.modelo) + '" placeholder="Nombre exacto del modelo"></div>' +
          '<div class="field"><label>API Key</label><div class="api-row"><input data-field="apiKey" type="password" placeholder="' + (item.tieneApiKey ? "Guardada de forma cifrada" : "Pegar API Key") + '"><button class="btn btn-light" type="button" data-action="ver">Ver</button></div></div>' +
          '<div class="field"><label>Orden</label><input data-field="orden" type="number" min="1" value="' + escapar(item.orden) + '"></div>' +
        '</div>' +
        (item.proveedor === "compatible" ? '<div class="field" style="margin-top:12px"><label>URL base compatible</label><input data-field="baseUrl" value="' + escapar(item.baseUrl || "") + '" placeholder="https://servidor/v1"></div>' : '') +
        '<div class="provider-actions"><button class="btn btn-light" type="button" data-action="probar">Probar IA</button><button class="btn btn-danger" type="button" data-action="eliminar">Eliminar</button>' + estadoHTML + '</div>' +
      '</article>';
    }).join("");

    conectarCards();
    actualizarEstadoGeneral();
  }

  function actualizarEstadoGeneral() {
    var badge = document.getElementById("estadoGeneral");
    if (!badge) return;
    var activos = lista.filter(function (item) { return item.activo && item.modelo && item.tieneApiKey; });
    if (activos.length) {
      badge.textContent = activos.length === 1 ? "1 IA lista" : activos.length + " IA listas";
      badge.className = "badge ok";
    } else {
      badge.textContent = "Sin IA lista";
      badge.className = "badge warn";
    }
  }

  function leerCard(card) {
    var id = card.getAttribute("data-id");
    var item = lista.find(function (x) { return x.id === id; });
    if (!item) return null;
    card.querySelectorAll("[data-field]").forEach(function (control) {
      var campo = control.getAttribute("data-field");
      if (campo === "activo") item.activo = control.checked;
      else if (campo === "orden") item.orden = Math.max(1, Number(control.value || 1));
      else if (campo !== "apiKey") item[campo] = texto(control.value);
    });
    var api = card.querySelector('[data-field="apiKey"]');
    if (api && texto(api.value)) item.apiKey = texto(api.value);
    return item;
  }

  function sincronizarDesdeDOM() {
    document.querySelectorAll(".provider[data-id]").forEach(leerCard);
    lista.sort(function (a, b) { return a.orden - b.orden; });
    lista.forEach(function (item, indice) { item.orden = indice + 1; });
  }

  function conectarCards() {
    document.querySelectorAll(".provider[data-id]").forEach(function (card) {
      card.addEventListener("change", function () {
        leerCard(card);
        render();
      });
      card.addEventListener("click", async function (event) {
        var boton = event.target.closest("[data-action]");
        if (!boton) return;
        var accion = boton.getAttribute("data-action");
        var id = card.getAttribute("data-id");
        if (accion === "ver") {
          var input = card.querySelector('[data-field="apiKey"]');
          if (input) input.type = input.type === "password" ? "text" : "password";
          return;
        }
        if (accion === "eliminar") {
          await IA.eliminarProveedor(id);
          lista = await IA.obtenerConfiguracion();
          delete estadosPrueba[id];
          render();
          return;
        }
        if (accion === "probar") {
          boton.disabled = true;
          estadosPrueba[id] = { ok: false, mensaje: "Probando..." };
          leerCard(card);
          try {
            lista = await IA.guardarConfiguracion(lista);
            var resultado = await IA.probarProveedor(id);
            estadosPrueba[id] = resultado;
          } catch (error) {
            estadosPrueba[id] = { ok: false, mensaje: error && error.message ? error.message : "No se pudo probar." };
          }
          render();
        }
      });
    });
  }

  function agregarProveedor() {
    sincronizarDesdeDOM();
    var nuevo = IA.crearProveedor();
    nuevo.orden = lista.length + 1;
    lista.push(nuevo);
    render();
  }

  async function guardar() {
    var boton = document.getElementById("btnGuardar");
    if (boton) boton.disabled = true;
    try {
      sincronizarDesdeDOM();
      lista = await IA.guardarConfiguracion(lista);
      estadosPrueba.__general = { ok: true };
      render();
      var badge = document.getElementById("estadoGeneral");
      if (badge) {
        badge.textContent = "Guardado";
        badge.className = "badge ok";
        setTimeout(actualizarEstadoGeneral, 1400);
      }
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo guardar la configuración.");
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  async function iniciar() {
    if (!IA) {
      document.getElementById("providerList").innerHTML = '<div class="empty">No se pudo cargar el motor de IA.</div>';
      return;
    }
    lista = await IA.obtenerConfiguracion();
    render();
    document.getElementById("btnAgregar").addEventListener("click", agregarProveedor);
    document.getElementById("btnGuardar").addEventListener("click", guardar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
