/* =========================================================
Nombre completo: mallas.parser.js
Ruta o ubicación: /Curriculo/mallas/mallas.parser.js
Funciones:
- Convertir texto libre de una malla curricular en niveles y materias.
- Interpretar filas provenientes de Excel con encabezados variables.
- Separar requisitos complementarios de las asignaturas.
- Validar duplicados y datos mínimos antes de guardar.
========================================================= */
(function (root, factory) {
  "use strict";
  var API = factory();
  if (typeof module === "object" && module.exports) module.exports = API;
  if (root) root.MallasParser = API;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = "1.0.0";
  var NIVELES = {
    primer: 1, primero: 1, primero: 1,
    segundo: 2, segunda: 2,
    tercer: 3, tercero: 3, tercera: 3,
    cuarto: 4, cuarta: 4,
    quinto: 5, quinta: 5,
    sexto: 6, sexta: 6,
    septimo: 7, septima: 7,
    octavo: 8, octava: 8,
    noveno: 9, novena: 9,
    decimo: 10, decima: 10
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_–—]+/g, " ")
      .replace(/[^a-zA-Z0-9\s.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function limpiarLinea(valor) {
    return texto(valor)
      .replace(/^\s*(?:[-•*]+|\d+[.)-])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nivelDesdeTexto(valor) {
    var n = normalizar(valor);
    var directo = n.match(/(?:nivel|semestre)\s*(\d{1,2})/i) || n.match(/^(\d{1,2})\s*(?:nivel|semestre)$/i);
    if (directo) return Number(directo[1]);

    var claves = Object.keys(NIVELES);
    for (var i = 0; i < claves.length; i += 1) {
      if (new RegExp("(?:^|\\s)" + claves[i] + "(?:\\s+|$)(?:nivel|semestre)").test(n)) {
        return NIVELES[claves[i]];
      }
    }

    var romano = n.match(/(?:nivel|semestre)\s+(i{1,3}|iv|v|vi{0,3}|ix|x)$/i);
    if (romano) {
      var tabla = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
      return tabla[romano[1].toLowerCase()] || 0;
    }
    return 0;
  }

  function esTituloGeneral(linea) {
    var n = normalizar(linea);
    return !n || /^(malla curricular|plan de estudios|estructura curricular|asignaturas)$/.test(n);
  }

  function esRequisito(linea) {
    var n = normalizar(linea);
    return /(?:requisito|idioma extranjero|nivel\s+[a-c]\d|competencias? digitales?|practicas? preprofesionales?|vinculacion con la sociedad|horas? de vinculacion|certificacion)/.test(n);
  }

  function nombreNivel(numero) {
    return numero > 0 ? numero + ". Nivel" : "Nivel sin identificar";
  }

  function parsearTexto(contenido, opciones) {
    opciones = opciones || {};
    var lineas = texto(contenido).split(/\r?\n/).map(limpiarLinea).filter(Boolean);
    var nivelActual = 0;
    var ordenNivel = {};
    var materias = [];
    var requisitos = [];
    var carreraSugerida = "";
    var tituloVisto = false;

    lineas.forEach(function (linea) {
      if (esTituloGeneral(linea)) {
        tituloVisto = true;
        return;
      }

      var nivel = nivelDesdeTexto(linea);
      if (nivel > 0 && /nivel|semestre/i.test(normalizar(linea))) {
        nivelActual = nivel;
        if (!ordenNivel[nivelActual]) ordenNivel[nivelActual] = 0;
        return;
      }

      if (esRequisito(linea)) {
        requisitos.push({
          orden: requisitos.length + 1,
          tipo: /idioma|nivel\s+[a-c]\d/i.test(normalizar(linea)) ? "idioma" :
            (/digital/i.test(normalizar(linea)) ? "competencia_digital" :
              (/practica/i.test(normalizar(linea)) ? "practicas" :
                (/vinculacion/i.test(normalizar(linea)) ? "vinculacion" : "otro"))),
          nombre: linea
        });
        return;
      }

      if (!nivelActual && !carreraSugerida && (tituloVisto || lineas.indexOf(linea) < 3)) {
        carreraSugerida = linea;
        return;
      }

      ordenNivel[nivelActual] = (ordenNivel[nivelActual] || 0) + 1;
      materias.push({
        nivelNumero: nivelActual,
        nivelNombre: nombreNivel(nivelActual),
        orden: ordenNivel[nivelActual],
        codigo: "",
        nombreOficial: linea,
        nombreNormalizado: normalizar(linea),
        tipo: "asignatura",
        obligatoria: true,
        activa: true
      });
    });

    return {
      carreraSugerida: texto(opciones.carrera) || carreraSugerida,
      materias: materias,
      requisitos: requisitos,
      totalNiveles: Array.from(new Set(materias.map(function (m) { return m.nivelNumero; }).filter(Boolean))).length,
      advertencias: materias.filter(function (m) { return !m.nivelNumero; }).length
        ? ["Existen materias sin nivel identificado. Revísalas antes de guardar."]
        : []
    };
  }

  function buscarCampo(objeto, aliases) {
    objeto = objeto || {};
    var claves = Object.keys(objeto);
    for (var i = 0; i < claves.length; i += 1) {
      var n = normalizar(claves[i]).replace(/[.]/g, "");
      if (aliases.indexOf(n) !== -1) return objeto[claves[i]];
    }
    return "";
  }

  function parsearFilasExcel(filas) {
    filas = Array.isArray(filas) ? filas : [];
    var materias = [];
    var requisitos = [];
    var ordenes = {};

    filas.forEach(function (fila, indice) {
      if (!fila || typeof fila !== "object") return;
      var nombre = texto(buscarCampo(fila, ["materia", "asignatura", "nombre", "nombre oficial", "nombre de asignatura", "unidad curricular"]));
      var tipo = texto(buscarCampo(fila, ["tipo", "tipo de registro", "categoria"]));
      var requisito = texto(buscarCampo(fila, ["requisito", "requisitos", "requisito complementario"]));

      if (requisito || /requisito/i.test(normalizar(tipo))) {
        var nombreReq = requisito || nombre;
        if (nombreReq) requisitos.push({ orden: requisitos.length + 1, tipo: "otro", nombre: nombreReq });
        return;
      }
      if (!nombre) return;

      var nivelValor = buscarCampo(fila, ["nivel", "nivel numero", "numero de nivel", "semestre", "nivel académico", "nivel academico"]);
      var nivel = Number(nivelValor) || nivelDesdeTexto(nivelValor);
      var orden = Number(buscarCampo(fila, ["orden", "nro", "numero", "número"])) || 0;
      if (!orden) {
        ordenes[nivel] = (ordenes[nivel] || 0) + 1;
        orden = ordenes[nivel];
      }

      materias.push({
        nivelNumero: nivel,
        nivelNombre: nombreNivel(nivel),
        orden: orden,
        codigo: texto(buscarCampo(fila, ["codigo", "código", "codigo asignatura", "código asignatura"])),
        nombreOficial: nombre,
        nombreNormalizado: normalizar(nombre),
        tipo: texto(tipo) || "asignatura",
        obligatoria: normalizar(buscarCampo(fila, ["obligatoria", "obligatorio"])) !== "no",
        activa: normalizar(buscarCampo(fila, ["activa", "activo"])) !== "no",
        filaOrigen: indice + 2
      });
    });

    materias.sort(function (a, b) {
      return a.nivelNumero - b.nivelNumero || a.orden - b.orden || a.nombreOficial.localeCompare(b.nombreOficial, "es");
    });

    return {
      materias: materias,
      requisitos: requisitos,
      totalNiveles: Array.from(new Set(materias.map(function (m) { return m.nivelNumero; }).filter(Boolean))).length,
      advertencias: materias.filter(function (m) { return !m.nivelNumero; }).length
        ? ["Algunas filas de Excel no tienen un nivel válido."]
        : []
    };
  }

  function validarMaterias(materias) {
    materias = Array.isArray(materias) ? materias : [];
    var errores = [];
    var vistos = {};

    materias.forEach(function (materia, indice) {
      var nombre = texto(materia && materia.nombreOficial);
      var nivel = Number(materia && materia.nivelNumero || 0);
      if (!nombre) errores.push("La fila " + (indice + 1) + " no tiene nombre de materia.");
      if (nivel < 1) errores.push("La materia " + (nombre || indice + 1) + " no tiene un nivel válido.");
      var clave = nivel + "|" + normalizar(nombre);
      if (nombre && vistos[clave]) errores.push("Materia duplicada en el nivel " + nivel + ": " + nombre + ".");
      vistos[clave] = true;
    });

    return { ok: errores.length === 0, errores: errores };
  }

  return {
    VERSION: VERSION,
    normalizar: normalizar,
    nivelDesdeTexto: nivelDesdeTexto,
    parsearTexto: parsearTexto,
    parsearFilasExcel: parsearFilasExcel,
    validarMaterias: validarMaterias
  };
});
