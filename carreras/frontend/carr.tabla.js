/*
Nombre del archivo: carr.tabla.js
Ubicación: carreras/frontend/carr.tabla.js
Función:
- Cargar carreras desde Firestore
- Renderizar una tabla editable
- Filtrar por búsqueda
- Ordenar por encabezados
- Detectar cambios pendientes
- Guardar cambios usando actualizar o renombrar
*/

import { carrLeerTodasLasCarreras } from "../backend/carr.leer.js";
import { carrActualizarCarrera } from "../backend/carr.actualizar.js";
import { carrRenombrarCarrera } from "../backend/carr.renombrar.js";
import { carrCrearIdCarrera } from "../backend/carr.normalizar.js";

const CARR_TIPOS = [
  "Tecnologia Superior",
  "Tecnologia Universitaria",
  "Tecnica Superior"
];

const CARR_ESTADOS = [
  "activa",
  "inactiva"
];

function carrTablaTextoSeguro(valor, fallback = "—") {
  const texto = String(valor ?? "").trim();
  return texto || fallback;
}

function carrTablaLimpiarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function carrTablaNormalizarEstado(estado) {
  const limpio = String(estado ?? "").trim().toLowerCase();
  return limpio === "inactiva" ? "inactiva" : "activa";
}

function carrTablaFechaOrdenable(valor) {
  if (!valor) return 0;

  try {
    if (typeof valor?.toDate === "function") {
      return valor.toDate().getTime();
    }

    if (valor instanceof Date) {
      return valor.getTime();
    }

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
  } catch (error) {
    return 0;
  }
}

function carrTablaFormatearFecha(valor) {
  const tiempo = carrTablaFechaOrdenable(valor);

  if (!tiempo) return "—";

  try {
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(tiempo));
  } catch (error) {
    return "—";
  }
}

function carrTablaNormalizarBusqueda(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function carrTablaCrearEstadoVacio(contenedor, mensaje, esError = false) {
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const vacio = document.createElement("div");
  vacio.className = esError
    ? "carr-tabla-empty carr-tabla-empty-error"
    : "carr-tabla-empty";
  vacio.textContent = mensaje;

  contenedor.appendChild(vacio);
}

function carrTablaCrearSelect(options, value, rowId, field) {
  const select = document.createElement("select");
  select.className = "carr-table-control carr-table-select";
  select.setAttribute("data-row-id", rowId);
  select.setAttribute("data-field", field);

  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = field === "estado"
      ? optionValue.charAt(0).toUpperCase() + optionValue.slice(1)
      : optionValue;
    option.selected = optionValue === value;
    select.appendChild(option);
  });

  return select;
}

function carrTablaConstruirResumen(totalVisibles, totalGeneral, totalCambios) {
  const visibleTexto = `${totalVisibles} ${totalVisibles === 1 ? "visible" : "visibles"}`;
  const totalTexto = `${totalGeneral} ${totalGeneral === 1 ? "registro" : "registros"}`;
  const cambiosTexto = `${totalCambios} ${totalCambios === 1 ? "cambio" : "cambios"}`;

  return `${visibleTexto} · ${totalTexto} · ${cambiosTexto}`;
}

