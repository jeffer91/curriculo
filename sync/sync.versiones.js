/* =========================================================
Nombre completo: sync.versiones.js
Ruta: /Curriculo/sync/sync.versiones.js
Funciones:
- Comparar registros locales y remotos por versión, fecha y contenido.
- Detectar qué lado contiene la información más reciente.
- Calcular un hash estable sin depender de metadatos de sincronización.
- Detectar conflictos cuando versión y fecha coinciden, pero el contenido difiere.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoSync = window.CurriculoSync || {};
  var NS = window.CurriculoSync;

  var CLAVES_TECNICAS = Object.freeze({
    hash: true,
    sincronizadoEn: true,
    ultimoIntentoEn: true,
    estadoSync: true,
    origen: true,
    dispositivoId: true,
    version: true,
    actualizadoEn: true,
    updatedAt: true,
    creadoEn: true,
    createdAt: true
  });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function fechaNumero(valor) {
    var numero = Date.parse(texto(valor));
    return Number.isFinite(numero) ? numero : 0;
  }

  function versionNumero(valor) {
    var numero = Number(valor || 0);
    return Number.isFinite(numero) ? numero : 0;
  }

  function serializarOrdenado(valor) {
    if (Array.isArray(valor)) {
      return "[" + valor.map(serializarOrdenado).join(",") + "]";
    }

    if (valor && typeof valor === "object") {
      return "{" + Object.keys(valor).sort().filter(function (clave) {
        return !CLAVES_TECNICAS[clave];
      }).map(function (clave) {
        return JSON.stringify(clave) + ":" + serializarOrdenado(valor[clave]);
      }).join(",") + "}";
    }

    return JSON.stringify(valor);
  }

  function hashTexto(cadena) {
    var hash = 2166136261;
    var textoCadena = String(cadena || "");

    for (var i = 0; i < textoCadena.length; i += 1) {
      hash ^= textoCadena.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function calcularHash(registro) {
    if (!registro) return "";
    return hashTexto(serializarOrdenado(registro));
  }

  function normalizar(registro) {
    if (!registro) return null;

    var normalizado = Object.assign({}, registro, {
      id: texto(registro.id),
      version: versionNumero(registro.version),
      actualizadoEn: texto(registro.actualizadoEn || registro.updatedAt)
    });

    normalizado.hash = calcularHash(normalizado);
    return normalizado;
  }

  function comparar(local, remoto) {
    local = normalizar(local);
    remoto = normalizar(remoto);

    if (!local && !remoto) {
      return { decision: "sin_datos", ganador: "ninguno", motivo: "No existen registros." };
    }

    if (local && !remoto) {
      return { decision: "crear_remoto", ganador: "local", motivo: "El registro solo existe en BDLocal.", local: local, remoto: null };
    }

    if (!local && remoto) {
      return { decision: "crear_local", ganador: "remoto", motivo: "El registro solo existe en Google Sheets.", local: null, remoto: remoto };
    }

    if (local.version > remoto.version) {
      return { decision: "local_a_remoto", ganador: "local", motivo: "BDLocal tiene una versión mayor.", local: local, remoto: remoto };
    }

    if (remoto.version > local.version) {
      return { decision: "remoto_a_local", ganador: "remoto", motivo: "Google Sheets tiene una versión mayor.", local: local, remoto: remoto };
    }

    var fechaLocal = fechaNumero(local.actualizadoEn);
    var fechaRemota = fechaNumero(remoto.actualizadoEn);

    if (fechaLocal > fechaRemota) {
      return { decision: "local_a_remoto", ganador: "local", motivo: "La versión es igual, pero BDLocal fue actualizada después.", local: local, remoto: remoto };
    }

    if (fechaRemota > fechaLocal) {
      return { decision: "remoto_a_local", ganador: "remoto", motivo: "La versión es igual, pero Google Sheets fue actualizado después.", local: local, remoto: remoto };
    }

    if (local.hash === remoto.hash) {
      return { decision: "igual", ganador: "ambos", motivo: "La versión, fecha y contenido coinciden.", local: local, remoto: remoto };
    }

    return {
      decision: "conflicto",
      ganador: "pendiente",
      motivo: "La versión y la fecha son iguales, pero el contenido es diferente.",
      local: local,
      remoto: remoto
    };
  }

  function compararListas(locales, remotos) {
    var mapaLocal = {};
    var mapaRemoto = {};
    var ids = {};

    (Array.isArray(locales) ? locales : []).forEach(function (registro) {
      if (!registro || !texto(registro.id)) return;
      mapaLocal[texto(registro.id)] = registro;
      ids[texto(registro.id)] = true;
    });

    (Array.isArray(remotos) ? remotos : []).forEach(function (registro) {
      if (!registro || !texto(registro.id)) return;
      mapaRemoto[texto(registro.id)] = registro;
      ids[texto(registro.id)] = true;
    });

    return Object.keys(ids).sort().map(function (id) {
      return Object.assign({ id: id }, comparar(mapaLocal[id], mapaRemoto[id]));
    });
  }

  NS.Versiones = {
    comparar: comparar,
    compararListas: compararListas,
    normalizar: normalizar,
    calcularHash: calcularHash,
    hashTexto: hashTexto,
    serializarOrdenado: serializarOrdenado
  };
})(window);