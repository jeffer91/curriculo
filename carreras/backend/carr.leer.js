/*
Nombre del archivo: carr.leer.js
Ubicación: carreras/backend/carr.leer.js
Función:
- Leer una carrera específica por su id
- Leer todas las carreras de la colección
- Devolver datos listos para consumo en frontend
*/

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { carrDb } from "./carr.firebase.js";

async function carrLeerCarreraPorId(carrId) {
  const id = String(carrId || "").trim();

  if (!id) {
    return {
      ok: false,
      mensaje: "Debe proporcionar un id de carrera válido."
    };
  }

  const referencia = doc(carrDb, "carreras", id);
  const snap = await getDoc(referencia);

  if (!snap.exists()) {
    return {
      ok: false,
      mensaje: "No se encontró la carrera solicitada."
    };
  }

  return {
    ok: true,
    mensaje: "Carrera encontrada.",
    id: snap.id,
    data: snap.data()
  };
}

async function carrLeerTodasLasCarreras() {
  try {
    const referencia = collection(carrDb, "carreras");
    const consulta = query(referencia, orderBy("nombre"));
    const snap = await getDocs(consulta);

    const items = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    return {
      ok: true,
      mensaje: "Carreras cargadas correctamente.",
      total: items.length,
      items
    };
  } catch (error) {
    console.error("[carr] Error al leer carreras:", error);

    return {
      ok: false,
      mensaje: "No se pudieron leer las carreras.",
      total: 0,
      items: []
    };
  }
}

export {
  carrLeerCarreraPorId,
  carrLeerTodasLasCarreras
};