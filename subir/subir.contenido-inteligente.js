/* =========================================================
Nombre completo: subir.contenido-inteligente.js
Ruta: /Curriculo/subir/subir.contenido-inteligente.js
Funciones:
- Mantener intactos los Excel que ya se procesan correctamente.
- Recuperar PEA Actividades solo cuando la lectura normal devuelve cero actividades.
- Detectar encabezados reales por coincidencias exactas y textos cortos.
- Evitar que una descripción extensa sea tomada como encabezado.
- Validar Base, Unidades y Actividades con el contenido real.
- Evitar el doble conteo de contenidos de Unidades.
- Mostrar hojas y filas del Excel con paginación de 25 registros.
========================================================= */
(function (window, document) {
  "use strict";

  var NS = window.SubirCCC = window.SubirCCC || {};
  if (NS.ContenidoInteligente && NS.ContenidoInteligente.version === 4) return;

  var TIPOS = ["pea_base", "pea_unidades", "pea_actividades"];
  var POR_PAGINA = 25;
  var estado = { paquete:null, filas:[], filtro:"", materiaId:"", tipo:"pea_base", hoja:0, pagina:1 };

  function $(id){ return document.getElementById(id); }
  function texto(v){ return String(v === null || typeof v === "undefined" ? "" : v).trim(); }
  function arr(v){ return Array.isArray(v) ? v : (v === null || typeof v === "undefined" ? [] : [v]); }
  function obj(v){ return !!v && typeof v === "object" && !Array.isArray(v); }
  function esc(v){ return texto(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function norm(v){ return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase(); }
  function clave(v,i){ var k=texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").toLowerCase(); return k || ("columna_"+(i+1)); }
  function nombreTipo(t){ return t === "pea_base" ? "PEA Base" : t === "pea_unidades" ? "PEA Unidades" : t === "pea_actividades" ? "PEA Actividades" : "Excel"; }

  function valorAlias(o,aliases){
    if(!obj(o)) return "";
    var buscadas=arr(aliases).map(norm), ks=Object.keys(o);
    for(var i=0;i<ks.length;i+=1){ if(buscadas.indexOf(norm(ks[i]))!==-1 && texto(o[ks[i]])) return texto(o[ks[i]]); }
    return "";
  }
  function numeroAlias(o,aliases){ var m=valorAlias(o,aliases).match(/-?\d+/); return m ? Number(m[0]) : 0; }
  function valoresFila(f){
    if(!obj(f)) return [];
    var ex=["__filaexcel","__hoja","id","materiaid","carreraid","nivelid","archivoid","creadoen","actualizadoen","procesadoen","leidoen","unidadnumero","actividaddetectada","tipoactividad","evaluacion"];
    return Object.keys(f).filter(function(k){ return ex.indexOf(norm(k))===-1 && texto(f[k]); }).map(function(k){ return texto(f[k]); });
  }
  function filasHojas(h){
    var out=[];
    if(Array.isArray(h)) h.forEach(function(x){ arr(x&&x.filas).forEach(function(f){ out.push(Object.assign({__hoja:texto(x.nombre||"Datos")},f)); }); });
    else if(obj(h)) Object.keys(h).forEach(function(n){ arr(h[n]&&h[n].filas).forEach(function(f){ out.push(Object.assign({__hoja:n},f)); }); });
    return out;
  }
  function registros(a){
    if(!a) return [];
    var d=a.datosProcesados;
    if(a.tipo==="pea_base") return obj(d) ? (arr(d.filas).length ? arr(d.filas) : filasHojas(d.hojas)) : [];
    if(a.tipo==="pea_unidades"){
      var u=Array.isArray(d)?d:arr(d&&(d.unidades||d.registros||d.filas)), originales=[];
      u.forEach(function(x){ arr(x&&x.filasOriginales).forEach(function(f){ originales.push(f); }); });
      return originales.length ? originales : u;
    }
    if(a.tipo==="pea_actividades") return Array.isArray(d)?d:arr(d&&(d.actividades||d.registros||d.filas));
    return Array.isArray(d)?d:(obj(d)?(arr(d.filas).length?arr(d.filas):filasHojas(d.hojas)):[]);
  }

  function baseValida(a){
    var d=obj(a&&a.datosProcesados)?a.datosProcesados:{}, campos=obj(d.campos)?d.campos:{}, fs=registros(a);
    var descripcion=texto(d.descripcion)||valorAlias(campos,["descripcion_asignatura","descripcionAsignatura","descripcion"]);
    var objetivo=texto(d.objetivo)||valorAlias(campos,["objetivo_asignatura","objetivoAsignatura","objetivo"]);
    fs.forEach(function(f){ var c=numeroAlias(f,["codigoComponente","codigo_componente"]),v=valorAlias(f,["descripcionComponente","descripcion_componente"]); if(c===1&&!descripcion)descripcion=v;if(c===2&&!objetivo)objetivo=v; });
    return {valido:!!(descripcion||objetivo||fs.some(function(f){return valoresFila(f).length;})),registros:fs.length,revision:!!((descripcion||objetivo)&&(!descripcion||!objetivo))};
  }
  function unidadesValidas(a){
    var d=a&&a.datosProcesados,u=Array.isArray(d)?d:arr(d&&(d.unidades||d.registros||d.filas)),unidades={},unicos={};
    u.forEach(function(x){
      if(!obj(x))return;
      var n=Number(x.unidadNumero||x.ordenComponente||x.unidad||x.numeroUnidad||0);if(n>=1&&n<=4)unidades[n]=true;
      var originales=arr(x.filasOriginales),contenidos=arr(x.contenidos).filter(function(v){return texto(v);});
      if(originales.length){
        originales.forEach(function(f){var nf=numeroAlias(f,["ordenComponente","orden_componente","unidadNumero","unidad_numero","numeroUnidad","numero_unidad","unidad"]),c=valorAlias(f,["descripcionComponente","descripcion_componente","contenido","tema","titulo"]);if(nf>=1&&nf<=4)unidades[nf]=true;if(c)unicos=[texto(f.__hoja),texto(f.__filaExcel),nf||n,norm(c)].join("|") in unicos?unicos:(unicos[[texto(f.__hoja),texto(f.__filaExcel),nf||n,norm(c)].join("|")]=true,unicos);});
      }else if(contenidos.length){contenidos.forEach(function(c,i){unicos[["contenido",n,i,norm(c)].join("|")]=true;});}
      else {var directo=texto(x.temaDetectado||x.tema||x.contenido||x.titulo||x.descripcionComponente);if(directo)unicos[["directo",n,norm(directo)].join("|")]=true;}
    });
    var total=Object.keys(unicos).length,totalUnidades=Object.keys(unidades).length;
    return {valido:total>0,registros:total,revision:total>0&&totalUnidades>0&&totalUnidades<4};
  }
  function actividadValida(f){
    if(!obj(f))return false;
    if(valorAlias(f,["actividadDetectada","actividad","descripcion","descripción","descripcionActividad","tema","titulo","contenido","detalle","taller","proyecto","mecanismo","tipoActividad","tipo_actividad","modalidad"]))return true;
    return valoresFila(f).filter(function(v){return !/^\d+(?:[.,]\d+)?$/.test(v);}).length>=2;
  }
  function actividadesValidas(a){var validas=registros(a).filter(actividadValida);return{valido:validas.length>0,registros:validas.length,revision:false};}
  function evaluarContenido(a){if(!a)return{valido:false,registros:0,revision:false};if(a.tipo==="pea_base")return baseValida(a);if(a.tipo==="pea_unidades")return unidadesValidas(a);if(a.tipo==="pea_actividades")return actividadesValidas(a);var fs=registros(a);return{valido:fs.some(function(f){return valoresFila(f).length;}),registros:fs.length,revision:false};}

  var ALIASES={nivel:["nivel","unidad","unidadnumero","numerounidad","numero de unidad"],mecanismo:["mecanismo","tipoactividad","tipo de actividad","tipo","modalidad"],tema:["tema","titulo","nombretema","nombre del tema"],descripcion:["descripcion","descripción","descripcionactividad","descripcion de actividad","actividad","contenido","detalle"]};
  function categoria(v){var n=norm(v),cats=Object.keys(ALIASES);for(var i=0;i<cats.length;i+=1){if(ALIASES[cats[i]].map(norm).indexOf(n)!==-1)return cats[i];}return "";}
  function evaluarEncabezado(f){
    var celdas=arr(f).map(texto),noVacias=celdas.filter(Boolean);if(noVacias.length<3||noVacias.length>12)return{valido:false,puntuacion:0,categorias:{}};
    var max=noVacias.reduce(function(m,c){return Math.max(m,c.length);},0),prom=noVacias.reduce(function(t,c){return t+c.length;},0)/noVacias.length;if(max>80||prom>40)return{valido:false,puntuacion:0,categorias:{}};
    var categorias={},coincidencias=0;celdas.forEach(function(c,i){var cat=categoria(c);if(cat&&typeof categorias[cat]==="undefined"){categorias[cat]=i;coincidencias+=1;}});
    var valido=coincidencias>=3&&typeof categorias.mecanismo!=="undefined"&&(typeof categorias.descripcion!=="undefined"||typeof categorias.tema!=="undefined");return{valido:valido,puntuacion:coincidencias*100-prom-max/10,categorias:categorias};
  }
  function detectarEncabezadoActividades(m){var limite=Math.min(arr(m).length,20),mejor=null;for(var i=0;i<limite;i+=1){var e=evaluarEncabezado(m[i]);if(e.valido&&(!mejor||e.puntuacion>mejor.puntuacion))mejor={index:i,puntuacion:e.puntuacion,categorias:e.categorias};}return mejor;}
  function limpiarMatriz(m){var fs=arr(m).map(function(f){return arr(f).map(texto);});while(fs.length&&!fs[0].some(function(c){return texto(c);}))fs.shift();while(fs.length&&!fs[fs.length-1].some(function(c){return texto(c);}))fs.pop();return fs;}
  function filaObjeto(f,headers,num,hoja){var o={__filaExcel:num,__hoja:hoja},usadas={};headers.forEach(function(h,i){var b=clave(h,i),k=b;if(usadas[b]){usadas[b]+=1;k=b+"_"+usadas[b];}else usadas[b]=1;o[k]=texto(f[i]);});return o;}
  function normalizarActividad(f,i){var nivel=numeroAlias(f,["nivel","unidad","unidadNumero","unidad_numero","numeroUnidad","numero_unidad"]),mecanismo=valorAlias(f,["mecanismo","tipoActividad","tipo_actividad","tipo","modalidad"]),tema=valorAlias(f,["tema","titulo","nombreTema","nombre_tema"]),descripcion=valorAlias(f,["descripcion","descripción","descripcionActividad","descripcion_actividad","actividad","contenido","detalle"]);if(!mecanismo&&!tema&&!descripcion)return null;return Object.assign({},f,{id:"actividad_rec_"+Date.now().toString(36)+"_"+i,nivel:nivel,unidadNumero:nivel,mecanismo:mecanismo,tema:tema,descripcion:descripcion,actividadDetectada:descripcion||tema||mecanismo,tipoActividad:mecanismo||"Actividad",evaluacion:""});}
  function recuperarActividadesArchivo(a){
    if(!a||a.tipo!=="pea_actividades"||!a.contenidoBinario||!window.XLSX)return null;
    var wb=window.XLSX.read(a.contenidoBinario,{type:"array",cellDates:true,cellNF:false,cellText:false}),actividades=[],hojas=[];
    wb.SheetNames.forEach(function(nombre){var ws=wb.Sheets[nombre],m=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});m=limpiarMatriz(m);var enc=detectarEncabezadoActividades(m);if(!enc){hojas.push({nombre:nombre,totalFilas:m.length,totalColumnas:m.reduce(function(mx,f){return Math.max(mx,arr(f).length);},0),encabezados:[],encabezadoIndex:-1,filas:[],preview:[]});return;}var headers=arr(m[enc.index]),filas=m.slice(enc.index+1).filter(function(f){return arr(f).some(function(c){return texto(c);});}).map(function(f,i){return filaObjeto(f,headers,enc.index+2+i,nombre);}),rec=filas.map(function(f,i){return normalizarActividad(f,actividades.length+i);}).filter(Boolean);actividades=actividades.concat(rec);hojas.push({nombre:nombre,totalFilas:m.length,totalColumnas:m.reduce(function(mx,f){return Math.max(mx,arr(f).length);},0),encabezados:headers.map(clave),encabezadoIndex:enc.index,filas:filas,preview:filas.slice(0,5)});});
    return actividades.length?{actividades:actividades,hojas:hojas,totalHojas:hojas.length}:null;
  }
  function instalarRecuperacionExcel(){
    if(!NS.Excel||NS.Excel.__recuperacionActividadesV4||typeof NS.Excel.enriquecerPaqueteConExcel!=="function")return;
    var original=NS.Excel.enriquecerPaqueteConExcel.bind(NS.Excel);
    NS.Excel.enriquecerPaqueteConExcel=async function(paquete,opciones){var r=await original(paquete,opciones),archivos=arr(r&&r.archivos).slice(),recuperados=0;for(var i=0;i<archivos.length;i+=1){var a=archivos[i];if(!a||a.tipo!=="pea_actividades"||evaluarContenido(a).valido)continue;try{var rec=recuperarActividadesArchivo(a);if(!rec||!rec.actividades.length)continue;archivos[i]=Object.assign({},a,{excelLeido:true,datosProcesados:rec.actividades,excelResumen:{totalHojas:rec.totalHojas,hojas:rec.hojas},errorExcel:"",recuperadoInteligentemente:true,totalActividadesRecuperadas:rec.actividades.length,actualizadoEn:new Date().toISOString()});recuperados+=1;}catch(error){console.warn("[SubirCCC.ContenidoInteligente] No se pudo recuperar "+texto(a.nombreArchivo)+":",error);}}return Object.assign({},r,{archivos:archivos,diagnosticoExcel:Object.assign({},r&&r.diagnosticoExcel?r.diagnosticoExcel:{},{archivosActividadesRecuperados:recuperados,recuperacionActividadesEn:recuperados?new Date().toISOString():""})});};
    NS.Excel.__recuperacionActividadesV4=true;
  }

  function evaluarTipo(archivos,tipo){
    var lista=arr(archivos).filter(function(a){return a&&a.tipo===tipo;}),nombre=nombreTipo(tipo);if(!lista.length)return{tipo:tipo,codigo:"falta",etiqueta:"Falta",detalle:"No se encontró "+nombre+".",valido:false,archivos:[],registros:0};
    var error=lista.find(function(a){return texto(a.errorExcel||a.errorLectura);});if(error)return{tipo:tipo,codigo:"error_lectura",etiqueta:"Error de lectura",detalle:texto(error.errorExcel||error.errorLectura),valido:false,archivos:lista,registros:0};
    var leidos=lista.filter(function(a){return a.excelLeido===true;});if(!leidos.length)return{tipo:tipo,codigo:"no_procesado",etiqueta:"No procesado",detalle:nombre+" fue detectado, pero no pudo procesarse.",valido:false,archivos:lista,registros:0};
    var evaluados=leidos.map(function(a){return{archivo:a,contenido:evaluarContenido(a)};}),bueno=evaluados.find(function(x){return x.contenido.valido;});if(!bueno)return{tipo:tipo,codigo:"sin_contenido",etiqueta:"Sin contenido",detalle:nombre+" existe, pero no produjo información curricular válida.",valido:false,archivos:lista,registros:0};
    var revision=lista.length>1||evaluados.some(function(x){return x.contenido.revision;})||lista.some(function(a){var c=Number(a.confianza||0);return c>0&&c<70;});return{tipo:tipo,codigo:revision?"revision":"correcto",etiqueta:revision?"Revisar":"Correcto",detalle:nombre+" fue leído y contiene "+bueno.contenido.registros+" registro(s) válido(s).",valido:true,archivos:lista,registros:bueno.contenido.registros};
  }
  function evaluarMateria(m,archivos){var estados={};TIPOS.forEach(function(t){estados[t]=evaluarTipo(archivos,t);});var completo=TIPOS.every(function(t){return estados[t].valido;}),revision=completo&&TIPOS.some(function(t){return estados[t].codigo==="revision";}),razones=TIPOS.map(function(t){return estados[t];}).filter(function(e){return !e.valido;}).map(function(e){return e.detalle;});return{materiaId:m.id,estados:estados,razones:razones,estado:completo?(revision?"revision":"completo"):"incompleto",archivosFaltantes:TIPOS.filter(function(t){return estados[t].codigo==="falta";}),archivosSinContenido:TIPOS.filter(function(t){return["sin_contenido","error_lectura","no_procesado"].indexOf(estados[t].codigo)!==-1;}),archivosDuplicados:TIPOS.filter(function(t){return estados[t].archivos.length>1;}),totalArchivosValidos:TIPOS.filter(function(t){return estados[t].valido;}).length};}
  function corregirPaquete(p){
    p=p||{};var archivos=arr(p.archivos),evaluaciones=[],materias=arr(p.materias).map(function(m){var ev=evaluarMateria(m,archivos.filter(function(a){return a.materiaId===m.id;}));evaluaciones.push(ev);return Object.assign({},m,{estadoValidacion:ev.estado,evaluacionInteligente:ev,totalArchivosEsperados:3,totalArchivosDetectados:TIPOS.filter(function(t){return ev.estados[t].archivos.length;}).length,totalArchivosEncontrados:ev.totalArchivosValidos,totalArchivosValidos:ev.totalArchivosValidos,archivosFaltantes:ev.archivosFaltantes,archivosSinContenido:ev.archivosSinContenido,archivosDuplicados:ev.archivosDuplicados,resumenValidacion:{tieneBase:ev.estados.pea_base.valido,tieneUnidades:ev.estados.pea_unidades.valido,tieneActividades:ev.estados.pea_actividades.valido},actualizadoEn:new Date().toISOString()});});
    var controladas=["materia_incompleta","contenido_pea_invalido","error_lectura_excel","excel_no_procesado","excel_sin_contenido_curricular","contenido_base_incompleto","contenido_inteligente_materia"],ids={};materias.forEach(function(m){ids[m.id]=true;});var vals=arr(p.validacionesSubida).filter(function(v){return!v||!ids[v.materiaId]||controladas.indexOf(v.tipo)===-1;});materias.forEach(function(m){var ev=m.evaluacionInteligente;if(ev.estado!=="completo")vals.push({id:"val_int_"+m.id,tipo:"contenido_inteligente_materia",severidad:ev.estado==="revision"?"advertencia":"error",bloqueaImportacion:false,materiaId:m.id,carreraId:m.carreraId||"",nivelId:m.nivelId||"",mensaje:ev.razones.join(" ")||"La materia requiere revisión.",detalle:ev,creadoEn:new Date().toISOString()});});var completas=evaluaciones.filter(function(e){return e.estado==="completo";}).length,incompletas=evaluaciones.filter(function(e){return e.estado==="incompleto";}).length,revision=evaluaciones.filter(function(e){return e.estado==="revision";}).length,bloquea=vals.some(function(v){return v&&v.bloqueaImportacion===true;}),errores=vals.filter(function(v){return v&&v.severidad==="error";}).length,advertencias=vals.filter(function(v){return v&&v.severidad==="advertencia";}).length,requiere=incompletas>0||revision>0||errores>0||advertencias>0;return Object.assign({},p,{materias:materias,evaluacionesMaterias:evaluaciones,validacionesSubida:vals,resumenValidacion:Object.assign({},p.resumenValidacion||{},{totalMaterias:materias.length,totalArchivos:archivos.length,materiasCompletas:completas,materiasIncompletas:incompletas,materiasRevision:revision,totalValidaciones:vals.length,bloqueaImportacion:bloquea,listoParaImportar:!bloquea&&!requiere,puedeImportarConObservaciones:!bloquea,requiereRevision:requiere}),validadoInteligentementeEn:new Date().toISOString()});
  }
  function instalarValidador(){if(!NS.Validador||NS.Validador.__inteligenteV4||typeof NS.Validador.validarPaquete!=="function")return;var original=NS.Validador.validarPaquete.bind(NS.Validador);NS.Validador.validarPaquete=function(p,op){op=op||{};var lanzar=op.lanzarSiBloquea===true,r=corregirPaquete(original(p,Object.assign({},op,{lanzarSiBloquea:false})));if(lanzar&&r.resumenValidacion.bloqueaImportacion)throw new Error("El paquete tiene errores críticos y no puede importarse.");return r;};NS.Validador.__inteligenteV4=true;}

  function estilos(){if($("inteligenteV4Estilos"))return;var s=document.createElement("style");s.id="inteligenteV4Estilos";s.textContent=".subir-pea-status{display:flex;flex-direction:column;gap:4px;min-width:110px}.subir-pea-status small,.subir-razon-unica,.subir-excel-note{font-size:11px;line-height:1.35;color:#667085}.subir-razon-unica{display:block;margin-top:5px;color:#912018}.subir-int-resumen{margin:12px 0;padding:12px 14px;border:1px solid #d8e2ef;border-radius:12px;background:#f8fafc}.subir-int-resumen.error{border-color:#fecdca;background:#fff4f2;color:#912018}.subir-int-resumen.ok{border-color:#abefc6;background:#ecfdf3;color:#067647}.subir-excel-zone{margin-top:18px;padding-top:15px;border-top:1px solid #d8e2ef}.subir-excel-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.subir-excel-tab,.subir-excel-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font-weight:700}.subir-excel-tab.activo{border-color:#0b4a8b;background:#eaf2fb;color:#0b4a8b}.subir-excel-toolbar,.subir-excel-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.subir-excel-toolbar select{padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.subir-excel-wrap{max-width:100%;overflow:auto;border:1px solid #cbd5e1;border-radius:12px}.subir-excel-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:12px}.subir-excel-table th,.subir-excel-table td{max-width:340px;padding:8px 10px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:left;overflow-wrap:anywhere}.subir-excel-table th{position:sticky;top:0;background:#eef4fb}.subir-excel-btn[disabled]{opacity:.45}.subir-excel-alert{padding:13px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#9a3412}";document.head.appendChild(s);}
  function clase(c){return c==="correcto"||c==="completo"?"ok":["falta","sin_contenido","error_lectura","no_procesado","incompleto"].indexOf(c)!==-1?"error":c==="revision"?"warn":"neutral";}
  function badge(e,c){return'<span class="subir-badge subir-badge-'+clase(c)+'">'+esc(e)+"</span>";}
  function filasVista(p){return arr(p.materias).map(function(m){var carrera=arr(p.carreras).find(function(x){return x.id===m.carreraId;}),nivel=arr(p.niveles).find(function(x){return x.id===m.nivelId;}),archivos=arr(p.archivos).filter(function(a){return a.materiaId===m.id;}),ev=m.evaluacionInteligente||evaluarMateria(m,archivos);return{carrera:carrera?carrera.nombre:"",nivel:nivel?nivel.nombre:"",codigo:m.codigo||"",materia:m.nombre||"",materiaId:m.id,archivos:archivos,evaluacion:ev};});}
  function celda(e){return'<div class="subir-pea-status">'+badge(e.etiqueta,e.codigo)+"<small>"+esc(e.detalle)+"</small></div>";}
  function pintar(filas){var t=$("tablaPreview");if(!t)return;if(!filas.length){t.innerHTML='<tr><td colspan="10" class="subir-empty">No hay materias para mostrar.</td></tr>';return;}t.innerHTML=filas.map(function(f){var e=f.evaluacion,r=e.razones[0]?'<small class="subir-razon-unica">'+esc(e.razones[0])+"</small>":"";return"<tr><td>"+esc(f.carrera)+"</td><td>"+esc(f.nivel)+"</td><td><code>"+esc(f.codigo||"S/C")+"</code></td><td><strong>"+esc(f.materia)+"</strong></td><td>"+celda(e.estados.pea_base)+"</td><td>"+celda(e.estados.pea_unidades)+"</td><td>"+celda(e.estados.pea_actividades)+"</td><td>"+badge(e.estado,e.estado)+r+"</td><td>"+f.archivos.length+'</td><td><button class="subir-mini-btn" type="button" data-int-ver="'+esc(f.materiaId)+'">Ver más</button></td></tr>';}).join("");}
  function filtrar(){var q=norm(estado.filtro),f=!q?estado.filas:estado.filas.filter(function(x){var e=x.evaluacion;return norm([x.carrera,x.nivel,x.codigo,x.materia,e.estado,e.razones.join(" ")].join(" ")).includes(q);});pintar(f);}
  function hojas(a){var mapa={};function add(n,f){n=texto(n||"Datos")||"Datos";(mapa[n]=mapa[n]||[]).push(f);}var d=a&&a.datosProcesados;if(!a)return[];if(a.tipo==="pea_base"&&obj(d)){if(obj(d.hojas))Object.keys(d.hojas).forEach(function(n){arr(d.hojas[n]&&d.hojas[n].filas).forEach(function(f){add(n,f);});});if(!Object.keys(mapa).length)arr(d.filas).forEach(function(f){add(f&&f.__hoja,f);});}else if(a.tipo==="pea_unidades"){var us=Array.isArray(d)?d:arr(d&&(d.unidades||d.registros||d.filas));us.forEach(function(u){var os=arr(u&&u.filasOriginales);if(os.length)os.forEach(function(f){add(f&&f.__hoja,f);});else if(u)add("Datos",u);});}else registros(a).forEach(function(f){add(f&&f.__hoja,f);});var hs=Object.keys(mapa).map(function(n){return{nombre:n,filas:mapa[n]};});if(!hs.length)hs=arr(a.excelResumen&&a.excelResumen.hojas).map(function(h){return{nombre:h.nombre||"Hoja",filas:arr(h.filas).length?arr(h.filas):arr(h.preview),preview:!arr(h.filas).length};});return hs;}
  function columnas(fs){var c=[],ex=["__hoja","materiaid","carreraid","nivelid","archivoid","creadoen","actualizadoen","procesadoen","id","unidadnumero","actividaddetectada","tipoactividad","evaluacion"];arr(fs).slice(0,300).forEach(function(f){if(!obj(f))return;Object.keys(f).forEach(function(k){if(ex.indexOf(norm(k))===-1&&c.indexOf(k)===-1)c.push(k);});});c.sort(function(a,b){return a==="__filaExcel"?-1:b==="__filaExcel"?1:0;});return c;}
  function titulo(k){return k==="__filaExcel"?"Fila Excel":texto(k).replace(/^__/,"").replace(/_/g," ").replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,"$1 $2").replace(/^./,function(x){return x.toUpperCase();});}
  function activo(f){return f.archivos.find(function(a){return a.tipo===estado.tipo;})||null;}
  function tablaExcel(a){if(!a)return'<p class="subir-excel-alert">No existe un archivo para este PEA.</p>';var error=texto(a.errorExcel||a.errorLectura);if(error)return'<p class="subir-excel-alert">'+esc(error)+"</p>";var hs=hojas(a);if(!hs.length)return'<p class="subir-excel-alert">No hay filas disponibles.</p>';estado.hoja=Math.max(0,Math.min(estado.hoja,hs.length-1));var h=hs[estado.hoja],fs=arr(h.filas),paginas=Math.max(1,Math.ceil(fs.length/POR_PAGINA));estado.pagina=Math.max(1,Math.min(estado.pagina,paginas));var ini=(estado.pagina-1)*POR_PAGINA,vis=fs.slice(ini,ini+POR_PAGINA),cols=columnas(fs),opts=hs.map(function(x,i){return'<option value="'+i+'" '+(i===estado.hoja?'selected':'')+'>'+esc(x.nombre)+' ('+x.filas.length+' filas)</option>';}).join(""),head="<tr>"+cols.map(function(c){return"<th>"+esc(titulo(c))+"</th>";}).join("")+"</tr>",body=vis.length?vis.map(function(f){return"<tr>"+cols.map(function(c){return"<td>"+esc(obj(f)?f[c]:"")+"</td>";}).join("")+"</tr>";}).join(""):'<tr><td colspan="'+Math.max(1,cols.length)+'">No hay filas.</td></tr>';return'<div class="subir-excel-toolbar"><label>Hoja <select data-int-hoja>'+opts+'</select></label><span class="subir-excel-note">Mostrando '+(fs.length?ini+1:0)+'–'+Math.min(ini+POR_PAGINA,fs.length)+' de '+fs.length+'</span></div><div class="subir-excel-wrap"><table class="subir-excel-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div><div class="subir-excel-pager"><button class="subir-excel-btn" data-int-pagina="'+(estado.pagina-1)+'" '+(estado.pagina<=1?'disabled':'')+'>Anterior</button><strong>Página '+estado.pagina+' de '+paginas+'</strong><button class="subir-excel-btn" data-int-pagina="'+(estado.pagina+1)+'" '+(estado.pagina>=paginas?'disabled':'')+'>Siguiente</button></div>'+(h.preview?'<p class="subir-excel-note">Esta carga conserva solo una vista previa. Vuelve a analizar el ZIP para guardar todas las filas.</p>':'');}
  function detalle(){var c=$("modalContenido"),tit=$("modalTitulo"),f=estado.filas.find(function(x){return x.materiaId===estado.materiaId;}),m=arr(estado.paquete&&estado.paquete.materias).find(function(x){return x.id===estado.materiaId;});if(!c||!tit||!f||!m)return;var e=f.evaluacion;tit.textContent=(m.codigo?m.codigo+' · ':'')+m.nombre;var resumen=e.estado==="completo"?'<div class="subir-int-resumen ok"><strong>Materia completa</strong>Los tres Excel contienen información válida.</div>':'<div class="subir-int-resumen error"><strong>¿Qué falta o qué debe revisarse?</strong><ul>'+e.razones.map(function(r){return'<li>'+esc(r)+'</li>';}).join("")+'</ul></div>',tabs=TIPOS.map(function(t){return'<button class="subir-excel-tab '+(t===estado.tipo?'activo':'')+'" data-int-tipo="'+t+'">'+esc(nombreTipo(t))+' · '+esc(e.estados[t].etiqueta)+'</button>';}).join("");c.innerHTML=resumen+'<section class="subir-excel-zone"><h3>Contenido de los Excel</h3><p class="subir-excel-note">Se muestran 25 filas por página.</p><div class="subir-excel-tabs">'+tabs+'</div>'+tablaExcel(activo(f))+'</section>';}
  function abrir(id){estado.materiaId=id;estado.tipo="pea_base";estado.hoja=0;estado.pagina=1;detalle();var m=$("modalDetalle");if(m&&!m.open)m.showModal();}
  function instalarPreview(){if(!NS.Preview||NS.Preview.__inteligenteV4)return;estilos();var p=NS.Preview.pintarPaquete.bind(NS.Preview),l=NS.Preview.limpiarPreview.bind(NS.Preview),con=NS.Preview.conectarEventosUI.bind(NS.Preview);NS.Preview.pintarPaquete=function(paquete){var corregido=corregirPaquete(paquete);estado.paquete=corregido;estado.filas=filasVista(corregido);estado.filtro="";p(corregido);pintar(estado.filas);};NS.Preview.limpiarPreview=function(){estado={paquete:null,filas:[],filtro:"",materiaId:"",tipo:"pea_base",hoja:0,pagina:1};l();};NS.Preview.conectarEventosUI=function(){con();var b=$("buscadorPreview"),t=$("tablaPreview"),c=$("modalContenido");if(b&&!b.__intV4){b.__intV4=true;b.addEventListener("input",function(){estado.filtro=b.value;setTimeout(filtrar,0);});}if(t&&!t.__intV4){t.__intV4=true;t.addEventListener("click",function(ev){var x=ev.target.closest("[data-int-ver]");if(x)abrir(x.getAttribute("data-int-ver"));});}if(c&&!c.__intV4){c.__intV4=true;c.addEventListener("click",function(ev){var x=ev.target.closest("[data-int-tipo]");if(x){estado.tipo=x.getAttribute("data-int-tipo");estado.hoja=0;estado.pagina=1;detalle();return;}var pg=ev.target.closest("[data-int-pagina]");if(pg&&!pg.disabled){estado.pagina=Number(pg.getAttribute("data-int-pagina")||1);detalle();}});c.addEventListener("change",function(ev){if(ev.target.matches("[data-int-hoja]")){estado.hoja=Number(ev.target.value||0);estado.pagina=1;detalle();}});}};NS.Preview.abrirDetalleMateria=abrir;NS.Preview.construirFilasTabla=filasVista;NS.Preview.__inteligenteV4=true;}

  function instalar(){instalarRecuperacionExcel();instalarValidador();instalarPreview();return true;}
  NS.ContenidoInteligente={version:4,registros:registros,evaluarContenido:evaluarContenido,evaluarTipo:evaluarTipo,evaluarMateria:evaluarMateria,corregirPaquete:corregirPaquete,detectarEncabezadoActividades:detectarEncabezadoActividades,recuperarActividadesArchivo:recuperarActividadesArchivo,instalar:instalar};
  NS.ContenidoInteligente.instalar();
  console.info("[SubirCCC.ContenidoInteligente] V4 activada.");
})(window, document);