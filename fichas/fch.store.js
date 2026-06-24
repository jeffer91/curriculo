/*
Nombre completo: fch.store.js
Ruta o ubicación: /fichas/fch.store.js
Función o funciones:
- Construir claves únicas de guardado
- Guardar fichas en localStorage
- Leer una ficha guardada
- Mantener el almacenamiento centralizado del módulo
*/

const FCH_STORAGE_PREFIX = "curriculo_ficha_";

function fchSafeText(value) {
  return String(value ?? "").trim();
}

function fchStoreBuildKey(parts) {
  const carreraId = fchSafeText(parts?.carreraId);
  const nivelId = fchSafeText(parts?.nivelId);
  const materiaId = fchSafeText(parts?.materiaId);

  if (!carreraId || !nivelId || !materiaId) {
    return "";
  }

  return `${carreraId}__${nivelId}__${materiaId}`;
}

function fchStoreSaveFicha(record) {
  const key = fchSafeText(record?.key);
  if (!key) {
    throw new Error("No se puede guardar una ficha sin clave.");
  }

  localStorage.setItem(
    `${FCH_STORAGE_PREFIX}${key}`,
    JSON.stringify(record)
  );
}

function fchStoreReadFicha(key) {
  const safeKey = fchSafeText(key);
  if (!safeKey) {
    return null;
  }

  const raw = localStorage.getItem(`${FCH_STORAGE_PREFIX}${safeKey}`);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[fch] Error al leer ficha guardada:", error);
    return null;
  }
}

export {
  FCH_STORAGE_PREFIX,
  fchStoreBuildKey,
  fchStoreSaveFicha,
  fchStoreReadFicha
};