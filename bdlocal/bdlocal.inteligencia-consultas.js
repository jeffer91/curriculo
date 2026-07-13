/* =========================================================
Nombre completo: bdlocal.inteligencia-consultas.js
Ruta o ubicación: /Curriculo/bdlocal/bdlocal.inteligencia-consultas.js
Funciones:
- Coordinar las consultas de resumen y materias de una carrera.
- Ejecutar una sola reparación inteligente cuando ambas consultas se realizan seguidas.
- Reutilizar por pocos segundos el resultado ya reparado sin mantener datos obsoletos.
- Verificar que Comunicados use registros curriculares realmente persistidos y no solo archivos detectados.
========================================================= */

(function (window) {
  "use strict";

  var Comunicados = window.ComunicadosCCC;

  if (!Comunicados || !Comunicados.BDLocal) {
    console.error("[BDLocalCCC.InteligenciaConsultas] No está disponible ComunicadosCCC.BDLocal.");
    return;
  }

  var modulo = Comunicados.BDLocal;

  if (modulo.__consultaInteligenteUnicaV2) {
    return;
  }

  var obtenerResumenOriginal = typeof modulo.obtenerResumenCarrera === "function"
    ? modulo.obtenerResumenCarrera.bind(modulo)
    : null;
  var obtenerMateriasOriginal = typeof modulo.obtenerMateriasPorCarrera === "function"
    ? modulo.obtenerMateriasPorCarrera.bind(modulo)
    : null;
  var obtenerDetalleOriginal = typeof modulo.obtenerDetalleMateriaComunicado === "function"
    ? modulo.obtenerDetalleMateriaComunicado.bind(modulo)
    : null;

  if (!obtenerResumenOriginal || !obtenerMateriasOriginal || !obtenerDetalleOriginal) {
    console.error("[BDLocalCCC.InteligenciaConsultas] Faltan consultas curriculares requeridas.");
    return;
  }

  var consultas = {};
  var VIGENCIA_RESULTADO_MS = 5000;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function esObjeto(valor) {
    return !!valor && typeof valor === "object" && !Array.isArray(valor);
  }

  function tieneValor(valor) {
    if (Array.isArray(valor)) return valor.some(tieneValor);
    if (esObjeto(valor)) {
      return Object.keys(valor).some(function (clave) {
        return tieneValor(valor[clave]);
      });
    }
    return texto(valor) !== "";
  }

  function basePersistidaValida(base) {
    if (!esObjeto(base)) return false;

    var datos = esObjeto(base.datos)
      ? base.datos
      : (esObjeto(base.datosProcesados) ? base.datosProcesados : base);
    var campos = esObjeto(datos.campos)
      ? datos.campos
      : (esObjeto(base.campos) ? base.campos : {});

    return !!(
      texto(datos.descripcion || base.descripcion) ||
      texto(datos.objetivo || base.objetivo) ||
      tieneValor(campos) ||
      tieneValor(datos.filas || base.filas) ||
      tieneValor(datos.hojas || base.hojas) ||
      tieneValor(datos.unidadesBase || base.unidadesBase) ||
      tieneValor(datos.bibliografia || base.bibliografia)
    );
  }

  function unidadPersistidaValida(unidad) {
    if (!esObjeto(unidad)) return false;

    return !!(
      arr(unidad.contenidos).some(function (item) { return texto(item); }) ||
      texto(
        unidad.temaDetectado || unidad.tema || unidad.contenido || unidad.titulo ||
        unidad.resultadoDetectado || unidad.resultadoAprendizaje || unidad.competencia
      )
    );
  }

  function actividadPersistidaValida(actividad) {
    return esObjeto(actividad) && !!texto(
      actividad.actividadDetectada || actividad.actividad || actividad.descripcion ||
      actividad.tema || actividad.titulo || actividad.contenido ||
      actividad.taller || actividad.proyecto
    );
  }

  function validarPersistenciaReal(detalle) {
    detalle = detalle || {};

    var materia = detalle.materia || null;
    var unidadesValidas = arr(detalle.unidades).filter(unidadPersistidaValida);
    var actividadesValidas = arr(detalle.actividades).filter(actividadPersistidaValida);
    var numerosUnidad = {};

    unidadesValidas.forEach(function (unidad) {
      var numero = Number(
        unidad.unidadNumero || unidad.unidad || unidad.numeroUnidad ||
        unidad.numero_unidad || unidad.n_unidad || 0
      );
      if (numero >= 1 && numero <= 4) numerosUnidad[numero] = true;
    });

    var tieneBase = basePersistidaValida(detalle.peaBase);
    var tieneUnidades = !!(
      numerosUnidad[1] && numerosUnidad[2] && numerosUnidad[3] && numerosUnidad[4]
    );
    var tieneActividades = actividadesValidas.length > 0;
    var completaPorEstado = !!(materia && materia.estadoValidacion === "completo");

    return {
      puedeGenerar: completaPorEstado && tieneBase && tieneUnidades && tieneActividades,
      completaPorEstado: completaPorEstado,
      tieneBase: tieneBase,
      tieneUnidades: tieneUnidades,
      tieneActividades: tieneActividades,
      unidadesPersistidasValidas: unidadesValidas.length,
      actividadesPersistidasValidas: actividadesValidas.length,
      verificacion: "persistencia_curricular_real",
      faltantes: [
        !tieneBase ? "PEA Base persistido" : "",
        !tieneUnidades ? "contenidos persistidos de las 4 unidades" : "",
        !tieneActividades ? "actividades persistidas" : ""
      ].filter(Boolean)
    };
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

  modulo.obtenerDetalleMateriaComunicado = async function (materiaId) {
    var detalle = await obtenerDetalleOriginal(materiaId);
    detalle.estadoGeneracion = validarPersistenciaReal(detalle);
    return detalle;
  };

  modulo.validarMateriaCompleta = validarPersistenciaReal;
  modulo.invalidarConsultaInteligente = invalidar;
  modulo.__consultaInteligenteUnicaV1 = true;
  modulo.__consultaInteligenteUnicaV2 = true;

  console.info("[BDLocalCCC.InteligenciaConsultas] Consulta única y persistencia curricular real activadas.");
})(window);
