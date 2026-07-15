/* =========================================================
Nombre completo: subir.contenido-inteligente.js
Ruta: /Curriculo/subir/subir.contenido-inteligente.js
Funciones:
- Validar los tres PEA usando el contenido real de cada Excel.
- Reconocer arreglos, objetos y encabezados equivalentes.
- Corregir falsos estados "sin contenido".
- Mostrar hojas y filas del Excel con paginación de 25 registros.
========================================================= */
(function (window, document) {
  "use strict";

  var NS = window.SubirCCC = window.SubirCCC || {};
  if (NS.ContenidoInteligente && NS.ContenidoInteligente.version === 3) return;

  var TIPOS = ["pea_base", "pea_unidades", "pea_actividades"];
  var POR_PAGINA = 25;
  var estado = { paquete: null, filas: [], filtro: "", materiaId: "", tipo: "pea_base", hoja: 0, pagina: 1 };

  function $(id) { return document.getElementById(id); }
  function texto(v) { return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function arr(v) { return Array.isArray(v) ? v : (v === null || typeof v === "undefined" ? [] : [v]); }
  function obj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function esc(v) { return texto(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function norm(v) { return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase(); }
  function nombreTipo(t) { return t === "pea_base" ? "PEA Base" : t === "pea_unidades" ? "PEA Unidades" : t === "pea_actividades" ? "PEA Actividades" : "Excel"; }

  function valorAlias(o, aliases) {
    if (!obj(o)) return "";
    var buscadas = arr(aliases).map(norm), claves = Object.keys(o);
    for (var i = 0; i < claves.length; i += 1) {
      if (buscadas.indexOf(norm(claves[i])) !== -1 && texto(o[claves[i]])) return texto(o[claves[i]]);
    }
    return "";
  }

  function numeroAlias(o, aliases) {
    var m = valorAlias(o, aliases).match(/-?\d+/);
    return m ? Number(m[0]) : 0;
  }

  function valoresFila(f) {
    if (!obj(f)) return [];
    var excluir = ["__filaexcel","__hoja","id","materiaid","carreraid","nivelid","archivoid","creadoen","actualizadoen","procesadoen","leidoen"];
    return Object.keys(f).filter(function (k) { return excluir.indexOf(norm(k)) === -1 && texto(f[k]); }).map(function (k) { return texto(f[k]); });
  }

  function filasHojas(hojas) {
    var out = [];
    if (Array.isArray(hojas)) {
      hojas.forEach(function (h) { arr(h && h.filas).forEach(function (f) { out.push(Object.assign({__hoja:texto(h.nombre||"Datos")},f)); }); });
    } else if (obj(hojas)) {
      Object.keys(hojas).forEach(function (n) { arr(hojas[n] && hojas[n].filas).forEach(function (f) { out.push(Object.assign({__hoja:n},f)); }); });
    }
    return out;
  }

  function registros(a) {
    if (!a) return [];
    var d = a.datosProcesados;
    if (a.tipo === "pea_base") return obj(d) ? (arr(d.filas).length ? arr(d.filas) : filasHojas(d.hojas)) : [];
    if (a.tipo === "pea_unidades") {
      var u = Array.isArray(d) ? d : arr(d && (d.unidades || d.registros || d.filas)), originales = [];
      u.forEach(function (x) { arr(x && x.filasOriginales).forEach(function (f) { originales.push(f); }); });
      return originales.length ? originales : u;
    }
    if (a.tipo === "pea_actividades") return Array.isArray(d) ? d : arr(d && (d.actividades || d.registros || d.filas));
    return Array.isArray(d) ? d : (obj(d) ? (arr(d.filas).length ? arr(d.filas) : filasHojas(d.hojas)) : []);
  }

  function baseValida(a) {
    var d = obj(a && a.datosProcesados) ? a.datosProcesados : {}, campos = obj(d.campos) ? d.campos : {}, fs = registros(a);
    var descripcion = texto(d.descripcion) || valorAlias(campos,["descripcion_asignatura","descripcionAsignatura","descripcion"]);
    var objetivo = texto(d.objetivo) || valorAlias(campos,["objetivo_asignatura","objetivoAsignatura","objetivo"]);
    fs.forEach(function (f) {
      var c = numeroAlias(f,["codigoComponente","codigo_componente"]), v = valorAlias(f,["descripcionComponente","descripcion_componente"]);
      if (c === 1 && !descripcion) descripcion = v;
      if (c === 2 && !objetivo) objetivo = v;
    });
    return { valido: !!(descripcion || objetivo || fs.some(function(f){return valoresFila(f).length;})), registros: fs.length, revision: !!((descripcion||objetivo) && (!descripcion || !objetivo)) };
  }

  function unidadesValidas(a) {
    var d = a && a.datosProcesados, u = Array.isArray(d) ? d : arr(d && (d.unidades || d.registros || d.filas));
    var total = 0, nums = {};
    u.forEach(function (x) {
      if (!obj(x)) return;
      var n = Number(x.unidadNumero || x.ordenComponente || x.unidad || x.numeroUnidad || 0);
      if (n >= 1 && n <= 4) nums[n] = true;
      var cs = arr(x.contenidos).filter(function(v){return texto(v);});
      if (cs.length) total += cs.length;
      else if (texto(x.temaDetectado || x.tema || x.contenido || x.titulo || x.descripcionComponente)) total += 1;
      arr(x.filasOriginales).forEach(function(f){
        var nf = numeroAlias(f,["ordenComponente","orden_componente","unidadNumero","unidad_numero","unidad"]);
        if (nf >= 1 && nf <= 4) nums[nf] = true;
        if (valorAlias(f,["descripcionComponente","descripcion_componente","contenido","tema","titulo"])) total += 1;
      });
    });
    return { valido: total > 0, registros: total, revision: total > 0 && Object.keys(nums).length > 0 && Object.keys(nums).length < 4 };
  }

  function actividadValida(f) {
    if (!obj(f)) return false;
    if (valorAlias(f,["actividadDetectada","actividad","descripcion","descripción","descripcionActividad","tema","titulo","contenido","taller","proyecto","mecanismo","tipoActividad","tipo_actividad","modalidad"])) return true;
    return valoresFila(f).filter(function(v){return !/^\d+(?:[.,]\d+)?$/.test(v);}).length >= 2;
  }

  function actividadesValidas(a) {
    var validas = registros(a).filter(actividadValida);
    return { valido: validas.length > 0, registros: validas.length, revision: false };
  }

  function evaluarContenido(a) {
    if (!a) return {valido:false,registros:0,revision:false};
    if (a.tipo === "pea_base") return baseValida(a);
    if (a.tipo === "pea_unidades") return unidadesValidas(a);
    if (a.tipo === "pea_actividades") return actividadesValidas(a);
    var fs = registros(a);
    return {valido:fs.some(function(f){return valoresFila(f).length;}),registros:fs.length,revision:false};
  }

  function evaluarTipo(archivos, tipo) {
    var lista = arr(archivos).filter(function(a){return a && a.tipo === tipo;}), nombre = nombreTipo(tipo);
    if (!lista.length) return {tipo:tipo,codigo:"falta",etiqueta:"Falta",detalle:"No se encontró "+nombre+".",valido:false,archivos:[],registros:0};
    var error = lista.find(function(a){return texto(a.errorExcel || a.errorLectura);});
    if (error) return {tipo:tipo,codigo:"error_lectura",etiqueta:"Error de lectura",detalle:texto(error.errorExcel || error.errorLectura),valido:false,archivos:lista,registros:0};
    var leidos = lista.filter(function(a){return a.excelLeido === true;});
    if (!leidos.length) return {tipo:tipo,codigo:"no_procesado",etiqueta:"No procesado",detalle:nombre+" fue detectado, pero no pudo procesarse.",valido:false,archivos:lista,registros:0};
    var evaluados = leidos.map(function(a){return {archivo:a,contenido:evaluarContenido(a)};}), bueno = evaluados.find(function(x){return x.contenido.valido;});
    if (!bueno) return {tipo:tipo,codigo:"sin_contenido",etiqueta:"Sin contenido",detalle:nombre+" existe, pero no produjo información curricular válida.",valido:false,archivos:lista,registros:0};
    var revision = lista.length > 1 || evaluados.some(function(x){return x.contenido.revision;}) || lista.some(function(a){var c=Number(a.confianza||0);return c>0&&c<70;});
    return {tipo:tipo,codigo:revision?"revision":"correcto",etiqueta:revision?"Revisar":"Correcto",detalle:nombre+" fue leído y contiene "+bueno.contenido.registros+" registro(s) válido(s).",valido:true,archivos:lista,registros:bueno.contenido.registros};
  }

  function evaluarMateria(m, archivos) {
    var estados = {};
    TIPOS.forEach(function(t){estados[t]=evaluarTipo(archivos,t);});
    var completo = TIPOS.every(function(t){return estados[t].valido;}), revision = completo && TIPOS.some(function(t){return estados[t].codigo === "revision";});
    var razones = TIPOS.map(function(t){return estados[t];}).filter(function(e){return !e.valido;}).map(function(e){return e.detalle;});
    return {
      materiaId:m.id, estados:estados, razones:razones,
      estado:completo?(revision?"revision":"completo"):"incompleto",
      archivosFaltantes:TIPOS.filter(function(t){return estados[t].codigo==="falta";}),
      archivosSinContenido:TIPOS.filter(function(t){return ["sin_contenido","error_lectura","no_procesado"].indexOf(estados[t].codigo)!==-1;}),
      archivosDuplicados:TIPOS.filter(function(t){return estados[t].archivos.length>1;}),
      totalArchivosValidos:TIPOS.filter(function(t){return estados[t].valido;}).length
    };
  }

  function corregirPaquete(p) {
    p = p || {};
    var archivos = arr(p.archivos), evaluaciones = [];
    var materias = arr(p.materias).map(function(m){
      var ev = evaluarMateria(m,archivos.filter(function(a){return a.materiaId===m.id;})); evaluaciones.push(ev);
      return Object.assign({},m,{
        estadoValidacion:ev.estado,evaluacionInteligente:ev,totalArchivosEsperados:3,
        totalArchivosDetectados:TIPOS.filter(function(t){return ev.estados[t].archivos.length;}).length,
        totalArchivosEncontrados:ev.totalArchivosValidos,totalArchivosValidos:ev.totalArchivosValidos,
        archivosFaltantes:ev.archivosFaltantes,archivosSinContenido:ev.archivosSinContenido,archivosDuplicados:ev.archivosDuplicados,
        resumenValidacion:{tieneBase:ev.estados.pea_base.valido,tieneUnidades:ev.estados.pea_unidades.valido,tieneActividades:ev.estados.pea_actividades.valido},
        actualizadoEn:new Date().toISOString()
      });
    });
    var controladas=["materia_incompleta","contenido_pea_invalido","error_lectura_excel","excel_no_procesado","excel_sin_contenido_curricular","contenido_base_incompleto","contenido_inteligente_materia"];
    var ids={}; materias.forEach(function(m){ids[m.id]=true;});
    var vals=arr(p.validacionesSubida).filter(function(v){return !v || !ids[v.materiaId] || controladas.indexOf(v.tipo)===-1;});
    materias.forEach(function(m){var ev=m.evaluacionInteligente;if(ev.estado!=="completo")vals.push({id:"val_int_"+m.id,tipo:"contenido_inteligente_materia",severidad:ev.estado==="revision"?"advertencia":"error",bloqueaImportacion:false,materiaId:m.id,carreraId:m.carreraId||"",nivelId:m.nivelId||"",mensaje:ev.razones.join(" ")||"La materia requiere revisión.",detalle:ev,creadoEn:new Date().toISOString()});});
    var completas=evaluaciones.filter(function(e){return e.estado==="completo";}).length,incompletas=evaluaciones.filter(function(e){return e.estado==="incompleto";}).length,revision=evaluaciones.filter(function(e){return e.estado==="revision";}).length;
    var bloquea=vals.some(function(v){return v&&v.bloqueaImportacion===true;}),errores=vals.filter(function(v){return v&&v.severidad==="error";}).length,advertencias=vals.filter(function(v){return v&&v.severidad==="advertencia";}).length,requiere=incompletas>0||revision>0||errores>0||advertencias>0;
    return Object.assign({},p,{materias:materias,evaluacionesMaterias:evaluaciones,validacionesSubida:vals,resumenValidacion:Object.assign({},p.resumenValidacion||{},{totalMaterias:materias.length,totalArchivos:archivos.length,materiasCompletas:completas,materiasIncompletas:incompletas,materiasRevision:revision,totalValidaciones:vals.length,bloqueaImportacion:bloquea,listoParaImportar:!bloquea&&!requiere,puedeImportarConObservaciones:!bloquea,requiereRevision:requiere}),validadoInteligentementeEn:new Date().toISOString()});
  }

  function instalarValidador() {
    if (!NS.Validador || NS.Validador.__inteligenteV3 || typeof NS.Validador.validarPaquete!=="function") return;
    var original=NS.Validador.validarPaquete.bind(NS.Validador);
    NS.Validador.validarPaquete=function(p,op){op=op||{};var lanzar=op.lanzarSiBloquea===true;var r=corregirPaquete(original(p,Object.assign({},op,{lanzarSiBloquea:false})));if(lanzar&&r.resumenValidacion.bloqueaImportacion)throw new Error("El paquete tiene errores críticos y no puede importarse.");return r;};
    NS.Validador.__inteligenteV3=true;
  }

  function estilos() {
    if ($("inteligenteV3Estilos")) return;
    var s=document.createElement("style");s.id="inteligenteV3Estilos";s.textContent=".subir-pea-status{display:flex;flex-direction:column;gap:4px;min-width:110px}.subir-pea-status small,.subir-razon-unica,.subir-excel-note{font-size:11px;line-height:1.35;color:#667085}.subir-razon-unica{display:block;margin-top:5px;color:#912018}.subir-int-resumen{margin:12px 0;padding:12px 14px;border:1px solid #d8e2ef;border-radius:12px;background:#f8fafc}.subir-int-resumen.error{border-color:#fecdca;background:#fff4f2;color:#912018}.subir-int-resumen.ok{border-color:#abefc6;background:#ecfdf3;color:#067647}.subir-excel-zone{margin-top:18px;padding-top:15px;border-top:1px solid #d8e2ef}.subir-excel-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.subir-excel-tab,.subir-excel-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font-weight:700}.subir-excel-tab.activo{border-color:#0b4a8b;background:#eaf2fb;color:#0b4a8b}.subir-excel-toolbar,.subir-excel-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.subir-excel-toolbar select{padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.subir-excel-wrap{max-width:100%;overflow:auto;border:1px solid #cbd5e1;border-radius:12px}.subir-excel-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:12px}.subir-excel-table th,.subir-excel-table td{max-width:340px;padding:8px 10px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:left;overflow-wrap:anywhere}.subir-excel-table th{position:sticky;top:0;background:#eef4fb}.subir-excel-btn[disabled]{opacity:.45}.subir-excel-alert{padding:13px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#9a3412}";document.head.appendChild(s);
  }

  function clase(c){return c==="correcto"||c==="completo"?"ok":["falta","sin_contenido","error_lectura","no_procesado","incompleto"].indexOf(c)!==-1?"error":c==="revision"?"warn":"neutral";}
  function badge(e,c){return '<span class="subir-badge subir-badge-'+clase(c)+'">'+esc(e)+'</span>';}
  function filasVista(p){return arr(p.materias).map(function(m){var carrera=arr(p.carreras).find(function(x){return x.id===m.carreraId;}),nivel=arr(p.niveles).find(function(x){return x.id===m.nivelId;}),archivos=arr(p.archivos).filter(function(a){return a.materiaId===m.id;}),ev=m.evaluacionInteligente||evaluarMateria(m,archivos);return{carrera:carrera?carrera.nombre:"",nivel:nivel?nivel.nombre:"",codigo:m.codigo||"",materia:m.nombre||"",materiaId:m.id,archivos:archivos,evaluacion:ev};});}
  function celda(e){return '<div class="subir-pea-status">'+badge(e.etiqueta,e.codigo)+'<small>'+esc(e.detalle)+'</small></div>';}
  function pintar(filas){var t=$("tablaPreview");if(!t)return;if(!filas.length){t.innerHTML='<tr><td colspan="10" class="subir-empty">No hay materias para mostrar.</td></tr>';return;}t.innerHTML=filas.map(function(f){var e=f.evaluacion,r=e.razones[0]?'<small class="subir-razon-unica">'+esc(e.razones[0])+'</small>':"";return'<tr><td>'+esc(f.carrera)+'</td><td>'+esc(f.nivel)+'</td><td><code>'+esc(f.codigo||"S/C")+'</code></td><td><strong>'+esc(f.materia)+'</strong></td><td>'+celda(e.estados.pea_base)+'</td><td>'+celda(e.estados.pea_unidades)+'</td><td>'+celda(e.estados.pea_actividades)+'</td><td>'+badge(e.estado,e.estado)+r+'</td><td>'+f.archivos.length+'</td><td><button class="subir-mini-btn" type="button" data-int-ver="'+esc(f.materiaId)+'">Ver más</button></td></tr>';}).join("");}
  function filtrar(){var q=norm(estado.filtro),f=!q?estado.filas:estado.filas.filter(function(x){var e=x.evaluacion;return norm([x.carrera,x.nivel,x.codigo,x.materia,e.estado,e.razones.join(" ")].join(" ")).includes(q);});pintar(f);}

  function hojas(a){var mapa={};function add(n,f){n=texto(n||"Datos")||"Datos";(mapa[n]=mapa[n]||[]).push(f);}var d=a&&a.datosProcesados;if(!a)return[];if(a.tipo==="pea_base"&&obj(d)){if(obj(d.hojas))Object.keys(d.hojas).forEach(function(n){arr(d.hojas[n]&&d.hojas[n].filas).forEach(function(f){add(n,f);});});if(!Object.keys(mapa).length)arr(d.filas).forEach(function(f){add(f&&f.__hoja,f);});}else if(a.tipo==="pea_unidades"){var us=Array.isArray(d)?d:arr(d&&(d.unidades||d.registros||d.filas));us.forEach(function(u){var os=arr(u&&u.filasOriginales);if(os.length)os.forEach(function(f){add(f&&f.__hoja,f);});else if(u)add("Datos",u);});}else registros(a).forEach(function(f){add(f&&f.__hoja,f);});var hs=Object.keys(mapa).map(function(n){return{nombre:n,filas:mapa[n]};});if(!hs.length)hs=arr(a.excelResumen&&a.excelResumen.hojas).map(function(h){return{nombre:h.nombre||"Hoja",filas:arr(h.filas).length?arr(h.filas):arr(h.preview),preview:!arr(h.filas).length};});return hs;}
  function columnas(fs){var c=[],ex=["__hoja","materiaid","carreraid","nivelid","archivoid","creadoen","actualizadoen","procesadoen"];arr(fs).slice(0,300).forEach(function(f){if(!obj(f))return;Object.keys(f).forEach(function(k){if(ex.indexOf(norm(k))===-1&&c.indexOf(k)===-1)c.push(k);});});c.sort(function(a,b){return a==="__filaExcel"?-1:b==="__filaExcel"?1:0;});return c;}
  function titulo(k){return k==="__filaExcel"?"Fila Excel":texto(k).replace(/^__/,"").replace(/_/g," ").replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,"$1 $2").replace(/^./,function(x){return x.toUpperCase();});}
  function archivoActivo(f){return f.archivos.find(function(a){return a.tipo===estado.tipo;})||null;}
  function tablaExcel(a){if(!a)return'<p class="subir-excel-alert">No existe un archivo para este PEA.</p>';var err=texto(a.errorExcel||a.errorLectura);if(err)return'<p class="subir-excel-alert">'+esc(err)+'</p>';var hs=hojas(a);if(!hs.length)return'<p class="subir-excel-alert">No hay filas disponibles.</p>';estado.hoja=Math.max(0,Math.min(estado.hoja,hs.length-1));var h=hs[estado.hoja],fs=arr(h.filas),paginas=Math.max(1,Math.ceil(fs.length/POR_PAGINA));estado.pagina=Math.max(1,Math.min(estado.pagina,paginas));var ini=(estado.pagina-1)*POR_PAGINA,vis=fs.slice(ini,ini+POR_PAGINA),cols=columnas(fs),opts=hs.map(function(x,i){return'<option value="'+i+'" '+(i===estado.hoja?'selected':'')+'>'+esc(x.nombre)+' ('+x.filas.length+' filas)</option>';}).join(""),head='<tr>'+cols.map(function(c){return'<th>'+esc(titulo(c))+'</th>';}).join("")+'</tr>',body=vis.length?vis.map(function(f){return'<tr>'+cols.map(function(c){return'<td>'+esc(obj(f)?f[c]:"")+'</td>';}).join("")+'</tr>';}).join(""):'<tr><td>No hay filas.</td></tr>';return'<div class="subir-excel-toolbar"><label>Hoja <select data-int-hoja>'+opts+'</select></label><span class="subir-excel-note">Mostrando '+(fs.length?ini+1:0)+'–'+Math.min(ini+POR_PAGINA,fs.length)+' de '+fs.length+'</span></div><div class="subir-excel-wrap"><table class="subir-excel-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div><div class="subir-excel-pager"><button class="subir-excel-btn" data-int-pagina="'+(estado.pagina-1)+'" '+(estado.pagina<=1?'disabled':'')+'>Anterior</button><strong>Página '+estado.pagina+' de '+paginas+'</strong><button class="subir-excel-btn" data-int-pagina="'+(estado.pagina+1)+'" '+(estado.pagina>=paginas?'disabled':'')+'>Siguiente</button></div>'+(h.preview?'<p class="subir-excel-note">Esta carga conserva solo una vista previa. Vuelve a analizar el ZIP para guardar todas las filas.</p>':'');}
  function detalle(){var c=$("modalContenido"),tit=$("modalTitulo"),f=estado.filas.find(function(x){return x.materiaId===estado.materiaId;}),m=arr(estado.paquete&&estado.paquete.materias).find(function(x){return x.id===estado.materiaId;});if(!c||!tit||!f||!m)return;var e=f.evaluacion;tit.textContent=(m.codigo?m.codigo+' · ':'')+m.nombre;var resumen=e.estado==="completo"?'<div class="subir-int-resumen ok"><strong>Materia completa</strong>Los tres Excel contienen información válida.</div>':'<div class="subir-int-resumen error"><strong>¿Qué falta o qué debe revisarse?</strong><ul>'+e.razones.map(function(r){return'<li>'+esc(r)+'</li>';}).join("")+'</ul></div>',tabs=TIPOS.map(function(t){return'<button class="subir-excel-tab '+(t===estado.tipo?'activo':'')+'" data-int-tipo="'+t+'">'+esc(nombreTipo(t))+' · '+esc(e.estados[t].etiqueta)+'</button>';}).join("");c.innerHTML=resumen+'<section class="subir-excel-zone"><h3>Contenido de los Excel</h3><p class="subir-excel-note">Se muestran 25 filas por página.</p><div class="subir-excel-tabs">'+tabs+'</div>'+tablaExcel(archivoActivo(f))+'</section>';}
  function abrir(id){estado.materiaId=id;estado.tipo="pea_base";estado.hoja=0;estado.pagina=1;detalle();var m=$("modalDetalle");if(m&&!m.open)m.showModal();}

  function instalarPreview(){if(!NS.Preview||NS.Preview.__inteligenteV3)return;estilos();var p=NS.Preview.pintarPaquete.bind(NS.Preview),l=NS.Preview.limpiarPreview.bind(NS.Preview),con=NS.Preview.conectarEventosUI.bind(NS.Preview);NS.Preview.pintarPaquete=function(paquete){paquete=corregirPaquete(paquete);estado.paquete=paquete;estado.filas=filasVista(paquete);estado.filtro="";p(paquete);pintar(estado.filas);};NS.Preview.limpiarPreview=function(){estado={paquete:null,filas:[],filtro:"",materiaId:"",tipo:"pea_base",hoja:0,pagina:1};l();};NS.Preview.conectarEventosUI=function(){con();var b=$("buscadorPreview"),t=$("tablaPreview"),c=$("modalContenido");if(b&&!b.__intV3){b.__intV3=true;b.addEventListener("input",function(){estado.filtro=b.value;setTimeout(filtrar,0);});}if(t&&!t.__intV3){t.__intV3=true;t.addEventListener("click",function(ev){var x=ev.target.closest("[data-int-ver]");if(x)abrir(x.getAttribute("data-int-ver"));});}if(c&&!c.__intV3){c.__intV3=true;c.addEventListener("click",function(ev){var x=ev.target.closest("[data-int-tipo]");if(x){estado.tipo=x.getAttribute("data-int-tipo");estado.hoja=0;estado.pagina=1;detalle();return;}var pg=ev.target.closest("[data-int-pagina]");if(pg&&!pg.disabled){estado.pagina=Number(pg.getAttribute("data-int-pagina")||1);detalle();}});c.addEventListener("change",function(ev){if(ev.target.matches("[data-int-hoja]")){estado.hoja=Number(ev.target.value||0);estado.pagina=1;detalle();}});}};NS.Preview.abrirDetalleMateria=abrir;NS.Preview.construirFilasTabla=filasVista;NS.Preview.__inteligenteV3=true;}

  NS.ContenidoInteligente={version:3,registros:registros,evaluarContenido:evaluarContenido,evaluarTipo:evaluarTipo,evaluarMateria:evaluarMateria,corregirPaquete:corregirPaquete,instalar:function(){instalarValidador();instalarPreview();return true;}};
  NS.ContenidoInteligente.instalar();
  console.info("[SubirCCC.ContenidoInteligente] V3 activada.");
})(window, document);
