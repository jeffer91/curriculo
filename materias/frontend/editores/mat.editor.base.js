/*
Nombre del archivo: mat.editor.base.js
Ubicación: C:\Users\ITSQMET\Desktop\eventos\materias\frontend\editores\mat.editor.base.js
Función:
- Renderiza el editor real según la vista previa
- Usa acordeones por bloque
- Muestra una materia por campo
- Permite agregar y quitar filas
- Devuelve una vista previa actualizada antes de guardar
*/

(function (window, document) {
  "use strict";

  window.MAT = window.MAT || {};
  var MAT = window.MAT;

  MAT.editor = MAT.editor || {};
  MAT.editor.base = MAT.editor.base || {};

  function esc(value) {
    return (MAT.ui && typeof MAT.ui.escapeHtml === "function")
      ? MAT.ui.escapeHtml(value)
      : String(value || "");
  }

  function cloneDeep(value) {
    try {
      return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
      return value || null;
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function markDirty() {
    if (MAT.state && typeof MAT.state.setDirty === "function") {
      MAT.state.setDirty(true);
    }
  }

  function findClosest(el, selector) {
    while (el && el.nodeType === 1) {
      if (typeof el.matches === "function" && el.matches(selector)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function getRenderList(list) {
    var items = toArray(list).map(function (item) {
      return String(item || "");
    });

    if (!items.length) {
      items.push("");
    }

    return items;
  }

  function countPreviewItems(preview) {
    var kind = String((preview && preview.kind) || "").trim();
    var summary = (preview && preview.summary) || {};

    if (kind === "materias-carrera" || kind === "transversales") {
      return (
        toArray(summary.nivel1).length +
        toArray(summary.nivel2).length +
        toArray(summary.nivel3).length +
        toArray(summary.nivel4).length +
        toArray(summary.sinNivel).length
      );
    }

    return toArray(summary.items).length;
  }

  function flattenPreviewItems(preview) {
    var kind = String((preview && preview.kind) || "").trim();
    var summary = (preview && preview.summary) || {};

    if (kind === "materias-carrera" || kind === "transversales") {
      return []
        .concat(toArray(summary.nivel1))
        .concat(toArray(summary.nivel2))
        .concat(toArray(summary.nivel3))
        .concat(toArray(summary.nivel4))
        .concat(toArray(summary.sinNivel));
    }

    return toArray(summary.items).slice();
  }

  function getFilledValuesFromList(listEl) {
    var inputs;
    var values = [];
    var i;
    var text;

    if (!listEl) {
      return values;
    }

    inputs = listEl.querySelectorAll("[data-mat-editor-part]");

    for (i = 0; i < inputs.length; i += 1) {
      text = normalizeText(inputs[i].value);
      if (text) {
        values.push(text);
      }
    }

    return values;
  }

  function getCountText(total, singular, plural) {
    if (!total) {
      return "sin datos";
    }

    return total + " " + (total === 1 ? singular : plural);
  }

  function updateBlockMeta(blockEl) {
    var listEl;
    var countEl;
    var values;
    var singular;
    var plural;

    if (!blockEl) return;

    listEl = blockEl.querySelector("[data-mat-list]");
    countEl = blockEl.querySelector("[data-mat-count]");

    if (!listEl || !countEl) return;

    values = getFilledValuesFromList(listEl);
    singular = String(blockEl.getAttribute("data-mat-unit-singular") || "item");
    plural = String(blockEl.getAttribute("data-mat-unit-plural") || "items");

    countEl.textContent = getCountText(values.length, singular, plural);
  }

  function updateAllBlockMeta(rootEl) {
    var blocks;
    var i;

    if (!rootEl) return;

    blocks = rootEl.querySelectorAll("[data-mat-block]");

    for (i = 0; i < blocks.length; i += 1) {
      updateBlockMeta(blocks[i]);
    }
  }

  function reindexList(listEl) {
    var rows;
    var i;
    var badge;

    if (!listEl) return;

    rows = listEl.querySelectorAll(".mat-editor-item");

    for (i = 0; i < rows.length; i += 1) {
      badge = rows[i].querySelector(".mat-editor-item-index");
      if (badge) {
        badge.textContent = String(i + 1);
      }
    }
  }

  function buildItemRow(part, value, index, placeholder) {
    var html = "";

    html += '<div class="mat-editor-item">';
    html +=   '<span class="mat-editor-item-index">' + esc(String(index)) + "</span>";
    html +=   '<input';
    html +=     ' type="text"';
    html +=     ' class="mat-editor-item-input"';
    html +=     ' data-mat-editor-part="' + esc(part) + '"';
    html +=     ' value="' + esc(value || "") + '"';
    html +=     ' placeholder="' + esc(placeholder || "") + '"';
    html +=   ">";
    html +=   '<button type="button" class="mat-editor-item-remove" data-mat-remove-item="' + esc(part) + '">Quitar</button>';
    html += "</div>";

    return html;
  }

  function buildAccordionBlock(options) {
    var items = getRenderList(options.items);
    var singular = String(options.unitSingular || "item");
    var plural = String(options.unitPlural || "items");
    var initialFilled = toArray(options.items).filter(function (item) {
      return !!normalizeText(item);
    }).length;
    var html = "";
    var i;

    html += '<details class="mat-editor-accordion"';
    html += ' data-mat-block="' + esc(options.part) + '"';
    html += ' data-mat-unit-singular="' + esc(singular) + '"';
    html += ' data-mat-unit-plural="' + esc(plural) + '"';

    if (options.open) {
      html += " open";
    }

    html += ">";

    html +=   '<summary class="mat-editor-summary">';
    html +=     '<span class="mat-editor-summary-main">' + esc(options.label) + "</span>";
    html +=     '<span class="mat-editor-summary-count" data-mat-count="' + esc(options.part) + '">';
    html +=       esc(getCountText(initialFilled, singular, plural));
    html +=     "</span>";
    html +=   "</summary>";

    html +=   '<div class="mat-editor-panel">';

    if (options.helperText) {
      html += '<div class="mat-editor-helper">' + esc(options.helperText) + "</div>";
    }

    html += '<div class="mat-editor-list" data-mat-list="' + esc(options.part) + '" data-mat-placeholder="' + esc(options.placeholder || "") + '">';

    for (i = 0; i < items.length; i += 1) {
      html += buildItemRow(options.part, items[i], i + 1, options.placeholder);
    }

    html += "</div>";

    html += '<div class="mat-editor-inline-actions">';
    html +=   '<button type="button" class="mat-editor-add" data-mat-add-item="' + esc(options.part) + '">';
    html +=     esc(options.addLabel || "Agregar");
    html +=   "</button>";
    html += "</div>";

    html +=   "</div>";
    html += "</details>";

    return html;
  }

  function createItemNode(part, value, index, placeholder) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = buildItemRow(part, value, index, placeholder);
    return wrapper.firstChild;
  }

  function handleAddAction(button) {
    var blockEl;
    var listEl;
    var placeholder;
    var part;
    var rowNode;
    var input;

    blockEl = findClosest(button, "[data-mat-block]");
    listEl = blockEl ? blockEl.querySelector("[data-mat-list]") : null;

    if (!blockEl || !listEl) return;

    part = String(button.getAttribute("data-mat-add-item") || "");
    placeholder = String(listEl.getAttribute("data-mat-placeholder") || "");

    rowNode = createItemNode(
      part,
      "",
      listEl.querySelectorAll(".mat-editor-item").length + 1,
      placeholder
    );

    listEl.appendChild(rowNode);
    reindexList(listEl);
    updateBlockMeta(blockEl);
    markDirty();

    input = rowNode.querySelector("[data-mat-editor-part]");
    if (input && typeof input.focus === "function") {
      input.focus();
    }
  }

  function handleRemoveAction(button) {
    var rowEl;
    var listEl;
    var blockEl;
    var rows;
    var input;

    rowEl = findClosest(button, ".mat-editor-item");
    listEl = rowEl ? rowEl.parentElement : null;
    blockEl = listEl ? findClosest(listEl, "[data-mat-block]") : null;

    if (!rowEl || !listEl || !blockEl) return;

    rows = listEl.querySelectorAll(".mat-editor-item");

    if (rows.length <= 1) {
      input = rowEl.querySelector("[data-mat-editor-part]");
      if (input) {
        input.value = "";
        if (typeof input.focus === "function") {
          input.focus();
        }
      }

      updateBlockMeta(blockEl);
      markDirty();
      return;
    }

    listEl.removeChild(rowEl);
    reindexList(listEl);
    updateBlockMeta(blockEl);
    markDirty();
  }

  MAT.editor.base.getEl = function () {
    if (MAT.ui && typeof MAT.ui.getEl === "function") {
      return MAT.ui.getEl("editor");
    }

    return document.querySelector("#mat-editor");
  };

  MAT.editor.base.renderEmpty = function (message) {
    if (MAT.ui && typeof MAT.ui.renderEditorPlaceholder === "function") {
      MAT.ui.renderEditorPlaceholder(message);
      return;
    }

    var el = this.getEl();
    if (!el) return;

    el.innerHTML = "<strong>Editor dinámico</strong><p>" + esc(message || "") + "</p>";
  };

  MAT.editor.base.attachDirtyListener = function () {
    var el = this.getEl();

    if (!el || el.__matEditorBound) {
      return;
    }

    el.addEventListener("input", function (event) {
      var target = event.target;
      var blockEl;

      if (!target || !target.getAttribute || !target.getAttribute("data-mat-editor-part")) {
        return;
      }

      blockEl = findClosest(target, "[data-mat-block]");
      if (blockEl) {
        updateBlockMeta(blockEl);
      }

      markDirty();
    });

    el.addEventListener("click", function (event) {
      var target = event.target;
      var addButton;
      var removeButton;

      if (!target) return;

      addButton = findClosest(target, "[data-mat-add-item]");
      if (addButton) {
        handleAddAction(addButton);
        return;
      }

      removeButton = findClosest(target, "[data-mat-remove-item]");
      if (removeButton) {
        handleRemoveAction(removeButton);
      }
    });

    el.__matEditorBound = true;
  };

  MAT.editor.base.renderFromPreview = function (preview, careerType) {
    var el = this.getEl();
    var html = "";
    var summary;
    var kind;
    var expected;

    if (!el) return;

    if (!preview || typeof preview !== "object") {
      this.renderEmpty("Aquí podrás editar los datos después de procesarlos.");
      return;
    }

    summary = preview.summary || {};
    kind = String(preview.kind || "").trim();

    html += "<strong>Editor dinámico</strong>";
    html += '<p class="mat-editor-intro">Revisa, corrige y edita antes de guardar. Cada materia ahora tiene su propio campo para que todo quede mejor organizado.</p>';

    if (kind === "materias-carrera") {
      html += buildAccordionBlock({
        label: "Nivel 1",
        part: "nivel1",
        items: summary.nivel1,
        placeholder: "Escribe una materia de Nivel 1",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: true,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 2",
        part: "nivel2",
        items: summary.nivel2,
        placeholder: "Escribe una materia de Nivel 2",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 3",
        part: "nivel3",
        items: summary.nivel3,
        placeholder: "Escribe una materia de Nivel 3",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 4",
        part: "nivel4",
        items: summary.nivel4,
        placeholder: "Escribe una materia de Nivel 4",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Sin nivel",
        part: "sinNivel",
        items: summary.sinNivel,
        placeholder: "Escribe una materia sin nivel",
        helperText: "Úsalo solo si realmente hay elementos sin nivel definido.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });
    } else if (kind === "transversales") {
      html += buildAccordionBlock({
        label: "Nivel 1",
        part: "nivel1",
        items: summary.nivel1,
        placeholder: "Escribe una materia transversal de Nivel 1",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: true,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 2",
        part: "nivel2",
        items: summary.nivel2,
        placeholder: "Escribe una materia transversal de Nivel 2",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 3",
        part: "nivel3",
        items: summary.nivel3,
        placeholder: "Escribe una materia transversal de Nivel 3",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Nivel 4",
        part: "nivel4",
        items: summary.nivel4,
        placeholder: "Escribe una materia transversal de Nivel 4",
        helperText: "Una materia por campo. Puedes agregar o quitar filas.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });

      html += buildAccordionBlock({
        label: "Sin nivel",
        part: "sinNivel",
        items: summary.sinNivel,
        placeholder: "Escribe una materia transversal sin nivel",
        helperText: "Úsalo solo si realmente hay elementos sin nivel definido.",
        addLabel: "Agregar materia",
        open: false,
        unitSingular: "materia",
        unitPlural: "materias"
      });
    } else if (kind === "nucleos") {
      html += buildAccordionBlock({
        label: "Núcleos",
        part: "items",
        items: summary.items,
        placeholder: "Escribe un núcleo",
        helperText: "Un núcleo por campo. Se recomiendan 4.",
        addLabel: "Agregar núcleo",
        open: true,
        unitSingular: "núcleo",
        unitPlural: "núcleos"
      });
    } else if (kind === "ejes") {
      expected = (MAT.carreras && typeof MAT.carreras.getEjesEsperados === "function")
        ? MAT.carreras.getEjesEsperados(careerType || "")
        : 4;

      html += buildAccordionBlock({
        label: "Ejes",
        part: "items",
        items: summary.items,
        placeholder: "Escribe un eje",
        helperText: "Un eje por campo. Para esta carrera se esperan " + String(expected) + ".",
        addLabel: "Agregar eje",
        open: true,
        unitSingular: "eje",
        unitPlural: "ejes"
      });
    } else {
      html += "<p>Tipo de editor aún no soportado.</p>";
    }

    el.innerHTML = html;
    this.attachDirtyListener();
    updateAllBlockMeta(el);
  };

  MAT.editor.base.collectPreview = function (originalPreview) {
    var preview = cloneDeep(originalPreview || {});
    var el = this.getEl();
    var inputs;
    var values = {};
    var i;
    var part;
    var text;

    if (!el || !preview || typeof preview !== "object") {
      return preview;
    }

    inputs = el.querySelectorAll("[data-mat-editor-part]");

    for (i = 0; i < inputs.length; i += 1) {
      part = String(inputs[i].getAttribute("data-mat-editor-part") || "").trim();
      if (!part) continue;

      text = normalizeText(inputs[i].value);

      if (!values[part]) {
        values[part] = [];
      }

      if (text) {
        values[part].push(text);
      }
    }

    preview.summary = preview.summary || {};

    if (preview.kind === "materias-carrera" || preview.kind === "transversales") {
      preview.summary.nivel1 = toArray(values.nivel1);
      preview.summary.nivel2 = toArray(values.nivel2);
      preview.summary.nivel3 = toArray(values.nivel3);
      preview.summary.nivel4 = toArray(values.nivel4);
      preview.summary.sinNivel = toArray(values.sinNivel);
    } else {
      preview.summary.items = toArray(values.items);
      preview.summary.total = preview.summary.items.length;
    }

    preview.totalLines = countPreviewItems(preview);
    preview.rawLines = flattenPreviewItems(preview);

    return preview;
  };
})(window, document);