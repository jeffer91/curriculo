const $pdf = id => document.getElementById(id);
const textoPdf = value => String(value ?? "").trim();

function normalizarEspaciosPdf(value) {
  return textoPdf(value).replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function textoElemento(id) {
  const el = $pdf(id);
  return el ? normalizarEspaciosPdf(el.innerText || el.textContent || "") : "";
}

function nombreArchivo(value) {
  return normalizarEspaciosPdf(value || "materia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "materia";
}

function wrapTextPdf(text, width = 88) {
  const entrada = normalizarEspaciosPdf(text);
  if (!entrada) return [""];
  const salida = [];
  entrada.split("\n").forEach(parrafo => {
    const p = parrafo.trim();
    if (!p) { salida.push(""); return; }
    const words = p.split(/\s+/);
    let line = "";
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        salida.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) salida.push(line);
  });
  return salida.length ? salida : [""];
}

function pdfSafeMateria(value) {
  return textoPdf(value)
    .replace(/[\\()]/g, m => `\\${m}`)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-");
}

function latin1BytesMateria(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    out[i] = code <= 255 ? code : 63;
  }
  return out;
}

function descargarPdfMateria(lineas, filename) {
  const wrapped = [];
  lineas.forEach(item => {
    if (item === "") wrapped.push("");
    else wrapTextPdf(item).forEach(line => wrapped.push(line));
  });

  const paginas = [];
  for (let i = 0; i < wrapped.length; i += 46) paginas.push(wrapped.slice(i, i + 46));
  if (!paginas.length) paginas.push([""]);

  const objects = [];
  const pageNums = [];
  const contentNums = [];
  let next = 4;
  paginas.forEach(() => { pageNums.push(next++); contentNums.push(next++); });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${paginas.length} /Kids [${pageNums.map(n => `${n} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  paginas.forEach((lines, idx) => {
    const stream = `BT\n/F1 10 Tf\n48 794 Td\n15 TL\n${lines.map(line => `(${pdfSafeMateria(line)}) Tj\nT*`).join("\n")}\nET`;
    objects[pageNums[idx]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNums[idx]} 0 R >>`;
    objects[contentNums[idx]] = `<< /Length ${latin1BytesMateria(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = latin1BytesMateria(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = latin1BytesMateria(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([latin1BytesMateria(pdf)], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function obtenerLineasUnidades() {
  const lineas = [];
  document.querySelectorAll("#materiaUnidades .unit-card").forEach(card => {
    const numero = normalizarEspaciosPdf(card.querySelector(".unit-number")?.textContent || "");
    const nombre = normalizarEspaciosPdf(card.querySelector(".unit-head strong")?.textContent || "");
    lineas.push("", `UNIDAD ${numero}${nombre ? ` - ${nombre}` : ""}`);

    card.querySelectorAll(".unit-field").forEach(field => {
      const etiqueta = normalizarEspaciosPdf(field.querySelector(":scope > span")?.textContent || "");
      const valores = Array.from(field.querySelectorAll("p, li"))
        .map(el => normalizarEspaciosPdf(el.textContent || ""))
        .filter(Boolean);
      const fallback = normalizarEspaciosPdf(field.textContent || "").replace(etiqueta, "").trim();
      if (etiqueta) lineas.push(`${etiqueta}:`);
      if (valores.length) valores.forEach((v, index) => lineas.push(etiqueta === "Contenidos" ? `${index + 1}. ${v}` : v));
      else lineas.push(fallback || "Sin información registrada.");
    });
  });
  return lineas;
}

function obtenerLista(selector) {
  const items = Array.from(document.querySelectorAll(`${selector} li, ${selector} .info-card`))
    .map(el => normalizarEspaciosPdf(el.innerText || el.textContent || ""))
    .filter(Boolean);
  if (items.length) return items;
  const fallback = document.querySelector(selector);
  const text = normalizarEspaciosPdf(fallback?.innerText || fallback?.textContent || "");
  return text ? [text] : ["Sin información registrada."];
}

function construirPdfMateria() {
  const materia = textoElemento("materiaNombre");
  if (!materia) return;

  const lineas = [
    "ITSQMET - GESTION CURRICULAR",
    "INFORMACION CURRICULAR DE LA ASIGNATURA",
    "",
    `Materia: ${materia}`,
    `Carrera: ${textoElemento("materiaCarrera") || "-"}`,
    `Nivel: ${textoElemento("materiaNivel") || "-"}`,
    `Codigo: ${textoElemento("materiaCodigo") || "-"}`,
    `Version: ${textoElemento("materiaVersion") || "-"}`,
    `Fecha de consulta: ${new Date().toLocaleDateString("es-EC")}`,
    "",
    "DESCRIPCION DE LA ASIGNATURA",
    textoElemento("materiaDescripcion") || "Sin información registrada.",
    "",
    "OBJETIVO DE LA ASIGNATURA",
    textoElemento("materiaObjetivo") || "Sin información registrada.",
    ...obtenerLineasUnidades(),
    "",
    "ACTIVIDADES"
  ];

  obtenerLista("#materiaActividades").forEach((item, index) => lineas.push(`${index + 1}. ${item}`));
  lineas.push("", "BIBLIOGRAFIA");
  obtenerLista("#materiaBibliografia").forEach((item, index) => lineas.push(`${index + 1}. ${item}`));
  lineas.push("", "Documento generado desde la consulta curricular institucional.");

  descargarPdfMateria(lineas, `informacion-curricular-${nombreArchivo(materia)}.pdf`);
}

const btnPdfMateria = $pdf("btnPdfMateria");
const materiaDetalle = $pdf("materiaDetalle");
const materiaCargando = $pdf("materiaCargando");
const materiaNombre = $pdf("materiaNombre");

function actualizarEstadoBotonPdf() {
  if (!btnPdfMateria) return;
  const visible = materiaDetalle && !materiaDetalle.classList.contains("hidden");
  const cargando = materiaCargando && !materiaCargando.classList.contains("hidden");
  btnPdfMateria.disabled = !visible || !!cargando || !normalizarEspaciosPdf(materiaNombre?.textContent || "");
}

if (btnPdfMateria) {
  btnPdfMateria.addEventListener("click", construirPdfMateria);
  [materiaDetalle, materiaCargando, materiaNombre].filter(Boolean).forEach(el => {
    new MutationObserver(actualizarEstadoBotonPdf).observe(el, { attributes:true, childList:true, subtree:true, characterData:true });
  });
  actualizarEstadoBotonPdf();
}
