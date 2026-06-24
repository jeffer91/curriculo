/*
Nombre completo: fch.service.js
Ruta o ubicación: /fichas/fch.service.js
Función o funciones:
- Simular o centralizar la lectura de catálogos
- Cargar información base desde PEA
- Guardar la ficha en almacenamiento local
- Dejar preparado el punto de integración con Firebase o el sistema real
*/

import {
  fchStoreBuildKey,
  fchStoreSaveFicha
} from "./fch.store.js";

async function fchServiceGetCatalogos() {
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

async function fchServiceLoadPeaData(seleccion) {
  const carreraId = String(seleccion?.carreraId || "").trim();
  const nivelId = String(seleccion?.nivelId || "").trim();
  const materiaId = String(seleccion?.materiaId || "").trim();

  if (!carreraId || !nivelId || !materiaId) {
    throw new Error("Selección incompleta para cargar PEA.");
  }

  return {
    carreraId,
    nivelId,
    materiaId,
    carreraNombre: carreraId === "administracion" ? "Administración" : "Contabilidad",
    nivelNombre: nivelId.replace(/_/g, " "),
    materiaNombre:
      materiaId === "matematica_financiera"
        ? "Matemática Financiera"
        : materiaId === "administracion_i"
        ? "Administración I"
        : "Ofimática",
    codigoMateria: "",
    objetivo: "Objetivo base traído desde PEA.",
    unidades: [
      "Unidad 1",
      "Unidad 2",
      "Unidad 3",
      "Unidad 4"
    ],
    fuente: "pea_documentos"
  };
}

async function fchServiceSaveFicha(payload) {
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
    key,
    seleccion,
    ficha,
    peaData,
    savedAt: new Date().toISOString()
  };

  fchStoreSaveFicha(record);

  return {
    ok: true,
    mensaje: "Ficha guardada correctamente.",
    key
  };
}

export {
  fchServiceGetCatalogos,
  fchServiceLoadPeaData,
  fchServiceSaveFicha
};