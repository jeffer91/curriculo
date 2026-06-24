/*
Nombre del archivo: carr.guardar.js
Ubicación: carreras/backend/carr.guardar.js
Función:
- Validar datos antes de guardar
- Crear el id del documento
- Verificar si la carrera ya existe
- Guardar solo nombre, tipo y estado en Firestore
*/

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { carrDb } from "./carr.firebase.js";
import { carrCrearIdCarrera } from "./carr.normalizar.js";
import { carrValidarCarrera } from "./carr.validar.js";

async function carrGuardarCarrera(data) {
  try {
    const validacion = carrValidarCarrera(data);

    if (!validacion.ok) {
      return {
        ok: false,
        mensaje: validacion.errores.join(" ")
      };
    }

    const valor = validacion.valor;
    const carrId = carrCrearIdCarrera(valor.nombre);

    if (!carrId) {
      return {
        ok: false,
        mensaje: "No fue posible generar un id válido para la carrera."
      };
    }

    const referencia = doc(carrDb, "carreras", carrId);
    const existente = await getDoc(referencia);

    if (existente.exists()) {
      return {
        ok: false,
        mensaje: `La carrera ya existe con el id: ${carrId}`
      };
    }

    const payload = {
      nombre: valor.nombre,
      tipo: valor.tipo,
      estado: valor.estado,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(referencia, payload);

    return {
      ok: true,
      mensaje: "Carrera creada correctamente.",
      id: carrId,
      data: {
        id: carrId,
        ...payload
      }
    };
  } catch (error) {
    console.error("[carr] Error en carrGuardarCarrera:", error);

    return {
      ok: false,
      mensaje: "Ocurrió un error inesperado al guardar la carrera."
    };
  }
}

export { carrGuardarCarrera };