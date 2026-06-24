/*
Nombre completo: fch.service.js
Ruta o ubicación: /fichas/fch.service.js
Función o funciones:
- Leer catálogos reales desde la base local central
- Construir materias desde las carreras guardadas en local
- Cargar información base para la ficha
- Guardar fichas en la base local central y dejarlas pendientes de sincronización
*/

import { fchStoreBuildKey } from "./fch.store.js";

function fchSafeText(value) {
  return String(value ?? "").trim();
}

function fchSlug(value) {
  return fchSafeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fchGetLocalDb() {
  if (!window.CurriculoLocal) {
    throw new Error("No se encontró la base local de Currículo.");
  }
  return window.CurriculoLocal;
}

function fchCleanArray(value) {
  return Array.isArray(value)
    ? value.map((item) => fchSafeText(item)).filter(Boolean)
    : [];
}

function fchNivelesBase() {
  return [
    { id: "nivel1", nombre: "Nivel 1" },
    { id: "nivel2", nombre: "Nivel 2" },
    { id: "nivel3", nombre: "Nivel 3" },
    { id: "nivel4", nombre: "Nivel 4" }
  ];
}

function fchGetNivelItems(carrera, nivelId) {
  const source = carrera || {};
  const map = {
    nivel1: []
      .concat(fchCleanArray(source.materiasNivel1))
      .concat(fchCleanArray(source.materiasTransversal1)),
    nivel2: []
      .concat(fchCleanArray(source.materiasNivel2))
      .concat(fchCleanArray(source.materiasTransversal2)),
    nivel3: []
      .concat(fchCleanArray(source.materiasNivel3))
      .concat(fchCleanArray(source.materiasTransversal3)),
    nivel4: []
      .concat(fchCleanArray(source.materiasNivel4))
      .concat(fchCleanArray(source.materiasTransversal4))
  };
  return map[nivelId] || [];
}

function fchBuildMateriaId(carreraId, nivelId, materiaNombre) {
  return [fchSafeText(carreraId), fchSafeText(nivelId), fchSlug(materiaNombre)].join("__");
}

function fchParseMateriaId(materiaId) {
  const parts = fchSafeText(materiaId).split("__");
  return {
    carreraId: parts[0] || "",
    nivelId: parts[1] || "",
    materiaSlug: parts.slice(2).join("__")
  };
}

function fchUniqueList(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = fchSafeText(item.id || item.nombre || item).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

async function fchServiceGetCatalogos() {
  const local = fchGetLocalDb();
  const carrerasRaw = await local.all("carreras");
  const carreras = carrerasRaw
    .map((item) => ({
      id: fchSafeText(item.id),
      nombre: fchSafeText(item.nombre || item.id),
      tipo: fchSafeText(item.tipo),
      estado: fchSafeText(item.estado || "activa")
    }))
    .filter((item) => item.id && item.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true }));

  const materias = [];

  carrerasRaw.forEach((carrera) => {
    const carreraId = fchSafeText(carrera.id);
    fchNivelesBase().forEach((nivel) => {
      fchGetNivelItems(carrera, nivel.id).forEach((materiaNombre) => {
        materias.push({
          id: fchBuildMateriaId(carreraId, nivel.id, materiaNombre),
          nombre: materiaNombre,
          carreraId,
          nivelId: nivel.id
        });
      });
    });
  });

  return {
    carreras,
    niveles: fchNivelesBase(),
    materias: fchUniqueList(materias)
  };
}

async function fchServiceLoadPeaData(seleccion) {
  const local = fchGetLocalDb();
  const carreraId = fchSafeText(seleccion?.carreraId);
  const nivelId = fchSafeText(seleccion?.nivelId);
  const materiaId = fchSafeText(seleccion?.materiaId);
  const parsedMateria = fchParseMateriaId(materiaId);
  const carrera = await local.get("carreras", carreraId);

  if (!carreraId || !nivelId || !materiaId) {
    throw new Error("Selección incompleta para cargar PEA.");
  }

  if (!carrera) {
    throw new Error("No se encontró la carrera en la base local.");
  }

  const nivel = fchNivelesBase().find((item) => item.id === nivelId) || { id: nivelId, nombre: nivelId };
  const materiasNivel = fchGetNivelItems(carrera, nivelId);
  const materiaNombre = materiasNivel.find((nombre) => fchBuildMateriaId(carreraId, nivelId, nombre) === materiaId) || parsedMateria.materiaSlug.replace(/_/g, " ");

  return {
    carreraId,
    nivelId,
    materiaId,
    carreraNombre: fchSafeText(carrera.nombre),
    nivelNombre: nivel.nombre,
    materiaNombre: fchSafeText(materiaNombre),
    codigoMateria: materiaId,
    objetivo: "Objetivo base pendiente de completar desde PEA.",
    unidades: [],
    fuente: "base_local_curriculo"
  };
}

async function fchServiceSaveFicha(payload) {
  const local = fchGetLocalDb();
  const seleccion = payload?.seleccion || {};
  const ficha = payload?.ficha || {};
  const peaData = payload?.peaData || null;
  const key = fchStoreBuildKey({
    carreraId: seleccion.carreraId,
    nivelId: seleccion.nivelId,
    materiaId: seleccion.materiaId
  });

  if (!key) {
    throw new Error("No se pudo construir la clave de guardado.");
  }

  const record = {
    id: key,
    key,
    seleccion,
    ficha,
    peaData,
    savedAtLocal: new Date().toISOString(),
    updatedAtLocal: new Date().toISOString()
  };

  await local.put("fichas", key, record, { remoteCollection: "fichas" });

  return {
    ok: true,
    mensaje: "Ficha guardada localmente. Quedó pendiente para la subida diaria si existen cambios.",
    key
  };
}

export {
  fchServiceGetCatalogos,
  fchServiceLoadPeaData,
  fchServiceSaveFicha
};
