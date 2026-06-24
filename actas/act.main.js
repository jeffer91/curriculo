/*
Nombre completo: act.main.js
Ruta o ubicación: /actas/act.main.js
Función o funciones:
- Inicializar el módulo de actas
- Cargar catálogos base
- Registrar eventos principales
- Cargar datos de ficha y PEA
- Guardar y exportar actas
*/

import {
  actCreateInitialState,
  actSetCatalogos,
  actSetSeleccion,
  actSetFichaData,
  actSetPeaData,
  actSetActaDraft,
  actResetState
} from "./act.state.js";
import {
  actUiBindCatalogos,
  actUiReadSeleccion,
  actUiFillForm,
  actUiReadForm,
  actUiSetEstado,
  actUiRenderResumenBase,
  actUiRenderPreview,
  actUiSetFichaRelacionada,
  actUiResetAll
} from "./act.ui.js";
import {
  actServiceGetCatalogos,
  actServiceLoadContextoActa,
  actServiceSaveActa
} from "./act.service.js";
import { actMapperBuildDraft } from "./act.mapper.js";
import { actTemplateBuildPreview } from "./act.template.js";
import {
  actExportJson,
  actExportText
} from "./act.export.js";

let actState = actCreateInitialState();

async function actLoadCatalogos() {
  try {
    const catalogos = await actServiceGetCatalogos();
    actState = actSetCatalogos(actState, catalogos);
    actUiBindCatalogos(actState.catalogos);
  } catch (error) {
    console.error("[act] Error al cargar catálogos:", error);
    actUiSetEstado("No se pudieron cargar los catálogos base.", "error");
  }
}

function actSyncUi() {
  actUiFillForm(actState.actaDraft);
  actUiRenderResumenBase({
    fichaData: actState.fichaData,
    peaData: actState.peaData
  });
  actUiSetFichaRelacionada(actState.fichaData?.key || "");
  actUiRenderPreview(
    actTemplateBuildPreview(actState.actaDraft, actState.fichaData, actState.peaData)
  );
}

async function actHandleCargar() {
  try {
    const seleccion = actUiReadSeleccion();
    actState = actSetSeleccion(actState, seleccion);

    if (!seleccion.carreraId || !seleccion.nivelId || !seleccion.materiaId) {
      actUiSetEstado("Debe seleccionar carrera, nivel y materia.", "error");
      return;
    }

    actUiSetEstado("Cargando información base para el acta...");
    const contexto = await actServiceLoadContextoActa(seleccion);

    actState = actSetFichaData(actState, contexto.fichaData);
    actState = actSetPeaData(actState, contexto.peaData);
    actState = actSetActaDraft(
      actState,
      actMapperBuildDraft({
        seleccion,
        fichaData: contexto.fichaData,
        peaData: contexto.peaData
      })
    );

    actSyncUi();
    actUiSetEstado("Datos base cargados correctamente.", "ok");
  } catch (error) {
    console.error("[act] Error al cargar contexto del acta:", error);
    actUiSetEstado("No se pudo cargar la ficha o los datos base.", "error");
  }
}

async function actHandleGuardar(event) {
  event.preventDefault();

  try {
    const formData = actUiReadForm();
    actState = actSetActaDraft(actState, formData);

    const resultado = await actServiceSaveActa({
      seleccion: actState.seleccion,
      acta: actState.actaDraft,
      fichaData: actState.fichaData,
      peaData: actState.peaData
    });

    actUiRenderPreview(
      actTemplateBuildPreview(actState.actaDraft, actState.fichaData, actState.peaData)
    );
    actUiSetEstado(
      resultado?.mensaje || "Acta guardada correctamente.",
      "ok"
    );
  } catch (error) {
    console.error("[act] Error al guardar acta:", error);
    actUiSetEstado("No se pudo guardar el acta.", "error");
  }
}

function actHandleExportarJson() {
  try {
    const formData = actUiReadForm();
    actState = actSetActaDraft(actState, formData);
    actExportJson(actState);
    actUiSetEstado("Acta exportada en JSON.", "ok");
  } catch (error) {
    console.error("[act] Error al exportar JSON:", error);
    actUiSetEstado("No se pudo exportar el JSON.", "error");
  }
}

function actHandleExportarTxt() {
  try {
    const formData = actUiReadForm();
    actState = actSetActaDraft(actState, formData);
    actExportText(actState);
    actUiSetEstado("Acta exportada en TXT.", "ok");
  } catch (error) {
    console.error("[act] Error al exportar TXT:", error);
    actUiSetEstado("No se pudo exportar el TXT.", "error");
  }
}

function actHandleLimpiar() {
  actState = actResetState(actState);
  actUiResetAll();
  actUiBindCatalogos(actState.catalogos);
  actUiSetEstado("Pantalla reiniciada.");
}

function actRegisterEvents() {
  const btnCargar = document.getElementById("actBtnCargar");
  const btnLimpiar = document.getElementById("actBtnLimpiar");
  const form = document.getElementById("actForm");
  const btnExportarJson = document.getElementById("actBtnExportarJson");
  const btnExportarTxt = document.getElementById("actBtnExportarTxt");

  if (btnCargar) {
    btnCargar.addEventListener("click", actHandleCargar);
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", actHandleLimpiar);
  }

  if (form) {
    form.addEventListener("submit", actHandleGuardar);
    form.addEventListener("input", () => {
      const formData = actUiReadForm();
      actState = actSetActaDraft(actState, formData);
      actUiRenderPreview(
        actTemplateBuildPreview(actState.actaDraft, actState.fichaData, actState.peaData)
      );
    });
  }

  if (btnExportarJson) {
    btnExportarJson.addEventListener("click", actHandleExportarJson);
  }

  if (btnExportarTxt) {
    btnExportarTxt.addEventListener("click", actHandleExportarTxt);
  }
}

async function actInit() {
  actRegisterEvents();
  await actLoadCatalogos();
  actSyncUi();
  actUiSetEstado("Módulo de actas listo.");
}

document.addEventListener("DOMContentLoaded", actInit);