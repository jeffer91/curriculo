/*
Nombre del archivo: carr.actualizar.js
Ubicación: carreras/backend/carr.actualizar.js
Función:
- Validar datos antes de actualizar
- Confirmar que el documento exista
- Actualizar nombre, tipo y estado
- Refrescar updatedAt
*/

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { carrDb } from "./carr.firebase.js";
import { carrValidarCarrera } from "./carr.validar.js";

async function carrActualizarCarrera(id, data) {
  try {
    const carrId = String(id || "").trim();

    if (!carrId) {
      return {
        ok: false,
        mensaje: "El id de la carrera es obligatorio para actualizar."
      };
    }

    const validacion = carrValidarCarrera(data);

    if (!validacion.ok) {
      return {
        ok: false,
        mensaje: validacion.errores.join(" ")
      };
    }

    const referencia = doc(carrDb, "carreras", carrId);
    const existente = await getDoc(referencia);

    if (!existente.exists()) {
      return {
        ok: false,
        mensaje: `No existe una carrera con el id: ${carrId}`
      };
    }

    const valor = validacion.valor;

    await updateDoc(referencia, {
      nombre: valor.nombre,
      tipo: valor.tipo,
      estado: valor.estado,
      updatedAt: serverTimestamp()
    });

    return {
      ok: true,
      mensaje: "Carrera actualizada correctamente.",
      id: carrId,
      data: {
        id: carrId,
        ...existente.data(),
        ...valor
      }
    };
  } catch (error) {
    console.error("[carr] Error en carrActualizarCarrera:", error);

    return {
      ok: false,
      mensaje: "Ocurrió un error inesperado al actualizar la carrera."
    };
  }
}

export { carrActualizarCarrera };