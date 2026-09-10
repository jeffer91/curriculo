const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyB56KzqQmNesXuoQLgLEMrK9H-NOwuqEh8",
  authDomain: "curriculo-ddfcd.firebaseapp.com",
  projectId: "curriculo-ddfcd",
  storageBucket: "curriculo-ddfcd.firebasestorage.app",
  messagingSenderId: "895337192000",
  appId: "1:895337192000:web:20e456628871ce83679da5"
});
const SDK = "12.16.0";
const appSdk = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`);
const fs = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`);
const firebaseApp = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
let db;
try { db = fs.initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true }); }
catch (_) { db = fs.getFirestore(firebaseApp); }

const $ = (id) => document.getElementById(id);
const texto = (v) => String(v ?? "").trim();
const normalizar = (v) => texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const estado = { carreras: [], materiasConsulta: [], materiasFormulario: [], tramite: null };

function setFirebaseStatus(ok, message) {
  const el = $("firebaseStatus");
  el.textContent = message;
  el.className = `status-pill ${ok ? "ok" : "error"}`;
}
function option(value, label) { return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }
function escapeHtml(value) {
  return texto(value).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function nombreCarrera(c) { return texto(c.nombre || c.nombreCarrera || c.carrera || c.id); }
function nombreMateria(m) { return texto(m.nombreMostrar || m.nombre || m.materia || m.id); }
function nivelMateria(m) {
  const n = Number(m.nivelNumero ?? m.nivel ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function activo(item) { return item && item.activo !== false && normalizar(item.estadoValidacion) !== "retirado"; }
function ordenarTexto(a,b) { return a.localeCompare(b, "es", { sensitivity: "base", numeric: true }); }

async function cargarCarreras() {
  const snap = await fs.getDocs(fs.collection(db, "carreras"));
  estado.carreras = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(activo)
    .sort((a,b) => ordenarTexto(nombreCarrera(a), nombreCarrera(b)));
  [$("consultaCarrera"), $("formCarrera")].forEach(select => {
    select.innerHTML = '<option value="">Seleccionar carrera</option>' + estado.carreras.map(c => option(c.id, nombreCarrera(c))).join("");
  });
}
async function cargarMaterias(carreraId) {
  if (!carreraId) return [];
  const q = fs.query(fs.collection(db, "materias"), fs.where("carreraId", "==", carreraId));
  const snap = await fs.getDocs(q);
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(activo)
    .sort((a,b) => nivelMateria(a)-nivelMateria(b) || ordenarTexto(nombreMateria(a), nombreMateria(b)));
}
function llenarNiveles(select, materias) {
  const niveles = [...new Set(materias.map(nivelMateria).filter(Boolean))].sort((a,b)=>a-b);
  select.innerHTML = '<option value="">Seleccionar nivel</option>' + niveles.map(n => option(String(n), `Nivel ${n}`)).join("");
  select.disabled = !niveles.length;
}
function llenarMaterias(select, materias, nivel) {
  const filtradas = materias.filter(m => String(nivelMateria(m)) === String(nivel));
  select.innerHTML = '<option value="">Seleccionar materia</option>' + filtradas.map(m => option(m.id, nombreMateria(m))).join("");
  select.disabled = !nivel || !filtradas.length;
}
function carreraPorId(id) { return estado.carreras.find(c => c.id === id) || null; }
function materiaPorId(lista,id) { return lista.find(m => m.id === id) || null; }

async function alCambiarCarrera(tipo) {
  const esConsulta = tipo === "consulta";
  const carrera = $(esConsulta ? "consultaCarrera" : "formCarrera").value;
  const nivel = $(esConsulta ? "consultaNivel" : "formNivel");
  const materia = $(esConsulta ? "consultaMateria" : "formMateria");
  nivel.disabled = true; materia.disabled = true;
  nivel.innerHTML = '<option value="">Cargando…</option>';
  materia.innerHTML = '<option value="">Seleccionar materia</option>';
  if (!carrera) {
    nivel.innerHTML = '<option value="">Seleccionar nivel</option>';
    if (esConsulta) ocultarMateria();
    return;
  }
  try {
    const materias = await cargarMaterias(carrera);
    if (esConsulta) estado.materiasConsulta = materias; else estado.materiasFormulario = materias;
    llenarNiveles(nivel, materias);
    if (esConsulta) ocultarMateria();
  } catch (e) {
    nivel.innerHTML = '<option value="">No disponible</option>';
    mostrarMensaje(esConsulta ? "tramiteMensaje" : "formMensaje", `No se pudieron cargar las materias: ${e.message}`, true);
  }
}
function alCambiarNivel(tipo) {
  const esConsulta = tipo === "consulta";
  const nivel = $(esConsulta ? "consultaNivel" : "formNivel").value;
  llenarMaterias($(esConsulta ? "consultaMateria" : "formMateria"), esConsulta ? estado.materiasConsulta : estado.materiasFormulario, nivel);
  if (esConsulta) ocultarMateria();
}
function ocultarMateria() { $("materiaDetalle").classList.add("hidden"); $("materiaVacia").classList.remove("hidden"); }
function mostrarMateria() {
  const m = materiaPorId(estado.materiasConsulta, $("consultaMateria").value);
  if (!m) return ocultarMateria();
  const c = carreraPorId($("consultaCarrera").value);
  $("materiaNivel").textContent = `Nivel ${nivelMateria(m) || "—"}`;
  $("materiaNombre").textContent = nombreMateria(m);
  $("materiaVersion").textContent = m.versionActual ? `Versión ${m.versionActual}` : "";
  $("materiaCarrera").textContent = c ? nombreCarrera(c) : texto(m.carreraId);
  $("materiaCodigo").textContent = texto(m.codigo || m.codigoMateria || "—");
  $("materiaEstado").textContent = texto(m.estadoValidacion || (m.activo === false ? "Retirada" : "Vigente"));
  $("materiaVacia").classList.add("hidden"); $("materiaDetalle").classList.remove("hidden");
}
function mostrarTab(nombre) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === nombre));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("is-active", p.id === `panel-${nombre}`));
}
function mostrarMensaje(id, mensaje, error=false) {
  const el = $(id); el.textContent = mensaje || ""; el.className = `form-message ${mensaje ? (error ? "error" : "ok") : ""}`;
}
function validarSolicitud() {
  const campos = ["formCarrera","formNivel","formMateria","formNombres","formCedula","formCorreo","formInformacion"];
  for (const id of campos) if (!texto($(id).value)) return `Completa el campo ${$(id).closest("label").querySelector("span").textContent.replace(" *","")}.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto($("formCorreo").value))) return "Ingresa un correo válido.";
  return "";
}
function datosFormulario() {
  const carrera = carreraPorId($("formCarrera").value);
  const materia = materiaPorId(estado.materiasFormulario, $("formMateria").value);
  return {
    usuario:{ nombres:texto($("formNombres").value), cedula:texto($("formCedula").value), correo:texto($("formCorreo").value) },
    carreraId:texto($("formCarrera").value), carreraNombre:carrera ? nombreCarrera(carrera) : "",
    nivelNumero:Number($("formNivel").value || 0),
    materiaId:texto($("formMateria").value), materiaNombre:materia ? nombreMateria(materia) : "", materiaCodigo:materia ? texto(materia.codigo || m.codigoMateria) : "",
    informacion:texto($("formInformacion").value), observaciones:texto($("formObservaciones").value)
  };
}
function randomCode() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
  const tail = Array.from(bytes).map(b => (b % 36).toString(36)).join("").toUpperCase();
  return `CUR-${date}-${tail}`;
}
async function enviarSolicitud(event) {
  event.preventDefault();
  const error = validarSolicitud(); if (error) return mostrarMensaje("formMensaje", error, true);
  const btn = $("btnEnviar"); btn.disabled = true; mostrarMensaje("formMensaje", "Guardando…");
  try {
    const data = datosFormulario();
    const codigoExistente = texto($("codigoActual").value);
    const codigo = codigoExistente || randomCode();
    const ref = fs.doc(db, "solicitudes_usuario", codigo);
    const nowIso = new Date().toISOString();
    if (codigoExistente) {
      const previo = await fs.getDoc(ref);
      if (!previo.exists()) throw new Error("No se encontró el trámite a corregir.");
      if (normalizar(previo.data().estado) !== "devuelto") throw new Error("Solo se puede reenviar una solicitud devuelta.");
      await fs.updateDoc(ref, { ...data, estado:"pendiente", actualizadoEn:fs.serverTimestamp(), reenviadoEn:fs.serverTimestamp(), ultimaAccionUsuarioEn:nowIso });
    } else {
      await fs.setDoc(ref, { codigo, ...data, estado:"pendiente", origen:"gitpages", creadoEn:fs.serverTimestamp(), actualizadoEn:fs.serverTimestamp(), creadoEnIso:nowIso });
    }
    $("codigoGenerado").textContent = codigo; $("envioExitoso").classList.remove("hidden");
    $("codigoActual").value = codigo;
    mostrarMensaje("formMensaje", "Información enviada correctamente.");
  } catch (e) { mostrarMensaje("formMensaje", `No se pudo enviar: ${e.message}`, true); }
  finally { btn.disabled = false; }
}
function fechaLegible(value) {
  try {
    const d = value?.toDate ? value.toDate() : new Date(value || "");
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-EC", { dateStyle:"medium", timeStyle:"short" });
  } catch (_) { return ""; }
}
async function consultarTramite(event) {
  event.preventDefault();
  const codigo = texto($("consultaCodigo").value).toUpperCase();
  if (!codigo) return mostrarMensaje("tramiteMensaje", "Ingresa el código de trámite.", true);
  $("tramiteResultado").classList.add("hidden"); mostrarMensaje("tramiteMensaje", "Consultando…");
  try {
    const snap = await fs.getDoc(fs.doc(db, "solicitudes_usuario", codigo));
    if (!snap.exists()) throw new Error("No encontramos un trámite con ese código.");
    const d = { id:snap.id, ...snap.data() }; estado.tramite = d;
    const est = normalizar(d.estado || "pendiente");
    $("tramiteEstado").textContent = texto(d.estado || "Pendiente").replace(/^./, c=>c.toUpperCase());
    $("tramiteEstado").dataset.state = est;
    $("tramiteCodigoResultado").textContent = d.codigo || d.id;
    $("tramiteFecha").textContent = fechaLegible(d.actualizadoEn || d.creadoEn || d.creadoEnIso);
    $("tramiteCarrera").textContent = texto(d.carreraNombre || d.carreraId || "—");
    $("tramiteNivel").textContent = d.nivelNumero ? `Nivel ${d.nivelNumero}` : "—";
    $("tramiteMateria").textContent = texto(d.materiaNombre || d.materiaId || "—");
    $("tramiteObservacion").textContent = texto(d.observacionAdministrador || "Sin observaciones.");
    $("btnCorregir").classList.toggle("hidden", est !== "devuelto");
    $("btnPdfOficial").classList.toggle("hidden", est !== "aprobado");
    $("tramiteResultado").classList.remove("hidden"); mostrarMensaje("tramiteMensaje", "Trámite encontrado.");
  } catch (e) { estado.tramite = null; mostrarMensaje("tramiteMensaje", e.message, true); }
}
async function cargarCorreccion() {
  const d = estado.tramite; if (!d || normalizar(d.estado)!=="devuelto") return;
  mostrarTab("enviar");
  $("codigoActual").value = d.codigo || d.id;
  $("formNombres").value = texto(d.usuario?.nombres); $("formCedula").value = texto(d.usuario?.cedula); $("formCorreo").value = texto(d.usuario?.correo);
  $("formInformacion").value = texto(d.informacion); $("formObservaciones").value = texto(d.observaciones);
  $("formCarrera").value = texto(d.carreraId); await alCambiarCarrera("form");
  $("formNivel").value = String(d.nivelNumero || ""); alCambiarNivel("form"); $("formMateria").value = texto(d.materiaId);
  $("envioExitoso").classList.add("hidden"); mostrarMensaje("formMensaje", `Corrige la información y reenvía el trámite ${d.codigo || d.id}.`);
}

function wrapText(text, width=82) {
  const words = texto(text).replace(/\s+/g," ").split(" "); const lines=[]; let line="";
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > width && line) { lines.push(line); line=word; } else line=next; }
  if (line) lines.push(line); return lines.length ? lines : [""];
}
function pdfSafe(s) { return texto(s).replace(/[\\()]/g, m => `\\${m}`).replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,"-"); }
function latin1Bytes(str) { const out = new Uint8Array(str.length); for (let i=0;i<str.length;i++) { const c=str.charCodeAt(i); out[i]=c<=255?c:63; } return out; }
function descargarPdf(lineas, filename) {
  const wrapped=[]; lineas.forEach(item => { if (item === "") wrapped.push(""); else wrapText(item).forEach(x=>wrapped.push(x)); });
  const chunks=[]; for (let i=0;i<wrapped.length;i+=48) chunks.push(wrapped.slice(i,i+48)); if (!chunks.length) chunks.push([""]);
  const objects=[]; const pageNums=[]; const contentNums=[]; let next=4;
  chunks.forEach(()=>{ pageNums.push(next++); contentNums.push(next++); });
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${chunks.length} /Kids [${pageNums.map(n=>`${n} 0 R`).join(" ")}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  chunks.forEach((lines,idx)=>{
    const stream = `BT\n/F1 10 Tf\n50 792 Td\n14 TL\n${lines.map(l=>`(${pdfSafe(l)}) Tj\nT*`).join("\n")}\nET`;
    objects[pageNums[idx]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNums[idx]} 0 R >>`;
    objects[contentNums[idx]] = `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offsets=[0];
  for (let i=1;i<objects.length;i++) { offsets[i]=latin1Bytes(pdf).length; pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = latin1Bytes(pdf).length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i=1;i<objects.length;i++) pdf += `${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url=URL.createObjectURL(new Blob([latin1Bytes(pdf)],{type:"application/pdf"})); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function lineasSolicitud(d, oficial=false) {
  const title = oficial ? "GESTION CURRICULAR - DOCUMENTO OFICIAL" : "GESTION CURRICULAR - BORRADOR";
  return [title, oficial ? "ESTADO: APROBADO" : "ESTADO: BORRADOR - PENDIENTE DE APROBACION", "", `Codigo: ${texto(d.codigo || "Aun no generado")}`, `Nombres: ${texto(d.usuario?.nombres)}`, `Cedula / identificacion: ${texto(d.usuario?.cedula)}`, `Correo: ${texto(d.usuario?.correo)}`, `Carrera: ${texto(d.carreraNombre)}`, `Nivel: ${d.nivelNumero ? `Nivel ${d.nivelNumero}` : ""}`, `Materia: ${texto(d.materiaNombre)}`, `Codigo materia: ${texto(d.materiaCodigo)}`, "", "Informacion:", texto(d.informacion), "", "Observaciones:", texto(d.observaciones || "Sin observaciones"), ...(oficial ? ["", `Observacion de administracion: ${texto(d.observacionAdministrador || "Sin observaciones")}`] : [])];
}
function descargarBorrador() {
  const error=validarSolicitud(); if (error) return mostrarMensaje("formMensaje", error, true);
  const d=datosFormulario(); d.codigo=texto($("codigoActual").value);
  descargarPdf(lineasSolicitud(d,false), `borrador-${d.materiaNombre || "solicitud"}.pdf`);
}
function descargarOficial() {
  const d=estado.tramite; if (!d || normalizar(d.estado)!=="aprobado") return;
  const oficial = d.datosAprobados ? { ...d, ...d.datosAprobados } : d;
  descargarPdf(lineasSolicitud(oficial,true), `oficial-${d.codigo || d.id}.pdf`);
}

function iniciarEventos() {
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click",()=>mostrarTab(btn.dataset.tab)));
  $("consultaCarrera").addEventListener("change",()=>alCambiarCarrera("consulta")); $("consultaNivel").addEventListener("change",()=>alCambiarNivel("consulta")); $("consultaMateria").addEventListener("change",mostrarMateria);
  $("formCarrera").addEventListener("change",()=>alCambiarCarrera("form")); $("formNivel").addEventListener("change",()=>alCambiarNivel("form"));
  $("formSolicitud").addEventListener("submit",enviarSolicitud); $("btnBorrador").addEventListener("click",descargarBorrador);
  $("formConsultaTramite").addEventListener("submit",consultarTramite); $("btnCorregir").addEventListener("click",cargarCorreccion); $("btnPdfOficial").addEventListener("click",descargarOficial);
  $("btnIrTramite").addEventListener("click",()=>{ $("consultaCodigo").value=$("codigoGenerado").textContent; mostrarTab("tramite"); $("formConsultaTramite").requestSubmit(); });
}

iniciarEventos();
try { await cargarCarreras(); setFirebaseStatus(true,"Conectado"); }
catch (e) { setFirebaseStatus(false,"Sin conexión"); mostrarMensaje("formMensaje",`No se pudo cargar la información oficial: ${e.message}`,true); }
