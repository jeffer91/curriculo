/* =========================================================
Nombre completo: firebase.mallas-integracion.js
Ruta o ubicación: /Curriculo/firebase/firebase.mallas-integracion.js
Funciones:
- Conservar la vinculación con la malla durante la preparación para Firestore.
- Aplicar nombre y nivel oficiales antes de calcular el ID y la huella curricular.
- Mantener el nombre originalmente detectado para trazabilidad.
========================================================= */
(function (window) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  var I = NS.Inteligencia;
  if (!I || typeof I.prepararPaquete !== "function" || I.__mallasIntegracionInstalada === true) return;

  var VERSION = "1.0.0";
  var prepararOriginal = I.prepararPaquete;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    if (typeof I.normalizarTexto === "function") return I.normalizarTexto(valor);
    return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function codigo(valor) {
    if (typeof I.normalizarCodigo === "function") return I.normalizarCodigo(valor);
    return texto(valor).toUpperCase().replace(/\s+/g, "");
  }

  function nivelFuente(materia) {
    return numero(materia && (materia.nivelNumero || materia.numeroNivel), 0);
  }

  function claveCodigo(materia) {
    var c = codigo(materia && (materia.codigo || materia.codigoMateria));
    return c ? c + "|n" + nivelFuente(materia) : "";
  }

  function claveNombre(materia) {
    return normalizar(materia && (materia.nombre || materia.nombreMateria || materia.materia)) + "|n" + nivelFuente(materia);
  }

  function encontrarFuente(item, fuentes, usados) {
    var porCodigo = claveCodigo(item.materia);
    var porNombre = claveNombre(item.materia);
    var indice = -1;

    if (porCodigo) {
      indice = fuentes.findIndex(function (fuente, i) {
        return !usados[i] && claveCodigo(fuente) === porCodigo;
      });
    }
    if (indice < 0) {
      indice = fuentes.findIndex(function (fuente, i) {
        return !usados[i] && claveNombre(fuente) === porNombre;
      });
    }
    if (indice < 0) return null;
    usados[indice] = true;
    return fuentes[indice];
  }

  function actualizarContexto(item, fuente) {
    var materia = item.materia;
    var nivelOficial = numero(fuente.mallaNivelOficial, materia.nivelNumero);
    var nombreOficial = texto(fuente.nombreOficialMalla || fuente.nombreInstitucional || fuente.nombre);
    var nombreOriginal = texto(fuente.nombreOriginalDetectado || fuente.nombreOriginalImportado || materia.nombre);

    materia.nombreOriginalDetectado = nombreOriginal;
    materia.nombreOriginalImportado = nombreOriginal;
    materia.nombreOficialMalla = nombreOficial || materia.nombre;
    materia.nombreInstitucional = nombreOficial || materia.nombre;
    materia.mallaId = texto(fuente.mallaId);
    materia.mallaVersion = numero(fuente.mallaVersion, 0);
    materia.mallaMateriaId = texto(fuente.mallaMateriaId);
    materia.mallaNivelOficial = nivelOficial;
    materia.vinculacionMalla = texto(fuente.vinculacionMalla || "automatica");
    materia.mallaVinculada = fuente.mallaVinculada === true;

    if (nombreOficial) materia.nombre = nombreOficial;
    if (nivelOficial > 0) {
      materia.nivelNumero = nivelOficial;
      materia.nivelNombre = nivelOficial + ". Nivel";
    }

    var nuevoId = I.crearIdMateria(
      materia.carreraId,
      materia.nivelNumero,
      materia.codigo,
      materia.nombre
    );
    I.reasignarMateriaId(item, nuevoId);

    [item.peaBase, item.actividades].forEach(function (documento) {
      if (!documento) return;
      documento.nombreMateria = materia.nombre;
      documento.codigoMateria = materia.codigo;
      documento.nivelNumero = materia.nivelNumero;
      documento.nivelNombre = materia.nivelNombre;
    });

    arr(item.unidades).forEach(function (unidad) {
      unidad.nombreMateria = materia.nombre;
      unidad.codigoMateria = materia.codigo;
      unidad.nivelNumero = materia.nivelNumero;
      unidad.nivelNombre = materia.nivelNombre;
    });

    item.snapshot = I.crearSnapshot(materia, item.peaBase, item.unidades, item.actividades);
    materia.hashContenido = I.hashContenido(item.snapshot);
    materia.hashSecciones = {
      materia: I.hashContenido(item.snapshot.materia),
      peaBase: I.hashContenido(item.snapshot.peaBase),
      unidades: I.hashContenido(item.snapshot.unidades),
      actividades: I.hashContenido(item.snapshot.actividades)
    };
    return item;
  }

  function recalcularCarreras(preparado) {
    arr(preparado.carreras).forEach(function (carrera) {
      var items = arr(preparado.materias).filter(function (item) {
        return item.materia.carreraId === carrera.id;
      });
      var niveles = {};
      items.forEach(function (item) {
        if (numero(item.materia.nivelNumero, 0) > 0) niveles[item.materia.nivelNumero] = true;
      });
      carrera.niveles = Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; });
      carrera.totalNiveles = carrera.niveles.length;
      carrera.totalMaterias = items.length;
    });
  }

  I.prepararPaquete = function (paquete, cargaId) {
    var fuentes = arr(paquete && paquete.materias);
    var vinculadas = fuentes.filter(function (materia) {
      return materia && materia.mallaVinculada === true && texto(materia.mallaMateriaId);
    });
    var preparado = prepararOriginal.call(I, paquete, cargaId);
    var usados = {};

    arr(preparado && preparado.materias).forEach(function (item) {
      var fuente = encontrarFuente(item, vinculadas, usados);
      if (fuente) actualizarContexto(item, fuente);
    });

    recalcularCarreras(preparado);
    preparado.comparacionMalla = paquete && paquete.comparacionMalla ? paquete.comparacionMalla : null;
    preparado.resumenOriginal = Object.assign({}, preparado.resumenOriginal || {}, {
      mallaComparada: !!(paquete && paquete.comparacionMalla),
      mallaIncompleta: !!(paquete && paquete.comparacionMalla && paquete.comparacionMalla.mallaIncompleta),
      materiasMallaFaltantes: numero(paquete && paquete.comparacionMalla && paquete.comparacionMalla.totalFaltantes, 0),
      materiasMallaNoVinculadas: numero(paquete && paquete.comparacionMalla && paquete.comparacionMalla.totalNoVinculadas, 0)
    });
    return preparado;
  };

  I.__mallasIntegracionInstalada = true;
  I.MallasIntegracion = { VERSION: VERSION, actualizarContexto: actualizarContexto };
})(window);

