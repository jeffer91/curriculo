/* =========================================================
Nombre completo: depuraciones.verbos.js
Ruta: /Curriculo/depuraciones/depuraciones.verbos.js
Funciones:
- Analizar el primer verbo de competencias y resultados de aprendizaje.
- Revisar forma gramatical, observabilidad, Bloom y alineación por unidad.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC,Reglas=NS.Reglas;
  if(!Reglas){console.error("[Depuraciones.Verbos] Falta depuraciones.reglas.js");return;}

  function crear(tipo,unidad,enunciado,ref,analisis){
    var nombre=tipo==="competencia"?"Competencia":"Resultado de aprendizaje";
    return {tipo:"verbo_"+tipo,severidad:analisis.severidad,titulo:nombre+" · Unidad "+unidad.numero,mensaje:analisis.mensaje,texto:enunciado,ref:ref,unidadNumero:unidad.numero,seccion:tipo,verbo:analisis.verbo,nivelBloom:analisis.nivel,nivelBloomNombre:analisis.nivelNombre};
  }
  function analizar(modelo){
    var hallazgos=[],verbosCompetencia={},verbosResultado={};
    (modelo.unidades||[]).forEach(function(unidad){
      if(!unidad.competencia){
        hallazgos.push({tipo:"competencia_ausente",severidad:"error",titulo:"Competencia ausente · Unidad "+unidad.numero,mensaje:"Cada unidad debe contar con su competencia.",texto:"",ref:unidad.refs&&unidad.refs.competencia||null,unidadNumero:unidad.numero,seccion:"competencia"});
      }else{
        var ac=Reglas.analizarVerbo(unidad.competencia,"competencia");hallazgos.push(crear("competencia",unidad,unidad.competencia,unidad.refs&&unidad.refs.competencia,ac));
        if(ac.verbo){verbosCompetencia[ac.verbo]=verbosCompetencia[ac.verbo]||[];verbosCompetencia[ac.verbo].push(unidad.numero);}
      }
      if(!unidad.resultado){
        hallazgos.push({tipo:"resultado_ausente",severidad:"error",titulo:"Resultado ausente · Unidad "+unidad.numero,mensaje:"Cada unidad debe contar con un resultado de aprendizaje.",texto:"",ref:unidad.refs&&unidad.refs.resultado||null,unidadNumero:unidad.numero,seccion:"resultado"});
      }else{
        var ar=Reglas.analizarVerbo(unidad.resultado,"resultado");hallazgos.push(crear("resultado",unidad,unidad.resultado,unidad.refs&&unidad.refs.resultado,ar));
        if(ar.verbo){verbosResultado[ar.verbo]=verbosResultado[ar.verbo]||[];verbosResultado[ar.verbo].push(unidad.numero);}
      }
      if(unidad.competencia&&unidad.resultado){
        var c=Reglas.analizarVerbo(unidad.competencia,"competencia"),r=Reglas.analizarVerbo(unidad.resultado,"resultado");
        if(c.nivel&&r.nivel&&r.nivel>c.nivel+1){
          hallazgos.push({tipo:"desalineacion_bloom",severidad:"advertencia",titulo:"Posible desalineación cognitiva · Unidad "+unidad.numero,mensaje:"El resultado está clasificado en "+r.nivelNombre+" y la competencia en "+c.nivelNombre+". Verifica que el resultado sea una evidencia alcanzable de la competencia.",texto:"Competencia: "+unidad.competencia+"\nResultado: "+unidad.resultado,ref:null,unidadNumero:unidad.numero,seccion:"alineacion"});
        }
      }
    });
    Object.keys(verbosCompetencia).forEach(function(v){if(verbosCompetencia[v].length>=3)hallazgos.push({tipo:"verbo_competencia_repetido",severidad:"advertencia",titulo:"Verbo de competencia repetido",mensaje:"El verbo «"+v+"» se utiliza en las unidades "+verbosCompetencia[v].join(", ")+". Conviene verificar la progresión cognitiva.",texto:v,ref:null,unidadNumero:0,seccion:"competencia"});});
    Object.keys(verbosResultado).forEach(function(v){if(verbosResultado[v].length>=3)hallazgos.push({tipo:"verbo_resultado_repetido",severidad:"advertencia",titulo:"Verbo de resultado repetido",mensaje:"El verbo «"+v+"» se utiliza en las unidades "+verbosResultado[v].join(", ")+". Verifica que exista progresión y no repetición mecánica.",texto:v,ref:null,unidadNumero:0,seccion:"resultado"});});
    return hallazgos;
  }
  NS.Verbos={analizar:analizar};
})(window);
