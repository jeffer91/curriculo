/* Adapta textos heredados de BDLocal al origen Firebase. */
(function (window, document) {
  "use strict";
  function reemplazarTexto(valor) {
    return String(valor || "")
      .replace(/BDLocalCCC/g, "Firebase Firestore")
      .replace(/BDLocal/g, "Firebase")
      .replace(/base local/gi, "Firebase")
      .replace(/IndexedDB/g, "Cloud Firestore");
  }
  function recorrer(nodo) {
    if (!nodo) return;
    if (nodo.nodeType === 3 && /BDLocal|IndexedDB|base local/i.test(nodo.nodeValue || "")) {
      nodo.nodeValue = reemplazarTexto(nodo.nodeValue);
      return;
    }
    if (nodo.nodeType !== 1) return;
    Array.prototype.forEach.call(nodo.childNodes || [], recorrer);
  }
  function instalar() {
    recorrer(document.body);
    if (typeof window.MutationObserver !== "function") return;
    new window.MutationObserver(function (cambios) {
      cambios.forEach(function (cambio) {
        Array.prototype.forEach.call(cambio.addedNodes || [], recorrer);
        if (cambio.type === "characterData") recorrer(cambio.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", instalar, { once: true });
  else instalar();
})(window, document);
