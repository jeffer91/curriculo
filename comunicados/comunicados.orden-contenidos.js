/* =========================================================
Nombre completo: comunicados.orden-contenidos.js
Ruta: /Curriculo/comunicados/comunicados.orden-contenidos.js
Funciones:
- Ordenar los contenidos de cada unidad por su numeración jerárquica.
- Comparar cada segmento numérico para ubicar 3.2.9 antes de 3.2.10.
- Colocar componentes padre antes de sus subcomponentes.
- Corregir también comunicados generados con datos existentes en BDLocal.
- Mantener al final los contenidos que no tengan numeración reconocible.
========================================================= */

(function (window) {
  "use strict";

  window.ComunicadosCCC = window.ComunicadosCCC || {};

  var Plantilla = window.ComunicadosCCC.Plantilla;

  if (!Plantilla || Plantilla.__ordenContenidosJerarquicoV1) return;

  var generarDocumentoOriginal = Plantilla.generarDocumento.bind(Plantilla);
  var generarMultipleOriginal = Plantilla.generarDocumentoMultiple.bind(Plantilla);

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function textoPlanoDesdeHTML(valor) {
    return texto(valor)
      .replace(/^<p\b[^>]*>/i, "")
      .replace(/<\/p>\s*$/i, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extraerRutaNumerica(valor) {
    var plano = textoPlanoDesdeHTML(valor);
    var match = plano.match(/^\s*(\d+(?:\.\d+)*)/);

    if (!match) return null;

    return match[1].split(".").map(function (segmento) {
      return Number(segmento);
    });
  }

  function compararRutasNumericas(a, b) {
    var limite = Math.max(a.length, b.length);

    for (var i = 0; i < limite; i += 1) {
      if (i >= a.length) return -1;
      if (i >= b.length) return 1;

      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }

    return 0;
  }

  function ordenarValores(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (valor, index) {
      return {
        valor: valor,
        index: index,
        ruta: extraerRutaNumerica(valor)
      };
    }).sort(function (a, b) {
      if (a.ruta && b.ruta) {
        var comparacion = compararRutasNumericas(a.ruta, b.ruta);
        return comparacion || (a.index - b.index);
      }

      if (a.ruta) return -1;
      if (b.ruta) return 1;

      return a.index - b.index;
    }).map(function (item) {
      return item.valor;
    });
  }

  function ordenarDatos(documento) {
    if (!documento || !documento.data || !Array.isArray(documento.data.unidades)) return;

    documento.data.unidades.forEach(function (unidad) {
      if (!unidad || !Array.isArray(unidad.contenidos)) return;
      unidad.contenidos = ordenarValores(unidad.contenidos);
    });
  }

  function ordenarHTML(html) {
    return texto(html).replace(
      /(<div class="com-pdf-lista-contenidos">)([\s\S]*?)(<\/div>)/gi,
      function (coincidencia, apertura, cuerpo, cierre) {
        var patronContenido = /<p class="com-pdf-contenido[^"]*">[\s\S]*?<\/p>/gi;
        var bloques = cuerpo.match(patronContenido) || [];

        if (bloques.length < 2) return coincidencia;

        var ordenados = ordenarValores(bloques);
        var resto = cuerpo.replace(patronContenido, "");

        return apertura + ordenados.join("") + resto + cierre;
      }
    );
  }

  function ajustarDocumento(documento) {
    if (!documento || typeof documento !== "object") return documento;
    if (documento.__ordenContenidosJerarquicoV1) return documento;

    ordenarDatos(documento);
    documento.html = ordenarHTML(documento.html);
    documento.__ordenContenidosJerarquicoV1 = true;

    return documento;
  }

  Plantilla.generarDocumento = function (detalle, reserva, config) {
    return ajustarDocumento(
      generarDocumentoOriginal(detalle, reserva, config)
    );
  };

  Plantilla.generarDocumentoMultiple = function (items, config) {
    var resultado = generarMultipleOriginal(items, config);
    var documentos = resultado && Array.isArray(resultado.documentos)
      ? resultado.documentos.map(ajustarDocumento)
      : [];

    if (resultado && typeof resultado === "object") {
      resultado.documentos = documentos;
      resultado.html = documentos.map(function (documento) {
        return documento.html || "";
      }).join("");
    }

    return resultado;
  };

  Plantilla.__ordenContenidosJerarquicoV1 = true;

  console.info("[ComunicadosCCC.OrdenContenidos] Orden jerárquico numérico activo para los PDF.");
})(window);
