/* =========================================================
Nombre completo: bdlocal.inteligencia-consultas.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.inteligencia-consultas.js
Funciones:
- Coordinar las consultas de resumen y materias de una carrera.
- Ejecutar una sola reparación inteligente cuando ambas consultas se realizan seguidas.
- Reutilizar por pocos segundos el resultado ya reparado sin mantener datos obsoletos.
========================================================= */

(function (window) {
  "use strict";

  var Comunicados = window.ComunicadosCCC;

  if (!Comunicados || !Comunicados.BDLocal) {
    console.error("[BDLocalCCC.InteligenciaConsultas] No está disponible ComunicadosCCC.BDLocal.");
    return;
  }

  var modulo = Comunicados.BDLocal;

  if (modulo.__consultaInteligenteUnicaV1) {
    return;
  }

  var obtenerResumenOriginal = typeof modulo.obtenerResumenCarrera === "function"
    ? modulo.obtenerResumenCarrera.bind(modulo)
    : null;
  var obtenerMateriasOriginal = typeof modulo.obtenerMateriasPorCarrera === "function"
    ? modulo.obtenerMateriasPorCarrera.bind(modulo)
    : null;

  if (!obtenerResumenOriginal || !obtenerMateriasOriginal) {
    console.error("[BDLocalCCC.InteligenciaConsultas] Faltan las consultas de carrera requeridas.");
    return;
  }

  var consultas = {};
  var VIGENCIA_RESULTADO_MS = 5000;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function crearConsulta(carreraId) {
    var clave = texto(carreraId);
    var entrada = {
      carreraId: clave,
      iniciadaEn: Date.now(),
      completadaEn: 0,
      resultado: null,
      promesa: null
    };

    entrada.promesa = Promise.all([
      obtenerResumenOriginal(clave),
      obtenerMateriasOriginal(clave, { soloCompletas: false })
    ]).then(function (resultados) {
      var materiasTodas = Array.isArray(resultados[1]) ? resultados[1] : [];

      entrada.resultado = {
        resumen: resultados[0] || {},
        materiasTodas: materiasTodas,
        materiasCompletas: materiasTodas.filter(function (materia) {
          return materia && materia.estadoValidacion === "completo";
        })
      };
      entrada.completadaEn = Date.now();

      return entrada.resultado;
    }).catch(function (error) {
      if (consultas[clave] === entrada) {
        delete consultas[clave];
      }
      throw error;
    });

    consultas[clave] = entrada;
    return entrada;
  }

  function obtenerConsulta(carreraId) {
    var clave = texto(carreraId);

    if (!clave) {
      return Promise.resolve({
        resumen: {},
        materiasTodas: [],
        materiasCompletas: []
      });
    }

    var entrada = consultas[clave];

    if (entrada) {
      if (!entrada.completadaEn) {
        return entrada.promesa;
      }

      if (Date.now() - entrada.completadaEn <= VIGENCIA_RESULTADO_MS) {
        return entrada.promesa;
      }

      delete consultas[clave];
    }

    return crearConsulta(clave).promesa;
  }

  function invalidar(carreraId) {
    var clave = texto(carreraId);

    if (clave) {
      delete consultas[clave];
      return;
    }

    consultas = {};
  }

  modulo.obtenerResumenCarrera = async function (carreraId) {
    var resultado = await obtenerConsulta(carreraId);
    return resultado.resumen;
  };

  modulo.obtenerMateriasPorCarrera = async function (carreraId, opciones) {
    opciones = opciones || {};

    var resultado = await obtenerConsulta(carreraId);

    return opciones.soloCompletas === false
      ? resultado.materiasTodas.slice()
      : resultado.materiasCompletas.slice();
  };

  modulo.invalidarConsultaInteligente = invalidar;
  modulo.__consultaInteligenteUnicaV1 = true;

  console.info("[BDLocalCCC.InteligenciaConsultas] Consulta única de carrera activada.");
})(window);