function carrCrearTablaCarreras(config = {}) {
  const contenedor = document.getElementById(config.contenedorId || "carrTablaWrap");
  const resumenNodo = document.getElementById(config.resumenId || "carrTablaResumen");
  const onDirtyChange = typeof config.onDirtyChange === "function"
    ? config.onDirtyChange
    : null;

  const state = {
    items: [],
    itemsById: new Map(),
    originalById: new Map(),
    dirty: new Map(),
    search: "",
    sortKey: "nombre",
    sortDir: "asc"
  };

  function notificarCambios() {
    if (onDirtyChange) {
      onDirtyChange({
        total: state.dirty.size,
        hasChanges: state.dirty.size > 0
      });
    }
  }

  function carrTablaActualizarResumen() {
    if (!resumenNodo) return;

    const visibles = obtenerItemsVisibles().length;
    resumenNodo.textContent = carrTablaConstruirResumen(
      visibles,
      state.items.length,
      state.dirty.size
    );
  }

  function obtenerSnapshotEditable(item) {
    return {
      nombre: carrTablaLimpiarTexto(item?.nombre),
      tipo: carrTablaLimpiarTexto(item?.tipo),
      estado: carrTablaNormalizarEstado(item?.estado)
    };
  }

  function syncMapsDesdeItems() {
    state.itemsById = new Map();
    state.originalById = new Map();

    state.items.forEach((item) => {
      const fila = {
        id: carrTablaTextoSeguro(item.id, ""),
        nombre: carrTablaLimpiarTexto(item.nombre),
        tipo: carrTablaLimpiarTexto(item.tipo),
        estado: carrTablaNormalizarEstado(item.estado),
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null
      };

      state.itemsById.set(fila.id, fila);
      state.originalById.set(fila.id, obtenerSnapshotEditable(fila));
    });

    state.dirty = new Map();
    notificarCambios();
  }

  function filaCoincideBusqueda(item) {
    if (!state.search) return true;

    const base = [
      item.id,
      item.nombre,
      item.tipo,
      item.estado
    ]
      .join(" ")
      .trim();

    return carrTablaNormalizarBusqueda(base).includes(state.search);
  }

  function valorOrden(item, key) {
    if (key === "createdAt" || key === "updatedAt") {
      return carrTablaFechaOrdenable(item[key]);
    }

    return carrTablaNormalizarBusqueda(item[key] || "");
  }

  function obtenerItemsVisibles() {
    const items = state.items.filter(filaCoincideBusqueda).slice();

    items.sort((a, b) => {
      const aValue = valorOrden(a, state.sortKey);
      const bValue = valorOrden(b, state.sortKey);

      if (aValue < bValue) {
        return state.sortDir === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return state.sortDir === "asc" ? 1 : -1;
      }

      return 0;
    });

    return items;
  }

  function filaEstaModificada(rowId) {
    const original = state.originalById.get(rowId);
    const actual = state.itemsById.get(rowId);

    if (!original || !actual) {
      state.dirty.delete(rowId);
      notificarCambios();
      return false;
    }

    const isDirty =
      carrTablaLimpiarTexto(actual.nombre) !== original.nombre ||
      carrTablaLimpiarTexto(actual.tipo) !== original.tipo ||
      carrTablaNormalizarEstado(actual.estado) !== original.estado;

    if (isDirty) {
      state.dirty.set(rowId, {
        id: rowId,
        before: { ...original },
        after: obtenerSnapshotEditable(actual)
      });
    } else {
      state.dirty.delete(rowId);
    }

    notificarCambios();
    return isDirty;
  }

  function aplicarEstadoFilaDOM(tr, rowId) {
    if (!tr) return;

    tr.classList.toggle("carr-row-dirty", state.dirty.has(rowId));
  }

  function construirSortLabel(titulo, key) {
    const activa = state.sortKey === key;
    const flecha = !activa
      ? "↕"
      : state.sortDir === "asc"
        ? "↑"
        : "↓";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = activa
      ? "carr-sort-btn is-active"
      : "carr-sort-btn";
    boton.setAttribute("data-sort-key", key);

    const texto = document.createElement("span");
    texto.textContent = titulo;

    const indicador = document.createElement("span");
    indicador.className = "carr-sort-indicator";
    indicador.textContent = flecha;

    boton.appendChild(texto);
    boton.appendChild(indicador);

    return boton;
  }

  function render() {
    if (!contenedor) {
      return;
    }

    if (!state.items.length) {
      carrTablaCrearEstadoVacio(
        contenedor,
        "Todavía no hay carreras registradas."
      );
      carrTablaActualizarResumen();
      return;
    }

    const itemsVisibles = obtenerItemsVisibles();

    if (!itemsVisibles.length) {
      carrTablaCrearEstadoVacio(
        contenedor,
        "No hay coincidencias para la búsqueda actual."
      );
      carrTablaActualizarResumen();
      return;
    }

    contenedor.innerHTML = "";

    const scroll = document.createElement("div");
    scroll.className = "carr-tabla-scroll";

    const tabla = document.createElement("table");
    tabla.className = "carr-tabla";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const headers = [
      ["ID", "id"],
      ["Nombre", "nombre"],
      ["Tipo", "tipo"],
      ["Estado", "estado"],
      ["Creado", "createdAt"],
      ["Actualizado", "updatedAt"]
    ];

    headers.forEach(([label, key]) => {
      const th = document.createElement("th");
      th.appendChild(construirSortLabel(label, key));
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");

    itemsVisibles.forEach((item) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-id", item.id);
      aplicarEstadoFilaDOM(tr, item.id);

      const tdId = document.createElement("td");
      tdId.className = "carr-cell-id";
      tdId.textContent = item.id;
      tr.appendChild(tdId);

      const tdNombre = document.createElement("td");
      const inputNombre = document.createElement("input");
      inputNombre.type = "text";
      inputNombre.value = item.nombre;
      inputNombre.className = "carr-table-control carr-table-input";
      inputNombre.setAttribute("data-row-id", item.id);
      inputNombre.setAttribute("data-field", "nombre");
      inputNombre.spellcheck = false;
      tdNombre.appendChild(inputNombre);
      tr.appendChild(tdNombre);

      const tdTipo = document.createElement("td");
      tdTipo.appendChild(
        carrTablaCrearSelect(CARR_TIPOS, item.tipo, item.id, "tipo")
      );
      tr.appendChild(tdTipo);

      const tdEstado = document.createElement("td");
      tdEstado.appendChild(
        carrTablaCrearSelect(CARR_ESTADOS, item.estado, item.id, "estado")
      );
      tr.appendChild(tdEstado);

      const tdCreated = document.createElement("td");
      tdCreated.className = "carr-cell-readonly";
      tdCreated.textContent = carrTablaFormatearFecha(item.createdAt);
      tr.appendChild(tdCreated);

      const tdUpdated = document.createElement("td");
      tdUpdated.className = "carr-cell-readonly";
      tdUpdated.textContent = carrTablaFormatearFecha(item.updatedAt);
      tr.appendChild(tdUpdated);

      tbody.appendChild(tr);
    });

    tabla.appendChild(thead);
    tabla.appendChild(tbody);
    scroll.appendChild(tabla);
    contenedor.appendChild(scroll);

    carrTablaActualizarResumen();
  }

  function handleControlChange(event) {
    const target = event.target;

    if (
      !target ||
      !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) ||
      !target.classList.contains("carr-table-control")
    ) {
      return;
    }

    const rowId = String(target.getAttribute("data-row-id") || "").trim();
    const field = String(target.getAttribute("data-field") || "").trim();

    if (!rowId || !field || !state.itemsById.has(rowId)) {
      return;
    }

    const item = state.itemsById.get(rowId);

    if (!item) return;

    if (field === "nombre") {
      item.nombre = carrTablaLimpiarTexto(target.value);
      target.value = item.nombre;
    }

    if (field === "tipo") {
      item.tipo = carrTablaLimpiarTexto(target.value);
    }

    if (field === "estado") {
      item.estado = carrTablaNormalizarEstado(target.value);
      target.value = item.estado;
    }

    const tr = target.closest("tr");
    filaEstaModificada(rowId);
    aplicarEstadoFilaDOM(tr, rowId);
    carrTablaActualizarResumen();

    if (event.type === "change" && (state.search || state.sortKey === field)) {
      render();
    }
  }

  function handleSortClick(event) {
    const boton = event.target.closest(".carr-sort-btn");

    if (!boton) return;

    const key = String(boton.getAttribute("data-sort-key") || "").trim();

    if (!key) return;

    if (state.sortKey === key) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = key;
      state.sortDir = "asc";
    }

    render();
  }

  async function cargar() {
    if (!contenedor) {
      return {
        ok: false,
        total: 0,
        items: [],
        mensaje: "No se encontró el contenedor de la tabla."
      };
    }

    carrTablaCrearEstadoVacio(contenedor, "Cargando carreras...");

    try {
      const resultado = await carrLeerTodasLasCarreras();

      if (!resultado.ok) {
        carrTablaCrearEstadoVacio(
          contenedor,
          resultado.mensaje || "No se pudo cargar la tabla de carreras.",
          true
        );

        if (resumenNodo) {
          resumenNodo.textContent = "Error al cargar";
        }

        return resultado;
      }

      state.items = Array.isArray(resultado.items)
        ? resultado.items.map((item) => ({ ...item }))
        : [];

      syncMapsDesdeItems();
      render();

      return {
        ok: true,
        total: state.items.length,
        items: state.items
      };
    } catch (error) {
      console.error("[carr] Error inesperado al cargar la tabla:", error);

      carrTablaCrearEstadoVacio(
        contenedor,
        "Ocurrió un error inesperado al cargar el listado.",
        true
      );

      if (resumenNodo) {
        resumenNodo.textContent = "Error inesperado";
      }

      return {
        ok: false,
        total: 0,
        items: [],
        mensaje: "Ocurrió un error inesperado al cargar la tabla."
      };
    }
  }

  function setBuscar(valor) {
    state.search = carrTablaNormalizarBusqueda(valor);
    render();
  }

  function getPendientes() {
    return state.dirty.size;
  }

  function hayCambios() {
    return state.dirty.size > 0;
  }

  async function guardarCambios() {
    const cambios = Array.from(state.dirty.values());

    if (!cambios.length) {
      return {
        ok: true,
        total: 0,
        resultados: [],
        mensaje: "No hay cambios pendientes."
      };
    }

    const resultados = [];
    let totalGuardados = 0;

    for (const cambio of cambios) {
      const idActual = cambio.id;
      const nuevoIdCalculado = carrCrearIdCarrera(cambio.after.nombre);

      let resultadoGuardado;

      if (nuevoIdCalculado && nuevoIdCalculado !== idActual) {
        resultadoGuardado = await carrRenombrarCarrera(idActual, cambio.after);
      } else {
        resultadoGuardado = await carrActualizarCarrera(idActual, cambio.after);
      }

      if (!resultadoGuardado.ok) {
        if (totalGuardados > 0) {
          await cargar();
        }

        return {
          ok: false,
          parcial: totalGuardados > 0,
          totalGuardados,
          resultados,
          mensaje: resultadoGuardado.mensaje || "No se pudieron guardar todos los cambios."
        };
      }

      resultados.push(resultadoGuardado);
      totalGuardados += 1;
    }

    await cargar();

    return {
      ok: true,
      total: totalGuardados,
      resultados,
      mensaje: "Cambios guardados correctamente."
    };
  }

  if (contenedor) {
    contenedor.addEventListener("input", handleControlChange);
    contenedor.addEventListener("change", handleControlChange);
    contenedor.addEventListener("click", handleSortClick);
  }

  return {
    cargar,
    setBuscar,
    getPendientes,
    hayCambios,
    guardarCambios
  };
}

export { carrCrearTablaCarreras };