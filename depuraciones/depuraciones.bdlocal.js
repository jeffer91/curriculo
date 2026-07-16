/* =========================================================
Nombre completo: depuraciones.bdlocal.js
Ruta: /Curriculo/depuraciones/depuraciones.bdlocal.js
Funciones:
- Leer carreras, materias y contenido curricular desde IndexedDB.
- Construir un modelo uniforme para los motores de depuración.
- Recuperar competencias y resultados desde unidadesBase o filas heredadas.
- Aplicar correcciones aprobadas solamente sobre BDLocal.
- Guardar ejecuciones y hallazgos de control de calidad.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC,BD=window.BDLocalCCC;
  if(!BD||!BD.Schema||!BD.Core){console.error("[Depuraciones.BDLocal] Falta BDLocalCCC.");return;}
  var Schema=BD.Schema,Core=BD.Core,S=Schema.STORES;
  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function arr(v){if(Array.isArray(v))return v;if(v===null||typeof v==="undefined")return[];return[v];}
  function fecha(){return Schema.fechaISO?Schema.fechaISO():new Date().toISOString();}
  function clonar(v){return JSON.parse(JSON.stringify(v));}
  function normalizarCampo(v){return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();}
  function valorCampo(obj,aliases){obj=obj||{};var buscados=aliases.map(normalizarCampo),keys=Object.keys(obj);for(var i=0;i<keys.length;i+=1){if(buscados.indexOf(normalizarCampo(keys[i]))!==-1&&texto(obj[keys[i]]))return {campo:keys[i],valor:texto(obj[keys[i]])};}return {campo:aliases[0],valor:""};}
  function numeroCampo(obj,aliases,defecto){var v=valorCampo(obj,aliases).valor,m=v.match(/-?\d+/);return m?Number(m[0]):Number(defecto||0);}
  function numeroUnidad(obj,defecto){var n=Number(obj&&(obj.unidadNumero||obj.numeroUnidad||obj.numero_unidad||obj.unidad||obj.n_unidad||obj.ordenComponente));return n>=1&&n<=4?n:Number(defecto||0);}
  function ordenarMaterias(a,b){var na=Number(a.nivelNumero||0),nb=Number(b.nivelNumero||0);if(na!==nb)return na-nb;return texto(a.nombre).localeCompare(texto(b.nombre),"es",{sensitivity:"base"});}
  async function inicializar(){await Core.ready();return true;}
  async function obtenerCarreras(){await inicializar();return(await Core.getAll(S.CARRERAS)).filter(function(c){return c&&c.id&&c.estado!=="eliminado";}).sort(function(a,b){return texto(a.nombre).localeCompare(texto(b.nombre),"es");});}
  async function obtenerMateriasPorCarrera(carreraId){await inicializar();var materias=await Core.getAllByIndex(S.MATERIAS,"carreraId",carreraId),niveles=await Core.getAllByIndex(S.NIVELES,"carreraId",carreraId),mapa={};niveles.forEach(function(n){mapa[n.id]=n;});return materias.map(function(m){var n=mapa[m.nivelId]||{};return Object.assign({},m,{nivelNumero:Number(n.numero||0),nivelNombre:texto(n.nombre)});}).sort(ordenarMaterias);}
  async function obtenerDetalle(materiaId){
    await inicializar();
    if(BD.Consultas&&typeof BD.Consultas.obtenerDetalleMateria==="function")return await BD.Consultas.obtenerDetalleMateria(materiaId);
    var materia=await Core.get(S.MATERIAS,materiaId);if(!materia)throw new Error("No se encontró la materia.");
    return {materia:materia,carrera:await Core.get(S.CARRERAS,materia.carreraId),nivel:await Core.get(S.NIVELES,materia.nivelId),pea:{base:await Core.get(S.PEA_BASE,materiaId),unidades:await Core.getAllByIndex(S.PEA_UNIDADES,"materiaId",materiaId),actividades:await Core.getAllByIndex(S.PEA_ACTIVIDADES,"materiaId",materiaId)}};
  }
  function resolverBase(base){base=base||{};if(base.datos&&typeof base.datos==="object")return{datos:base.datos,ruta:["datos"]};if(base.datosProcesados&&typeof base.datosProcesados==="object")return{datos:base.datosProcesados,ruta:["datosProcesados"]};return{datos:base,ruta:[]};}
  function resolverUnidadesBase(base){var r=resolverBase(base),datos=r.datos||{};if(Array.isArray(datos.unidadesBase))return{unidades:datos.unidadesBase,ruta:r.ruta.concat(["unidadesBase"])};if(Array.isArray(base&&base.unidadesBase))return{unidades:base.unidadesBase,ruta:["unidadesBase"]};return{unidades:[],ruta:r.ruta.concat(["unidadesBase"])};}
  function campoExistente(obj,campos){for(var i=0;i<campos.length;i+=1){if(Object.prototype.hasOwnProperty.call(obj||{},campos[i]))return campos[i];}return campos[0];}
  function contenidoDirecto(registro){var campos=["contenido","temaDetectado","tema","titulo","descripcionComponente","descripcion_componente","descripcion"];for(var i=0;i<campos.length;i+=1){if(texto(registro&&registro[campos[i]]))return{campo:campos[i],texto:texto(registro[campos[i]])};}return null;}
  function obtenerFilasBase(base){
    var lista=[],r=resolverBase(base),datos=r.datos||{};
    arr(datos.filas).forEach(function(f,i){lista.push({fila:f,path:r.ruta.concat(["filas",i])});});
    if(r.ruta.length)arr(base.filas).forEach(function(f,i){lista.push({fila:f,path:["filas",i]});});
    function hojas(origen,pathBase){Object.keys(origen||{}).forEach(function(nombre){arr(origen[nombre]&&origen[nombre].filas).forEach(function(f,i){lista.push({fila:f,path:pathBase.concat([nombre,"filas",i])});});});}
    hojas(datos.hojas,r.ruta.concat(["hojas"]));if(r.ruta.length)hojas(base.hojas,["hojas"]);
    return lista;
  }
  function construirModelo(detalle){
    detalle=detalle||{};var materia=detalle.materia||{},base=detalle.pea&&detalle.pea.base||detalle.peaBase||null,registros=arr(detalle.pea&&detalle.pea.unidades||detalle.unidades),resBase=resolverUnidadesBase(base||{});
    var mapa={1:{numero:1,contenidos:[],refs:{}},2:{numero:2,contenidos:[],refs:{}},3:{numero:3,contenidos:[],refs:{}},4:{numero:4,contenidos:[],refs:{}}};
    resBase.unidades.forEach(function(u,index){
      var n=numeroUnidad(u,index+1);if(!mapa[n])return;
      var cn=campoExistente(u,["nombre","tituloUnidad","titulo","unidadNombre"]),cc=campoExistente(u,["competencia","competenciaUnidad","competencia_unidad"]),cr=campoExistente(u,["resultadoAprendizaje","resultado","resultado_aprendizaje","resultadoDetectado"]);
      mapa[n].nombre=texto(u[cn]);mapa[n].competencia=texto(u[cc]);mapa[n].resultado=texto(u[cr]);
      mapa[n].refs.nombre={store:S.PEA_BASE,key:materia.id,path:resBase.ruta.concat([index,cn]),seccion:"nombre_unidad",unidadNumero:n};
      mapa[n].refs.competencia={store:S.PEA_BASE,key:materia.id,path:resBase.ruta.concat([index,cc]),seccion:"competencia",unidadNumero:n};
      mapa[n].refs.resultado={store:S.PEA_BASE,key:materia.id,path:resBase.ruta.concat([index,cr]),seccion:"resultado",unidadNumero:n};
    });
    obtenerFilasBase(base||{}).forEach(function(item){
      var fila=item.fila||{},codigo=numeroCampo(fila,["codigoComponente","codigo_componente"],0),orden=numeroCampo(fila,["ordenComponente","orden_componente"],0);if(!mapa[orden]||[3,4,5].indexOf(codigo)===-1)return;
      var d=valorCampo(fila,["descripcionComponente","descripcion_componente"]),ref={store:S.PEA_BASE,key:materia.id,path:item.path.concat([d.campo]),unidadNumero:orden};
      if(codigo===3&&!mapa[orden].nombre){mapa[orden].nombre=d.valor;ref.seccion="nombre_unidad";mapa[orden].refs.nombre=ref;}
      if(codigo===4&&!mapa[orden].competencia){mapa[orden].competencia=d.valor;ref.seccion="competencia";mapa[orden].refs.competencia=ref;}
      if(codigo===5&&!mapa[orden].resultado){mapa[orden].resultado=d.valor;ref.seccion="resultado";mapa[orden].refs.resultado=ref;}
    });
    registros.forEach(function(registro,indexRegistro){
      var n=numeroUnidad(registro,0);if(!mapa[n]){var muestra=arr(registro&&registro.contenidos)[0]||texto(registro&&registro.temaDetectado),match=texto(muestra).match(/^\s*([1-4])(?:\.|\s|$)/);n=match?Number(match[1]):0;}if(!mapa[n])return;
      if(Array.isArray(registro.contenidos))registro.contenidos.forEach(function(c,indexContenido){if(texto(c))mapa[n].contenidos.push({texto:texto(c),ref:{store:S.PEA_UNIDADES,key:registro.id,path:["contenidos",indexContenido],seccion:"contenido",unidadNumero:n,registroIndex:indexRegistro}});});
      else{var directo=contenidoDirecto(registro);if(directo)mapa[n].contenidos.push({texto:directo.texto,ref:{store:S.PEA_UNIDADES,key:registro.id,path:[directo.campo],seccion:"contenido",unidadNumero:n,registroIndex:indexRegistro}});}
    });
    return{materia:materia,carrera:detalle.carrera||{},nivel:detalle.nivel||{},base:base,actividades:arr(detalle.pea&&detalle.pea.actividades||detalle.actividades),unidades:[mapa[1],mapa[2],mapa[3],mapa[4]],detalleOriginal:detalle};
  }
  function establecer(obj,path,valor){var actual=obj;for(var i=0;i<path.length-1;i+=1){var k=path[i];if(actual[k]===null||typeof actual[k]!=="object")actual[k]=typeof path[i+1]==="number"?[]:{};actual=actual[k];}actual[path[path.length-1]]=valor;return obj;}
  async function guardarCorreccion(ref,nuevoTexto){
    if(!ref||!ref.store||!ref.key||!Array.isArray(ref.path))throw new Error("La referencia de corrección no es válida.");nuevoTexto=texto(nuevoTexto);if(!nuevoTexto)throw new Error("La corrección no puede quedar vacía.");
    var registro=await Core.get(ref.store,ref.key);if(!registro)throw new Error("No se encontró el registro que se desea corregir.");var copia=clonar(registro);establecer(copia,ref.path,nuevoTexto);copia.actualizadoEn=fecha();copia.depuradoEn=fecha();await Core.put(ref.store,copia);
    var materia=await Core.get(S.MATERIAS,ref.materiaId||registro.materiaId||registro.id||"");if(materia){materia.actualizadoEn=fecha();materia.ultimaDepuracionEn=fecha();await Core.put(S.MATERIAS,materia);}return copia;
  }
  async function guardarEjecucion(modelo,hallazgos,resumen){var id=Schema.uid("dep"),ahora=fecha(),ejecucion={id:id,materiaId:modelo.materia.id,carreraId:modelo.materia.carreraId,nivelId:modelo.materia.nivelId,estado:"finalizado",resumen:resumen||{},creadoEn:ahora};await Core.put(S.DEPURACION_EJECUCIONES,ejecucion);var filas=arr(hallazgos).map(function(h){return Object.assign({},h,{id:Schema.uid("hallazgo"),ejecucionId:id,materiaId:modelo.materia.id,carreraId:modelo.materia.carreraId,estado:"pendiente",creadoEn:ahora});});if(filas.length)await Core.bulkPut(S.DEPURACION_HALLAZGOS,filas);return{ejecucion:ejecucion,hallazgos:filas};}
  async function obtenerEjecuciones(materiaId){var datos=await Core.getAllByIndex(S.DEPURACION_EJECUCIONES,"materiaId",materiaId);return datos.sort(function(a,b){return texto(b.creadoEn).localeCompare(texto(a.creadoEn));});}
  NS.BDLocal={inicializar:inicializar,obtenerCarreras:obtenerCarreras,obtenerMateriasPorCarrera:obtenerMateriasPorCarrera,obtenerDetalle:obtenerDetalle,construirModelo:construirModelo,guardarCorreccion:guardarCorreccion,guardarEjecucion:guardarEjecucion,obtenerEjecuciones:obtenerEjecuciones,establecer:establecer,clonar:clonar};
})(window);
