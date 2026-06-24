document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("carrForm");
  if (form) {
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      await window.CurriculoLocal.put("carreras", "x", { id: "x" });
    });
  }
});
