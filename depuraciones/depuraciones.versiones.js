/* =========================================================
Nombre completo: depuraciones.versiones.js
Ruta: /Curriculo/depuraciones/depuraciones.versiones.js
Funciones:
- Crear versiones semánticas de cada materia almacenada en BDLocal.
- Evitar versiones falsas por espacios, tildes, mayúsculas o fechas técnicas.
- Registrar las diferencias entre una versión y la siguiente.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC,BD=window.BDLocalCCC;
  if(!BD||!BD.Core||!BD.Schema){console.error("[Depuraciones.Versiones] Falta BDLocalCCC.");return;}
  var Core=BD.Core,Schema=BD.Schema,S=Schema.STORES;
  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function fecha(){return Schema.fechaISO?Schema.fechaISO():new Date().toISOString();}
  function clonar(v){return JSON.parse(JSON.stringify(v));}
  function ordenarObjeto(v){
    if(Array.isArray(v))return v.map(ordenarObjeto);
    if(v&&typeof v==="object"){
      var o={};Object.keys(v).sort().forEach(function(k){if(["actualizadoEn","creadoEn","generadoEn","depuradoEn","ultimaDepuracionEn","contenidoBinario"].indexOf(k)!==-1)return;o[k]=ordenarObjeto(v[k]);});return o;
    }
    return v;
  }
  function normalizarSemantico(v){
    if(typeof v==="string")return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[\s\u00a0]+/g," ").replace(/\s*([,.;:])\s*/g,"$1").trim();
    if(Array.isArray(v))return v.map(normalizarSemantico);
    if(v&&typeof v==="object"){var o={};Object.keys(v).sort().forEach(function(k){o[k]=normalizarSemantico(v[k]);});return o;}
    return v;
  }
  function hash(cadena){var h=2166136261,s=String(cadena||"");for(var i=0;i<s.length;i+=1){h^=s.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return("00000000"+(h>>>0).toString(16)).slice(-8);}
  function snapshotModelo(modelo){
    return ordenarObjeto({
      materia:{id:modelo.materia.id,carreraId:modelo.materia.carreraId,nivelId:modelo.materia.nivelId,codigo:modelo.materia.codigo||"",nombre:modelo.materia.nombre||"",nombreInstitucional:modelo.materia.nombreInstitucional||""},
      carrera:{id:modelo.carrera.id||"",nombre:modelo.carrera.nombre||""},
      nivel:{id:modelo.nivel.id||"",numero:modelo.nivel.numero||0,nombre:modelo.nivel.nombre||""},
      unidades:(modelo.unidades||[]).map(function(u){return {numero:u.numero,nombre:u.nombre||"",competencia:u.competencia||"",resultado:u.resultado||"",contenidos:(u.contenidos||[]).map(function(c){return c.texto;})};}),
      actividades:(modelo.actividades||[]).map(function(a){return {unidadNumero:a.unidadNumero||a.unidad||0,tipo:a.tipoActividad||a.mecanismo||a.tipo||"",tema:a.tema||a.titulo||"",descripcion:a.actividadDetectada||a.actividad||a.descripcion||a.contenido||""};})
    });
  }
  function diferencias(anterior,nuevo,ruta,salida){
    ruta=ruta||"";salida=salida||[];
    if(salida.length>=400)return salida;
    var aTipo=Array.isArray(anterior)?"array":typeof anterior,bTipo=Array.isArray(nuevo)?"array":typeof nuevo;
    if(aTipo!==bTipo){salida.push({ruta:ruta||"raiz",tipoCambio:"modificado",valorAnterior:anterior,valorNuevo:nuevo});return salida;}
    if(aTipo==="array"){
      var max=Math.max(anterior.length,nuevo.length);for(var i=0;i<max;i+=1){var r=ruta+"["+i+"]";if(i>=anterior.length)salida.push({ruta:r,tipoCambio:"agregado",valorAnterior:null,valorNuevo:nuevo[i]});else if(i>=nuevo.length)salida.push({ruta:r,tipoCambio:"eliminado",valorAnterior:anterior[i],valorNuevo:null});else diferencias(anterior[i],nuevo[i],r,salida);}return salida;
    }
    if(anterior&&nuevo&&aTipo==="object"){
      var claves={};Object.keys(anterior).forEach(function(k){claves[k]=1;});Object.keys(nuevo).forEach(function(k){claves[k]=1;});Object.keys(claves).sort().forEach(function(k){var r=ruta?ruta+"."+k:k;if(!Object.prototype.hasOwnProperty.call(anterior,k))salida.push({ruta:r,tipoCambio:"agregado",valorAnterior:null,valorNuevo:nuevo[k]});else if(!Object.prototype.hasOwnProperty.call(nuevo,k))salida.push({ruta:r,tipoCambio:"eliminado",valorAnterior:anterior[k],valorNuevo:null});else diferencias(anterior[k],nuevo[k],r,salida);});return salida;
    }
    if(JSON.stringify(anterior)!==JSON.stringify(nuevo))salida.push({ruta:ruta||"raiz",tipoCambio:"modificado",valorAnterior:anterior,valorNuevo:nuevo});
    return salida;
  }
  function seccionRuta(ruta){if(/^unidades/.test(ruta))return "unidades";if(/^actividades/.test(ruta))return "actividades";if(/^materia/.test(ruta))return "materia";return "general";}
  async function listar(materiaId){await Core.ready();var lista=await Core.getAllByIndex(S.MATERIA_VERSIONES,"materiaId",materiaId);return lista.sort(function(a,b){return Number(b.version||0)-Number(a.version||0);});}
  async function registrarVersionActual(materiaId,origen){
    await Core.ready();if(!NS.BDLocal)throw new Error("No está disponible DepuracionesCCC.BDLocal.");
    var detalle=await NS.BDLocal.obtenerDetalle(materiaId),modelo=NS.BDLocal.construirModelo(detalle),snapshot=snapshotModelo(modelo);
    var exacto=JSON.stringify(snapshot),semantico=JSON.stringify(normalizarSemantico(snapshot));
    var hashExacto=hash(exacto),hashSemantico=hash(semantico),versiones=await listar(materiaId),ultima=versiones[0]||null;
    if(ultima&&ultima.hashSemantico===hashSemantico)return {creada:false,version:ultima,cambios:[]};
    var numero=ultima?Number(ultima.version||0)+1:1,ahora=fecha();
    var registro={id:"version_"+Schema.slug(materiaId)+"_"+numero+"_"+Date.now(),materiaId:materiaId,carreraId:modelo.materia.carreraId,nivelId:modelo.materia.nivelId,codigoMateria:modelo.materia.codigo||"",nombreMateria:modelo.materia.nombre||"",version:numero,hashExacto:hashExacto,hashSemantico:hashSemantico,snapshot:clonar(snapshot),origen:origen||"depuracion",creadoEn:ahora};
    var cambios=ultima?diferencias(ultima.snapshot,snapshot,"",[]):[];
    registro.resumenCambios={total:cambios.length,agregados:cambios.filter(function(c){return c.tipoCambio==="agregado";}).length,eliminados:cambios.filter(function(c){return c.tipoCambio==="eliminado";}).length,modificados:cambios.filter(function(c){return c.tipoCambio==="modificado";}).length};
    await Core.put(S.MATERIA_VERSIONES,registro);
    if(cambios.length){await Core.bulkPut(S.MATERIA_CAMBIOS,cambios.map(function(c){return {id:Schema.uid("cambio"),materiaId:materiaId,versionAnterior:ultima.version,versionNueva:numero,seccion:seccionRuta(c.ruta),ruta:c.ruta,tipoCambio:c.tipoCambio,valorAnterior:c.valorAnterior,valorNuevo:c.valorNuevo,creadoEn:ahora};}));}
    return {creada:true,version:registro,cambios:cambios};
  }
  async function cambiosDeVersion(materiaId,versionNueva){var lista=await Core.getAllByIndex(S.MATERIA_CAMBIOS,"materiaId",materiaId);return lista.filter(function(c){return Number(c.versionNueva)===Number(versionNueva);});}
  NS.Versiones={registrarVersionActual:registrarVersionActual,listar:listar,cambiosDeVersion:cambiosDeVersion,snapshotModelo:snapshotModelo,diferencias:diferencias,normalizarSemantico:normalizarSemantico};
})(window);
