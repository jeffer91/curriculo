/* =========================================================
Nombre completo: depuraciones.numeracion.js
Ruta: /Curriculo/depuraciones/depuraciones.numeracion.js
Funciones:
- Validar numeración jerárquica de componentes por unidad.
- Detectar duplicados, saltos, hijos sin padre y números fuera de unidad.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC;
  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function codigoDe(v){var m=texto(v).match(/^\s*([1-9]\d*(?:\.[0-9]+)+)(?=\s|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]|$)/);return m?m[1]:"";}
  function partes(c){return c?c.split(".").map(Number):[];}
  function padre(c){var p=partes(c);return p.length>2?p.slice(0,-1).join("."):"";}
  function hallazgo(tipo,severidad,titulo,mensaje,item,extra){return Object.assign({tipo:tipo,severidad:severidad,titulo:titulo,mensaje:mensaje,texto:item&&item.texto||"",ref:item&&item.ref||null,unidadNumero:item&&item.ref&&item.ref.unidadNumero||0,seccion:"numeracion"},extra||{});}

  function analizarUnidad(unidad){
    var encontrados=[],mapa={},hallazgos=[],ultimoPorPadre={};
    (unidad.contenidos||[]).forEach(function(item,indice){
      var codigo=codigoDe(item.texto);
      if(!codigo){hallazgos.push(hallazgo("contenido_sin_numeracion","advertencia","Contenido sin numeración","Se recomienda asignar una numeración jerárquica coherente con la unidad.",item,{indice:indice}));return;}
      var p=partes(codigo);encontrados.push({codigo:codigo,partes:p,item:item,indice:indice});
      if(p[0]!==Number(unidad.numero))hallazgos.push(hallazgo("unidad_incorrecta","error","Numeración fuera de la unidad","El componente inicia con "+p[0]+", pero pertenece a la Unidad "+unidad.numero+".",item,{codigo:codigo}));
      if(mapa[codigo])hallazgos.push(hallazgo("numero_duplicado","error","Número de componente duplicado","La numeración "+codigo+" aparece más de una vez con contenido igual o diferente.",item,{codigo:codigo,coincideCon:mapa[codigo].item.texto}));
      else mapa[codigo]={item:item,indice:indice};
      if(p.length>4)hallazgos.push(hallazgo("profundidad_excesiva","advertencia","Desglose demasiado profundo","La numeración "+codigo+" supera cuatro segmentos. Debe usarse solamente cuando aporte claridad técnica.",item,{codigo:codigo}));
      var pa=padre(codigo);if(pa&&!mapa[pa])hallazgos.push(hallazgo("padre_ausente","error","Subtema sin componente padre","Existe "+codigo+", pero no se encontró previamente su padre "+pa+".",item,{codigo:codigo,padre:pa}));
      var clave=pa||String(p[0]);var actual=p[p.length-1];var anterior=ultimoPorPadre[clave];
      if(typeof anterior==="number"){
        if(actual<anterior)hallazgos.push(hallazgo("orden_regresivo","advertencia","Numeración fuera de orden","El componente "+codigo+" aparece después de una numeración superior del mismo nivel.",item,{codigo:codigo}));
        else if(actual>anterior+1)hallazgos.push(hallazgo("salto_secuencia","advertencia","Salto en la secuencia","Antes de "+codigo+" falta al menos un número en la misma jerarquía.",item,{codigo:codigo,esperado:(clave?clave+".":"")+(anterior+1)}));
      }
      ultimoPorPadre[clave]=actual;
    });
    if(!hallazgos.length)hallazgos.push({tipo:"numeracion_correcta",severidad:"correcto",titulo:"Numeración correcta",mensaje:"Los componentes de la Unidad "+unidad.numero+" mantienen orden y jerarquía válidos.",texto:"",ref:null,unidadNumero:unidad.numero,seccion:"numeracion"});
    return hallazgos;
  }
  function analizar(modelo){var hallazgos=[];(modelo.unidades||[]).forEach(function(u){hallazgos=hallazgos.concat(analizarUnidad(u));});return hallazgos;}
  NS.Numeracion={analizar:analizar,analizarUnidad:analizarUnidad,codigoDe:codigoDe};
})(window);
