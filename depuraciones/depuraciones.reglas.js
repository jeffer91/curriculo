/* =========================================================
Nombre completo: depuraciones.reglas.js
Ruta: /Curriculo/depuraciones/depuraciones.reglas.js
Funciones:
- Centralizar reglas de verbos, severidades y Taxonomía de Bloom.
- Mantener configurables los verbos ambiguos de la política institucional.
========================================================= */
(function(window){
  "use strict";
  window.DepuracionesCCC=window.DepuracionesCCC||{};
  var NS=window.DepuracionesCCC;

  function texto(v){return String(v===null||typeof v==="undefined"?"":v).trim();}
  function normalizar(v){return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-zñáéíóúü\s]/gi," ").replace(/\s+/g," ").trim();}

  var NIVELES=Object.freeze({
    1:{nombre:"Recordar",tipo:"orden inferior"},
    2:{nombre:"Comprender",tipo:"orden inferior"},
    3:{nombre:"Aplicar",tipo:"orden inferior"},
    4:{nombre:"Analizar",tipo:"orden superior"},
    5:{nombre:"Evaluar",tipo:"orden superior"},
    6:{nombre:"Crear",tipo:"orden superior"}
  });

  var CATALOGO={};
  function registrar(nivel,verbos){verbos.forEach(function(v){CATALOGO[normalizar(v)]=nivel;});}
  registrar(1,["describir","describe","encontrar","encuentra","identificar","identifica","listar","lista","localizar","localiza","nombrar","nombra","reconocer","reconoce","repetir","repite","definir","define","observar","observa"]);
  registrar(2,["clasificar","clasifica","comparar","compara","ejemplificar","ejemplifica","explicar","explica","interpretar","interpreta","parafrasear","parafrasea","resumir","resume","relacionar","relaciona","distinguir","distingue"]);
  registrar(3,["aplicar","aplica","calcular","calcula","demostrar","demuestra","desarrollar","desarrolla","ejecutar","ejecuta","emplear","emplea","implementar","implementa","organizar","organiza","realizar","realiza","resolver","resuelve","seleccionar","selecciona","simular","simula","utilizar","utiliza","usar","usa"]);
  registrar(4,["analizar","analiza","categorizar","categoriza","comprobar","comprueba","diagnosticar","diagnostica","diferenciar","diferencia","examinar","examina","inspeccionar","inspecciona","investigar","investiga","priorizar","prioriza","estructurar","estructura","integrar","integra","determinar","determina"]);
  registrar(5,["argumentar","argumenta","criticar","critica","decidir","decide","evaluar","evalua","juzgar","juzga","justificar","justifica","valorar","valora","verificar","verifica","validar","valida","estimar","estima"]);
  registrar(6,["adaptar","adapta","construir","construye","crear","crea","diseñar","diseña","elaborar","elabora","formular","formula","generar","genera","innovar","innova","planificar","planifica","producir","produce","proponer","propone","redactar","redacta","reformular","reformula"]);

  var GENERICOS_ERROR=["conocer","conoce","saber","sabe","entender","entiende","formar","forma"];
  var AMBIGUOS_ADVERTENCIA=["comprender","comprende","reconocer","reconoce","aplicar","aplica","analizar","analiza","evaluar","evalua","crear","crea"];

  function primerVerbo(enunciado){
    var limpio=normalizar(enunciado);
    if(!limpio)return "";
    var palabras=limpio.split(" ").filter(Boolean);
    var conectores={el:1,la:1,los:1,las:1,un:1,una:1,se:1,que:1,al:1};
    for(var i=0;i<palabras.length;i+=1){if(!conectores[palabras[i]])return palabras[i];}
    return palabras[0]||"";
  }

  function esInfinitivo(verbo){return /(ar|er|ir)$/.test(normalizar(verbo));}
  function esTerceraPersona(verbo){
    verbo=normalizar(verbo);
    if(!verbo)return false;
    if(esInfinitivo(verbo))return false;
    return /(a|e|iza|ifica|uye|one|iene|duce|ce)$/.test(verbo);
  }
  function analizarVerbo(enunciado,tipo){
    var verbo=primerVerbo(enunciado);
    var nivel=CATALOGO[verbo]||0;
    var severidad="correcto";
    var mensaje="Verbo observable y medible.";
    if(!verbo){severidad="error";mensaje="No se identificó un verbo rector.";}
    else if(GENERICOS_ERROR.indexOf(verbo)!==-1){severidad="error";mensaje="El verbo es genérico o no evidencia una acción medible.";}
    else if(AMBIGUOS_ADVERTENCIA.indexOf(verbo)!==-1){severidad="advertencia";mensaje="La política presenta criterios contradictorios para este verbo; requiere revisión contextual.";}
    else if(!nivel){severidad="advertencia";mensaje="El verbo no consta en el catálogo institucional configurado.";}
    if(tipo==="competencia"&&verbo&&!esInfinitivo(verbo)){
      severidad=severidad==="error"?"error":"advertencia";
      mensaje+=" La competencia normalmente debe iniciar con un verbo en infinitivo.";
    }
    if(tipo==="resultado"&&verbo&&esInfinitivo(verbo)){
      severidad=severidad==="error"?"error":"advertencia";
      mensaje+=" El resultado debe iniciar en tercera persona del singular y presente.";
    }
    return {verbo:verbo,nivel:nivel,nivelNombre:nivel&&NIVELES[nivel]?NIVELES[nivel].nombre:"No clasificado",severidad:severidad,mensaje:mensaje,esInfinitivo:esInfinitivo(verbo),esTerceraPersona:esTerceraPersona(verbo)};
  }

  NS.Reglas={
    NIVELES:NIVELES,
    CATALOGO:CATALOGO,
    GENERICOS_ERROR:GENERICOS_ERROR.slice(),
    AMBIGUOS_ADVERTENCIA:AMBIGUOS_ADVERTENCIA.slice(),
    texto:texto,
    normalizar:normalizar,
    primerVerbo:primerVerbo,
    analizarVerbo:analizarVerbo
  };
})(window);
