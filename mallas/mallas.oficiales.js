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
  },
  "desarrollodesoftware": {
    "carrera": "Desarrollo de Software",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Office Essentials",
        "Matemáticas Discretas",
        "Lenguajes de Programación I",
        "Sistemas Operativos",
        "Fundamentos de Redes"
      ],
      "2": [
        "Mantenimiento y Ensamblaje de Computadoras",
        "Aplicaciones Móviles I",
        "Calidad de Software SQA",
        "Lenguajes de Programación II",
        "Bases de Datos I"
      ],
      "3": [
        "Aplicaciones Web I",
        "Aplicaciones Móviles II",
        "Seguridad Informática",
        "Lenguajes de Programación III",
        "Bases de Datos II"
      ],
      "4": [
        "Aplicaciones Web II",
        "Aplicaciones Móviles III",
        "Metodología de Desarrollo de Software",
        "Inteligencia Artificial",
        "Inteligencia de Negocios",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "disenomultimedia": {
    "carrera": "Diseño Multimedia",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Branding digital",
        "Semiología de la imagen",
        "Creatividad",
        "Fundamentos de programación",
        "Figura humana y diseño de personaje"
      ],
      "2": [
        "Diseño WEB I",
        "Marketing digital",
        "Multimedia",
        "Diseño gráfico",
        "Producción audiovisual"
      ],
      "3": [
        "Motion design",
        "Programación de videojuegos",
        "Animación y Diseño 2D y 3D",
        "Producción de sonido",
        "Redacción de contenidos multimedia"
      ],
      "4": [
        "Modelación e impresión 3D",
        "UX / UI",
        "Inteligencia artificial orientada al diseño",
        "Entrepreneurship"
      ]
    }
  },
  "educacionbasica": {
    "carrera": "Educación Básica",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Office Essentials",
        "La familia y el entorno educativo",
        "Aprendizaje y enseñanza de la comunicación humana",
        "Sistemas educativos del aprendizaje humano",
        "Psicología de los ciclos de la vida y aprendizaje humano"
      ],
      "2": [
        "Pedagogía, andragogía y corrientes",
        "Didáctica general",
        "Diseño, gestión y evaluación curricular",
        "Neurociencia educativa",
        "Teoría del aprendizaje"
      ],
      "3": [
        "Aprendizaje y enseñanza de la lengua y literatura",
        "Aprendizaje y enseñanza del sistema de relaciones y funciones numérico estadístico y probabilidades",
        "Aprendizaje y enseñanza de las ciencias naturales",
        "Aprendizaje y enseñanza inclusiva",
        "Aprendizaje y enseñanza de la cultura física, estética y expresión corporal"
      ],
      "4": [
        "Planificación, modelos y procesos de investigación educativa",
        "Gestión de recursos, estrategias y ambientes",
        "Tics en educación y gamificación",
        "Metodología de investigación educativa",
        "Deontología docente",
        "Unidad de integración curricular"
      ]
    }
  },
  "educacioninicial": {
    "carrera": "Educación Inicial",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Competencias Digitales para la Educación Inicial",
        "Didáctica Aplicada",
        "Psicomotricidad y Expresión Corporal",
        "Bases Biológicas del Desarrollo",
        "Pedagogía Infantil",
        "Estrategias Metodológicas para el Aprendizaje en Educación Inicial"
      ],
      "2": [
        "Las TIC’s en la Educación Inicial",
        "Expresión Plástica y Artística",
        "Psicología Infantil I",
        "Pedagogía Infantil II",
        "Planificación y Diseño Curricular",
        "Estimulación Temprana I"
      ],
      "3": [
        "Psicología Infantil II",
        "Pedagogía para Infantes con Discapacidad",
        "Iniciación a las Operaciones Concretas",
        "Estimulación Temprana II"
      ],
      "4": [
        "Gerencia Educativa",
        "Evaluación Institucional de Logros en Nivel Inicial y Primero de Básica",
        "Dificultades en el Aprendizaje",
        "Iniciación a la Prelectura y Preescritura",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "enfermeria": {
    "carrera": "Enfermería",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Bioquímica",
        "Morfofisiología I",
        "Enfermería Técnica",
        "Promoción de la Salud y Salud Intercultural",
        "Redacción y Ofimática Aplicada a la Salud"
      ],
      "2": [
        "Salud Sexual y Salud Reproductiva",
        "Morfofisiología II",
        "Nutrición y Dietética",
        "Farmacología Básica",
        "Enfermería en el Cuidado de la Persona con Discapacidad y Adultos Mayores"
      ],
      "3": [
        "Enfermería en el Cuidado Esencial y Obstétrico",
        "Microbiología y Parasitología",
        "Farmacología Aplicada",
        "Instrumentación Quirúrgica",
        "Enfermería en el Cuidado del Paciente Quirúrgico y Pos Quirúrgico"
      ],
      "4": [
        "Enfermería en Salud Mental",
        "Enfermería Crítica y Clínica",
        "Ética, Deontología Profesional y Derechos del Paciente",
        "Epidemiología e Investigación en Salud",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "esteticaintegral": {
    "carrera": "Estética Integral",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Comunicación oral y escrita",
        "Tratamiento y manejo de desechos",
        "Terapias alternativas",
        "Química cosmética",
        "Cuidado de la piel"
      ],
      "2": [
        "Administración en estéticas integrales",
        "Masajes y terapia corporal",
        "Aparatología en estética integral",
        "Valoración estética",
        "Cosmiatría"
      ],
      "3": [
        "Contabilidad básica y tributación",
        "Terapias faciales",
        "Manicure y pedicure",
        "Tricología y peluquería",
        "Dermocosmética"
      ],
      "4": [
        "Gestión de centros de estética integral",
        "Terapias estéticas integrales",
        "Terapeútica en estética",
        "Asesoría de imagen",
        "Visagismo y maquillaje profesional",
        "Unidad de integración curricular"
      ]
    }
  },
  "gastronomia": {
    "carrera": "Gastronomía",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Fundamentos de Gastronomía",
        "Elaboración de menús",
        "Office Essentials",
        "Procesos, higiene e inocuidad alimentaria",
        "Química general de los alimentos"
      ],
      "2": [
        "Costos y Presupuestos Gastronómicos",
        "Cocina Ecuatoriana",
        "Técnicas de Carnicería y Chacutería",
        "Panadería",
        "Riesgos y Seguridad en la Industria Culinaria"
      ],
      "3": [
        "Cocina Internacional I (Europea)",
        "Pastelería y chocolatería",
        "Conservación y Técnicas de Almacenaje",
        "Enología, Bebidas y Maridaje",
        "Administración y Marketing Digital de Establecimientos Gastronómicos"
      ],
      "4": [
        "Cocina de Autor y Tendencias Creativas",
        "Cocina Internacional II (Asiática y Americana)",
        "Diseño, Equipamiento y Software gastronómico",
        "Organización de Eventos y Catering"
      ]
    }
  },
  "gestiondeltalentohumano": {
    "carrera": "Gestión del Talento Humano",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Administración de la Compensación en Talento Humano",
        "Computación Aplicada",
        "Comunicación Oral y Escrita",
        "Fundamentos de Gestión de Talento Humano",
        "Legislación Laboral y Seguridad Social"
      ],
      "2": [
        "Reclutamiento y Selección de Personal",
        "Comportamiento Organizacional",
        "Capacitación y Desarrollo de Personal",
        "Gestión de Desempeño",
        "Seguridad y Salud Ocupacional"
      ],
      "3": [
        "Remuneración y Compensación",
        "Gestión y Desarrollo de Competencias",
        "Valoración de Cargos",
        "Gestión Presupuestaria y de Talento Humano",
        "Desarrollo Organizacional"
      ],
      "4": [
        "Estadística Aplicada",
        "Análisis de Gestión de Riesgos",
        "Entrepreneurship",
        "Liderazgo y Gestión de Conflictos",
        "Gestión de Nómina y Prestaciones Sociales",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "marketingdigitalycomercioelectronico": {
    "carrera": "Marketing Digital y Comercio Electrónico",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Marketing Instruccional",
        "Competencias Digitales",
        "Métodos Cuantitativos para la Toma de Decisiones",
        "Redacción de Contenidos",
        "Gestión de la Innovación",
        "Análisis e Investigación de Mercados"
      ],
      "2": [
        "Diseño Gráfico Digital",
        "Manejo de Marca – Branding",
        "Comportamiento del Consumidor",
        "Redes Sociales y Community Management"
      ],
      "3": [
        "Diseño y Programación Web",
        "Técnicas Audiovisuales",
        "Gestión de Importaciones y Exportaciones",
        "Gerencia de Ventas",
        "Entrepreneurship"
      ],
      "4": [
        "Optimización del Motor de Búsqueda (SEO)",
        "Anuncios y Analítica en Google",
        "Comercio Digital (E-commerce)",
        "Métricas de Marketing",
        "Bases de Datos e Inteligencia de Negocios",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "mecanicaautomotriz": {
    "carrera": "Mecánica Automotriz",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Física automotriz",
        "Ofimática",
        "Comunicación oral y escrita",
        "Metrología",
        "Cálculo diferencial e integral"
      ],
      "2": [
        "Ciencia de materiales",
        "Neumática e hidráulica",
        "Electrónica análoga y digital",
        "Sistemas CAD – CAM",
        "Metodología de la investigación",
        "Mecánica de motos I"
      ],
      "3": [
        "Logística y mantenimiento de repuestos",
        "Estructura y acabados automotrices",
        "Mecánica de motores a gasolina y diesel",
        "Electricidad automotriz",
        "Climatización y aire acondicionado"
      ],
      "4": [
        "Vehículos eléctricos e híbridos",
        "Mantenimiento mecánico automotriz",
        "Computadoras automotrices",
        "Entrepreneurship",
        "Mecánica de motos II"
      ]
    }
  },
  "mecanicademotos": {
    "carrera": "Mecánica de Motos",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Física Básica",
        "Ofimática",
        "Comunicación Oral y Escrita",
        "Metrología",
        "Cálculo Diferencial e Integral"
      ],
      "2": [
        "Ciencia de materiales",
        "Neumática e Hidráulica",
        "Electricidad y electrónica de motos",
        "Sistemas de transmisión y embrague",
        "Metodología de la Investigación"
      ],
      "3": [
        "Logística y Mantenimiento de Repuestos",
        "Estructura y Acabados de Motocicletas",
        "Mecánica de Motores a Gasolina y ensamblaje",
        "Sistemas de frenos y suspensión",
        "Diagnóstico electrónico de motos"
      ],
      "4": [
        "Motos eléctricas",
        "Taller de mantenimiento integral",
        "Normativas Ambientales y Emisiones en Motocicletas",
        "Entrepreneurship"
      ]
    }
  },
  "procesamientodealimentos": {
    "carrera": "Procesamiento de Alimentos",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Matemática aplicada a los procesos",
        "Química general",
        "Introducción al procesamiento de alimentos",
        "Dietética y nutrición",
        "Procesamiento de frutas y vegetales"
      ],
      "2": [
        "Bioquímica alimentaria",
        "Microbiología y parasitología de alimentos",
        "Procesamiento de cereales",
        "Procesos, higiene e inocuidad alimentaria",
        "Métodos de conservación de alimentos"
      ],
      "3": [
        "Procesamiento de productos del mar y cárnicos",
        "Procesamiento de confites",
        "Procesamiento de lácteos",
        "Procesamiento de bebidas",
        "Sistemas integrados de calidad"
      ],
      "4": [
        "Metodología de la investigación",
        "Importación y exportación de alimentos",
        "Cadena de almacenamiento y refrigeración"
      ]
    }
  },
  "redesytelecomunicaciones": {
    "carrera": "Redes y Telecomunicaciones",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Office Essentials",
        "Matemáticas de Redes",
        "Fundamentos de Redes (CCNA1)",
        "Programación de Sistemas Telemáticos",
        "Sistemas Operativos"
      ],
      "2": [
        "Redes LAN y WAN (CCNA2)",
        "Mantenimiento y Ensamblaje de Computadoras",
        "Sistemas de Cableado Estructurado",
        "Plataforma de Servidores",
        "Fundamentos de Electricidad y Electrónica"
      ],
      "3": [
        "Automatización de Redes (CCNA3)",
        "Firewall y Proxy",
        "Transmisión de Datos",
        "Bases de Datos",
        "Telefonía IP"
      ],
      "4": [
        "Gestión y Auditoría de Infraestructura Tecnológica",
        "Administración de Redes",
        "Sistemas de Automatización IOT",
        "Seguridad de Redes",
        "Redes Inalámbricas",
        "Unidad de Integración Curricular"
      ]
    }
  },
  "rehabilitacionfisica": {
    "carrera": "Rehabilitación Física",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Comunicación Oral y Escrita",
        "Morfofisiología I",
        "Fisiología del Movimiento",
        "Fundamentos de Rehabilitación Física",
        "Office essentials"
      ],
      "2": [
        "Técnicas de Masoterapia",
        "Morfofisiología II",
        "Biomecánica y Evaluación Funcional",
        "Farmacología aplicada a la Rehabilitación Física",
        "Semiotecnia en la Rehabilitación Física"
      ],
      "3": [
        "Kinesioterapia",
        "Rehabilitación Musculoesquelética",
        "Rehabilitación Cardiorrespiratoria",
        "Neurorehabilitación",
        "Rehabilitación Geriátrica"
      ],
      "4": [
        "Rehabilitación Deportiva",
        "Rehabilitación Uroginecológica",
        "Atención Integral al Paciente Crónico o con Discapacidad",
        "Ergonomía y Seguridad Laboral en Entornos de Salud"
      ]
    }
  },
  "seguridadyprevencionderiesgoslaborales": {
    "carrera": "Seguridad y Prevención de Riesgos Laborales",
    "fuente": "Malla oficial facilitada para su codificación",
    "version": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "niveles": {
      "1": [
        "Fundamentos y técnicas de gestión de riesgo",
        "Office esencial",
        "Higiene industrial",
        "Comunicación oral y escrita",
        "Marco legal de seguridad y salud ocupacional"
      ],
      "2": [
        "Sistemas integrados de Gestión",
        "Estadísticas y probabilidades",
        "Metodología de la investigación",
        "Gestión por procesos",
        "Normativa Internacional en Seguridad y Salud Ocupacional"
      ],
      "3": [
        "Fisiología y anatomía ocupacional",
        "Electricidad, magnetismo y radiación",
        "Control de emergencias",
        "Ergonomía aplicada",
        "Auditoría e inspecciones"
      ],
      "4": [
        "Salud ocupacional en industria",
        "Gestión del talento humano",
        "Clima y condiciones psicolaborales",
        "Planes de emergencia y simulacros"
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
