/* =========================================================
Nombre completo: mallas.comparador.js
Ruta o ubicación: /Curriculo/mallas/mallas.comparador.js
Funciones:
- Comparar materias detectadas en un ZIP contra una malla oficial.
- Usar equivalencias, nombre normalizado y nivel, sin depender de códigos.
- Normalizar tildes, signos, números romanos y distintas formas de escribir niveles.
- Proponer coincidencias por similitud sin confirmarlas automáticamente.
- Garantizar relaciones uno a uno entre materia detectada y oficial.
========================================================= */
(function (root, factory) {
  "use strict";
  var API = factory();
  if (typeof module === "object" && module.exports) module.exports = API;
  if (root) root.MallasComparador = API;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = "1.1.0";
  var ROMANOS = Object.freeze({ x: "10", ix: "9", viii: "8", vii: "7", vi: "6", v: "5", iv: "4", iii: "3", ii: "2", i: "1" });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizar(valor) {
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

  function numeroNivel(valor) {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return valor > 0 ? Math.trunc(valor) : 0;
    }

    var limpio = normalizar(valor);
    if (!limpio) return 0;

    var directo = Number(limpio);
    if (Number.isFinite(directo) && directo > 0) return Math.trunc(directo);

    var coincidencia = limpio.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
    if (!coincidencia) return 0;

    var n = Number(coincidencia[1]);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }

  function nivel(item) {
    if (!item) return 0;

    var candidatos = [
      item.nivelNumero,
      item.numeroNivel,
      item.mallaNivelOficial,
      item.nivel,
      item.nivelNombre,
      item.estructura,
      item.estructuraNombre
    ];

    for (var i = 0; i < candidatos.length; i += 1) {
      var n = numeroNivel(candidatos[i]);
      if (n > 0) return n;
    }

    return 0;
  }

  function etiquetaNivel(valor) {
    var n = numeroNivel(valor);
    return n > 0 ? "Nivel " + n : "Sin nivel";
  }

  function nombreDetectado(item) {
    return texto(item && (item.nombreOriginalDetectado || item.nombre || item.nombreMateria || item.materia));
  }

  function nombreOficial(item) {
    return texto(item && (item.nombreOficial || item.nombre || item.nombreMateria));
  }

  function idOficial(item, indice) {
    return texto(item && (item.id || item.mallaMateriaId)) || "oficial_" + indice;
  }

  function tokens(valor) {
    var salida = {};
    normalizar(valor).split(" ").filter(Boolean).forEach(function (token) {
      salida[token] = true;
    });
    return salida;
  }

  function similitud(a, b) {
    var ta = tokens(a);
    var tb = tokens(b);
    var aa = Object.keys(ta);
    var bb = Object.keys(tb);
    if (!aa.length || !bb.length) return 0;
    var comunes = aa.filter(function (token) { return tb[token]; }).length;
    return (2 * comunes) / (aa.length + bb.length);
  }

  function claveEquivalencia(nombre, numeroNivelValor) {
    return normalizar(nombre) + "|n" + numeroNivel(numeroNivelValor);
  }

  function prepararOficiales(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (item, indice) {
      return Object.assign({}, item, {
        __id: idOficial(item, indice),
        __nombre: nombreOficial(item),
        __nombreNormalizado: normalizar(item && (item.nombreNormalizado || nombreOficial(item))),
        __nivel: nivel(item)
      });
    });
  }

  function prepararDetectadas(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (item, indice) {
      return {
        referencia: item,
        indice: indice,
        id: texto(item && item.id) || "detectada_" + indice,
        nombre: nombreDetectado(item),
        nombreNormalizado: normalizar(nombreDetectado(item)),
        nivel: nivel(item)
      };
    });
  }

  function mapaEquivalencias(lista) {
    var mapa = {};
    (Array.isArray(lista) ? lista : []).forEach(function (item) {
      var clave = claveEquivalencia(
        item && (item.nombreDetectadoNormalizado || item.nombreDetectado),
        item && item.nivelDetectado
      );
      if (clave !== "|n0") mapa[clave] = item;
    });
    return mapa;
  }

  function unico(lista) {
    return lista.length === 1 ? lista[0] : null;
  }

  function comparar(materiasDetectadas, materiasOficiales, equivalencias, opciones) {
    opciones = opciones || {};
    var umbral = Number(opciones.umbralSimilitud || 0.86);
    var margen = Number(opciones.margenSimilitud || 0.08);
    var oficiales = prepararOficiales(materiasOficiales);
    var detectadas = prepararDetectadas(materiasDetectadas);
    var equivalenciasMapa = mapaEquivalencias(equivalencias);
    var usados = {};
    var coincidencias = [];
    var noVinculadas = [];
    var conflictos = [];

    function disponibles(filtro) {
      return oficiales.filter(function (oficial) {
        return !usados[oficial.__id] && filtro(oficial);
      });
    }

    function vincular(detectada, oficial, criterio, confianza, equivalencia) {
      usados[oficial.__id] = true;
      coincidencias.push({
        detectada: detectada.referencia,
        detectadaId: detectada.id,
        oficial: oficial,
        oficialId: oficial.__id,
        criterio: criterio,
        confianza: Number(confianza || 1),
        equivalencia: equivalencia || null,
        requiereConfirmacion: false
      });
    }

    detectadas.forEach(function (detectada) {
      var oficial = null;
      var equivalencia = equivalenciasMapa[claveEquivalencia(detectada.nombre, detectada.nivel)] || null;

      if (equivalencia) {
        oficial = disponibles(function (item) {
          return item.__id === texto(equivalencia.mallaMateriaId || equivalencia.oficialId);
        })[0] || null;
        if (oficial) {
          vincular(detectada, oficial, "equivalencia_guardada", 1, equivalencia);
          return;
        }
      }

      oficial = unico(disponibles(function (item) {
        return item.__nombreNormalizado === detectada.nombreNormalizado && item.__nivel === detectada.nivel;
      }));
      if (oficial) {
        vincular(detectada, oficial, "nombre_y_nivel", 1);
        return;
      }

      var mismoNombreOtroNivel = disponibles(function (item) {
        return item.__nombreNormalizado === detectada.nombreNormalizado && item.__nivel !== detectada.nivel;
      });
      if (mismoNombreOtroNivel.length === 1) {
        noVinculadas.push({
          detectada: detectada.referencia,
          detectadaId: detectada.id,
          motivo: "nivel_diferente",
          sugerencia: mismoNombreOtroNivel[0],
          similitud: 1,
          requiereConfirmacion: true
        });
        return;
      }

      var similares = disponibles(function (item) {
        return item.__nivel === detectada.nivel;
      }).map(function (item) {
        return { oficial: item, valor: similitud(detectada.nombre, item.__nombre) };
      }).filter(function (item) {
        return item.valor >= umbral;
      }).sort(function (a, b) {
        return b.valor - a.valor;
      });

      if (similares.length && (similares.length === 1 || similares[0].valor - similares[1].valor >= margen)) {
        noVinculadas.push({
          detectada: detectada.referencia,
          detectadaId: detectada.id,
          motivo: "posible_coincidencia",
          sugerencia: similares[0].oficial,
          similitud: similares[0].valor,
          requiereConfirmacion: true
        });
        return;
      }

      if (similares.length > 1) {
        conflictos.push({
          detectada: detectada.referencia,
          detectadaId: detectada.id,
          motivo: "varias_coincidencias",
          opciones: similares.slice(0, 5)
        });
      }

      noVinculadas.push({
        detectada: detectada.referencia,
        detectadaId: detectada.id,
        motivo: similares.length > 1 ? "varias_coincidencias" : "no_contemplada",
        sugerencia: null,
        similitud: 0,
        requiereConfirmacion: true
      });
    });

    var faltantes = oficiales.filter(function (oficial) {
      return !usados[oficial.__id];
    });

    return {
      coincidencias: coincidencias,
      faltantes: faltantes,
      noVinculadas: noVinculadas,
      conflictos: conflictos,
      resumen: {
        totalOficiales: oficiales.length,
        totalDetectadas: detectadas.length,
        vinculadas: coincidencias.length,
        faltantes: faltantes.length,
        noVinculadas: noVinculadas.length,
        conflictos: conflictos.length,
        completa: faltantes.length === 0 && noVinculadas.length === 0
      }
    };
  }

  function aplicarVinculo(materia, oficial, datos) {
    materia = materia || {};
    oficial = oficial || {};
    datos = datos || {};
    var original = nombreDetectado(materia);
    materia.nombreOriginalDetectado = materia.nombreOriginalDetectado || original;
    materia.nombreOriginalImportado = materia.nombreOriginalImportado || original;
    materia.nombreOficialMalla = nombreOficial(oficial);
    materia.nombreInstitucional = nombreOficial(oficial);
    materia.nombre = nombreOficial(oficial);
    materia.mallaId = texto(datos.mallaId || oficial.mallaId);
    materia.mallaVersion = Number(datos.mallaVersion || oficial.mallaVersion || 0);
    materia.mallaMateriaId = idOficial(oficial, 0);
    materia.mallaNivelOficial = nivel(oficial);
    materia.vinculacionMalla = texto(datos.criterio || "manual");
    materia.mallaVinculada = true;
    return materia;
  }

  return {
    VERSION: VERSION,
    normalizar: normalizar,
    numeroNivel: numeroNivel,
    nivel: nivel,
    etiquetaNivel: etiquetaNivel,
    similitud: similitud,
    claveEquivalencia: claveEquivalencia,
    comparar: comparar,
    aplicarVinculo: aplicarVinculo
  };
});
