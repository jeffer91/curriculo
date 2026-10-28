/* Exportador DOCX auténtico basado en Office Open XML y JSZip local. */
(function (window) {
  "use strict";
  var NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  function esc(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function textoRun(value, formato) {
    if (!value) return "";
    formato = formato || {};
    var props = (formato.bold ? "<w:b/>" : "") +
      (formato.italic ? "<w:i/>" : "") + (formato.underline ? '<w:u w:val="single"/>' : "");
    return "<w:r>" + (props ? "<w:rPr>" + props + "</w:rPr>" : "") +
      '<w:t xml:space="preserve">' + esc(value) + "</w:t></w:r>";
  }
  function runs(nodo, formato) {
    if (!nodo) return "";
    if (nodo.nodeType === 3) return textoRun(nodo.nodeValue, formato);
    if (nodo.nodeType !== 1) return "";
    var tag = String(nodo.tagName || "").toLowerCase();
    if (tag === "br") return "<w:r><w:br/></w:r>";
    if (["script", "style", "iframe", "object", "svg"].indexOf(tag) !== -1) return "";
    var formatoNuevo = Object.assign({}, formato || {});
    if (tag === "strong" || tag === "b" || tag === "th") formatoNuevo.bold = true;
    if (tag === "i" || tag === "em") formatoNuevo.italic = true;
    if (tag === "u") formatoNuevo.underline = true;
    return Array.from(nodo.childNodes || []).map(function (child) { return runs(child, formatoNuevo); }).join("");
  }
  function parrafo(nodo, estilo, prefijo) {
    var contenido = (prefijo ? textoRun(prefijo) : "") + runs(nodo);
    var estiloXml = estilo ? '<w:pPr><w:pStyle w:val="' + esc(estilo) + '"/></w:pPr>' : "";
    return "<w:p>" + estiloXml + (contenido || textoRun(" ")) + "</w:p>";
  }
  function filasTabla(nodo) {
    return Array.from(nodo.querySelectorAll("tr"));
  }
  function tabla(nodo) {
    var filas = filasTabla(nodo), columnCount = 1;
    filas.forEach(function (fila) { columnCount = Math.max(columnCount, fila.querySelectorAll("th,td").length); });
    var grid = Array.from({ length: columnCount }, function () { return '<w:gridCol w:w="' + Math.floor(9000 / columnCount) + '"/>'; }).join("");
    var body = filas.map(function (fila) {
      var cols = Array.from(fila.children).filter(function (c) { return /^(th|td)$/i.test(c.tagName); });
      var cells = cols.map(function (c) {
        var bold = c.tagName.toLowerCase() === "th";
        var p = "<w:p>" + (bold ? '<w:pPr><w:keepNext/></w:pPr>' : "") +
          (bold ? "<w:r><w:rPr><w:b/></w:rPr>" : "") +
          (bold ? '<w:t xml:space="preserve">' + esc(c.textContent || "") + '</w:t></w:r>' : runs(c)) +
          "</w:p>";
        return '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>' + p + '</w:tc>';
      }).join("");
      return "<w:tr>" + cells + "</w:tr>";
    }).join("");
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/>' +
      '<w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/>' +
      '<w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>' +
      '<w:tblGrid>' + grid + '</w:tblGrid>' + body + '</w:tbl>';
  }
  function bloques(nodo) {
    var salida = [];
    Array.from(nodo.children || []).forEach(function (child) {
      var tag = child.tagName.toLowerCase();
      if (tag === "h1") salida.push(parrafo(child, "Title"));
      else if (tag === "h2") salida.push(parrafo(child, "Heading1"));
      else if (tag === "h3") salida.push(parrafo(child, "Heading2"));
      else if (tag === "h4") salida.push(parrafo(child, "Heading3"));
      else if (tag === "p") salida.push(parrafo(child));
      else if (tag === "table") salida.push(tabla(child));
      else if (tag === "ul" || tag === "ol") {
        Array.from(child.children).filter(function (li) { return li.tagName.toLowerCase() === "li"; })
          .forEach(function (li, i) { salida.push(parrafo(li, "", tag === "ol" ? (i + 1) + ". " : "• ")); });
      } else if (["div", "section", "article"].indexOf(tag) !== -1) {
        salida.push.apply(salida, bloques(child));
      } else if (child.textContent && child.textContent.trim()) salida.push(parrafo(child));
    });
    return salida;
  }
  function estilos() {
    var styles = [
      ["Normal", "Normal", 21, false],
      ["Title", "Título", 32, true],
      ["Heading1", "Encabezado 1", 26, true],
      ["Heading2", "Encabezado 2", 23, true],
      ["Heading3", "Encabezado 3", 21, true]
    ];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="' + NS + '">' + styles.map(function (s, i) {
        return '<w:style w:type="paragraph"' + (i === 0 ? ' w:default="1"' : "") +
          ' w:styleId="' + s[0] + '"><w:name w:val="' + esc(s[1]) + '"/>' +
          '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + s[2] + '"/>' +
          (s[3] ? '<w:b/>' : '') + '</w:rPr></w:style>';
      }).join("") + '</w:styles>';
  }
  async function crear(html) {
    if (!window.JSZip) throw new Error("Falta JSZip para exportar DOCX.");
    var contenedor = window.document.createElement("div");
    contenedor.innerHTML = String(html || "");
    var body = bloques(contenedor);
    if (!body.length) throw new Error("La ficha todavía no contiene información para Word.");
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + NS + '"><w:body>' + body.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1021" w:right="907" w:bottom="1021" w:left="907"/></w:sectPr>' +
      '</w:body></w:document>';
    var zip = new window.JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>');
    zip.folder("_rels").file(".rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>');
    zip.folder("word").file("document.xml", xml);
    zip.folder("word").file("styles.xml", estilos());
    zip.folder("word").folder("_rels").file("document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>');
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }
  window.CurriculoFichasDOCX = Object.freeze({ crear: crear });
})(window);
