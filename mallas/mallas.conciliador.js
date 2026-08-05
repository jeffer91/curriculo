/* =========================================================
Nombre completo: mallas.conciliador.js
Ruta o ubicación: /Curriculo/mallas/mallas.conciliador.js
Funciones:
- Reconocer materias iguales aunque cambien tildes, signos o números romanos.
- Detectar posibles coincidencias que requieren confirmación.
- Separar coincidencias seguras, dudosas y materias realmente nuevas.
========================================================= */
(function (root, factory) {
  "use strict";
  var API = factory();
  if (typeof module === "object" && module.exports) module.exports = API;
  if (root) root.MallasConciliador = API;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = "1.0.0";
  var ROMANOS = Object.freeze({ x: "10", ix: "9", viii: "8", vii: "7", vi: "6", v: "5", iv: "4", iii: "3", ii: "2", i: "1" });
  var PALABRAS_VACIAS = Object.freeze({
    a: true, al: true, de: true, del: true, el: true, la: true, las: true, los: true,
    en: true, para: true, por: true, y: true, e: true, un: true, una: true
  });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function nivel(materia) {
    var n = Number(materia && (materia.nivelNumero || materia.numeroNivel || materia.nivel));
    return Number.isFinite(n) ? n : 0;
  }

  function nombre(materia) {
    return texto(materia && (materia.nombreOficial || materia.nombre || materia.nombreMateria || materia.materia));
  }

  function normalizarMateria(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " y ")
      .replace(/[_\-–—./,;:()[\]{}]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/g, function (romano) {
        return ROMANOS[romano] || romano;
      })
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensSignificativos(valor) {
    return normalizarMateria(valor).split(" ").filter(function (token) {
      return token && !PALABRAS_VACIAS[token];
    });
  }

  function firmaSignificativa(valor) {
    return tokensSignificativos(valor).join(" ");
  }

  function mismoId(a, b) {
    var idA = texto(a && a.materiaFirebaseId);
    var idB = texto(b && b.materiaFirebaseId);
    return !!idA && !!idB && idA === idB;
  }

  function sonIgualesSeguras(a, b) {
    if (mismoId(a, b)) return true;
    if (nivel(a) !== nivel(b)) return false;
    var normalA = normalizarMateria(nombre(a));
    var normalB = normalizarMateria(nombre(b));
    if (!normalA || !normalB) return false;
    if (normalA === normalB) return true;
    var firmaA = firmaSignificativa(normalA);
    var firmaB = firmaSignificativa(normalB);
    return !!firmaA && firmaA === firmaB;
  }

  function similitud(a, b) {
    if (nivel(a) !== nivel(b)) return 0;
    var tokensA = tokensSignificativos(nombre(a));
    var tokensB = tokensSignificativos(nombre(b));
    if (!tokensA.length || !tokensB.length) return 0;
    var conjuntoA = Array.from(new Set(tokensA));
    var conjuntoB = Array.from(new Set(tokensB));
    var interseccion = conjuntoA.filter(function (token) { return conjuntoB.indexOf(token) !== -1; }).length;
    if (!interseccion) return 0;
    var union = Array.from(new Set(conjuntoA.concat(conjuntoB))).length;
    var cobertura = interseccion / Math.min(conjuntoA.length, conjuntoB.length);
    var jaccard = interseccion / Math.max(1, union);
    return Number((cobertura * 0.65 + jaccard * 0.35).toFixed(4));
  }

  function buscarMejorPosible(actuales, importada, usados) {
    var mejor = null;
    (Array.isArray(actuales) ? actuales : []).forEach(function (actual) {
      var clave = texto(actual && actual.materiaFirebaseId) || (nivel(actual) + "|" + normalizarMateria(nombre(actual)));
      if (usados && usados[clave]) return;
      if (sonIgualesSeguras(actual, importada)) return;
      var puntaje = similitud(actual, importada);
      if (puntaje < 0.58) return;
      if (!mejor || puntaje > mejor.puntaje) mejor = { actual: actual, importada: importada, puntaje: puntaje, clave: clave };
    });
    return mejor;
  }

  function analizar(actuales, importadas) {
    actuales = Array.isArray(actuales) ? actuales : [];
    importadas = Array.isArray(importadas) ? importadas : [];
    var usados = {};
    var exactas = [];
    var posibles = [];
    var nuevas = [];

    importadas.forEach(function (importada) {
      var exacta = actuales.find(function (actual) { return sonIgualesSeguras(actual, importada); });
      if (exacta) {
        exactas.push({ actual: exacta, importada: importada, puntaje: 1 });
        return;
      }
      var posible = buscarMejorPosible(actuales, importada, usados);
      if (posible) {
        posibles.push(posible);
        usados[posible.clave] = true;
        return;
      }
      nuevas.push(importada);
    });

    return { exactas: exactas, posibles: posibles, nuevas: nuevas };
  }

  return {
    VERSION: VERSION,
    normalizarMateria: normalizarMateria,
    tokensSignificativos: tokensSignificativos,
    firmaSignificativa: firmaSignificativa,
    sonIgualesSeguras: sonIgualesSeguras,
    similitud: similitud,
    buscarMejorPosible: buscarMejorPosible,
    analizar: analizar
  };
});
