/*
Nombre completo: fch.main.js
Ruta o ubicación: /fichas/fch.main.js
Función o funciones:
- Inicializar el módulo de fichas
- Cargar selectores base
- Registrar eventos principales
- Sincronizar formulario, vista previa y estado
- Guardar y exportar fichas
*/

import {
  fchCreateInitialState,
  fchSetCatalogos,
  fchSetSeleccion,
  fchSetPeaData,
  fchSetFichaDraft,
  fchResetState
} from "./fch.state.js";
import {
  fchUiBindCatalogos,
  fchUiReadSeleccion,
  fchUiFillForm,
  fchUiReadForm,
  fchUiSetEstado,
  fchUiRenderResumenBase,
  fchUiRenderPreview,
  fchUiResetAll
} from "./fch.ui.js";
import {
  fchServiceGetCatalogos,
  fchServiceLoadPeaData,
  fchServiceSaveFicha
} from "./fch.service.js";
import { fchMapperBuildDraftFromPea } from "./fch.mapper.js";
import { fchTemplateBuildPreview } from "./fch.template.js";
import {
  fchExportJson,
  fchExportText
} from "./fch.export.js";

let fchState = fchCreateInitialState();

async function fchLoadCatalogos() {
  try {
    const catalogos = await fchServiceGetCatalogos();
    fchState = fchSetCatalogos(fchState, catalogos);
    fchUiBindCatalogos(fchState.catalogos);
  } catch (error) {
    console.error("[fch] Error al cargar catálogos:", error);
    fchUiSetEstado("No se pudieron cargar los catálogos base.", "error");
  }
}

function fchSyncUi() {
  fchUiFillForm(fchState.fichaDraft);
  fchUiRenderResumenBase(fchState.peaData);
  fchUiRenderPreview(fchTemplateBuildPreview(fchState.fichaDraft, fchState.peaData));
}

async function fchHandleCargarDesdePea() {
  try {
    const seleccion = fchUiReadSeleccion();
    fchState = fchSetSeleccion(fchState, seleccion);

    if (!seleccion.carreraId || !seleccion.nivelId || !seleccion.materiaId) {
      fchUiSetEstado("Debe seleccionar carrera, nivel y materia.", "error");
      return;
    }

    fchUiSetEstado("Cargando información desde PEA...");
    const peaData = await fchServiceLoadPeaData(seleccion);
    fchState = fchSetPeaData(fchState, peaData);

    const draft = fchMapperBuildDraftFromPea({
      seleccion,
      peaData
    });

    fchState = fchSetFichaDraft(fchState, draft);
    fchSyncUi();
    fchUiSetEstado("Datos base cargados correctamente.", "ok");
  } catch (error) {
    console.error("[fch] Error al cargar desde PEA:", error);
    fchUiSetEstado("No se pudo cargar la información de PEA.", "error");
  }
}

async function fchHandleGuardar(event) {
  event.preventDefault();

  try {
    const formData = fchUiReadForm();
    fchState = fchSetFichaDraft(fchState, formData);

    const resultado = await fchServiceSaveFicha({
      seleccion: fchState.seleccion,
      ficha: fchState.fichaDraft,
      peaData: fchState.peaData
    });

    fchUiRenderPreview(fchTemplateBuildPreview(fchState.fichaDraft, fchState.peaData));
    fchUiSetEstado(
      resultado?.mensaje || "Ficha guardada correctamente.",
      "ok"
    );
  } catch (error) {
    console.error("[fch] Error al guardar ficha:", error);
    fchUiSetEstado("No se pudo guardar la ficha.", "error");
  }
}

function fchHandleExportarJson() {
  try {
    const formData = fchUiReadForm();
    fchState = fchSetFichaDraft(fchState, formData);
    fchExportJson(fchState);
    fchUiSetEstado("Ficha exportada en JSON.", "ok");
  } catch (error) {
    console.error("[fch] Error al exportar JSON:", error);
    fchUiSetEstado("No se pudo exportar el JSON.", "error");
  }
}

function fchHandleExportarTxt() {
  try {
    const formData = fchUiReadForm();
    fchState = fchSetFichaDraft(fchState, formData);
    fchExportText(fchState);
    fchUiSetEstado("Ficha exportada en TXT.", "ok");
  } catch (error) {
    console.error("[fch] Error al exportar TXT:", error);
    fchUiSetEstado("No se pudo exportar el TXT.", "error");
  }
}

function fchHandleLimpiar() {
  fchState = fchResetState(fchState);
  fchUiResetAll();
  fchUiBindCatalogos(fchState.catalogos);
  fchUiSetEstado("Pantalla reiniciada.");
}

function fchRegisterEvents() {
  const btnCargar = document.getElementById("fchBtnCargar");
  const btnLimpiar = document.getElementById("fchBtnLimpiar");
  const form = document.getElementById("fchForm");
  const btnExportarJson = document.getElementById("fchBtnExportarJson");
  const btnExportarTxt = document.getElementById("fchBtnExportarTxt");

  if (btnCargar) {
    btnCargar.addEventListener("click", fchHandleCargarDesdePea);
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", fchHandleLimpiar);
  }

  if (form) {
    form.addEventListener("submit", fchHandleGuardar);
    form.addEventListener("input", () => {
      const formData = fchUiReadForm();
      fchState = fchSetFichaDraft(fchState, formData);
      fchUiRenderPreview(fchTemplateBuildPreview(fchState.fichaDraft, fchState.peaData));
    });
  }

  if (btnExportarJson) {
    btnExportarJson.addEventListener("click", fchHandleExportarJson);
  }

  if (btnExportarTxt) {
    btnExportarTxt.addEventListener("click", fchHandleExportarTxt);
  }
}

async function fchInit() {
  fchRegisterEvents();
  await fchLoadCatalogos();
  fchSyncUi();
  fchUiSetEstado("Módulo de fichas listo.");
}

document.addEventListener("DOMContentLoaded", fchInit);