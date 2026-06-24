/*
Nombre completo: act.service.js
Ruta o ubicación: /actas/act.service.js
Función o funciones:
- Leer catálogos reales desde la base local central
- Obtener el contexto base del acta desde ficha guardada localmente
- Construir un contexto de respaldo desde carreras y materias locales
- Guardar actas primero en la base local central y dejarlas pendientes de sincronización
*/

import { fchStoreBuildKey } from "../fichas/fch.store.js";
import { actStoreBuildKey } from "./act.store.js";

function actSafeText(value) {
  return String(value ?? "").trim();
}

function actSlug(value) {
  return actSafeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function actGetLocalDb() {
  if (!window.CurriculoLocal) {
    throw new Error("No se encontró la base local de Currículo.");
  }
  return window.CurriculoLocal;
}

function actCleanArray(value) {
  return Array.isArray(value)
    ? value.map((item) => actSafeText(item)).filter(Boolean)
    : [];
}

function actNivelesBase() {
  return [
    { id: "nivel1", nombre: "Nivel 1" },
    { id: "nivel2", nombre: "Nivel 2" },
    { id: "nivel3", nombre: "Nivel 3" },
    { id: "nivel4", nombre: "Nivel 4" }
  ];
}

function actGetNivelItems(carrera, nivelId) {
  const source = carrera || {};
  const map = {
    nivel1: []
      .concat(actCleanArray(source.materiasNivel1))
      .concat(actCleanArray(source.materiasTransversal1)),
    nivel2: []
      .concat(actCleanArray(source.materiasNivel2))
      .concat(actCleanArray(source.materiasTransversal2)),
    nivel3: []
      .concat(actCleanArray(source.materiasNivel3))
      .concat(actCleanArray(source.materiasTransversal3)),
    nivel4: []
      .concat(actCleanArray(source.materiasNivel4))
      .concat(actCleanArray(source.materiasTransversal4))
  };
  return map[nivelId] || [];
}

function actBuildMateriaId(carreraId, nivelId, materiaNombre) {
  return [actSafeText(carreraId), actSafeText(nivelId), actSlug(materiaNombre)].join("__");
}

function actParseMateriaId(materiaId) {
  const parts = actSafeText(materiaId).split("__");
  return {
    carreraId: parts[0] || "",
    nivelId: parts[1] || "",
    materiaSlug: parts.slice(2).join("__")
  };
}

function actUniqueList(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = actSafeText(item.id || item.nombre || item).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

async function actServiceGetCatalogos() {
  const local = actGetLocalDb();
  const carrerasRaw = await local.all("carreras");
  const carreras = carrerasRaw
    .map((item) => ({
      id: actSafeText(item.id),
      nombre: actSafeText(item.nombre || item.id),
      tipo: actSafeText(item.tipo),
      estado: actSafeText(item.estado || "activa")
    }))
    .filter((item) => item.id && item.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true }));

  const materias = [];

  carrerasRaw.forEach((carrera) => {
    const carreraId = actSafeText(carrera.id);
    actNivelesBase().forEach((nivel) => {
      actGetNivelItems(carrera, nivel.id).forEach((materiaNombre) => {
        materias.push({
          id: actBuildMateriaId(carreraId, nivel.id, materiaNombre),
          nombre: materiaNombre,
          carreraId,
          nivelId: nivel.id
        });
      });
    });
  });

  return {
    carreras,
    niveles: actNivelesBase(),
    materias: actUniqueList(materias)
  };
}

async function actServiceLoadContextoActa(seleccion) {
  const local = actGetLocalDb();
  const carreraId = actSafeText(seleccion?.carreraId);
  const nivelId = actSafeText(seleccion?.nivelId);
  const materiaId = actSafeText(seleccion?.materiaId);
  const parsedMateria = actParseMateriaId(materiaId);

  if (!carreraId || !nivelId || !materiaId) {
    throw new Error("Selección incompleta para cargar el acta.");
  }

  const fichaKey = fchStoreBuildKey({ carreraId, nivelId, materiaId });
  const fichaData = await local.get("fichas", fichaKey);
  const carrera = await local.get("carreras", carreraId);

  if (!carrera) {
    throw new Error("No se encontró la carrera en la base local.");
  }

  const nivel = actNivelesBase().find((item) => item.id === nivelId) || { id: nivelId, nombre: nivelId };
  const materiasNivel = actGetNivelItems(carrera, nivelId);
  const materiaNombre = materiasNivel.find((nombre) => actBuildMateriaId(carreraId, nivelId, nombre) === materiaId) || parsedMateria.materiaSlug.replace(/_/g, " ");

  const peaData = {
    carreraId,
    nivelId,
    materiaId,
    carreraNombre: actSafeText(carrera.nombre),
    nivelNombre: nivel.nombre,
    materiaNombre: actSafeText(materiaNombre),
    objetivo: fichaData?.ficha?.objetivo || "Objetivo base pendiente de completar desde ficha o PEA.",
    fuente: fichaData ? "ficha_local" : "base_local_curriculo"
  };

  if (fichaData) {
    return {
      fichaData,
      peaData
    };
  }

  return {
    fichaData: {
      key: fichaKey,
      ficha: {
        carreraNombre: peaData.carreraNombre,
        nivelNombre: peaData.nivelNombre,
        materiaNombre: peaData.materiaNombre,
        objetivo: peaData.objetivo,
        observaciones: "",
        decisiones: "",
        responsables: ""
      },
      aviso: "No existe ficha guardada para esta asignatura. Se generó un contexto base desde la información local."
    },
    peaData
  };
}

async function actServiceSaveActa(payload) {
  const local = actGetLocalDb();
  const seleccion = payload?.seleccion || {};
  const acta = payload?.acta || {};
  const fichaData = payload?.fichaData || null;
  const peaData = payload?.peaData || null;

  const key = actStoreBuildKey({
    carreraId: seleccion.carreraId,
    nivelId: seleccion.nivelId,
    materiaId: seleccion.materiaId
  });

  if (!key) {
    throw new Error("No se pudo construir la clave del acta.");
  }

  const record = {
    id: key,
    key,
    seleccion,
    acta,
    fichaData,
    peaData,
    savedAtLocal: new Date().toISOString(),
    updatedAtLocal: new Date().toISOString()
  };

  await local.put("actas", key, record, { remoteCollection: "actas" });

  return {
    ok: true,
    mensaje: "Acta guardada localmente. Quedó pendiente para la subida diaria si existen cambios.",
    key
  };
}

export {
  actServiceGetCatalogos,
  actServiceLoadContextoActa,
  actServiceSaveActa
};
