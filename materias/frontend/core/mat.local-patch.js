/* Materias: usa local primero y deja pendiente para sincronizar */
(function (window) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  function db() { return window.CurriculoLocal; }
  function clean(v) { return String(v == null ? "" : v).trim(); }
  function clone(v) { try { return JSON.parse(JSON.stringify(v || null)); } catch (e) { return v; } }

  function ensureShape(data) {
    if (MAT.carreras && typeof MAT.carreras.ensureShape === "function") {
      return MAT.carreras.ensureShape(data || {});
    }
    return data || {};
  }

  var remoteListar = MAT.carreras && MAT.carreras.listar;
  var remoteLeerUna = MAT.carreras && MAT.carreras.leerUna;

  MAT.carreras = MAT.carreras || {};

  MAT.carreras.listar = async function () {
    var list = db() ? await db().all("carreras") : [];
    var remote;

    if (list.length > 0) {
      return list.sort(function (a, b) {
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base", numeric: true });
      });
    }

    if (typeof remoteListar === "function") {
      remote = await remoteListar();
      if (db()) {
        for (var i = 0; i < remote.length; i += 1) {
          await db().put("carreras", remote[i].id, remote[i], { markDirty: false });
        }
      }
      return remote;
    }

    return [];
  };

  MAT.carreras.leerUna = async function (careerId) {
    var id = clean(careerId);
    var item;

    if (!id) throw new Error("MAT: Debes indicar el id de la carrera.");

    item = db() ? await db().get("carreras", id) : null;
    if (item) return ensureShape(Object.assign({ id: id }, item));

    if (typeof remoteLeerUna === "function") {
      item = await remoteLeerUna(id);
      if (item && db()) await db().put("carreras", id, item, { markDirty: false });
      return item ? ensureShape(Object.assign({ id: id }, item)) : null;
    }

    return null;
  };

  MAT.carga = MAT.carga || {};
  MAT.carga.actualizar = async function (careerId, patch, options) {
    var id = clean(careerId);
    var current = await MAT.carreras.leerUna(id);
    var updated = Object.assign({}, clone(current) || {}, clone(patch) || {});

    if (!id) throw new Error("MAT: Debes indicar el id de la carrera.");
    if (!current) throw new Error("MAT: La carrera seleccionada no existe en local.");

    updated.id = id;
    updated.updatedAtLocal = new Date().toISOString();

    if (options && options.audit) {
      updated.ultimaCarga = clone(options.audit);
    }

    await db().put("carreras", id, updated, { remoteCollection: "carreras" });
    return ensureShape(updated);
  };
})(window);
