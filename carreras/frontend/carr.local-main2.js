document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("carrForm");
  var status = document.getElementById("carrEstadoGuardado");
  function clean(v) { return String(v == null ? "" : v).trim(); }
  function makeId(v) { return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  if (form) {
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var nombre = clean(document.getElementById("carrNombre").value);
      var tipo = clean(document.getElementById("carrTipo").value);
      var estado = clean(document.getElementById("carrEstado").value) || "activa";
      var id = makeId(nombre);
      if (!id || !tipo) {
        status.textContent = "Complete nombre y tipo.";
        return;
      }
      await window.CurriculoLocal.put("carreras", id, { id: id, nombre: nombre, tipo: tipo, estado: estado, updatedAtLocal: new Date().toISOString() });
      status.textContent = "Guardado localmente.";
    });
  }
});