/* =========================================================
Memoria persistente de decisiones de malla
- Reutiliza malla_equivalencias para no crear una colección adicional.
- Recupera equivalencias de versiones anteriores por carrera.
- Recuerda excepciones aprobadas y no vuelve a solicitarlas.
- Remapea relaciones manuales a la materia oficial de la malla vigente.
========================================================= */
(function (window, document) {
  "use strict";

  var NS = window.CurriculoFirebase || {};
  var Mallas = NS.Mallas;
  var Comparador = window.MallasComparador;

  if (!Mallas || !Comparador || Mallas.__memoriaDecisionesInstalada === true) return;

  var VERSION = "1.0.0";
  var COLECCION_EQUIVALENCIAS = "malla_equivalencias";
  var EXCEPCION_ID = "__EXCEPCION_APROBADA__";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";
  var equivalenciasPorCarrera = Object.create(null);
  var sdkEstado = { db: null, firestore: null, promesa: null };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    if (typeof Comparador.normalizar === "function") return Comparador.normalizar(valor);
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nivelMateria(materia) {
    return numero(materia && (materia.nivelNumero || materia.numeroNivel || materia.nivel), 0);
  }

  function nombreMateria(materia) {
    return texto(materia && (
      materia.nombreOriginalDetectado ||
      materia.nombreOriginalImportado ||
      materia.nombre ||
      materia.nombreMateria ||
      materia.materia
    ));
  }

  function nivelesCompatibles(a, b) {
    a = numero(a, 0);
    b = numero(b, 0);
    return a === b || a === 0 || b === 0;
  }

  function mismaDetectada(materia, equivalencia) {
    return normalizar(nombreMateria(materia)) === normalizar(
      equivalencia && (equivalencia.nombreDetectadoNormalizado || equivalencia.nombreDetectado)
    ) && nivelesCompatibles(nivelMateria(materia), equivalencia && equivalencia.nivelDetectado);
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrirFirestore() {
    if (sdkEstado.db && sdkEstado.firestore) return sdkEstado;
    if (sdkEstado.promesa) return sdkEstado.promesa;
    if (!NS.CONFIG) throw new Error("Firebase no tiene configuración disponible.");

    sdkEstado.promesa = Promise.all([
      importarModulo(SDK_BASE + "firebase-app.js"),
      importarModulo(SDK_BASE + "firebase-firestore.js")
    ]).then(function (modulos) {
      var appSDK = modulos[0];
      var firestore = modulos[1];
      var app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(NS.CONFIG);
      sdkEstado.firestore = firestore;
      try {
        sdkEstado.db = firestore.getFirestore(app);
      } catch (error) {
        sdkEstado.db = firestore.initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true
        });
      }
      return sdkEstado;
    }).catch(function (error) {
      sdkEstado.promesa = null;
      throw error;
    });

    return sdkEstado.promesa;
  }

  async function obtenerEquivalenciasCarrera(carreraId) {
    carreraId = texto(carreraId);
    if (!carreraId) return [];

    var sdk = await abrirFirestore();
    var q = sdk.firestore.query(
      sdk.firestore.collection(sdk.db, COLECCION_EQUIVALENCIAS),
      sdk.firestore.where("carreraId", "==", carreraId)
    );
    var snap = await sdk.firestore.getDocs(q);
    return snap.docs.map(function (item) {
      return Object.assign({ id: item.id }, item.data());
    }).filter(function (item) {
      return item && item.activa !== false;
    });
  }

  function combinarEquivalencias(actuales, aprendidas) {
    var mapa = Object.create(null);
    arr(actuales).concat(arr(aprendidas)).forEach(function (item, indice) {
      if (!item || item.activa === false) return;
      var id = texto(item.id) || [
        texto(item.mallaId),
        normalizar(item.nombreDetectado),
        numero(item.nivelDetectado, 0),
        texto(item.mallaMateriaId),
        indice
      ].join("|");
      mapa[id] = item;
    });
    return Object.keys(mapa).map(function (id) { return mapa[id]; });
  }

  var obtenerMallaOriginal = Mallas.obtenerMallaVigenteParaCarrera.bind(Mallas);
  Mallas.obtenerMallaVigenteParaCarrera = async function (carrera) {
    var detalle = await obtenerMallaOriginal(carrera);
    if (!detalle) return detalle;

    var carreraId = texto(
      carrera && (carrera.id || carrera.carreraId) ||
      detalle.malla && detalle.malla.carreraId
    );

    try {
      var aprendidas = await obtenerEquivalenciasCarrera(carreraId);
      equivalenciasPorCarrera[carreraId] = aprendidas;
      detalle.equivalencias = combinarEquivalencias(detalle.equivalencias, aprendidas);
      detalle.equivalenciasAprendidas = aprendidas;
    } catch (error) {
      console.warn("[Mallas memoria] No se pudieron recuperar decisiones anteriores:", error);
      equivalenciasPorCarrera[carreraId] = arr(detalle.equivalencias);
    }

    return detalle;
  };

  function buscarOficialActual(oficiales, equivalencia) {
    var porId = arr(oficiales).find(function (oficial) {
      return texto(oficial && (oficial.id || oficial.mallaMateriaId)) === texto(equivalencia && equivalencia.mallaMateriaId);
    });
    if (porId) return porId;

    var nombre = normalizar(equivalencia && equivalencia.nombreOficial);
    var nivel = numero(equivalencia && equivalencia.nivelOficial, 0);
    if (!nombre) return null;

    return arr(oficiales).find(function (oficial) {
      var nombreActual = normalizar(oficial && (oficial.nombreOficial || oficial.nombre || oficial.nombreMateria));
      var nivelActual = numero(oficial && (oficial.nivelNumero || oficial.numeroNivel || oficial.nivel), 0);
      return nombreActual === nombre && (!nivel || nivelActual === nivel);
    }) || null;
  }

  function esExcepcion(equivalencia) {
    return texto(equivalencia && equivalencia.criterio) === "excepcion_aprobada" ||
      texto(equivalencia && equivalencia.mallaMateriaId) === EXCEPCION_ID;
  }

  var compararOriginal = Comparador.comparar.bind(Comparador);
  Comparador.comparar = function (detectadas, oficiales, equivalencias, opciones) {
    detectadas = arr(detectadas);
    oficiales = arr(oficiales);
    var carreraId = texto(detectadas[0] && detectadas[0].carreraId);
    var aprendidas = combinarEquivalencias(
      equivalencias,
      equivalenciasPorCarrera[carreraId] || []
    );
    var preparadas = [];
    var relacionesPorDetectada = Object.create(null);

    aprendidas.forEach(function (equivalencia) {
      if (esExcepcion(equivalencia)) {
        detectadas.forEach(function (materia) {
          if (!mismaDetectada(materia, equivalencia)) return;
          materia.mallaExcepcionAprobada = true;
          materia.mallaDecisionAprendida = true;
          materia.mallaDecisionCriterio = "excepcion_aprobada";
        });
        return;
      }

      var oficial = buscarOficialActual(oficiales, equivalencia);
      if (!oficial) return;

      detectadas.forEach(function (materia) {
        if (!mismaDetectada(materia, equivalencia)) return;
        var clave = normalizar(nombreMateria(materia)) + "|n" + nivelMateria(materia);
        var idOficial = texto(oficial.id || oficial.mallaMateriaId);
        var prioridad = idOficial === texto(equivalencia.mallaMateriaId) ? 2 : 1;
        var anterior = relacionesPorDetectada[clave];
        if (anterior && anterior.prioridad > prioridad) return;

        relacionesPorDetectada[clave] = {
          prioridad: prioridad,
          equivalencia: Object.assign({}, equivalencia, {
            mallaMateriaId: idOficial,
            oficialId: idOficial,
            nombreOficial: texto(oficial.nombreOficial || oficial.nombre || equivalencia.nombreOficial),
            nivelOficial: numero(oficial.nivelNumero || oficial.numeroNivel || equivalencia.nivelOficial, 0),
            nombreDetectado: nombreMateria(materia),
            nombreDetectadoNormalizado: normalizar(nombreMateria(materia)),
            nivelDetectado: nivelMateria(materia),
            criterio: texto(equivalencia.criterio || "equivalencia_guardada")
          })
        };
      });
    });

    Object.keys(relacionesPorDetectada).forEach(function (clave) {
      preparadas.push(relacionesPorDetectada[clave].equivalencia);
    });

    return compararOriginal(detectadas, oficiales, preparadas, opciones || {});
  };

  function nombreDesdeBoton(boton) {
    var tarjeta = boton && boton.closest ? boton.closest("[data-drag-materia]") : null;
    var strong = tarjeta && tarjeta.querySelector("strong");
    return texto(strong && strong.textContent);
  }

  function nivelDesdeBoton(boton) {
    var tarjeta = boton && boton.closest ? boton.closest("[data-drag-materia]") : null;
    var smalls = tarjeta ? tarjeta.querySelectorAll("small") : [];
    for (var i = 0; i < smalls.length; i += 1) {
      var contenido = texto(smalls[i].textContent);
      if (contenido.toLowerCase().indexOf("nivel detectado") === -1) continue;
      var match = contenido.match(/\d+/);
      return match ? numero(match[0], 0) : 0;
    }
    return 0;
  }

  async function guardarExcepcionPersistente(boton) {
    var carreraId = texto(boton.getAttribute("data-excepcion-carrera"));
    var nombreDetectado = nombreDesdeBoton(boton);
    var nivelDetectado = nivelDesdeBoton(boton);

    if (!carreraId || !nombreDetectado) {
      throw new Error("No se pudo identificar la materia para recordar la excepción.");
    }

    var detalle = await Mallas.obtenerMallaVigenteParaCarrera({ id: carreraId, carreraId: carreraId });
    if (!detalle || !detalle.malla) {
      throw new Error("No se encontró la malla vigente de la carrera.");
    }

    var guardada = await Mallas.guardarEquivalencia({
      mallaId: detalle.malla.id,
      carreraId: texto(detalle.malla.carreraId || carreraId),
      mallaMateriaId: EXCEPCION_ID,
      nombreOficial: "EXCEPCIÓN APROBADA",
      nivelOficial: 0,
      nombreDetectado: nombreDetectado,
      nivelDetectado: nivelDetectado,
      criterio: "excepcion_aprobada"
    });

    equivalenciasPorCarrera[carreraId] = combinarEquivalencias(
      equivalenciasPorCarrera[carreraId] || [],
      [guardada]
    );

    return guardada;
  }

  document.addEventListener("click", function (event) {
    var boton = event.target && event.target.closest
      ? event.target.closest("[data-excepcion-detectada]")
      : null;

    if (!boton) return;

    if (boton.getAttribute("data-memoria-reintento") === "1") {
      boton.removeAttribute("data-memoria-reintento");
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    var nombre = nombreDesdeBoton(boton) || "esta materia";
    var confirmar = window.confirm(
      "La materia \"" + nombre + "\" podrá importarse como excepción, pero seguirá sin corresponder a ninguna materia oficial de la malla.\n\n" +
      "Esta decisión quedará guardada para futuras cargas.\n\n¿Deseas continuar?"
    );

    if (!confirmar) return;

    boton.disabled = true;
    guardarExcepcionPersistente(boton).then(function () {
      var confirmOriginal = window.confirm;
      try {
        boton.disabled = false;
        boton.setAttribute("data-memoria-reintento", "1");
        window.confirm = function () { return true; };
        boton.click();
      } finally {
        window.confirm = confirmOriginal;
      }
    }).catch(function (error) {
      boton.disabled = false;
      console.error("[Mallas memoria] No se pudo guardar la excepción:", error);
      window.alert(
        "No se pudo guardar la decisión para futuras cargas. La excepción no fue aprobada.\n\n" +
        (error && error.message ? error.message : error)
      );
    });
  }, true);

  Mallas.__memoriaDecisionesInstalada = true;
  Mallas.MemoriaDecisiones = {
    VERSION: VERSION,
    EXCEPCION_ID: EXCEPCION_ID,
    obtenerEquivalenciasCarrera: obtenerEquivalenciasCarrera
  };
})(window, document);
