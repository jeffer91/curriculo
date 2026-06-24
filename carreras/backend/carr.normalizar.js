/*
Nombre del archivo: carr.normalizar.js
Ubicación: carreras/backend/carr.normalizar.js
Función:
- Limpiar y normalizar texto
- Quitar tildes y caracteres especiales
- Generar un id válido para el documento de la carrera
*/

function carrQuitarTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function carrLimpiarTextoBase(texto) {
  return String(texto || "")
    .trim()
    .replace(/\s+/g, " ");
}

function carrCrearIdCarrera(nombre) {
  const base = carrQuitarTildes(carrLimpiarTextoBase(nombre))
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base;
}

export {
  carrQuitarTildes,
  carrLimpiarTextoBase,
  carrCrearIdCarrera
};