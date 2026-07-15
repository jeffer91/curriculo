/* Mejora la vista previa: muestra faltantes reales y permite revisar los Excel con paginación. */
(function (window, document) {
  "use strict";

  var NS = window.SubirCCC = window.SubirCCC || {};
  var original = NS.Preview;
  if (!original || original.__faltantesExcelV1) return;

  var TIPOS = ["pea_base", "pea_unidades", "pea_actividades"];
  var POR_PAGINA = 25;
  var paqueteActual = null;
  var filasActuales = [];
  var filtroActual = "";
  var detalle = { materiaId: "", archivoId: "", hoja: 0, pagina: 1 };

  function $(id) { return document.getElementById(id); }
  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v); }
  function arr(v) { return Array.isArray(v) ? v : (v === null || typeof v === "undefined" ? [] : [v]); }
  function obj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function esc(v) { return texto(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function saltos(v) { return esc(v).replace(/\n/g,"<br>"); }
  function norm(v) { return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }

  function nombreTipo(tipo) {
    if (tipo === "pea_base") return "PEA Base";
    if (tipo === "pea_unidades") return "PEA Unidades";
    if (tipo === "pea_actividades") return "PEA Actividades";
    return "No identificado";
  }

  function asegurarEstilos() {
    if ($("previewFaltantesExcelStyles")) return;
    var s = document.createElement("style");
    s.id = "previewFaltantesExcelStyles";
    s.textContent = [
      ".subir-pea-status{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:98px}",
      ".subir-pea-status small{font-size:10px;line-height:1.25;color:#667085}",
      ".subir-faltantes{display:block;margin-top:5px;max-width:300px;font-size:11px;line-height:1.35;color:#912018}",
      ".subir-detalle-faltantes{margin:12px 0;padding:12px 14px;border:1px solid #fecdca;border-radius:12px;background:#fff4f2;color:#912018}",
      ".subir-detalle-faltantes strong{display:block;margin-bottom:6px}.subir-detalle-faltantes ul{margin:0;padding-left:20px}",
      ".subir-excel-zone{margin-top:18px;padding-top:15px;border-top:1px solid #d8e2ef}",
      ".subir-excel-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}",
      ".subir-excel-tab{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font-weight:700}",
      ".subir-excel-tab.activo{border-color:#0b4a8b;background:#eaf2fb;color:#0b4a8b}",
      ".subir-excel-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:10px 0}",
      ".subir-excel-meta div{border:1px solid #d8e2ef;border-radius:10px;padding:9px;background:#f8fafc}.subir-excel-meta span{display:block;font-size:11px;color:#667085}.subir-excel-meta strong{display:block;margin-top:3px;overflow-wrap:anywhere}",
      ".subir-excel-toolbar,.subir-excel-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}",
      ".subir-excel-toolbar label{display:flex;align-items:center;gap:7px;font-weight:700}.subir-excel-toolbar select{max-width:360px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}",
      ".subir-excel-wrap{max-width:100%;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;background:#fff}",
      ".subir-excel-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:12px}",
      ".subir-excel-table th,.subir-excel-table td{max-width:330px;padding:8px 10px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:left;overflow-wrap:anywhere}",
      ".subir-excel-table th{position:sticky;top:0;z-index:1;background:#eef4fb;color:#17324d}",
      ".subir-excel-btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;font-weight:700}.subir-excel-btn[disabled]{opacity:.45;cursor:not-allowed}",
      ".subir-excel-alert{padding:13px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#9a3412}",
      ".subir-excel-note{font-size:12px;color:#667085}"
    ].join("");
    document.head.appendChild(s);
  }

  function clase(c) {
    if (c === "correcto" || c === "completo") return "ok";
    if (c === "falta" || c === "sin_contenido" || c === "error_lectura" || c === "incompleto") return "error";
    if (c === "duplicado" || c === "revision" || c === "no_procesado") return "warn";
    return "neutral";
  }

  function badge(etiqueta, codigo) {
    return '<span class="subir-badge subir-badge-' + clase(codigo) + '">' + esc(etiqueta) + "</span>";
  }

  function tieneValor(v) {
    if (Array.isArray(v)) return v.some(tieneValor);
    if (obj(v)) return Object.keys(v).some(function (k) { return tieneValor(v[k]); });
    return texto(v).trim() !== "";
  }

  function contenidoValido(a) {
    var d = a && a.datosProcesados;
    if (!a) return false;
    if (a.tipo === "pea_base") return obj(d) && !!(texto(d.descripcion).trim() || texto(d.objetivo).trim() || tieneValor(d.campos) || tieneValor(d.filas) || tieneValor(d.hojas) || tieneValor(d.unidadesBase) || tieneValor(d.bibliografia));
    if (a.tipo === "pea_unidades") return arr(d).some(function (u) { return arr(u && u.contenidos).some(function (x) { return texto(x).trim(); }) || texto(u && (u.temaDetectado || u.tema || u.contenido || u.resultadoAprendizaje || u.competencia)).trim(); });
    if (a.tipo === "pea_actividades") return arr(d).some(function (x) { return texto(x && (x.actividadDetectada || x.actividad || x.descripcion || x.tema || x.titulo || x.contenido)).trim(); });
    return tieneValor(d);
  }

  function incluyeTipo(lista, tipo) {
    return arr(lista).some(function (x) { return typeof x === "string" ? x === tipo : x && x.tipo === tipo; });
  }

  function evaluarTipo(materia, archivos, tipo) {
    var lista = archivos.filter(function (a) { return a.tipo === tipo; });
    var nombre = nombreTipo(tipo);
    if (!lista.length || incluyeTipo(materia.archivosFaltantes, tipo)) return { codigo:"falta", etiqueta:"Falta", detalle:"No se encontró " + nombre + "." };
    var error = lista.find(function (a) { return texto(a.errorExcel || a.errorLectura).trim(); });
    if (error) return { codigo:"error_lectura", etiqueta:"Error lectura", detalle:texto(error.errorExcel || error.errorLectura) };
    if (lista.some(function (a) { return a.excelLeido !== true; })) return { codigo:"no_procesado", etiqueta:"No procesado", detalle:nombre + " fue detectado, pero no quedó marcado como leído." };
    if (incluyeTipo(materia.archivosSinContenido, tipo) || !lista.some(contenidoValido)) return { codigo:"sin_contenido", etiqueta:"Sin contenido", detalle:nombre + " existe, pero no produjo información curricular válida." };
    if (lista.length > 1 || incluyeTipo(materia.archivosDuplicados, tipo)) return { codigo:"duplicado", etiqueta:"Duplicado", detalle:"Se encontraron " + lista.length + " archivos para " + nombre + "." };
    var baja = lista.find(function (a) { return Number(a.confianza || 0) > 0 && Number(a.confianza) < 70; });
    if (baja) return { codigo:"revision", etiqueta:"Revisar", detalle:nombre + " fue clasificado con confianza de " + baja.confianza + "%." };
    return { codigo:"correcto", etiqueta:"Correcto", detalle:nombre + " fue leído y contiene información válida." };
  }

  function construirFilas(paquete) {
    return arr(paquete.materias).map(function (m) {
      var carrera = arr(paquete.carreras).find(function (x) { return x.id === m.carreraId; });
      var nivel = arr(paquete.niveles).find(function (x) { return x.id === m.nivelId; });
      var archivos = arr(paquete.archivos).filter(function (x) { return x.materiaId === m.id; });
      var estados = {};
      TIPOS.forEach(function (t) { estados[t] = evaluarTipo(m, archivos, t); });
      var razones = TIPOS.map(function (t) { return estados[t]; }).filter(function (e) { return e.codigo !== "correcto"; }).map(function (e) { return e.detalle; });
      arr(paquete.validacionesSubida).forEach(function (v) {
        if (v && v.materiaId === m.id && texto(v.mensaje).trim()) razones.push(texto(v.mensaje).trim());
      });
      razones = razones.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      if (!razones.length && m.estadoValidacion !== "completo") razones.push("La materia requiere revisión del contenido curricular procesado.");
      return { carrera:carrera ? carrera.nombre : "", nivel:nivel ? nivel.nombre : "", codigo:m.codigo || "", materia:m.nombre || "", materiaId:m.id, estado:m.estadoValidacion || "pendiente", archivos:archivos, estados:estados, razones:razones };
    });
  }

  function estadoCelda(e) {
    return '<div class="subir-pea-status" title="' + esc(e.detalle) + '">' + badge(e.etiqueta,e.codigo) + "<small>" + esc(e.detalle) + "</small></div>";
  }

  function pintarTabla(filas) {
    var tbody = $("tablaPreview");
    if (!tbody) return;
    if (!filas.length) { tbody.innerHTML = '<tr><td colspan="10" class="subir-empty">No hay materias para mostrar.</td></tr>'; return; }
    tbody.innerHTML = filas.map(function (f) {
      var faltan = f.razones.length ? '<small class="subir-faltantes">' + f.razones.map(esc).join("<br>") + "</small>" : "";
      return "<tr>" +
        "<td>"+esc(f.carrera)+"</td><td>"+esc(f.nivel)+"</td><td><code>"+esc(f.codigo||"S/C")+"</code></td><td><strong>"+esc(f.materia)+"</strong></td>" +
        "<td>"+estadoCelda(f.estados.pea_base)+"</td><td>"+estadoCelda(f.estados.pea_unidades)+"</td><td>"+estadoCelda(f.estados.pea_actividades)+"</td>" +
        "<td>"+badge(f.estado,f.estado)+faltan+"</td><td>"+esc(f.archivos.length)+"</td>" +
        '<td><button class="subir-mini-btn" type="button" data-ver-mas-materia="'+esc(f.materiaId)+'">Ver más</button></td></tr>';
    }).join("");
  }

  function aplicarFiltro() {
    var q = norm(filtroActual);
    var datos = !q ? filasActuales : filasActuales.filter(function (f) {
      return norm([f.carrera,f.nivel,f.codigo,f.materia,f.estado,f.razones.join(" "),f.estados.pea_base.etiqueta,f.estados.pea_unidades.etiqueta,f.estados.pea_actividades.etiqueta].join(" ")).includes(q);
    });
    pintarTabla(datos);
  }

  function agrupar(mapa, hoja, fila) {
    hoja = texto(hoja || "Datos").trim() || "Datos";
    if (!mapa[hoja]) mapa[hoja] = [];
    mapa[hoja].push(fila);
  }

  function obtenerHojas(a) {
    var d = a && a.datosProcesados, mapa = {}, hojas = [];
    if (!a) return [];
    if (a.tipo === "pea_base" && obj(d)) {
      if (obj(d.hojas)) Object.keys(d.hojas).forEach(function (n) { arr(d.hojas[n] && d.hojas[n].filas).forEach(function (f) { agrupar(mapa,n,f); }); });
      if (!Object.keys(mapa).length) arr(d.filas).forEach(function (f) { agrupar(mapa,f && f.__hoja,f); });
    } else if (a.tipo === "pea_unidades") {
      arr(d).forEach(function (u) { var originales=arr(u&&u.filasOriginales); if(originales.length) originales.forEach(function(f){agrupar(mapa,f&&f.__hoja,f);}); else if(u) agrupar(mapa,"Datos",u); });
    } else if (a.tipo === "pea_actividades") {
      arr(d).forEach(function (f) { agrupar(mapa,f&&f.__hoja,f); });
    } else if (obj(d) && Array.isArray(d.hojas)) {
      d.hojas.forEach(function (h) { arr(h.filas).forEach(function (f) { agrupar(mapa,h.nombre,f); }); });
    }
    hojas = Object.keys(mapa).map(function (n) { return { nombre:n, filas:mapa[n], preview:false }; });
    if (!hojas.length) hojas = arr(a.excelResumen && a.excelResumen.hojas).map(function (h) { return { nombre:h.nombre||"Hoja", filas:arr(h.filas).length?arr(h.filas):arr(h.preview), preview:!arr(h.filas).length }; });
    return hojas;
  }

  function columnas(filas) {
    var r=[], excluir={__hoja:1,materiaId:1,carreraId:1,nivelId:1,archivoId:1,creadoEn:1,actualizadoEn:1,procesadoEn:1};
    arr(filas).slice(0,250).forEach(function(f){ if(!obj(f))return; Object.keys(f).forEach(function(k){if(!excluir[k]&&r.indexOf(k)===-1)r.push(k);}); });
    r.sort(function(a,b){if(a==="__filaExcel")return-1;if(b==="__filaExcel")return 1;return 0;});
    return r;
  }

  function tituloColumna(k) {
    if (k === "__filaExcel") return "Fila Excel";
    return texto(k).replace(/^__/,"").replace(/_/g," ").replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,"$1 $2").replace(/^./,function(x){return x.toUpperCase();});
  }

  function idArchivo(a, i) { return a.id || (a.tipo + "_" + i); }

  function archivoActivo(archivos) {
    var encontrado = archivos.find(function(a,i){return idArchivo(a,i)===detalle.archivoId;});
    if (encontrado) return encontrado;
    if (!archivos.length) return null;
    detalle.archivoId = idArchivo(archivos[0],0);
    return archivos[0];
  }

  function renderExcel(a) {
    if (!a) return '<p class="subir-excel-alert">No hay un Excel seleccionado.</p>';
    var hojas=obtenerHojas(a), hi=Math.max(0,Math.min(Number(detalle.hoja||0),Math.max(0,hojas.length-1))), h=hojas[hi]||{nombre:"Sin datos",filas:[]};
    detalle.hoja=hi;
    var filas=arr(h.filas), cols=columnas(filas), total=Math.max(1,Math.ceil(filas.length/POR_PAGINA)), p=Math.max(1,Math.min(Number(detalle.pagina||1),total));
    detalle.pagina=p;
    var ini=(p-1)*POR_PAGINA, fin=Math.min(ini+POR_PAGINA,filas.length), actuales=filas.slice(ini,fin), error=texto(a.errorExcel||a.errorLectura).trim();
    var html='<div class="subir-excel-meta"><div><span>Archivo</span><strong>'+esc(a.nombreArchivo||"Sin nombre")+'</strong></div><div><span>Tipo</span><strong>'+esc(nombreTipo(a.tipo))+'</strong></div><div><span>Lectura</span><strong>'+esc(error?"Error":(a.excelLeido===true?"Correcta":"No procesado"))+'</strong></div><div><span>Hojas</span><strong>'+esc(hojas.length)+'</strong></div></div>';
    if(error) html+='<p class="subir-excel-alert"><strong>Error:</strong> '+esc(error)+'</p>';
    if(!hojas.length||!filas.length||!cols.length) return html+'<p class="subir-excel-alert">El Excel fue detectado, pero no hay filas disponibles para mostrar.</p>';
    html+='<div class="subir-excel-toolbar"><label>Hoja <select data-excel-hoja>'+hojas.map(function(x,i){return '<option value="'+i+'"'+(i===hi?' selected':'')+'>'+esc(x.nombre)+' · '+esc(arr(x.filas).length)+' filas</option>';}).join('')+'</select></label><span>Mostrando '+(ini+1)+'–'+fin+' de '+filas.length+' filas</span></div>';
    if(h.preview) html+='<p class="subir-excel-note">Solo se recuperó la vista previa almacenada de esta hoja.</p>';
    html+='<div class="subir-excel-wrap"><table class="subir-excel-table"><thead><tr>'+cols.map(function(c){return'<th>'+esc(tituloColumna(c))+'</th>';}).join('')+'</tr></thead><tbody>'+actuales.map(function(f){return'<tr>'+cols.map(function(c){var v=f&&typeof f[c]!=="undefined"?f[c]:"";return'<td>'+saltos(Array.isArray(v)?v.join(' · '):v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
    html+='<div class="subir-excel-pager"><span>Página '+p+' de '+total+'</span><div><button class="subir-excel-btn" data-excel-pagina="'+(p-1)+'"'+(p<=1?' disabled':'')+'>Anterior</button> <button class="subir-excel-btn" data-excel-pagina="'+(p+1)+'"'+(p>=total?' disabled':'')+'>Siguiente</button></div></div>';
    return html;
  }

  function renderDetalle() {
    var cont=$("modalContenido"), titulo=$("modalTitulo");
    if(!cont||!titulo||!paqueteActual)return;
    var f=filasActuales.find(function(x){return x.materiaId===detalle.materiaId;});
    var m=arr(paqueteActual.materias).find(function(x){return x.id===detalle.materiaId;});
    if(!f||!m){cont.innerHTML='<p class="subir-excel-alert">No se encontró la materia.</p>';return;}
    var carrera=arr(paqueteActual.carreras).find(function(x){return x.id===m.carreraId;}), nivel=arr(paqueteActual.niveles).find(function(x){return x.id===m.nivelId;}), archivos=f.archivos.slice().sort(function(a,b){return TIPOS.indexOf(a.tipo)-TIPOS.indexOf(b.tipo);}), activo=archivoActivo(archivos);
    titulo.textContent=(m.codigo?m.codigo+' · ':'')+m.nombre;
    var razones=f.razones.length?'<div class="subir-detalle-faltantes"><strong>¿Qué falta o qué debe corregirse?</strong><ul>'+f.razones.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul></div>':'<div class="subir-success">La materia tiene los tres Excel con contenido curricular válido.</div>';
    var tabs=archivos.length?'<div class="subir-excel-tabs">'+archivos.map(function(a,i){var id=idArchivo(a,i);return'<button class="subir-excel-tab '+(id===detalle.archivoId?'activo':'')+'" data-excel-archivo="'+esc(id)+'">'+esc(nombreTipo(a.tipo))+'</button>';}).join('')+'</div>':'';
    cont.innerHTML='<div class="subir-detail-grid"><div><span>Carrera</span><strong>'+esc(carrera?carrera.nombre:'')+'</strong></div><div><span>Nivel</span><strong>'+esc(nivel?nivel.nombre:'')+'</strong></div><div><span>Estado</span><strong>'+esc(m.estadoValidacion||'pendiente')+'</strong></div><div><span>Archivos</span><strong>'+archivos.length+'</strong></div></div>'+razones+'<section class="subir-excel-zone"><h3>Excel de la materia</h3><p class="subir-excel-note">Selecciona un archivo y revisa sus hojas. Se muestran 25 filas por página.</p>'+(archivos.length?tabs+renderExcel(activo):'<p class="subir-excel-alert">No hay archivos asociados.</p>')+'</section>';
  }

  function abrir(materiaId) {
    detalle={materiaId:materiaId,archivoId:"",hoja:0,pagina:1};
    renderDetalle();
    var modal=$("modalDetalle"); if(modal&&!modal.open)modal.showModal();
  }

  var pintarPaqueteOriginal = original.pintarPaquete.bind(original);
  var limpiarOriginal = original.limpiarPreview.bind(original);
  var conectarOriginal = original.conectarEventosUI.bind(original);

  original.pintarPaquete = function (paquete) {
    paqueteActual=paquete; filasActuales=construirFilas(paquete); filtroActual=""; detalle={materiaId:"",archivoId:"",hoja:0,pagina:1};
    pintarPaqueteOriginal(paquete); asegurarEstilos(); pintarTabla(filasActuales);
  };

  original.limpiarPreview = function () {
    paqueteActual=null; filasActuales=[]; filtroActual=""; detalle={materiaId:"",archivoId:"",hoja:0,pagina:1};
    limpiarOriginal();
  };

  original.conectarEventosUI = function () {
    conectarOriginal(); asegurarEstilos();
    var buscador=$("buscadorPreview");
    if(buscador&&!buscador.__faltantesExcel){buscador.__faltantesExcel=true;buscador.addEventListener("input",function(){filtroActual=buscador.value;setTimeout(aplicarFiltro,0);});}
    var tabla=$("tablaPreview");
    if(tabla&&!tabla.__faltantesExcel){tabla.__faltantesExcel=true;tabla.addEventListener("click",function(e){var b=e.target.closest("[data-ver-mas-materia]");if(b)abrir(b.getAttribute("data-ver-mas-materia"));});}
    var cont=$("modalContenido");
    if(cont&&!cont.__faltantesExcel){cont.__faltantesExcel=true;cont.addEventListener("click",function(e){var a=e.target.closest("[data-excel-archivo]");if(a){detalle.archivoId=a.getAttribute("data-excel-archivo")||"";detalle.hoja=0;detalle.pagina=1;renderDetalle();return;}var p=e.target.closest("[data-excel-pagina]");if(p&&!p.disabled){detalle.pagina=Number(p.getAttribute("data-excel-pagina")||1);renderDetalle();}});cont.addEventListener("change",function(e){if(!e.target.matches("[data-excel-hoja]"))return;detalle.hoja=Number(e.target.value||0);detalle.pagina=1;renderDetalle();});}
  };

  original.abrirDetalleMateria = abrir;
  original.construirFilasTabla = construirFilas;
  original.__faltantesExcelV1 = true;
})(window, document);
