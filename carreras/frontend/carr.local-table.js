document.addEventListener("DOMContentLoaded", function () {
  var wrap = document.getElementById("carrTablaWrap");
  var resumen = document.getElementById("carrTablaResumen");
  var buscar = document.getElementById("carrTablaBuscar");
  var limpiar = document.getElementById("carrBtnLimpiarBusqueda");
  var recargar = document.getElementById("carrBtnRecargarTabla");
  var q = "";
  function esc(v) { return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function plain(v) { return String(v || "").toLowerCase(); }
  async function render() {
    var all = await window.CurriculoLocal.all("carreras");
    var list = all.filter(function (x) {
      if (!q) return true;
      return plain([x.id, x.nombre, x.tipo, x.estado].join(" ")).indexOf(plain(q)) >= 0;
    });
    if (resumen) resumen.textContent = list.length + " visibles · " + all.length + " registros";
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = "<div class='carr-tabla-empty'>No hay carreras para mostrar.</div>";
      return;
    }
    wrap.innerHTML = "<div class='carr-tabla-scroll'><table class='carr-tabla'><thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Actualizado</th></tr></thead><tbody>" + list.map(function (x) {
      return "<tr><td class='carr-cell-id'>" + esc(x.id) + "</td><td>" + esc(x.nombre) + "</td><td>" + esc(x.tipo) + "</td><td>" + esc(x.estado) + "</td><td class='carr-cell-readonly'>" + esc(x.updatedAtLocal || "—") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  window.CarrerasLocalRender = render;
  if (buscar) buscar.addEventListener("input", function () { q = buscar.value; render(); });
  if (limpiar) limpiar.addEventListener("click", function () { if (buscar) buscar.value = ""; q = ""; render(); });
  if (recargar) recargar.addEventListener("click", render);
  setTimeout(render, 200);
  window.addEventListener("curriculo-local-status", render);
});
