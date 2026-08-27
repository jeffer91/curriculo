/* =========================================================
Nombre completo: firebase.exportar.js
Ruta o ubicación: /Curriculo/firebase/firebase.exportar.js
Funciones:
- Leer en modo solo lectura todas las colecciones Firestore usadas por Curriculo.
- Normalizar Timestamp, GeoPoint, referencias y valores anidados para exportación.
- Continuar la exportación aunque una colección concreta no pueda leerse.
- Entregar un respaldo estructurado con resumen por colección.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoFirebase = window.CurriculoFirebase || {};
  var NS = window.CurriculoFirebase;

  if (NS.Exportar && NS.Exportar.__instalada === true) return;

  var VERSION = "1.0.0";
  var SDK_BASE = "https://www.gstatic.com/firebasejs/" + String(NS.SDK_VERSION || "12.16.0") + "/";

  /*
   * Firestore Web no expone listCollections() para descubrir colecciones raíz.
   * Esta lista reúne todas las colecciones planas que utiliza actualmente la app.
   * Si en el futuro se añade otra colección a Curriculo, debe agregarse aquí.
   */
  var COLECCIONES = Object.freeze([
    "carreras",
    "materias",
    "pea_base",
    "pea_unidades",
    "pea_actividades",
    "cargas",
    "materias_pendientes",
    "materia_versiones",
    "materia_cambios",
    "comunicados",
    "configuracion",
    "mallas_curriculares",
    "malla_materias",
    "malla_requisitos",
    "malla_equivalencias",
    "malla_comparaciones",
    "ficha_inputs",
    "ficha_contextos",
    "ficha_tendencias",
    "ficha_generaciones",
    "ficha_periodos"
  ]);

  var estado = {
    firestoreSDK: null,
    appSDK: null,
    app: null,
    db: null,
    promesa: null
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function importarModulo(url) {
    var dinamico = new Function("url", "return import(url);");
    return dinamico(url);
  }

  async function abrirSDK() {
    if (estado.db && estado.firestoreSDK) return estado;
    if (estado.promesa) return estado.promesa;
    if (!NS.CONFIG) throw new Error("Firebase no tiene configuración disponible.");

    estado.promesa = (async function () {
      if (typeof NS.ready === "function") {
        try {
          await NS.ready();
        } catch (errorReady) {
          // Se vuelve a intentar mediante el SDK compartido.
        }
      }

      var modulos = await Promise.all([
        importarModulo(SDK_BASE + "firebase-app.js"),
        importarModulo(SDK_BASE + "firebase-firestore.js")
      ]);

      estado.appSDK = modulos[0];
      estado.firestoreSDK = modulos[1];
      estado.app = estado.appSDK.getApps().length
        ? estado.appSDK.getApp()
        : estado.appSDK.initializeApp(NS.CONFIG);

      try {
        estado.db = estado.firestoreSDK.getFirestore(estado.app);
      } catch (errorGet) {
        estado.db = estado.firestoreSDK.initializeFirestore(estado.app, {
          experimentalAutoDetectLongPolling: true
        });
      }

      return estado;
    })().catch(function (error) {
      estado.promesa = null;
      throw error;
    });

    return estado.promesa;
  }

  function limpiarValor(valor, vistos) {
    if (valor === null || typeof valor === "undefined") return null;

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      return valor.toISOString();
    }

    if (typeof valor === "string" || typeof valor === "boolean") return valor;

    if (typeof valor === "number") {
      return Number.isFinite(valor) ? valor : null;
    }

    if (typeof valor === "bigint") return String(valor);

    if (typeof valor === "object" && typeof valor.toDate === "function") {
      try {
        var fecha = valor.toDate();
        return fecha instanceof Date && !Number.isNaN(fecha.getTime())
          ? fecha.toISOString()
          : texto(fecha);
      } catch (errorFecha) {}
    }

    if (typeof valor === "object" && typeof valor.toBase64 === "function") {
      try {
        return { __tipo: "bytes", base64: valor.toBase64() };
      } catch (errorBytes) {}
    }

    if (
      typeof valor === "object" &&
      typeof valor.latitude === "number" &&
      typeof valor.longitude === "number"
    ) {
      return {
        __tipo: "geopoint",
        latitude: valor.latitude,
        longitude: valor.longitude
      };
    }

    if (
      typeof valor === "object" &&
      typeof valor.path === "string" &&
      valor.constructor &&
      /DocumentReference/i.test(String(valor.constructor.name || ""))
    ) {
      return { __tipo: "document_reference", path: valor.path };
    }

    if (Array.isArray(valor)) {
      return valor.map(function (item) {
        return limpiarValor(item, vistos);
      });
    }

    if (typeof valor === "object") {
      vistos = vistos || new WeakSet();

      if (vistos.has(valor)) return "[Referencia circular]";
      vistos.add(valor);

      var salida = {};
      Object.keys(valor).forEach(function (clave) {
        try {
          salida[clave] = limpiarValor(valor[clave], vistos);
        } catch (errorCampo) {
          salida[clave] = "[No se pudo exportar: " + texto(errorCampo && errorCampo.message) + "]";
        }
      });

      vistos.delete(valor);
      return salida;
    }

    return texto(valor);
  }

  async function obtenerColeccion(nombre) {
    nombre = texto(nombre);
    if (!nombre) throw new Error("La colección es obligatoria.");

    var s = await abrirSDK();
    var snap = await s.firestoreSDK.getDocs(
      s.firestoreSDK.collection(s.db, nombre)
    );

    return snap.docs.map(function (docSnap) {
      var data = limpiarValor(docSnap.data(), new WeakSet()) || {};
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return Object.assign({ id: docSnap.id }, data);
      }
      return { id: docSnap.id, valor: data };
    });
  }

  async function obtenerTodo(opciones) {
    opciones = opciones || {};
    var onProgress = typeof opciones.onProgress === "function"
      ? opciones.onProgress
      : null;

    await abrirSDK();

    var colecciones = {};
    var resumen = [];
    var totalRegistros = 0;
    var errores = [];

    for (var i = 0; i < COLECCIONES.length; i += 1) {
      var nombre = COLECCIONES[i];

      if (onProgress) {
        onProgress({
          actual: i,
          total: COLECCIONES.length,
          porcentaje: Math.round((i / COLECCIONES.length) * 100),
          coleccion: nombre,
          mensaje: "Leyendo " + nombre + "..."
        });
      }

      try {
        var registros = await obtenerColeccion(nombre);
        colecciones[nombre] = registros;
        totalRegistros += registros.length;
        resumen.push({
          coleccion: nombre,
          registros: registros.length,
          estado: "ok",
          error: ""
        });
      } catch (error) {
        var mensaje = error && error.message ? error.message : "No se pudo leer la colección.";
        colecciones[nombre] = [];
        errores.push({ coleccion: nombre, error: mensaje });
        resumen.push({
          coleccion: nombre,
          registros: 0,
          estado: "error",
          error: mensaje
        });
      }
    }

    if (onProgress) {
      onProgress({
        actual: COLECCIONES.length,
        total: COLECCIONES.length,
        porcentaje: 100,
        coleccion: "",
        mensaje: "Lectura de Firebase terminada."
      });
    }

    return {
      formato: "curriculo-firebase-backup-v1",
      proyectoId: NS.CONFIG && NS.CONFIG.projectId ? NS.CONFIG.projectId : "",
      generadoEn: new Date().toISOString(),
      totalColecciones: COLECCIONES.length,
      coleccionesLeidas: resumen.filter(function (item) { return item.estado === "ok"; }).length,
      totalRegistros: totalRegistros,
      errores: errores,
      resumen: resumen,
      colecciones: colecciones
    };
  }

  NS.Exportar = {
    __instalada: true,
    VERSION: VERSION,
    COLECCIONES: COLECCIONES,
    obtenerColeccion: obtenerColeccion,
    obtenerTodo: obtenerTodo,
    limpiarValor: limpiarValor
  };
})(window);
