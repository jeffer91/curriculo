/* =========================================================
Nombre completo: menu-superior.js
Ruta o ubicación: /Curriculo/menu-superior/menu-superior.js
Función o funciones:
- Crear un menú superior reutilizable en todas las pantallas.
- Navegar de forma segura en navegador y Electron.
- Incorporar el módulo Depuraciones mediante navegación local directa.
- Cargar automáticamente diagnóstico global e inteligencia BDLocal.
- Activar la apertura no bloqueante del detalle de materias en BDLocal.
========================================================= */
(function(window,document){
  "use strict";
  var MENU_ID="curriculoMenuSuperior";
  var ROOT_CLASS="cms-menu-mounted";
  var VERSION_RECURSOS="20260716-2";
  var LINKS=[
    {id:"inicio",label:"Inicio",shortLabel:"Inicio",root:"index.html",child:"../index.html",icon:"⌂"},
    {id:"subir",label:"Subir ZIP",shortLabel:"Subir",root:"subir/subir.html",child:"../subir/subir.html",icon:"ZIP"},
    {id:"bdlocal",label:"BDLocal",shortLabel:"BD",root:"bdlocal/bdlocal.html",child:"../bdlocal/bdlocal.html",icon:"BD"},
    {id:"depuraciones",label:"Depuraciones",shortLabel:"Dep.",root:"depuraciones/depuraciones.html",child:"../depuraciones/depuraciones.html",icon:"DEP",native:true},
    {id:"comunicados",label:"Comunicados",shortLabel:"Com.",root:"comunicados/comunicados.html",child:"../comunicados/comunicados.html",icon:"COM"}
  ];
  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function escapar(v){return texto(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function pathActual(){return String(window.location.pathname||"").replace(/\\/g,"/").toLowerCase();}
  function estaEnSubcarpeta(){return /\/(subir|bdlocal|comunicados|depuraciones|menu-superior)\//.test(pathActual());}
  function rutaDesdeRaiz(ruta){return(estaEnSubcarpeta()?"../":"")+ruta;}
  function pantallaActual(){var p=pathActual();if(p.indexOf("/subir/")!==-1)return"subir";if(p.indexOf("/bdlocal/")!==-1)return"bdlocal";if(p.indexOf("/depuraciones/")!==-1)return"depuraciones";if(p.indexOf("/comunicados/")!==-1)return"comunicados";return"inicio";}
  function hrefDe(link){return estaEnSubcarpeta()?link.child:link.root;}
  function esElectron(){return!!(window.CurriculoElectron&&window.CurriculoElectron.isElectron===true&&typeof window.CurriculoElectron.navigate==="function");}
  function construirHTML(){
    var activa=pantallaActual();
    var links=LINKS.map(function(link){
      var routeAttr=link.native?"":' data-cms-route="'+escapar(link.id)+'"';
      return '<a class="cms-link '+(link.id===activa?"cms-link-active":"")+'" href="'+escapar(hrefDe(link))+'"'+routeAttr+' title="'+escapar(link.label)+'"><span class="cms-link-icon">'+escapar(link.icon)+'</span><span class="cms-link-label">'+escapar(link.label)+'</span><span class="cms-link-short">'+escapar(link.shortLabel)+'</span></a>';
    }).join("");
    return '<nav id="'+MENU_ID+'" class="cms-menu" aria-label="Menú superior Curriculo"><div class="cms-inner"><a class="cms-brand" href="'+escapar(estaEnSubcarpeta()?"../index.html":"index.html")+'" data-cms-route="inicio"><span class="cms-brand-mark">CCC</span><span class="cms-brand-text"><strong>Curriculo</strong><small>Gestión Curricular</small></span></a><div class="cms-links">'+links+'</div><div class="cms-right"><span class="cms-mode" id="cmsMode">Local</span><button class="cms-icon-btn" type="button" id="cmsBtnRecargar" title="Recargar pantalla">↻</button></div></div></nav>';
  }
  async function navegar(ruta,fallbackHref){
    var href=texto(fallbackHref);
    if(esElectron()){
      try{var resultado=await window.CurriculoElectron.navigate(ruta);if(resultado===true||(resultado&&resultado.ok===true))return true;console.warn("[MenuSuperior] Electron no confirmó la navegación:",resultado);}catch(error){console.warn("[MenuSuperior] Falló la navegación IPC:",error);}
    }
    if(href){window.location.assign(href);return true;}return false;
  }
  function conectarEventos(){
    var menu=document.getElementById(MENU_ID);if(!menu)return;
    menu.addEventListener("click",function(event){var enlace=event.target.closest("[data-cms-route]");if(!enlace)return;if(esElectron()){event.preventDefault();navegar(enlace.getAttribute("data-cms-route"),enlace.getAttribute("href"));}});
    var recargar=document.getElementById("cmsBtnRecargar");if(recargar)recargar.addEventListener("click",function(){window.location.reload();});
  }
  function actualizarModo(){var el=document.getElementById("cmsMode");if(!el)return;el.textContent=esElectron()?"Electron":"Navegador";el.classList.toggle("cms-mode-electron",esElectron());}
  function cargarScript(src,atributo,callback){
    var existente=document.querySelector('script['+atributo+'="true"]');if(existente){if(callback)callback();return;}
    var script=document.createElement("script");script.src=src;script.async=false;script.setAttribute(atributo,"true");if(callback)script.addEventListener("load",callback,{once:true});script.addEventListener("error",function(){console.error("[MenuSuperior] No se pudo cargar:",src);});document.head.appendChild(script);
  }
  function cargarDiagnosticoGlobal(){
    if(!document.querySelector('link[data-diagnostico-css="true"]')){var link=document.createElement("link");link.rel="stylesheet";link.href=rutaDesdeRaiz("diagnostico/diagnostico-modal.css?v="+VERSION_RECURSOS);link.dataset.diagnosticoCss="true";document.head.appendChild(link);}
    if(window.DiagnosticoFlujo){if(!window.DiagnosticoModal)cargarScript(rutaDesdeRaiz("diagnostico/diagnostico-modal.js?v="+VERSION_RECURSOS),"data-diagnostico-modal");return;}
    cargarScript(rutaDesdeRaiz("diagnostico/diagnostico-flujo.js?v="+VERSION_RECURSOS),"data-diagnostico-flujo",function(){if(!window.DiagnosticoModal)cargarScript(rutaDesdeRaiz("diagnostico/diagnostico-modal.js?v="+VERSION_RECURSOS),"data-diagnostico-modal");});
  }
  function cargarInteligenciaBDLocal(){
    if(!window.BDLocalCCC||!window.BDLocalCCC.Core||window.BDLocalCCC.Inteligencia||document.querySelector('script[data-bdlocal-inteligencia="true"]'))return;
    var script=document.createElement("script");script.src=rutaDesdeRaiz("bdlocal/bdlocal.inteligencia.js?v="+VERSION_RECURSOS);script.dataset.bdlocalInteligencia="true";script.async=false;script.addEventListener("error",function(){console.error("[MenuSuperior] No se pudo cargar bdlocal.inteligencia.js.");});document.head.appendChild(script);
  }
  function cargarDetalleRapidoBDLocal(){
    if(pantallaActual()!=="bdlocal"||document.querySelector('script[data-bdlocal-detalle-rapido="true"]'))return;
    cargarScript(rutaDesdeRaiz("bdlocal/bdlocal.detalle-rapido.js?v="+VERSION_RECURSOS),"data-bdlocal-detalle-rapido");
  }
  function montar(){
    cargarDiagnosticoGlobal();
    if(document.getElementById(MENU_ID)){cargarInteligenciaBDLocal();cargarDetalleRapidoBDLocal();return;}
    document.body.classList.add(ROOT_CLASS);document.body.insertAdjacentHTML("afterbegin",construirHTML());conectarEventos();actualizarModo();cargarInteligenciaBDLocal();cargarDetalleRapidoBDLocal();
  }
  function marcarActivo(ruta){document.querySelectorAll(".cms-link").forEach(function(link){var id=link.getAttribute("data-cms-route")||(/depuraciones/.test(link.getAttribute("href")||"")?"depuraciones":"");link.classList.toggle("cms-link-active",id===texto(ruta||pantallaActual()).toLowerCase());});}
  window.CurriculoMenuSuperior={montar:montar,marcarActivo:marcarActivo,obtenerPantallaActual:pantallaActual,esElectron:esElectron,navegar:navegar,cargarDiagnosticoGlobal:cargarDiagnosticoGlobal};
  cargarDiagnosticoGlobal();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",montar,{once:true});else montar();
})(window,document);
