/*
Nombre completo: act.store.js
Ruta o ubicación: /actas/act.store.js
Función o funciones:
- Construir claves únicas del acta
- Guardar y leer actas en localStorage
- Centralizar el almacenamiento del módulo
*/

const ACT_STORAGE_PREFIX = "curriculo_acta_";

function actSafeText(value) {
  return String(value ?? "").trim();
}

function actStoreBuildKey(parts) {
  const carreraId = actSafeText(parts?.carreraId);
  const nivelId = actSafeText(parts?.nivelId);
  const materiaId = actSafeText(parts?.materiaId);

  if (!carreraId || !nivelId || !materiaId) {
    return "";
  }

  return `${carreraId}__${nivelId}__${materiaId}`;
}

function actStoreSaveActa(record) {
  const key = actSafeText(record?.key);
  if (!key) {
    throw new Error("No se puede guardar un acta sin clave.");
  }

  localStorage.setItem(
    `${ACT_STORAGE_PREFIX}${key}`,
    JSON.stringify(record)
  );
}

function actStoreReadActa(key) {
  const safeKey = actSafeText(key);
  if (!safeKey) {
    return null;
  }

  const raw = localStorage.getItem(`${ACT_STORAGE_PREFIX}${safeKey}`);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[act] Error al leer acta guardada:", error);
    return null;
  }
}

export {
  ACT_STORAGE_PREFIX,
  actStoreBuildKey,
  actStoreSaveActa,
  actStoreReadActa
};