/*
Nombre del archivo: carr.renombrar.js
Ubicación: carreras/backend/carr.renombrar.js
Función:
- Validar datos antes de renombrar
- Calcular el nuevo id según el nuevo nombre
- Crear el nuevo documento
- Eliminar el documento anterior
- Conservar createdAt y refrescar updatedAt
*/

import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { carrDb } from "./carr.firebase.js";
import { carrActualizarCarrera } from "./carr.actualizar.js";
import { carrCrearIdCarrera } from "./carr.normalizar.js";
import { carrValidarCarrera } from "./carr.validar.js";

async function carrRenombrarCarrera(idActual, data) {
  try {
    const idOrigen = String(idActual || "").trim();

    if (!idOrigen) {
      return {
        ok: false,
        mensaje: "El id actual de la carrera es obligatorio para renombrar."
      };
    }

    const validacion = carrValidarCarrera(data);

    if (!validacion.ok) {
      return {
        ok: false,
        mensaje: validacion.errores.join(" ")
      };
    }

    const valor = validacion.valor;
    const nuevoId = carrCrearIdCarrera(valor.nombre);

    if (!nuevoId) {
      return {
        ok: false,
        mensaje: "No fue posible generar un nuevo id válido para la carrera."
      };
    }

    if (nuevoId === idOrigen) {
      return await carrActualizarCarrera(idOrigen, valor);
    }

    const referenciaOrigen = doc(carrDb, "carreras", idOrigen);
    const documentoOrigen = await getDoc(referenciaOrigen);

    if (!documentoOrigen.exists()) {
      return {
        ok: false,
        mensaje: `No existe una carrera con el id: ${idOrigen}`
      };
    }

    const referenciaNueva = doc(carrDb, "carreras", nuevoId);
    const documentoNuevo = await getDoc(referenciaNueva);

    if (documentoNuevo.exists()) {
      return {
        ok: false,
        mensaje: `Ya existe otra carrera con el id destino: ${nuevoId}`
      };
    }

    const actualData = documentoOrigen.data();

    const payload = {
      ...actualData,
      nombre: valor.nombre,
      tipo: valor.tipo,
      estado: valor.estado,
      updatedAt: serverTimestamp()
    };

    if (!payload.createdAt) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(referenciaNueva, payload);
    await deleteDoc(referenciaOrigen);

    return {
      ok: true,
      mensaje: "Carrera renombrada correctamente.",
      idAnterior: idOrigen,
      id: nuevoId,
      data: {
        id: nuevoId,
        ...actualData,
        ...valor
      }
    };
  } catch (error) {
    console.error("[carr] Error en carrRenombrarCarrera:", error);

    return {
      ok: false,
      mensaje: "Ocurrió un error inesperado al renombrar la carrera."
    };
  }
}

export { carrRenombrarCarrera };