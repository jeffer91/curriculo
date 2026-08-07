/* =========================================================
Nombre completo: ia.motor.js
Ruta o ubicación: /Curriculo/configuracion/ia.motor.js
Funciones:
- Administrar varios proveedores de IA con prioridad principal y respaldos.
- Guardar las API Keys cifradas localmente mediante Web Crypto + IndexedDB.
- Mantener proveedor, modelo, estado y orden sin guardar claves en Firebase o GitHub.
- Probar conexión y generación real de cada proveedor.
- Generar texto usando automáticamente el siguiente proveedor activo cuando uno falla.
========================================================= */
(function (window) {
  "use strict";

  var STORAGE_KEY = "curriculo_ia_config_v1";
  var DB_NAME = "curriculo-seguridad";
  var DB_VERSION = 1;
  var STORE = "secretos";
  var MASTER_KEY_ID = "ia_master_key";
  var VERSION = "1.0.0";

  var PROVEEDORES = Object.freeze({
    openai: {
      id: "openai",
      nombre: "OpenAI",
      endpoint: "https://api.openai.com/v1/chat/completions"
    },
    gemini: {
      id: "gemini",
      nombre: "Google Gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    },
    groq: {
      id: "groq",
      nombre: "Groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions"
    },
    openrouter: {
      id: "openrouter",
      nombre: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions"
    },
    compatible: {
      id: "compatible",
      nombre: "OpenAI compatible",
      endpoint: ""
    }
  });

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function idNuevo() {
    return "ia_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function configuracionBase() {
    return [];
  }

  function normalizarItem(item, indice) {
    item = item || {};
    var proveedor = PROVEEDORES[texto(item.proveedor)] ? texto(item.proveedor) : "openai";
    return {
      id: texto(item.id) || idNuevo(),
      proveedor: proveedor,
      nombre: texto(item.nombre) || PROVEEDORES[proveedor].nombre,
      modelo: texto(item.modelo),
      baseUrl: texto(item.baseUrl),
      activo: item.activo === true,
      orden: Math.max(1, numero(item.orden, indice + 1)),
      actualizadoEn: texto(item.actualizadoEn)
    };
  }

  function leerMetadata() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : configuracionBase();
      return (Array.isArray(parsed) ? parsed : []).map(normalizarItem).sort(function (a, b) {
        return a.orden - b.orden;
      });
    } catch (error) {
      console.warn("[IA] No se pudo leer la configuración local:", error);
      return configuracionBase();
    }
  }

  function guardarMetadata(items) {
    var limpios = (Array.isArray(items) ? items : []).map(normalizarItem).map(function (item, indice) {
      item.orden = indice + 1;
      item.actualizadoEn = new Date().toISOString();
      return item;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limpios));
    return limpios;
  }

  function abrirDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB no está disponible para proteger las API Keys."));
        return;
      }
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("No se pudo abrir el almacén seguro.")); };
    });
  }

  async function dbGet(id) {
    var db = await abrirDB();
    try {
      return await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    } finally {
      db.close();
    }
  }

  async function dbSet(id, valor) {
    var db = await abrirDB();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(valor, id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    } finally {
      db.close();
    }
  }

  async function dbDelete(id) {
    var db = await abrirDB();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    } finally {
      db.close();
    }
  }

  async function obtenerMasterKey() {
    var key = await dbGet(MASTER_KEY_ID);
    if (key) return key;
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Web Crypto no está disponible para cifrar la API Key.");
    }
    key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    await dbSet(MASTER_KEY_ID, key);
    return key;
  }

  function arrayBufferALista(buffer) {
    return Array.prototype.slice.call(new Uint8Array(buffer));
  }

  async function guardarSecreto(id, valor) {
    valor = texto(valor);
    if (!valor) {
      await dbDelete("api:" + id);
      return false;
    }
    var key = await obtenerMasterKey();
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(valor);
    var cifrado = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);
    await dbSet("api:" + id, {
      iv: Array.prototype.slice.call(iv),
      data: arrayBufferALista(cifrado),
      actualizadoEn: new Date().toISOString()
    });
    return true;
  }

  async function leerSecreto(id) {
    var guardado = await dbGet("api:" + id);
    if (!guardado || !guardado.iv || !guardado.data) return "";
    var key = await obtenerMasterKey();
    try {
      var claro = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(guardado.iv) },
        key,
        new Uint8Array(guardado.data)
      );
      return new TextDecoder().decode(claro);
    } catch (error) {
      throw new Error("No se pudo descifrar la API Key guardada en este equipo.");
    }
  }

  async function tieneSecreto(id) {
    return !!(await dbGet("api:" + id));
  }

  async function obtenerConfiguracion() {
    var items = leerMetadata();
    var salida = [];
    for (var i = 0; i < items.length; i += 1) {
      salida.push(Object.assign({}, items[i], {
        tieneApiKey: await tieneSecreto(items[i].id)
      }));
    }
    return salida;
  }

  async function guardarConfiguracion(items) {
    items = Array.isArray(items) ? items : [];
    var metadata = [];
    for (var i = 0; i < items.length; i += 1) {
      var original = items[i] || {};
      var item = normalizarItem(original, i);
      if (Object.prototype.hasOwnProperty.call(original, "apiKey")) {
        var api = texto(original.apiKey);
        if (api) await guardarSecreto(item.id, api);
        else if (original.borrarApiKey === true) await dbDelete("api:" + item.id);
      }
      metadata.push(item);
    }
    guardarMetadata(metadata);
    return await obtenerConfiguracion();
  }

  async function eliminarProveedor(id) {
    id = texto(id);
    var items = leerMetadata().filter(function (item) { return item.id !== id; });
    guardarMetadata(items);
    await dbDelete("api:" + id);
    return await obtenerConfiguracion();
  }

  function obtenerEndpoint(item) {
    if (item.proveedor === "compatible") {
      var base = texto(item.baseUrl).replace(/\/+$/g, "");
      if (!base) throw new Error("Configura la URL del proveedor compatible.");
      return /\/chat\/completions$/i.test(base) ? base : base + "/chat/completions";
    }
    return PROVEEDORES[item.proveedor].endpoint;
  }

  async function leerRespuestaJSON(response) {
    var textoRespuesta = await response.text();
    var parsed;
    try {
      parsed = textoRespuesta ? JSON.parse(textoRespuesta) : {};
    } catch (error) {
      parsed = { raw: textoRespuesta };
    }
    if (!response.ok) {
      var mensaje = parsed && parsed.error
        ? (parsed.error.message || parsed.error.status || JSON.stringify(parsed.error))
        : (parsed.message || textoRespuesta || ("HTTP " + response.status));
      throw new Error(texto(mensaje) || ("HTTP " + response.status));
    }
    return parsed;
  }

  async function llamarCompatible(item, apiKey, prompt, opciones) {
    var endpoint = obtenerEndpoint(item);
    var headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    };
    if (item.proveedor === "openrouter") headers["X-Title"] = "Curriculo CCC";
    var body = {
      model: item.modelo,
      messages: [
        { role: "system", content: texto(opciones && opciones.system) || "Responde con precisión y no inventes información." },
        { role: "user", content: prompt }
      ],
      temperature: typeof opciones.temperature === "number" ? opciones.temperature : 0.2
    };
    if (opciones && opciones.json === true) body.response_format = { type: "json_object" };
    var response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });
    var data = await leerRespuestaJSON(response);
    var salida = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    if (Array.isArray(salida)) {
      salida = salida.map(function (parte) { return parte && (parte.text || parte.content || ""); }).join("\n");
    }
    if (!texto(salida)) throw new Error("El proveedor respondió sin texto utilizable.");
    return texto(salida);
  }

  async function llamarGemini(item, apiKey, prompt, opciones) {
    var endpoint = PROVEEDORES.gemini.endpoint
      .replace("{model}", encodeURIComponent(item.modelo)) +
      "?key=" + encodeURIComponent(apiKey);
    var body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: texto(opciones && opciones.system) || "Responde con precisión y no inventes información." }]
      },
      generationConfig: {
        temperature: typeof opciones.temperature === "number" ? opciones.temperature : 0.2
      }
    };
    if (opciones && opciones.json === true) body.generationConfig.responseMimeType = "application/json";
    var response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var data = await leerRespuestaJSON(response);
    var partes = data && data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts
      : [];
    var salida = (Array.isArray(partes) ? partes : []).map(function (parte) { return texto(parte && parte.text); }).filter(Boolean).join("\n");
    if (!salida) throw new Error("Gemini respondió sin texto utilizable.");
    return salida;
  }

  async function ejecutarProveedor(item, prompt, opciones) {
    item = normalizarItem(item, 0);
    if (!item.modelo) throw new Error("Falta configurar el modelo de " + item.nombre + ".");
    var apiKey = await leerSecreto(item.id);
    if (!apiKey) throw new Error("Falta la API Key de " + item.nombre + ".");
    var inicio = performance.now();
    var salida = item.proveedor === "gemini"
      ? await llamarGemini(item, apiKey, prompt, opciones || {})
      : await llamarCompatible(item, apiKey, prompt, opciones || {});
    return {
      ok: true,
      proveedorId: item.id,
      proveedor: item.nombre,
      tipoProveedor: item.proveedor,
      modelo: item.modelo,
      texto: salida,
      latenciaMs: Math.max(0, Math.round(performance.now() - inicio))
    };
  }

  async function probarProveedor(id) {
    var items = leerMetadata();
    var item = items.find(function (actual) { return actual.id === texto(id); });
    if (!item) return { ok: false, mensaje: "No se encontró el proveedor." };
    try {
      var resultado = await ejecutarProveedor(
        item,
        "Responde únicamente con las palabras: IA OK",
        { temperature: 0 }
      );
      resultado.mensaje = "Conexión y generación correctas.";
      return resultado;
    } catch (error) {
      return {
        ok: false,
        proveedorId: item.id,
        proveedor: item.nombre,
        modelo: item.modelo,
        mensaje: error && error.message ? error.message : "No se pudo probar la IA."
      };
    }
  }

  async function generar(prompt, opciones) {
    opciones = opciones || {};
    prompt = texto(prompt);
    if (!prompt) return { ok: false, mensaje: "No se recibió contenido para analizar.", intentos: [] };
    var items = leerMetadata().filter(function (item) {
      return item.activo === true && (!opciones.proveedorId || item.id === opciones.proveedorId);
    }).sort(function (a, b) { return a.orden - b.orden; });
    if (!items.length) return { ok: false, mensaje: "No hay proveedores de IA activos.", intentos: [] };

    var intentos = [];
    for (var i = 0; i < items.length; i += 1) {
      try {
        var resultado = await ejecutarProveedor(items[i], prompt, opciones);
        resultado.intentos = intentos;
        return resultado;
      } catch (error) {
        intentos.push({
          proveedorId: items[i].id,
          proveedor: items[i].nombre,
          modelo: items[i].modelo,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
    return {
      ok: false,
      mensaje: "Ningún proveedor de IA pudo completar la solicitud.",
      intentos: intentos
    };
  }

  async function disponible() {
    var items = await obtenerConfiguracion();
    return items.some(function (item) {
      return item.activo === true && item.tieneApiKey === true && !!texto(item.modelo);
    });
  }

  window.CurriculoIA = {
    VERSION: VERSION,
    PROVEEDORES: PROVEEDORES,
    obtenerConfiguracion: obtenerConfiguracion,
    guardarConfiguracion: guardarConfiguracion,
    eliminarProveedor: eliminarProveedor,
    probarProveedor: probarProveedor,
    generar: generar,
    disponible: disponible,
    crearProveedor: function () {
      return normalizarItem({ id: idNuevo(), proveedor: "openai", activo: false }, leerMetadata().length);
    }
  };
})(window);