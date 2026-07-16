/* =========================================================
Nombre completo: sync.client.js
Ruta: /Curriculo/sync/sync.client.js
Funciones:
- Probar la conexión con el endpoint de Google Apps Script.
- Enviar solicitudes de comparación y sincronización.
- Aplicar timeout y devolver errores claros sin modificar BDLocal.
========================================================= */
(function (window) {
  "use strict";

  window.CurriculoSync = window.CurriculoSync || {};
  var NS = window.CurriculoSync;

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function validarEndpoint(endpoint) {
    var url = texto(endpoint);
    if (!/^https:\/\//i.test(url)) throw new Error("El endpoint debe comenzar con https://");
    return url;
  }

  function conTimeout(promesa, ms) {
    return new Promise(function (resolve, reject) {
      var finalizada = false;
      var timer = setTimeout(function () {
        if (finalizada) return;
        finalizada = true;
        reject(new Error("La conexión superó el tiempo máximo de espera."));
      }, Number(ms || 20000));

      Promise.resolve(promesa).then(function (resultado) {
        if (finalizada) return;
        finalizada = true;
        clearTimeout(timer);
        resolve(resultado);
      }).catch(function (error) {
        if (finalizada) return;
        finalizada = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async function fetchJSON(url, opciones) {
    var respuesta = await conTimeout(window.fetch(url, opciones || {}), 25000);
    var textoRespuesta = await respuesta.text();
    var datos;

    try {
      datos = textoRespuesta ? JSON.parse(textoRespuesta) : {};
    } catch (errorJSON) {
      throw new Error("El endpoint respondió, pero no devolvió JSON válido.");
    }

    if (!respuesta.ok || datos.ok === false) {
      throw new Error(datos.mensaje || ("Error HTTP " + respuesta.status));
    }

    return datos;
  }

  function parametros(config, extras) {
    var base = {
      spreadsheetId: texto(config && config.spreadsheetId),
      token: texto(config && config.token),
      dispositivoId: texto(config && config.dispositivoId),
      entorno: texto(config && config.entorno || "pruebas")
    };
    return Object.assign(base, extras || {});
  }

  async function get(config, accion, extras) {
    var endpoint = validarEndpoint(config && config.endpoint);
    var params = parametros(config, Object.assign({ action: accion }, extras || {}));
    var query = Object.keys(params).filter(function (clave) {
      return params[clave] !== "" && params[clave] !== null && typeof params[clave] !== "undefined";
    }).map(function (clave) {
      return encodeURIComponent(clave) + "=" + encodeURIComponent(String(params[clave]));
    }).join("&");
    return await fetchJSON(endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + query, { method: "GET", cache: "no-store" });
  }

  async function post(config, accion, payload) {
    var endpoint = validarEndpoint(config && config.endpoint);
    var body = parametros(config, {
      action: accion,
      payload: payload || {},
      enviadoEn: new Date().toISOString()
    });

    return await fetchJSON(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  }

  async function probarConexion(config) {
    return await get(config, "ping");
  }

  async function listarPruebas(config) {
    return await get(config, "listar_test");
  }

  async function compararPruebas(config, registros) {
    return await post(config, "comparar_test", { registros: registros || [] });
  }

  async function sincronizarPruebas(config, registros) {
    return await post(config, "sincronizar_test", { registros: registros || [] });
  }

  NS.Client = {
    validarEndpoint: validarEndpoint,
    probarConexion: probarConexion,
    listarPruebas: listarPruebas,
    compararPruebas: compararPruebas,
    sincronizarPruebas: sincronizarPruebas,
    get: get,
    post: post
  };
})(window);