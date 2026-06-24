/*
Nombre completo: act.service.js
Ruta o ubicación: /actas/act.service.js
Función o funciones:
- Centralizar lectura de catálogos
- Obtener el contexto base del acta desde ficha y PEA
- Guardar actas en almacenamiento local
- Dejar preparado el módulo para integraciones reales
*/

import {
  fchStoreBuildKey,
  fchStoreReadFicha
} from "../fichas/fch.store.js";
import {
  actStoreBuildKey,
  actStoreSaveActa
} from "./act.store.js";

async function actServiceGetCatalogos() {
  return {
    carreras: [
      { id: "administracion", nombre: "Administración" },
      { id: "contabilidad", nombre: "Contabilidad" }
    ],
    niveles: [
      { id: "primer_nivel", nombre: "Primer nivel" },
      { id: "segundo_nivel", nombre: "Segundo nivel" },
      { id: "tercer_nivel", nombre: "Tercer nivel" },
      { id: "cuarto_nivel", nombre: "Cuarto nivel" }
    ],
    materias: [
      { id: "matematica_financiera", nombre: "Matemática Financiera" },
      { id: "administracion_i", nombre: "Administración I" },
      { id: "ofimatica", nombre: "Ofimática" }
    ]
  };
}

async function actServiceLoadContextoActa(seleccion) {
  const fichaKey = fchStoreBuildKey({
    carreraId: seleccion?.carreraId,
    nivelId: seleccion?.nivelId,
    materiaId: seleccion?.materiaId
  });

  const fichaData = fchStoreReadFicha(fichaKey);

  const peaData = {
    carreraId: seleccion?.carreraId || "",
    nivelId: seleccion?.nivelId || "",
    materiaId: seleccion?.materiaId || "",
    carreraNombre: seleccion?.carreraId === "administracion" ? "Administración" : "Contabilidad",
    nivelNombre: String(seleccion?.nivelId || "").replace(/_/g, " "),
    materiaNombre:
      seleccion?.materiaId === "matematica_financiera"
        ? "Matemática Financiera"
        : seleccion?.materiaId === "administracion_i"
        ? "Administración I"
        : "Ofimática",
    objetivo: "Objetivo base traído desde PEA.",
    fuente: "pea_documentos"
  };

  if (!fichaData) {
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
        }
      },
      peaData
    };
  }

  return {
    fichaData,
    peaData
  };
}

async function actServiceSaveActa(payload) {
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
    key,
    seleccion,
    acta,
    fichaData,
    peaData,
    savedAt: new Date().toISOString()
  };

  actStoreSaveActa(record);

  return {
    ok: true,
    mensaje: "Acta guardada correctamente.",
    key
  };
}

export {
  actServiceGetCatalogos,
  actServiceLoadContextoActa,
  actServiceSaveActa
};