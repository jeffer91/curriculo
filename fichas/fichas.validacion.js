/* Validaciones independientes de Firebase y de la interfaz.
   Malla oficial, informes institucionales y cobertura de IA. */
(function (window) {
  "use strict";
  function texto(v) { return String(v == null ? "" : v).trim(); }
  function normalizar(v) {
    return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase().replace(/\s+/g, " ")
      .replace(/\biii\b/g, "3").replace(/\bii\b/g, "2").replace(/\bi\b/g, "1");
  }
  function buscarMateria(esperada, materias) {
    materias = Array.isArray(materias) ? materias : [];
    var id = texto(esperada && esperada.materiaFirebaseId);
    if (id) {
      var exacta = materias.find(function (m) {
        return texto(m.id) === id && Number(m.nivelNumero) === Number(esperada.nivelNumero);
      });
      if (exacta) return exacta;
    }
    var candidatas = materias.filter(function (m) {
      return Number(m.nivelNumero) === Number(esperada.nivelNumero) &&
        normalizar(m.nombreMostrar || m.nombreInstitucional || m.nombreCorregido || m.nombre) === normalizar(esperada.nombreOficial);
    });
    return candidatas.length === 1 ? candidatas[0] : null;
  }
  function validarInput(r, fechaReferencia) {
    var problemas = [];
    if (!r) return { completo: false, problemas: ["No se ha cargado el informe."] };
    if (r.noAplica === true) {
      if (texto(r.justificacionNoAplica).length < 12) problemas.push("Justificación de No aplica insuficiente.");
      return { completo: problemas.length === 0, problemas: problemas };
    }
    if (!texto(r.documentoNombre) && !texto(r.extractoFuente)) problemas.push("Falta documento o texto fuente.");
    if (!texto(r.periodoInforme)) problemas.push("Falta período del informe.");
    if (!r.analisisIA || texto(r.analisisIA.resumen).length < 20) problemas.push("Falta análisis verificable del informe.");
    var hoy = texto(fechaReferencia) || new Date().toISOString().slice(0, 10);
    if (texto(r.vigenciaDesde) && r.vigenciaDesde > hoy) problemas.push("El informe aún no está vigente.");
    if (texto(r.vigenciaHasta) && r.vigenciaHasta < hoy) problemas.push("El informe está vencido.");
    if (texto(r.vigenciaDesde) && texto(r.vigenciaHasta) && r.vigenciaHasta < r.vigenciaDesde) problemas.push("Fechas de vigencia inconsistentes.");
    return { completo: problemas.length === 0, problemas: problemas };
  }
  function validarGeneracion(analisis, materias, inputs) {
    materias = Array.isArray(materias) ? materias : [];
    inputs = inputs || {};
    var errores = [];
    if (!analisis || typeof analisis !== "object") return ["La IA no devolvió un análisis estructurado."];
    if (!texto(analisis.objetivo)) errores.push("Falta objetivo de la ficha.");
    var tipos = ["graduados", "titulacion", "vinculacion", "practicas"];
    tipos.forEach(function (tipo) {
      if (!(inputs[tipo] && inputs[tipo].noAplica === true) &&
          (!analisis.inputs || !texto(analisis.inputs[tipo]))) errores.push("Falta análisis del input " + tipo + ".");
    });
    var correlaciones = Array.isArray(analisis.correlaciones) ? analisis.correlaciones : [];
    if (correlaciones.length !== materias.length) errores.push("La IA debe entregar una correlación por cada asignatura.");
    var usados = {};
    correlaciones.forEach(function (r) {
      var id = texto(r && r.materiaId);
      var nombre = normalizar(r && r.materia);
      var encontrada = materias.find(function (m) {
        return (id && id === texto(m.materiaId || m.id)) || (nombre && nombre === normalizar(m.nombre || m.nombreOficial || m.nombreMostrar));
      });
      if (!encontrada) { errores.push("La IA incluyó una materia ajena a la malla."); return; }
      var clave = texto(encontrada.materiaId || encontrada.id || encontrada.nombre || encontrada.nombreOficial);
      if (usados[clave]) errores.push("La IA duplicó el análisis de una materia.");
      usados[clave] = true;
      if (id && id !== texto(encontrada.materiaId || encontrada.id)) {
        errores.push("La IA alteró el identificador de una materia.");
      }
      if (!texto(r.analisis)) errores.push("Falta análisis de " + texto(encontrada.nombre || encontrada.nombreOficial) + ".");
      var estado = normalizar(r.estadoCurricular);
      if (estado && estado !== "mantener" && estado !== "requiere revision humana") {
        errores.push("La IA propuso un cambio curricular no aprobado.");
      }
    });
    materias.forEach(function (m) {
      var key = texto(m.materiaId || m.id || m.nombre || m.nombreOficial);
      if (!usados[key]) errores.push("Falta correlación de " + texto(m.nombre || m.nombreOficial) + ".");
    });
    if (!Array.isArray(analisis.conclusiones) || !analisis.conclusiones.some(function (x) { return !!texto(x); })) errores.push("Faltan conclusiones.");
    if (!Array.isArray(analisis.recomendaciones) || !analisis.recomendaciones.some(function (x) { return !!texto(x); })) errores.push("Faltan recomendaciones.");
    return Array.from(new Set(errores));
  }
  window.CurriculoFichasValidacion = Object.freeze({
    normalizar: normalizar, buscarMateria: buscarMateria,
    validarInput: validarInput, validarGeneracion: validarGeneracion
  });
})(window);
