/* =========================================================
Nombre completo: depuraciones.duplicados.js
Ruta: /Curriculo/depuraciones/depuraciones.duplicados.js
Funciones:
- Detectar duplicados exactos y textos curricularmente similares.
- Comparar contenidos, competencias, resultados y actividades de una materia.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC;
  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function normalizar(v){return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/^\s*\d+(?:\.\d+)+\s*/,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim();}
  function tokens(v){var omitir={de:1,la:1,el:1,los:1,las:1,un:1,una:1,y:1,e:1,o:1,para:1,por:1,del:1,al:1,en:1,con:1,su:1,sus:1};return normalizar(v).split(" ").filter(function(t){return t.length>2&&!omitir[t];});}
  function similitud(a,b){
    var A=tokens(a),B=tokens(b);if(!A.length||!B.length)return 0;
    var setA={};A.forEach(function(t){setA[t]=1;});var setB={};B.forEach(function(t){setB[t]=1;});
    var inter=0,union={};Object.keys(setA).forEach(function(k){union[k]=1;if(setB[k])inter+=1;});Object.keys(setB).forEach(function(k){union[k]=1;});
    return inter/Object.keys(union).length;
  }
  function obtenerItems(modelo){
    var items=[];
    (modelo.unidades||[]).forEach(function(u){
      if(texto(u.competencia))items.push({tipo:"competencia",unidadNumero:u.numero,texto:u.competencia,ref:u.refs&&u.refs.competencia});
      if(texto(u.resultado))items.push({tipo:"resultado",unidadNumero:u.numero,texto:u.resultado,ref:u.refs&&u.refs.resultado});
      (u.contenidos||[]).forEach(function(c){if(texto(c.texto))items.push({tipo:"contenido",unidadNumero:u.numero,texto:c.texto,ref:c.ref});});
    });
    (modelo.actividades||[]).forEach(function(a,i){var t=texto(a.actividadDetectada||a.actividad||a.descripcion||a.tema||a.titulo||a.contenido);if(t)items.push({tipo:"actividad",unidadNumero:Number(a.unidadNumero||a.unidad||0),texto:t,ref:null,indice:i});});
    return items.slice(0,350);
  }
  function analizar(modelo){
    var items=obtenerItems(modelo),hallazgos=[],vistos={},pares={};
    items.forEach(function(item){
      var clave=item.tipo+"|"+normalizar(item.texto);if(normalizar(item.texto).length<5)return;
      if(vistos[clave]){
        hallazgos.push({tipo:"duplicado_exacto",severidad:"error",titulo:"Duplicado exacto de "+item.tipo,mensaje:"El mismo texto aparece en más de una ubicación de la materia.",texto:item.texto,ref:item.ref,unidadNumero:item.unidadNumero,seccion:"duplicados",coincideCon:vistos[clave]});
      }else vistos[clave]={unidadNumero:item.unidadNumero,texto:item.texto,tipo:item.tipo};
    });
    for(var i=0;i<items.length;i+=1){
      for(var j=i+1;j<items.length;j+=1){
        var a=items[i],b=items[j];if(a.tipo!==b.tipo)continue;
        var na=normalizar(a.texto),nb=normalizar(b.texto);if(na===nb||na.length<18||nb.length<18)continue;
        var s=similitud(a.texto,b.texto);if(s<.82)continue;
        var key=[na,nb].sort().join("||");if(pares[key])continue;pares[key]=1;
        hallazgos.push({tipo:"posible_repeticion",severidad:"advertencia",titulo:"Posible repetición de "+a.tipo,mensaje:"Los textos presentan una similitud aproximada del "+Math.round(s*100)+" %. Revisa si ambos aportan contenidos diferentes.",texto:a.texto+"\n\nCoincide con:\n"+b.texto,ref:b.ref||a.ref,unidadNumero:b.unidadNumero||a.unidadNumero,seccion:"duplicados",similitud:Math.round(s*100)});
      }
    }
    if(!hallazgos.length)hallazgos.push({tipo:"sin_duplicados",severidad:"correcto",titulo:"Sin repeticiones relevantes",mensaje:"No se detectaron duplicados exactos ni similitudes superiores al umbral configurado.",texto:"",ref:null,unidadNumero:0,seccion:"duplicados"});
    return hallazgos;
  }
  NS.Duplicados={analizar:analizar,similitud:similitud,normalizar:normalizar};
})(window);
