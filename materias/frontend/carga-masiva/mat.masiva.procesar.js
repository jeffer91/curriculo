/*
Nombre del archivo: mat.masiva.procesar.js
Ubicación: C:\Users\ITSQMET\Desktop\desarrollo\Curriculo\materias\frontend\carga-masiva\mat.masiva.procesar.js
Función:
- Procesa el texto dentro del modal de carga masiva
- Genera la vista previa temporal
- Ejecuta validación antes de aplicar al editor
- Muestra estados útiles según advertencias y líneas descartadas
- Permite procesar con Ctrl + Enter
*/
(function (window, document) {
"use strict";

window.MAT = window.MAT || {};
var MAT = window.MAT;

MAT.masiva = MAT.masiva || {};
MAT.masiva.procesar = MAT.masiva.procesar || {};

function getModalInputValue() {
    var input = MAT.ui.modal.getInput();
    return input ? String(input.value || "") : "";
}

function buildStatusMessage(validation, analysis) {
    var parserWarnings = analysis &&
        analysis.meta &&
        Array.isArray(analysis.meta.warnings)
        ? analysis.meta.warnings
        : [];
    var discardedCount = analysis &&
        analysis.meta &&
        Array.isArray(analysis.meta.discarded)
        ? analysis.meta.discarded.length
        : 0;

    if (validation && !validation.ok) {
        return {
            text: validation.errors[0] || "La estructura no es válida.",
            type: "error"
        };
    }

    if (parserWarnings.length) {
        return {
            text: parserWarnings[0],
            type: "warn"
        };
    }

    if (validation && validation.warnings && validation.warnings.length) {
        return {
            text: validation.warnings[0],
            type: "warn"
        };
    }

    if (discardedCount > 0) {
        return {
            text: "Importación procesada correctamente. Se descartaron " + discardedCount + " líneas de encabezado o ruido.",
            type: "ok"
        };
    }

    return {
        text: "Importación procesada correctamente. Presiona Aplicar al editor.",
        type: "ok"
    };
}

function syncStateAfterProcess(raw, analysis, validation) {
    MAT.masiva.state.rawText = String(raw || "");
    MAT.masiva.state.preview = analysis || null;
    MAT.masiva.state.lastValidation = validation || null;

    if (MAT.state && typeof MAT.state.setRawText === "function") {
        MAT.state.setRawText(raw || "");
    }
}

MAT.masiva.procesar.run = function () {
    var raw = getModalInputValue();
    var analysis;
    var validation;
    var feedback;

    if (!MAT.state.data.selectedCareerId) {
        MAT.ui.modal.setStatus("Primero selecciona una carrera.", "warn");
        return null;
    }

    if (!MAT.state.data.selectedLoadType) {
        MAT.ui.modal.setStatus("Primero selecciona qué vas a subir.", "warn");
        return null;
    }

    if (!String(raw).trim()) {
        MAT.ui.modal.setStatus("Pega contenido antes de procesar.", "warn");
        MAT.ui.modal.setApplyEnabled(false);
        MAT.ui.clearPreview();
        return null;
    }

    analysis = MAT.main.analyzeRawText(
        raw,
        MAT.state.data.selectedLoadType,
        MAT.state.data.selectedCareerType
    );

    validation = MAT.validar.general.preview(
        analysis,
        MAT.state.data.selectedCareerType
    );

    syncStateAfterProcess(raw, analysis, validation);

    if (typeof MAT.ui.renderPreview === "function") {
        MAT.ui.renderPreview(analysis);
    }

    MAT.ui.modal.setApplyEnabled(!!validation.ok);

    feedback = buildStatusMessage(validation, analysis);
    MAT.ui.modal.setStatus(feedback.text, feedback.type);

    return {
        preview: analysis,
        validation: validation,
        feedback: feedback
    };
};

MAT.masiva.procesar.clear = function () {
    if (MAT.masiva && MAT.masiva.modal && typeof MAT.masiva.modal.resetTemp === "function") {
        MAT.masiva.modal.resetTemp();
    }

    if (MAT.state && typeof MAT.state.setRawText === "function") {
        MAT.state.setRawText("");
    }

    if (MAT.masiva && MAT.masiva.state) {
        MAT.masiva.state.lastValidation = null;
    }
};

MAT.masiva.procesar.bind = function () {
    var processButton = MAT.ui.getEl("processButton");
    var clearButton = MAT.ui.getEl("clearButton");
    var input = MAT.ui.modal.getInput();

    if (processButton && !processButton.__matBound) {
        processButton.addEventListener("click", function () {
            MAT.masiva.procesar.run();
        });
        processButton.__matBound = true;
    }

    if (clearButton && !clearButton.__matBound) {
        clearButton.addEventListener("click", function () {
            MAT.masiva.procesar.clear();
        });
        clearButton.__matBound = true;
    }

    if (input && !input.__matMassiveCtrlEnterBound) {
        input.addEventListener("keydown", function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                MAT.masiva.procesar.run();
            }
        });
        input.__matMassiveCtrlEnterBound = true;
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
        MAT.masiva.procesar.bind();
    });
} else {
    MAT.masiva.procesar.bind();
}

})(window, document);