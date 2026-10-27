/* =========================================================
Archivo: /mallas/mallas.oficiales.js
Catálogo curricular suministrado para codificación.
- Fuente estática por carrera y nivel; no escribe ni modifica Firebase.
- Versiones y vigencias quedan sin dato hasta recibir respaldo.
- El módulo Fichas toma el catálogo primero cuando existe.
- Para carreras aún no incorporadas, Fichas utiliza la malla vigente de Firebase.
========================================================= */
(function (window) {
  "use strict";

  var CATALOGO = {
  "administracion": {
    "carrera": "Administración",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Administración I",
        "Ofimática",
        "Comunicación Oral y Escrita",
        "Matemática Financiera",
        "Legislación Laboral y Mercantil",
        "Contabilidad General"
      ],
      "2": [
        "Administración II",
        "Contabilidad de Costos",
        "Investigación de Mercados",
        "Gestión del Talento Humano"
      ],
      "3": [
        "Gestión de procesos empresariales",
        "Gerencia de ventas y negocios",
        "Análisis financiero",
        "Presupuestos",
        "Logística empresarial"
      ],
      "4": [
        "Métodos Cuantitativos para la Toma de Decisiones",
        "Planificación Estratégica",
        "Entrepreneurship",
        "Sistemas de Gestión de Calidad",
        "Auditoría",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "contabilidad": {
    "carrera": "Contabilidad",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Administración",
        "Ofimática",
        "Comunicación Oral y Escrita",
        "Matemática Financiera",
        "Legislación Mercantil y Tributaria",
        "Contabilidad General"
      ],
      "2": [
        "Contabilidad General II",
        "Contabilidad de Costos I",
        "Finanzas",
        "Tributación"
      ],
      "3": [
        "Contabilidad Superior I",
        "Contabilidad de Costos II",
        "Análisis Financiero",
        "Presupuesto",
        "Sistema Contable"
      ],
      "4": [
        "Métodos Cuantitativos para la Toma de Decisiones",
        "Planificación Estratégica",
        "Entrepreneurship",
        "Contabilidad Superior 2",
        "Auditoría Financiera",
        "Unidad de Integración Curricular"
      ]
    }
  }
};

  function normalizar(valor) {
    return String(valor == null ? "" : valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function nombreNivel(nivel) {
    var nombres = { 1: "Primer nivel", 2: "Segundo nivel", 3: "Tercer nivel", 4: "Cuarto nivel", 5: "Quinto nivel", 6: "Sexto nivel" };
    return nombres[nivel] || "Nivel " + nivel;
  }

  function encontrarRegistro(carrera) {
    var nombres = typeof carrera === "string" ? [carrera] : [
      carrera && carrera.nombreInstitucional,
      carrera && carrera.nombreCorregido,
      carrera && carrera.nombre,
      carrera && carrera.carreraNombre
    ];
    for (var i = 0; i < nombres.length; i += 1) {
      var clave = normalizar(nombres[i]).replace(/\s+/g, "");
      if (Object.prototype.hasOwnProperty.call(CATALOGO, clave)) return CATALOGO[clave];
    }
    return null;
  }

  function obtenerPorCarrera(carrera) {
    var registro = encontrarRegistro(carrera);
    if (!registro) return null;
    var materias = [];
    Object.keys(registro.niveles).map(Number).sort(function (a, b) { return a - b; }).forEach(function (nivel) {
      registro.niveles[nivel].forEach(function (nombre, indice) {
        materias.push({
          nivelNumero: nivel,
          nivelNombre: nombreNivel(nivel),
          orden: indice + 1,
          nombreOficial: nombre,
          tipo: normalizar(nombre) === "unidad de integracion curricular" ? "integracion_curricular" : "asignatura",
          obligatoria: true,
          activa: true,
          materiaFirebaseId: ""
        });
      });
    });
    return {
      malla: {
        id: "catalogo_codigo_" + normalizar(registro.carrera).replace(/\s+/g, "_"),
        carreraNombre: registro.carrera,
        origen: "codigo_oficial",
        fuente: registro.fuente,
        version: registro.version,
        vigenciaInicio: registro.vigenciaInicio,
        vigenciaFin: registro.vigenciaFin
      },
      materias: materias
    };
  }

  function listarCarreras() {
    return Object.keys(CATALOGO).map(function (clave) {
      var registro = CATALOGO[clave];
      return {
        carrera: registro.carrera,
        niveles: Object.keys(registro.niveles).length,
        totalMaterias: Object.keys(registro.niveles).reduce(function (total, nivel) {
          return total + registro.niveles[nivel].length;
        }, 0)
      };
    });
  }

  window.CurriculoMallasOficiales = Object.freeze({
    obtenerPorCarrera: obtenerPorCarrera,
    listarCarreras: listarCarreras
  });
})(window);
