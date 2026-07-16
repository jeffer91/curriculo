/* =========================================================
Nombre completo: depuraciones.main.js
Ruta: /Curriculo/depuraciones/depuraciones.main.js
Funciones:
- Controlar filtros, análisis, resultados, edición y versiones.
- Solicitar confirmación antes de modificar registros de BDLocal.
========================================================= */
(function(window,document){
  "use strict";
  var NS=window.DepuracionesCCC||{};
  if(!NS.BDLocal||!NS.Numeracion||!NS.Verbos||!NS.Duplicados||!NS.Versiones){console.error("[Depuraciones.Main] Faltan módulos requeridos.");return;}
  var $=function(id){return document.getElementById(id);};
  var estado={carreras:[],materias:[],materiaId:"",modelo:null,hallazgos:[],edicion:null};

  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function esc(v){return texto(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function setEstado(tipo,titulo,mensaje){var el=$("depEstado");el.className="dep-status dep-status-"+tipo;el.querySelector("strong").textContent=titulo;el.querySelector("span:last-child").textContent=mensaje;}
  function option(valor,etiqueta){return '<option value="'+esc(valor)+'">'+esc(etiqueta)+"</option>";}
  function nombreMateria(m){return (m.nivelNombre?m.nivelNombre+" · ":"")+(m.codigo?m.codigo+" · ":"")+texto(m.nombreInstitucional||m.nombreCorregido||m.nombre);}

  async function cargarCarreras(){
    setEstado("working","Cargando","Leyendo carreras desde BDLocal.");
    estado.carreras=await NS.BDLocal.obtenerCarreras();
    $("depCarrera").innerHTML=option("","Selecciona una carrera")+estado.carreras.map(function(c){return option(c.id,c.nombre);}).join("");
    setEstado("ok","BDLocal disponible",estado.carreras.length+" carreras encontradas.");
  }
  async function cambiarCarrera(){
    var id=$("depCarrera").value;estado.materiaId="";estado.modelo=null;estado.hallazgos=[];
    $("btnAnalizarCarrera").disabled=!id;$("btnAnalizarMateria").disabled=true;$("btnRecargarVersiones").disabled=true;
    $("depMateriaInfo").classList.add("dep-hidden");limpiarResultados();
    if(!id){$("depMateria").disabled=true;$("depMateria").innerHTML=option("","Selecciona una carrera");return;}
    setEstado("working","Cargando materias","Consultando la carrera seleccionada.");
    estado.materias=await NS.BDLocal.obtenerMateriasPorCarrera(id);
    $("depMateria").disabled=false;$("depMateria").innerHTML=option("","Selecciona una materia")+estado.materias.map(function(m){return option(m.id,nombreMateria(m));}).join("");
    setEstado("ok","Carrera cargada",estado.materias.length+" materias disponibles para depuración.");
  }
  async function cambiarMateria(){
    estado.materiaId=$("depMateria").value;$("btnAnalizarMateria").disabled=!estado.materiaId;$("btnRecargarVersiones").disabled=!estado.materiaId;limpiarResultados();
    if(!estado.materiaId){$("depMateriaInfo").classList.add("dep-hidden");return;}
    var detalle=await NS.BDLocal.obtenerDetalle(estado.materiaId);estado.modelo=NS.BDLocal.construirModelo(detalle);renderInfo();await renderVersiones();
  }
  function renderInfo(){
    var m=estado.modelo.materia,c=estado.modelo.carrera,n=estado.modelo.nivel,el=$("depMateriaInfo");
    el.innerHTML='<div><span>Carrera</span><strong>'+esc(c.nombre||"No registrada")+'</strong></div><div><span>Nivel</span><strong>'+esc(n.nombre||n.numero||"No registrado")+'</strong></div><div><span>Código</span><strong>'+esc(m.codigo||"S/C")+'</strong></div><div><span>Materia</span><strong>'+esc(m.nombreInstitucional||m.nombreCorregido||m.nombre)+'</strong></div>';el.classList.remove("dep-hidden");
  }
  function resumenHallazgos(lista){return {total:lista.length,errores:lista.filter(function(h){return h.severidad==="error";}).length,advertencias:lista.filter(function(h){return h.severidad==="advertencia";}).length,correctos:lista.filter(function(h){return h.severidad==="correcto";}).length,informativos:lista.filter(function(h){return h.severidad==="info";}).length};}
  async function analizarMateria(materiaId,renderizar){
    await NS.Versiones.registrarVersionActual(materiaId,"analisis_depuracion");
    var detalle=await NS.BDLocal.obtenerDetalle(materiaId),modelo=NS.BDLocal.construirModelo(detalle);
    var numeracion=NS.Numeracion.analizar(modelo),verbos=NS.Verbos.analizar(modelo),duplicados=NS.Duplicados.analizar(modelo);
    var hallazgos=numeracion.concat(verbos,duplicados);hallazgos.forEach(function(h){if(h.ref)h.ref.materiaId=materiaId;});
    var resumen=resumenHallazgos(hallazgos);await NS.BDLocal.guardarEjecucion(modelo,hallazgos,resumen);
    if(renderizar!==false){estado.modelo=modelo;estado.materiaId=materiaId;estado.hallazgos=hallazgos;renderInfo();renderResultados(resumen);await renderVersiones();}
    return {modelo:modelo,hallazgos:hallazgos,resumen:resumen};
  }
  async function ejecutarMateria(){
    if(!estado.materiaId)return;
    try{$("btnAnalizarMateria").disabled=true;setEstado("working","Analizando materia","Revisando numeración, verbos, repeticiones y versiones.");var r=await analizarMateria(estado.materiaId,true);setEstado(r.resumen.errores?"error":"ok",r.resumen.errores?"Análisis con errores":"Análisis finalizado",r.resumen.total+" resultados generados; "+r.resumen.errores+" errores y "+r.resumen.advertencias+" advertencias.");}catch(e){console.error(e);setEstado("error","No se pudo analizar",e.message||String(e));}finally{$("btnAnalizarMateria").disabled=!estado.materiaId;}
  }
  async function ejecutarCarrera(){
    if(!$("depCarrera").value||!estado.materias.length)return;
    var btn=$("btnAnalizarCarrera");btn.disabled=true;var total={materias:estado.materias.length,hallazgos:0,errores:0,advertencias:0};
    try{for(var i=0;i<estado.materias.length;i+=1){setEstado("working","Analizando carrera","Materia "+(i+1)+" de "+estado.materias.length+": "+texto(estado.materias[i].nombre));var r=await analizarMateria(estado.materias[i].id,false);total.hallazgos+=r.resumen.total;total.errores+=r.resumen.errores;total.advertencias+=r.resumen.advertencias;}
      $("depResumen").innerHTML='<div class="dep-card-grid"><div class="dep-summary-card"><strong>'+total.materias+'</strong><span>Materias analizadas</span></div><div class="dep-summary-card"><strong>'+total.hallazgos+'</strong><span>Resultados generados</span></div><div class="dep-summary-card"><strong>'+total.errores+'</strong><span>Errores</span></div><div class="dep-summary-card"><strong>'+total.advertencias+'</strong><span>Advertencias</span></div></div>';setEstado(total.errores?"error":"ok","Carrera analizada",total.materias+" materias procesadas.");
    }catch(e){console.error(e);setEstado("error","Análisis interrumpido",e.message||String(e));}finally{btn.disabled=false;}
  }

  function icono(sev){return sev==="error"?"!":sev==="advertencia"?"△":sev==="correcto"?"✓":"i";}
  function tarjeta(h,index){
    var chips=[];if(h.unidadNumero)chips.push("Unidad "+h.unidadNumero);if(h.verbo)chips.push("Verbo: "+h.verbo);if(h.nivelBloomNombre)chips.push("Bloom: "+h.nivelBloomNombre);if(h.similitud)chips.push("Similitud: "+h.similitud+" %");
    return '<article class="dep-hallazgo dep-hallazgo-'+esc(h.severidad)+'"><div class="dep-hallazgo-icon">'+icono(h.severidad)+'</div><div><h3>'+esc(h.titulo)+'</h3><p>'+esc(h.mensaje)+'</p>'+(h.texto?'<p class="dep-hallazgo-texto">'+esc(h.texto)+'</p>':"")+(chips.length?'<div class="dep-hallazgo-meta">'+chips.map(function(c){return '<span class="dep-chip">'+esc(c)+'</span>';}).join("")+'</div>':"")+'</div><div>'+(h.ref?'<button class="dep-btn dep-btn-light dep-btn-small" type="button" data-editar="'+index+'">Editar en BDLocal</button>':"")+'</div></article>';
  }
  function renderLista(id,lista){$(id).innerHTML=lista.length?lista.map(function(h){return tarjeta(h,estado.hallazgos.indexOf(h));}).join(""):'<div class="dep-empty">No hay resultados en esta sección.</div>';}
  function renderResultados(resumen){
    $("statHallazgos").textContent=resumen.total;$("statErrores").textContent=resumen.errores;$("statAdvertencias").textContent=resumen.advertencias;$("statCorrectos").textContent=resumen.correctos;
    $("depResumen").innerHTML='<div class="dep-card-grid"><div class="dep-summary-card"><strong>'+resumen.errores+'</strong><span>Errores que requieren ajuste</span></div><div class="dep-summary-card"><strong>'+resumen.advertencias+'</strong><span>Observaciones para revisión</span></div><div class="dep-summary-card"><strong>'+resumen.correctos+'</strong><span>Validaciones correctas</span></div><div class="dep-summary-card"><strong>'+resumen.informativos+'</strong><span>Datos informativos</span></div></div>';
    renderLista("listaNumeracion",estado.hallazgos.filter(function(h){return h.seccion==="numeracion";}));
    renderLista("listaVerbos",estado.hallazgos.filter(function(h){return ["competencia","resultado","alineacion"].indexOf(h.seccion)!==-1;}));
    renderLista("listaDuplicados",estado.hallazgos.filter(function(h){return h.seccion==="duplicados";}));
  }
  function limpiarResultados(){estado.hallazgos=[];$("statHallazgos").textContent="0";$("statErrores").textContent="0";$("statAdvertencias").textContent="0";$("statCorrectos").textContent="0";$("statVersion").textContent="—";$("depResumen").innerHTML='<div class="dep-empty">Aún no se ha ejecutado una depuración.</div>';["listaNumeracion","listaVerbos","listaDuplicados"].forEach(function(id){$(id).innerHTML='<div class="dep-empty">Sin análisis.</div>';});}

  async function renderVersiones(){
    if(!estado.materiaId){$("listaVersiones").innerHTML='<div class="dep-empty">Selecciona una materia.</div>';return;}
    var versiones=await NS.Versiones.listar(estado.materiaId);$("statVersion").textContent=versiones.length?"v"+versiones[0].version:"—";
    if(!versiones.length){$("listaVersiones").innerHTML='<div class="dep-empty">Aún no existe una versión registrada. Se creará al analizar la materia.</div>';return;}
    $("listaVersiones").innerHTML=versiones.map(function(v){var r=v.resumenCambios||{};var items=[];if(Number(v.version)===1)items.push("Primera versión registrada.");else{items.push((r.modificados||0)+" elementos modificados.");items.push((r.agregados||0)+" elementos agregados.");items.push((r.eliminados||0)+" elementos eliminados.");}return '<article class="dep-version"><div class="dep-version-head"><h3>Versión '+v.version+'</h3><time>'+esc(new Date(v.creadoEn).toLocaleString("es-EC"))+'</time></div><div class="dep-hallazgo-meta"><span class="dep-chip">'+esc(v.origen||"depuración")+'</span><span class="dep-chip">Hash '+esc(v.hashSemantico)+'</span></div><ul>'+items.map(function(i){return '<li>'+esc(i)+'</li>';}).join("")+'</ul></article>';}).join("");
  }
  function abrirEdicion(index){var h=estado.hallazgos[Number(index)];if(!h||!h.ref)return;estado.edicion=h;$("depModalTitulo").textContent="Editar "+(h.seccion==="contenido"?"contenido":h.seccion);$("depModalAyuda").textContent="Se guardará una versión antes y otra después del cambio. El ZIP y el Excel original no se modificarán.";$("depModalTexto").value=h.texto||"";$("depModal").classList.remove("dep-hidden");$("depModalTexto").focus();}
  function cerrarModal(){estado.edicion=null;$("depModal").classList.add("dep-hidden");}
  async function guardarEdicion(){
    if(!estado.edicion||!estado.edicion.ref)return;var nuevo=$("depModalTexto").value.trim();if(!nuevo){setEstado("error","Corrección vacía","Escribe el texto que se guardará en BDLocal.");return;}
    try{$("depModalGuardar").disabled=true;setEstado("working","Guardando corrección","Creando respaldo de la versión actual.");await NS.Versiones.registrarVersionActual(estado.materiaId,"antes_de_correccion");await NS.BDLocal.guardarCorreccion(estado.edicion.ref,nuevo);await NS.Versiones.registrarVersionActual(estado.materiaId,"correccion_aprobada");cerrarModal();await analizarMateria(estado.materiaId,true);setEstado("ok","Corrección guardada","BDLocal fue actualizado y el historial de versiones quedó registrado.");}catch(e){console.error(e);setEstado("error","No se pudo guardar",e.message||String(e));}finally{$("depModalGuardar").disabled=false;}
  }
  function cambiarTab(btn){document.querySelectorAll(".dep-tab").forEach(function(b){b.classList.toggle("dep-tab-active",b===btn);});var id=btn.getAttribute("data-tab");document.querySelectorAll(".dep-tab-panel").forEach(function(p){p.classList.toggle("dep-tab-panel-active",p.id==="tab"+id.charAt(0).toUpperCase()+id.slice(1));});}
  function eventos(){
    $("depCarrera").addEventListener("change",function(){cambiarCarrera().catch(errorGlobal);});$("depMateria").addEventListener("change",function(){cambiarMateria().catch(errorGlobal);});$("btnAnalizarMateria").addEventListener("click",ejecutarMateria);$("btnAnalizarCarrera").addEventListener("click",ejecutarCarrera);$("btnRecargarVersiones").addEventListener("click",function(){renderVersiones().catch(errorGlobal);});
    document.addEventListener("click",function(e){var editar=e.target.closest("[data-editar]");if(editar)abrirEdicion(editar.getAttribute("data-editar"));var tab=e.target.closest(".dep-tab");if(tab)cambiarTab(tab);});
    $("depModalCerrar").addEventListener("click",cerrarModal);$("depModalCancelar").addEventListener("click",cerrarModal);$("depModalGuardar").addEventListener("click",guardarEdicion);$("depModal").addEventListener("click",function(e){if(e.target===$("depModal"))cerrarModal();});
  }
  function errorGlobal(e){console.error(e);setEstado("error","Ocurrió un error",e.message||String(e));}
  async function iniciar(){try{eventos();await cargarCarreras();}catch(e){errorGlobal(e);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})(window,document);
