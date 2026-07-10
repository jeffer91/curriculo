/* =========================================================
Nombre completo: comunicados.override.js
Ruta o ubicación: /Curriculo/comunicados/comunicados.override.js
Función o funciones:
- Exigir integridad curricular antes de generar comunicados.
- Sustituir rutas de logo por el logo exacto embebido.
- Mejorar el diseño institucional sin alterar la lógica de guardado PDF.
- Añadir código, nivel, pie institucional y evitar numeración duplicada de contenidos.
========================================================= */

(function (window) {
  "use strict";

  var NS = window.ComunicadosCCC;
  if (!NS || !NS.Plantilla) {
    console.error("[ComunicadosCCC.Override] La plantilla base no está disponible.");
    return;
  }

  var originalDocumento = NS.Plantilla.generarDocumento.bind(NS.Plantilla);
  var originalMultiple = NS.Plantilla.generarDocumentoMultiple.bind(NS.Plantilla);

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function contenidoCompleto(data, detalle) {
    data = data || {};
    detalle = detalle || {};
    var integridad = detalle.materia && detalle.materia.integridadContenido;

    if (integridad && integridad.completo === false) {
      return { ok: false, faltantes: arr(integridad.faltantes) };
    }

    var faltantes = [];
    if (!data.descripcion || /^No se registra/i.test(data.descripcion)) faltantes.push("descripción");
    if (!data.objetivo || /^No se registra/i.test(data.objetivo)) faltantes.push("objetivo");

    var unidades = arr(data.unidades);
    if (unidades.length !== 4) faltantes.push("cuatro unidades");
    if (unidades.filter(function (u) { return texto(u.nombre) && u.nombre !== "No registrada"; }).length < 4) faltantes.push("nombres de las cuatro unidades");
    if (unidades.filter(function (u) { return texto(u.resultadoAprendizaje) && u.resultadoAprendizaje !== "No registrado"; }).length < 4) faltantes.push("resultados de aprendizaje");
    if (unidades.filter(function (u) { return texto(u.competencia) && u.competencia !== "No registrada"; }).length < 4) faltantes.push("competencias");
    if (unidades.reduce(function (total, u) { return total + arr(u.contenidos).length; }, 0) < 1) faltantes.push("contenidos");
    if (!arr(data.actividades).length) faltantes.push("actividades");
    if (!arr(data.bibliografia).length) faltantes.push("bibliografía");
    if (arr(data.bibliografia).some(function (b) { return !texto(b.justificacion); })) faltantes.push("justificación de cada bibliografía");

    return { ok: faltantes.length === 0, faltantes: faltantes };
  }

  function cssInstitucional() {
    return '<style id="comunicadoInstitucionalOverride">' +
      '@page{size:A4;margin:13mm 15mm 15mm 15mm}' +
      '.com-pdf-page{min-height:0!important;page-break-after:always;break-after:page;color:#111;font-size:10pt;line-height:1.45}' +
      '.com-pdf-page:last-child{page-break-after:auto;break-after:auto}' +
      '.com-pdf-header{display:grid!important;grid-template-columns:76mm 1fr;gap:10mm;align-items:center;margin:0 0 6mm!important;padding:0 0 5mm!important;border-bottom:1.2px solid #111}' +
      '.com-pdf-logo{display:block!important;width:70mm!important;max-width:70mm!important;height:auto!important;max-height:28mm!important;margin:0!important;object-fit:contain!important;object-position:left center!important;opacity:1!important;filter:none!important}' +
      '.com-pdf-identificacion{text-align:right}.com-pdf-tipo{font-size:8.5pt;font-weight:700;letter-spacing:.12em;margin-bottom:2mm}' +
      '.com-pdf-numero{margin:0!important;text-align:right!important;font-size:12.5pt!important;font-weight:800!important;line-height:1.2}' +
      '.com-pdf-codigo{font-size:10.5pt;font-weight:700;margin-top:1.5mm}' +
      '.com-pdf-resumen{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111;margin:0 0 6mm!important}' +
      '.com-pdf-resumen p{margin:0!important;padding:3mm 3.5mm;border-right:1px solid #111;border-bottom:1px solid #111;text-align:left!important}' +
      '.com-pdf-resumen p:nth-child(2n){border-right:0}.com-pdf-resumen p:nth-last-child(-n+2){border-bottom:0}' +
      '.com-pdf-resumen strong{display:block;font-size:8pt;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.8mm}' +
      '.com-pdf-seccion,.com-pdf-unidad{margin:0 0 6mm!important;padding:0!important}' +
      '.com-pdf-seccion>h1,.com-pdf-unidad>h2{margin:0 0 3mm!important;padding:2.2mm 3mm!important;border:1px solid #111!important;background:#f2f2f2!important;font-size:10.5pt!important;line-height:1.25!important;text-transform:uppercase;letter-spacing:.04em;page-break-after:avoid;break-after:avoid}' +
      '.com-pdf-unidad{border:1px solid #111!important;page-break-inside:auto!important;break-inside:auto!important}' +
      '.com-pdf-unidad>h2{margin:0!important;border-width:0 0 1px!important;background:#e9e9e9!important}' +
      '.com-pdf-campo{margin:0!important;padding:3mm!important;border-bottom:1px solid #c5c5c5}.com-pdf-campo:last-child{border-bottom:0}' +
      '.com-pdf-campo>strong{display:block;margin:0 0 1.5mm;font-size:8.3pt;text-transform:uppercase;letter-spacing:.04em}' +
      '.com-pdf-campo p,.com-pdf-seccion p{text-align:justify!important;margin:0!important}' +
      '.com-pdf-lista-contenidos{list-style:none!important;margin:0!important;padding:0!important}' +
      '.com-pdf-lista-contenidos li{margin:0 0 1.5mm!important;padding:0!important;text-align:justify!important;page-break-inside:avoid;break-inside:avoid}' +
      '.com-pdf-table{width:100%;margin:0;border-collapse:collapse;table-layout:fixed}' +
      '.com-pdf-table th,.com-pdf-table td{border:1px solid #111!important;padding:2.2mm 2.5mm!important;vertical-align:top;font-size:9pt;overflow-wrap:anywhere}' +
      '.com-pdf-table th{background:#ededed!important;font-weight:800}' +
      '.com-pdf-bibliografia-item{margin:0 0 3.5mm!important;padding:3mm!important;border:1px solid #111!important;page-break-inside:avoid;break-inside:avoid}' +
      '.com-pdf-bibliografia-item p{margin:0 0 2mm!important}.com-pdf-bibliografia-item p:last-child{margin-bottom:0!important}' +
      '.com-pdf-footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #111;display:flex;justify-content:space-between;gap:8mm;font-size:8pt;page-break-inside:avoid;break-inside:avoid}' +
      '.com-pdf-footer strong{text-transform:uppercase}.com-pdf-footer span{text-align:right}' +
      '</style>';
  }

  function mejorar(documento, detalle, config) {
    documento = documento || {};
    var data = documento.data || {};
    var validacion = contenidoCompleto(data, detalle);

    if (!validacion.ok) {
      throw new Error("No se puede generar el comunicado. Faltan: " + validacion.faltantes.join(", ") + ". Vuelve a importar el ZIP y verifica BDLocal.");
    }

    var logo = texto(window.CURRICULO_LOGO_COMUNICADO || config && config.logoSrc);
    var materia = detalle && detalle.materia || {};
    var nivel = detalle && detalle.nivel || {};
    var unidadResponsable = texto(config && config.unidadResponsable || "UNIDAD DE GESTIÓN PEDAGÓGICA ACADÉMICA");
    var nota = texto(config && config.nota || "");

    var encabezado = '<header class="com-pdf-header">' +
      '<div class="com-pdf-logo-wrap">' + (logo ? '<img class="com-pdf-logo" src="' + escapar(logo) + '" alt="ITSQMET">' : '') + '</div>' +
      '<div class="com-pdf-identificacion"><div class="com-pdf-tipo">COMUNICADO INSTITUCIONAL</div>' +
      '<div class="com-pdf-numero">Comunicado No. 01</div><div class="com-pdf-codigo">' + escapar(data.numeroComunicado) + '</div></div>' +
      '</header>';

    var resumen = '<section class="com-pdf-resumen">' +
      '<p><strong>Carrera</strong>' + escapar(data.carrera) + '</p>' +
      '<p><strong>Asignatura</strong>' + escapar(data.nombreAsignatura) + '</p>' +
      '<p><strong>Código</strong>' + escapar(materia.codigo || materia.codigoMateria || 'S/C') + '</p>' +
      '<p><strong>Nivel</strong>' + escapar(nivel.nombre || materia.nivelNombre || 'No registrado') + '</p>' +
      '</section>';

    var pie = '<footer class="com-pdf-footer"><strong>' + escapar(unidadResponsable) + '</strong>' +
      (nota ? '<span>' + escapar(nota) + '</span>' : '') + '</footer>';

    var html = texto(documento.html);
    html = html.replace(/<header class="com-pdf-header">[\s\S]*?<\/header>/, encabezado);
    html = html.replace(/<section class="com-pdf-resumen">[\s\S]*?<\/section>/, resumen);
    html = html.replace('</main>', pie + '</main>');
    html = cssInstitucional() + html;

    return Object.assign({}, documento, { html: html });
  }

  NS.Plantilla.generarDocumento = function (detalle, reserva, config) {
    return mejorar(originalDocumento(detalle, reserva, config), detalle, config || {});
  };

  NS.Plantilla.generarDocumentoMultiple = function (items, config) {
    var resultado = originalMultiple(items, config);
    var documentos = arr(resultado.documentos).map(function (documento, indice) {
      return mejorar(documento, items[indice] && items[indice].detalle, config || {});
    });

    return Object.assign({}, resultado, {
      documentos: documentos,
      html: documentos.map(function (documento) { return documento.html; }).join("")
    });
  };

  console.info("[ComunicadosCCC.Override] Diseño institucional e integridad activos.");
})(window);
