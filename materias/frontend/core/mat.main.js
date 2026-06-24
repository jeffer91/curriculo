/*
Nombre del archivo: mat.main.js
Ubicación: C:\Users\ITSQMET\Desktop\desarrollo\Curriculo\materias\frontend\core\mat.main.js
Función:
- Orquesta el módulo completo
- Carga carreras desde Firebase
- Analiza texto para importación masiva
- Delega al parser inteligente de carga masiva
- Aplica importaciones al editor principal
- Valida y guarda en Firestore
- Carga un resumen compacto de la carrera al seleccionarla
*/
(function (window, document) {
"use strict";

window.MAT = window.MAT || {};
var MAT = window.MAT;

function safeClone(value) {
    try {
        return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
        return value || null;
    }
}

function toArray(value) {
    return Array.isArray(value) ? value.slice() : [];
}

function getExpectedEjes(careerType) {
    if (MAT.carreras && typeof MAT.carreras.getEjesEsperados === "function") {
        return MAT.carreras.getEjesEsperados(careerType || "");
    }
    return 4;
}

MAT.main = {
    init: function () {
        this.bindEvents();
        this.renderSelectors();
        this.setCareerTypeDisplay("");
        this.resetProcessedArea("Aquí podrás editar los datos después de importarlos o cargarlos desde Firebase.");

        if (typeof MAT.ui.clearCareerQuickSummary === "function") {
            MAT.ui.clearCareerQuickSummary("Selecciona una carrera para ver qué está cargado.");
        }

        this.boot();
    },

    bindEvents: function () {
        var refreshButton = MAT.ui.getEl("refreshButton");
        var saveButton = MAT.ui.getEl("saveButton");
        var careerSelect = MAT.selectores &&
            MAT.selectores.carreras &&
            MAT.selectores.carreras.getEl
            ? MAT.selectores.carreras.getEl()
            : null;
        var loadTypeSelect = MAT.selectores &&
            MAT.selectores.tipoCarga &&
            MAT.selectores.tipoCarga.getEl
            ? MAT.selectores.tipoCarga.getEl()
            : null;
        var self = this;

        if (refreshButton && !refreshButton.__matBoundMain) {
            refreshButton.addEventListener("click", function () {
                self.loadCareers();
            });
            refreshButton.__matBoundMain = true;
        }

        if (careerSelect && !careerSelect.__matBoundMain) {
            careerSelect.addEventListener("change", function (event) {
                self.onCareerChange(event.target.value);
            });
            careerSelect.__matBoundMain = true;
        }

        if (loadTypeSelect && !loadTypeSelect.__matBoundMain) {
            loadTypeSelect.addEventListener("change", function (event) {
                self.onLoadTypeChange(event.target.value);
            });
            loadTypeSelect.__matBoundMain = true;
        }

        if (saveButton && !saveButton.__matBoundMain) {
            saveButton.addEventListener("click", function () {
                self.handleSave();
            });
            saveButton.__matBoundMain = true;
        }
    },

    renderSelectors: function () {
        if (
            MAT.selectores &&
            MAT.selectores.tipoCarga &&
            typeof MAT.selectores.tipoCarga.render === "function"
        ) {
            MAT.selectores.tipoCarga.render();
        }

        if (
            MAT.selectores &&
            MAT.selectores.carreras &&
            typeof MAT.selectores.carreras.render === "function"
        ) {
            MAT.selectores.carreras.render([]);
        }
    },

    boot: function () {
        var db = MAT.firebase.init();

        if (!db) {
            MAT.ui.setStatus(
                "Falta configurar Firebase en mat.config.js. El módulo está armado, pero aún no puede leer carreras.",
                "warn"
            );
            return;
        }

        MAT.ui.clearSummary("Aún no has guardado cambios.");
        this.loadCareers();
    },

    loadCareers: async function () {
        var list = [];

        try {
            MAT.ui.setStatus("Cargando carreras desde Firebase...", "");
            list = await MAT.carreras.listar();
            MAT.state.setCareers(list);
            MAT.state.setReady(true);

            if (
                MAT.selectores &&
                MAT.selectores.carreras &&
                typeof MAT.selectores.carreras.render === "function"
            ) {
                MAT.selectores.carreras.render(list);
            }

            if (!list.length) {
                this.setCareerTypeDisplay("");
                this.resetProcessedArea("No se encontraron carreras.");
                MAT.ui.clearCareerQuickSummary("No hay carreras disponibles.");
                MAT.ui.setStatus("No se encontraron carreras en la colección.", "warn");
                return;
            }

            MAT.ui.setStatus("Carreras cargadas correctamente: " + list.length, "ok");
        } catch (error) {
            console.error(error);
            this.setCareerTypeDisplay("");
            MAT.ui.clearCareerQuickSummary("No se pudo cargar el resumen.");
            MAT.ui.setStatus("Ocurrió un error al leer carreras.", "error");
        }
    },

    onCareerChange: function (careerId) {
        var career = MAT.carreras.buscarLocal(careerId);
        var selectedId = String(careerId || "");

        if (!career) {
            MAT.state.clearCareer();
            this.setCareerTypeDisplay("");
            this.resetProcessedArea("Selecciona una carrera para continuar.");
            MAT.ui.clearCareerQuickSummary("Selecciona una carrera para ver qué está cargado.");
            MAT.ui.setStatus("Selecciona una carrera para continuar.", "");
            return;
        }

        MAT.state.setCareer(career);
        this.setCareerTypeDisplay(career.tipo || "");
        this.resetProcessedArea("La carrera cambió. Abre la carga masiva o espera la carga automática desde Firebase.");
        this.updateEditorHint();

        MAT.ui.setStatus(
            "Carrera seleccionada: " + career.nombre + (career.tipo ? " | " + career.tipo : ""),
            "ok"
        );

        this.loadCareerQuickSummary(selectedId, career);
    },

    loadCareerQuickSummary: async function (careerId, fallbackCareer) {
        var requestedId = String(careerId || "");
        var fullCareer = null;

        if (!requestedId) {
            MAT.ui.clearCareerQuickSummary("Selecciona una carrera para ver qué está cargado.");
            return;
        }

        if (
            MAT.ui.carreraSummary &&
            typeof MAT.ui.carreraSummary.renderLoading === "function"
        ) {
            MAT.ui.carreraSummary.renderLoading();
        } else {
            MAT.ui.clearCareerQuickSummary("Revisando carga...");
        }

        try {
            if (MAT.carreras && typeof MAT.carreras.leerUna === "function") {
                fullCareer = await MAT.carreras.leerUna(requestedId);
            }

            if (!this.isSelectedCareer(requestedId)) {
                return;
            }

            if (!fullCareer || typeof fullCareer !== "object") {
                fullCareer = fallbackCareer || {};
            }

            if (
                MAT.ui.carreraSummary &&
                typeof MAT.ui.carreraSummary.render === "function"
            ) {
                MAT.ui.carreraSummary.render(fullCareer);
            } else {
                MAT.ui.clearCareerQuickSummary("Resumen disponible.");
            }
        } catch (error) {
            console.error(error);

            if (!this.isSelectedCareer(requestedId)) {
                return;
            }

            if (
                MAT.ui.carreraSummary &&
                typeof MAT.ui.carreraSummary.renderError === "function"
            ) {
                MAT.ui.carreraSummary.renderError();
            } else {
                MAT.ui.clearCareerQuickSummary("No se pudo leer el resumen.");
            }
        }
    },

    isSelectedCareer: function (careerId) {
        var currentId = MAT.state && MAT.state.data ? MAT.state.data.selectedCareerId : "";
        return String(currentId || "") === String(careerId || "");
    },

    onLoadTypeChange: function (value) {
        MAT.state.setLoadType(value);
        this.resetProcessedArea("El tipo de carga cambió. Abre la carga masiva o espera la carga automática desde Firebase.");
        this.updateEditorHint();
    },

    updateEditorHint: function () {
        var type = MAT.state.data.selectedLoadType;
        var text = "Primero elige una carrera y luego el tipo de carga. Después usa el botón Abrir carga masiva.";

        if (type === "materias-carrera") {
            text = "Usa el botón Abrir carga masiva. Puedes pegar bloques con Nivel 1, 1 Nivel, tablas copiadas desde PDF o Word y el sistema intentará limpiar encabezados y numeración.";
        } else if (type === "transversales") {
            text = "Usa el botón Abrir carga masiva. Puedes pegar materias con nivel o sin nivel.";
        } else if (type === "nucleos") {
            text = "Usa el botón Abrir carga masiva. Deben ser 4 núcleos.";
        } else if (type === "ejes") {
            text = "Usa el botón Abrir carga masiva. Si la carrera es universitaria se esperan 6. Si es superior o técnica, 4.";
        }

        MAT.ui.setEditorHint(text);
    },

    setCareerTypeDisplay: function (value) {
        var input = MAT.ui.getEl("careerTypeDisplay");
        var text = String(value || "").trim();

        if (!input) {
            return;
        }

        input.value = text || "Sin seleccionar";
    },

    resetProcessedArea: function (editorMessage) {
        MAT.state.clearPreview();
        MAT.state.setDirty(false);
        MAT.ui.clearPreview();
        MAT.ui.setSaveEnabled(false);

        if (
            MAT.editor &&
            MAT.editor.base &&
            typeof MAT.editor.base.renderEmpty === "function"
        ) {
            MAT.editor.base.renderEmpty(
                editorMessage || "Aquí podrás editar los datos después de importarlos."
            );
        }

        if (
            MAT.tabla &&
            MAT.tabla.render &&
            typeof MAT.tabla.render.empty === "function"
        ) {
            MAT.tabla.render.empty(
                editorMessage || "Aún no hay datos para mostrar."
            );
        }

        if (
            MAT.masiva &&
            MAT.masiva.modal &&
            typeof MAT.masiva.modal.resetTemp === "function"
        ) {
            MAT.masiva.modal.resetTemp();
        }
    },

    applyImportedPreview: function (analysis) {
        var validation;

        if (!analysis || typeof analysis !== "object") {
            MAT.ui.setStatus("No hay una importación válida para aplicar.", "warn");
            return null;
        }

        validation = MAT.validar.general.preview(
            analysis,
            MAT.state.data.selectedCareerType
        );

        MAT.state.setPreview(analysis);
        MAT.state.setDirty(true);

        if (
            MAT.editor &&
            MAT.editor.base &&
            typeof MAT.editor.base.renderFromPreview === "function"
        ) {
            MAT.editor.base.renderFromPreview(
                analysis,
                MAT.state.data.selectedCareerType
            );
        }

        if (
            MAT.tabla &&
            MAT.tabla.render &&
            typeof MAT.tabla.render.fromPreview === "function"
        ) {
            MAT.tabla.render.fromPreview(
                analysis,
                MAT.state.data.selectedCareerType,
                {
                    source: "importado",
                    title: "Datos del bloque actual"
                }
            );
        }

        MAT.ui.setSaveEnabled(!!validation.ok);

        if (
            MAT.ui.resumen &&
            typeof MAT.ui.resumen.renderValidation === "function"
        ) {
            MAT.ui.resumen.renderValidation(validation);
        }

        if (!validation.ok) {
            MAT.ui.setStatus(
                validation.errors[0] || "La estructura no es válida.",
                "error"
            );
            return {
                preview: analysis,
                validation: validation
            };
        }

        if (validation.warnings.length) {
            MAT.ui.setStatus(
                "Importación aplicada con advertencias. Revisa el resumen.",
                "warn"
            );
            return {
                preview: analysis,
                validation: validation
            };
        }

        MAT.ui.setStatus(
            "Importación aplicada correctamente. Ahora puedes revisar y guardar.",
            "ok"
        );

        return {
            preview: analysis,
            validation: validation
        };
    },

    processMassiveText: function () {
        if (
            MAT.masiva &&
            MAT.masiva.procesar &&
            typeof MAT.masiva.procesar.run === "function"
        ) {
            return MAT.masiva.procesar.run();
        }
        return null;
    },

    clearMassiveText: function () {
        if (
            MAT.masiva &&
            MAT.masiva.procesar &&
            typeof MAT.masiva.procesar.clear === "function"
        ) {
            MAT.masiva.procesar.clear();
        }
    },

    handleSave: async function () {
        var editedPreview;
        var validation;
        var result;

        if (!MAT.state.data.preview) {
            MAT.ui.setStatus(
                "Primero importa, edita o carga un bloque antes de guardar.",
                "warn"
            );
            return null;
        }

        editedPreview = MAT.editor.base.collectPreview(MAT.state.data.preview);

        validation = MAT.validar.general.beforeSave({
            careerId: MAT.state.data.selectedCareerId,
            loadType: MAT.state.data.selectedLoadType,
            preview: editedPreview,
            careerType: MAT.state.data.selectedCareerType
        });

        if (
            MAT.ui.resumen &&
            typeof MAT.ui.resumen.renderValidation === "function"
        ) {
            MAT.ui.resumen.renderValidation(validation);
        }

        if (!validation.ok) {
            MAT.ui.setStatus(
                validation.errors[0] || "Hay errores que bloquean el guardado.",
                "error"
            );
            return null;
        }

        try {
            MAT.ui.setStatus("Guardando cambios en Firebase...", "");

            result = await MAT.carga.guardar({
                careerId: MAT.state.data.selectedCareerId,
                preview: editedPreview
            });

            MAT.state.setPreview(editedPreview);
            MAT.state.setDirty(false);
            this.updateLocalCareer(result.updated);

            if (
                MAT.ui.resumen &&
                typeof MAT.ui.resumen.renderSaveResult === "function"
            ) {
                MAT.ui.resumen.renderSaveResult(result);
            }

            if (
                MAT.tabla &&
                MAT.tabla.render &&
                typeof MAT.tabla.render.fromPreview === "function"
            ) {
                MAT.tabla.render.fromPreview(
                    editedPreview,
                    MAT.state.data.selectedCareerType,
                    {
                        source: "guardado",
                        title: "Datos del bloque actual"
                    }
                );
            }

            this.loadCareerQuickSummary(MAT.state.data.selectedCareerId);

            if (result.warnings && result.warnings.length) {
                MAT.ui.setStatus(
                    "Cambios guardados con advertencias. Revisa el resumen.",
                    "warn"
                );
                return result;
            }

            MAT.ui.setStatus("Cambios guardados correctamente.", "ok");
            return result;
        } catch (error) {
            console.error(error);
            MAT.ui.setStatus("Ocurrió un error al guardar en Firebase.", "error");
            return null;
        }
    },

    updateLocalCareer: function (updatedDoc) {
        var list = MAT.state.data.careers || [];
        var id = String((updatedDoc && updatedDoc.id) || "");
        var i;

        if (!id) {
            return;
        }

        for (i = 0; i < list.length; i += 1) {
            if (String(list[i].id || "") === id) {
                list[i].nombre = String(updatedDoc.nombre || list[i].nombre || "");
                list[i].tipo = String(updatedDoc.tipo || list[i].tipo || "");
                list[i].estado = String(updatedDoc.estado || list[i].estado || "");
                break;
            }
        }
    },

    analyzeRawText: function (raw, loadType, careerType) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;
        var options;
        var lines;
        var response;

        options = {
            loadType: String(loadType || ""),
            careerType: String(careerType || ""),
            careerName: String(
                MAT.state && MAT.state.data ? MAT.state.data.selectedCareerName : ""
            ),
            expected: loadType === "nucleos"
                ? 4
                : (loadType === "ejes" ? getExpectedEjes(careerType) : 0)
        };

        if (parser && typeof parser.analyze === "function") {
            return parser.analyze(raw, options);
        }

        lines = this.cleanLines(raw);

        response = {
            kind: String(loadType || ""),
            totalLines: lines.length,
            rawLines: lines.slice(),
            summary: {},
            careerType: String(careerType || ""),
            meta: {
                parser: "fallback-main-parser",
                accepted: lines.slice(),
                discarded: [],
                warnings: []
            }
        };

        if (loadType === "materias-carrera") {
            response.summary = this.detectByLevels(lines);
        } else if (loadType === "transversales") {
            response.summary = this.detectTransversales(lines);
        } else if (loadType === "nucleos") {
            response.summary = this.detectFlatList(lines, 4);
        } else if (loadType === "ejes") {
            response.summary = this.detectEjes(lines, careerType);
        } else {
            response.summary = { items: lines.slice() };
        }

        return response;
    },

    cleanLines: function (raw) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;

        if (parser && typeof parser.cleanLines === "function") {
            return parser.cleanLines(raw);
        }

        return String(raw || "")
            .split(/\r?\n/)
            .map(function (line) {
                return String(line || "").replace(/\t/g, " ").trim();
            })
            .filter(function (line) {
                return !!line;
            });
    },

    stripListPrefix: function (text) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;

        if (parser && typeof parser.stripListPrefix === "function") {
            return parser.stripListPrefix(text);
        }

        return String(text || "")
            .replace(/^\d+\s*[\.\-\)]\s*/, "")
            .replace(/^[\-\*\•]\s*/, "")
            .trim();
    },

    extractLevelLine: function (text) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;

        if (parser && typeof parser.extractLevelLine === "function") {
            return parser.extractLevelLine(text);
        }

        return {
            level: "",
            text: this.stripListPrefix(text)
        };
    },

    detectByLevels: function (lines) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;
        var result;
        var currentLevel = "";
        var levels = {
            nivel1: [],
            nivel2: [],
            nivel3: [],
            nivel4: [],
            sinNivel: []
        };
        var i;
        var info;

        if (parser && typeof parser.parseMateriasCarrera === "function") {
            result = parser.parseMateriasCarrera(lines, {
                loadType: "materias-carrera",
                careerType: String(MAT.state.data.selectedCareerType || ""),
                careerName: String(MAT.state.data.selectedCareerName || "")
            });

            return safeClone(result.summary || levels);
        }

        for (i = 0; i < lines.length; i += 1) {
            info = this.extractLevelLine(lines[i]);

            if (info.level) {
                currentLevel = "nivel" + info.level;
                if (info.text) {
                    levels[currentLevel].push(info.text);
                }
                continue;
            }

            if (currentLevel && levels[currentLevel]) {
                levels[currentLevel].push(info.text);
            } else {
                levels.sinNivel.push(info.text);
            }
        }

        return levels;
    },

    detectTransversales: function (lines) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;
        var result;
        var levels = {
            nivel1: [],
            nivel2: [],
            nivel3: [],
            nivel4: [],
            sinNivel: []
        };
        var i;
        var info;

        if (parser && typeof parser.parseTransversales === "function") {
            result = parser.parseTransversales(lines, {
                loadType: "transversales",
                careerType: String(MAT.state.data.selectedCareerType || ""),
                careerName: String(MAT.state.data.selectedCareerName || "")
            });

            return safeClone(result.summary || levels);
        }

        for (i = 0; i < lines.length; i += 1) {
            info = this.extractLevelLine(lines[i]);

            if (info.level) {
                if (info.text) {
                    levels["nivel" + info.level].push(info.text);
                }
                continue;
            }

            levels.sinNivel.push(info.text);
        }

        return levels;
    },

    detectFlatList: function (lines, expected) {
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;
        var result;

        if (parser && typeof parser.parseFlatList === "function") {
            result = parser.parseFlatList(lines, "flat", expected, {
                careerType: String(MAT.state.data.selectedCareerType || ""),
                careerName: String(MAT.state.data.selectedCareerName || "")
            });

            return {
                expected: Number(expected || 0),
                total: result && result.summary ? Number(result.summary.total || 0) : 0,
                items: result && result.summary ? toArray(result.summary.items) : []
            };
        }

        return {
            expected: Number(expected || 0),
            total: lines.length,
            items: lines.map(this.stripListPrefix.bind(this))
        };
    },

    detectEjes: function (lines, careerType) {
        var expected = getExpectedEjes(careerType);
        var parser = MAT.masiva && MAT.masiva.parser ? MAT.masiva.parser : null;
        var result;

        if (parser && typeof parser.parseFlatList === "function") {
            result = parser.parseFlatList(lines, "ejes", expected, {
                careerType: String(careerType || ""),
                careerName: String(MAT.state.data.selectedCareerName || "")
            });

            return {
                expected: expected,
                total: result && result.summary ? Number(result.summary.total || 0) : 0,
                items: result && result.summary ? toArray(result.summary.items) : []
            };
        }

        return {
            expected: expected,
            total: lines.length,
            items: lines.map(this.stripListPrefix.bind(this))
        };
    }
};

document.addEventListener("DOMContentLoaded", function () {
    MAT.main.init();
});

})(window, document);