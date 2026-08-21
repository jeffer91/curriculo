/* =========================================================
Nombre completo: estadisticas.js
Ruta o ubicación: /Curriculo/estadisticas/estadisticas.js
Funciones:
- Construir un tablero institucional de cobertura curricular por carrera.
- Comparar materias cargadas en Firebase contra la malla vigente.
- Separar Niveles, Núcleos y Transversales.
- Mostrar materias completas, incompletas, faltantes y no vinculadas.
- Filtrar por carrera, tipo, nivel/núcleo, estado, PEA y búsqueda.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var estado = {
    carreras: [],
    carrerasDetalle: [],
    filas: [],
    cargando: false
  };

  function texto(valor) {
    return String(valor === null || typeof valor === "undefined" ? "" : valor).trim();
  }

  function arr(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || typeof valor === "undefined") return [];
    return [valor];
  }

  function numero(valor, defecto) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : Number(defecto || 0);
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function escapar(valor) {
    return texto(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setTexto(id, valor) {
    var el = $(id);
    if (el) el.textContent = texto(valor);
  }

  function setEstado(tipo, titulo, mensaje) {
    var el = $("estadisticasEstado");
    if (!el) return;
    el.className = "est-status est-status-" + tipo;
    el.innerHTML = "<strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span>";
  }

  function nombreMateria(materia) {
    return texto(
      materia && (
        materia.nombreMostrar ||
        materia.nombreInstitucional ||
        materia.nombreCorregido ||
        materia.nombreOficial ||
        materia.nombre ||
        materia.materia
      )
    );
  }

  function esTransversal(materia) {
    materia = materia || {};
    return materia.esTransversal === true ||
      materia.perteneceMalla === false ||
      normalizar(materia.tipoMateria) === "transversal" ||
      normalizar(materia.tipo) === "transversal" ||
      normalizar(materia.origenMateria) === "institucional" ||
      /^\s*n(?:\s*[-–—._:]\s*|\s+)(?=\S)/i.test(texto(materia.nombreOriginal || materia.nombreOriginalDetectado));
  }

  function esNucleo(materia) {
    materia = materia || {};
    var tipo = normalizar(materia.tipoMateria || materia.estructuraTipo || materia.tipo);
    var nombre = normalizar(materia.nucleoNombre || materia.nivelNombre || materia.nivel);
    return materia.esNucleo === true ||
      numero(materia.nucleoNumero, 0) > 0 ||
      tipo === "nucleo" ||
      /^nucleo(?:\s|$)/.test(nombre);
  }

  function tipoElemento(materia) {
    if (esTransversal(materia)) return "transversal";
    if (esNucleo(materia)) return "nucleo";
    return "nivel";
  }

  function numeroEstructura(materia, tipo) {
    materia = materia || {};
    if (tipo === "transversal") return 0;
    if (tipo === "nucleo") {
      return numero(materia.nucleoNumero || materia.nivelNumero || materia.numeroNivel, 0);
    }
    return numero(materia.nivelNumero || materia.numeroNivel || materia.nivel, 0);
  }

  function etiquetaEstructura(materia, tipo) {
    materia = materia || {};
    if (tipo === "transversal") return "Transversal";
    var n = numeroEstructura(materia, tipo);
    var nombre = texto(tipo === "nucleo" ? materia.nucleoNombre : materia.nivelNombre);
    if (nombre && normalizar(nombre) !== "transversal") return nombre;
    if (tipo === "nucleo") return n > 0 ? "Núcleo " + n : "Núcleo";
    return n > 0 ? "Nivel " + n : "Sin nivel";
  }

  function estadoMateria(materia) {
    if (!materia) return "faltante";
    var valor = normalizar(
      materia.estadoValidacion ||
      materia.estadoClasificado ||
      materia.etiquetaEstado ||
      materia.estado
    );
    if (["completo", "completa", "ok", "validado", "validada"].indexOf(valor) !== -1) {
      return "completo";
    }
    return "incompleto";
  }

  function listaContieneTipo(lista, tipo) {
    var aliases = {
      base: ["base", "pea base", "pea_base"],
      unidades: ["unidades", "pea unidades", "pea_unidades"],
      actividades: ["actividades", "pea actividades", "pea_actividades"]
    };
    var buscados = (aliases[tipo] || [tipo]).map(normalizar);
    return arr(lista).some(function (item) {
      return buscados.indexOf(normalizar(item)) !== -1;
    });
  }

  function estadoPEA(materia, tipo) {
    if (!materia) return "faltante";
    if (listaContieneTipo(materia.archivosFaltantes, tipo)) return "faltante";
    if (listaContieneTipo(materia.archivosSinContenido, tipo)) return "incompleto";

    var resumen = materia.resumenValidacion || {};
    var mapa = {
      base: ["tieneBase", "tieneArchivoBase"],
      unidades: ["tieneUnidades", "tieneArchivoUnidades"],
      actividades: ["tieneActividades", "tieneArchivoActividades"]
    };
    var campos = mapa[tipo] || [];
    var tieneValido = resumen[campos[0]];
    var tieneArchivo = resumen[campos[1]];

    if (tieneArchivo === false) return "faltante";
    if (tieneValido === false && tieneArchivo === true) return "incompleto";
    if (tieneValido === true) return "completo";

    var archivos = materia.archivos || {};
    var tieneMapaArchivos = Object.keys(archivos).length > 0;
    var existe = tipo === "base"
      ? !!(archivos.base || archivos.pea_base)
      : (tipo === "unidades"
        ? !!(archivos.unidades || archivos.pea_unidades)
        : !!(archivos.actividades || archivos.pea_actividades));

    if (tieneMapaArchivos && !existe) return "faltante";
    if (estadoMateria(materia) === "completo") return "completo";
    return "incompleto";
  }

  function coinciden(esperado, actual, tipo) {
    var idEsperado = texto(esperado && esperado.materiaFirebaseId);
    var idActual = texto(actual && (actual.id || actual.materiaFirebaseId));
    if (idEsperado && idActual && idEsperado === idActual) return true;

    if (normalizar(nombreMateria(esperado)) !== normalizar(nombreMateria(actual))) return false;
    if (tipoElemento(actual) !== tipo) return false;

    var nEsperado = numeroEstructura(esperado, tipo);
    var nActual = numeroEstructura(actual, tipo);
    if (nEsperado > 0 && nActual > 0 && nEsperado !== nActual) return false;
    return true;
  }

  function crearFila(carrera, tipo, esperado, actual, estadoForzado, referenciaForzada) {
    var base = actual || esperado || {};
    return {
      id: [texto(carrera.id), tipo, texto((actual && actual.id) || (esperado && esperado.id) || nombreMateria(base))].join("|"),
      carreraId: texto(carrera.id),
      carrera: texto(carrera.nombre || carrera.carrera),
      tipo: tipo,
      estructuraNumero: numeroEstructura(base, tipo),
      estructura: etiquetaEstructura(base, tipo),
      materia: nombreMateria(base) || "Sin nombre",
      codigo: texto(base.codigo || base.codigoMateria),
      estado: estadoForzado || estadoMateria(actual),
      esperada: !!esperado,
      cargada: !!actual,
      referencia: referenciaForzada || (esperado
        ? "Malla vigente"
        : (tipo === "transversal" ? "Sin catálogo institucional" : "No vinculada a la malla")),
      pea: {
        base: actual ? estadoPEA(actual, "base") : "faltante",
        unidades: actual ? estadoPEA(actual, "unidades") : "faltante",
        actividades: actual ? estadoPEA(actual, "actividades") : "faltante"
      },
      actual: actual || null,
      esperado: esperado || null
    };
  }

  function construirFilasCarrera(carrera, materias, detalleMalla) {
    materias = arr(materias).filter(function (materia) {
      return materia && materia.activo !== false;
    });
    var esperadas = arr(detalleMalla && detalleMalla.materias).filter(function (materia) {
      return materia && materia.activa !== false;
    });
    var tieneMalla = !!(detalleMalla && detalleMalla.malla);
    var usados = {};
    var filas = [];

    esperadas.forEach(function (esperado) {
      var tipo = tipoElemento(esperado);
      var indice = materias.findIndex(function (actual, idx) {
        return !usados[idx] && coinciden(esperado, actual, tipo);
      });
      var actual = indice >= 0 ? materias[indice] : null;
      if (indice >= 0) usados[indice] = true;
      filas.push(crearFila(carrera, tipo, esperado, actual, actual ? null : "faltante"));
    });

    materias.forEach(function (actual, indice) {
      if (usados[indice]) return;
      var tipo = tipoElemento(actual);
      var estadoForzado = null;
      var referencia = "";

      if (tipo === "transversal") {
        referencia = "Sin catálogo institucional";
      } else if (tieneMalla) {
        estadoForzado = "no_vinculado";
        referencia = "No vinculada a la malla";
      } else {
        referencia = "Sin malla vigente";
      }

      filas.push(crearFila(carrera, tipo, null, actual, estadoForzado, referencia));
    });

    return filas.sort(function (a, b) {
      var ordenTipo = { nivel: 1, nucleo: 2, transversal: 3 };
      return (ordenTipo[a.tipo] || 9) - (ordenTipo[b.tipo] || 9) ||
        a.estructuraNumero - b.estructuraNumero ||
        a.materia.localeCompare(b.materia, "es");
    });
  }

  async function cargarConcurrencia(items, limite, tarea) {
    var salida = new Array(items.length);
    var cursor = 0;
    var completadas = 0;

    async function trabajador() {
      while (cursor < items.length) {
        var indice = cursor;
        cursor += 1;
        salida[indice] = await tarea(items[indice], indice);
        completadas += 1;
        setEstado("loading", "Cargando estadísticas", "Procesando carrera " + completadas + " de " + items.length + ".");
      }
    }

    var trabajadores = [];
    var total = Math.min(Math.max(1, limite), Math.max(1, items.length));
    for (var i = 0; i < total; i += 1) trabajadores.push(trabajador());
    await Promise.all(trabajadores);
    return salida;
  }

  async function cargarCarrera(carrera) {
    var materias = await Firebase.obtenerMateriasPorCarrera(carrera.id, {
      soloCompletas: false,
      incluirRetiradas: false
    });
    var detalleMalla = null;
    var errorMalla = "";

    if (Firebase.Mallas && typeof Firebase.Mallas.obtenerMallaVigenteParaCarrera === "function") {
      try {
        detalleMalla = await Firebase.Mallas.obtenerMallaVigenteParaCarrera(carrera);
      } catch (error) {
        errorMalla = error && error.message ? error.message : texto(error);
      }
    }

    return {
      carrera: carrera,
      materias: materias,
      detalleMalla: detalleMalla,
      errorMalla: errorMalla,
      filas: construirFilasCarrera(carrera, materias, detalleMalla)
    };
  }

  function llenarCarreras() {
    var select = $("filtroCarrera");
    if (!select) return;
    select.innerHTML = '<option value="">Todas las carreras</option>' + estado.carreras.map(function (carrera) {
      return '<option value="' + escapar(carrera.id) + '">' + escapar(carrera.nombre || carrera.carrera) + "</option>";
    }).join("");
  }

  function actualizarFiltroEstructura() {
    var select = $("filtroEstructura");
    if (!select) return;
    var actual = select.value;
    var carreraId = texto($("filtroCarrera") && $("filtroCarrera").value);
    var tipo = texto($("filtroTipo") && $("filtroTipo").value);
    var nombres = {};

    estado.filas.forEach(function (fila) {
      if (carreraId && fila.carreraId !== carreraId) return;
      if (tipo && fila.tipo !== tipo) return;
      nombres[fila.estructura] = true;
    });

    var opciones = Object.keys(nombres).sort(function (a, b) {
      var na = Number((a.match(/\d+/) || [999])[0]);
      var nb = Number((b.match(/\d+/) || [999])[0]);
      return na - nb || a.localeCompare(b, "es");
    });

    select.innerHTML = '<option value="">Todos los niveles / núcleos</option>' + opciones.map(function (nombre) {
      return '<option value="' + escapar(nombre) + '">' + escapar(nombre) + "</option>";
    }).join("");
    if (opciones.indexOf(actual) !== -1) select.value = actual;
  }

  function estadoEfectivo(fila, pea) {
    if (fila.estado === "no_vinculado") return "no_vinculado";
    if (!pea) return fila.estado;
    return fila.pea[pea] || fila.estado;
  }

  function filasFiltradas() {
    var carreraId = texto($("filtroCarrera") && $("filtroCarrera").value);
    var tipo = texto($("filtroTipo") && $("filtroTipo").value);
    var estructura = texto($("filtroEstructura") && $("filtroEstructura").value);
    var estadoFiltro = texto($("filtroEstado") && $("filtroEstado").value);
    var pea = texto($("filtroPEA") && $("filtroPEA").value);
    var buscar = normalizar($("filtroBuscar") && $("filtroBuscar").value);
    var soloProblemas = !!($("soloProblemas") && $("soloProblemas").checked);

    return estado.filas.filter(function (fila) {
      if (carreraId && fila.carreraId !== carreraId) return false;
      if (tipo && fila.tipo !== tipo) return false;
      if (estructura && fila.estructura !== estructura) return false;

      var estadoActual = estadoEfectivo(fila, pea);
      if (estadoFiltro && estadoActual !== estadoFiltro) return false;
      if (soloProblemas && estadoActual === "completo") return false;

      if (buscar) {
        var bolsa = normalizar([fila.carrera, fila.estructura, fila.codigo, fila.materia, fila.estado].join(" "));
        if (bolsa.indexOf(buscar) === -1) return false;
      }
      return true;
    });
  }

  function porcentaje(completas, esperadas) {
    if (!esperadas) return null;
    return Math.round((completas / esperadas) * 1000) / 10;
  }

  function badgeEstado(valor) {
    var etiquetas = {
      completo: "Completo",
      incompleto: "Incompleto",
      faltante: "Faltante",
      no_vinculado: "No vinculado"
    };
    return '<span class="est-badge est-badge-' + escapar(valor) + '">' + escapar(etiquetas[valor] || valor) + "</span>";
  }

  function resumenGrupo(filas, tipo) {
    var lista = filas.filter(function (fila) { return fila.tipo === tipo; });
    var esperadas = lista.filter(function (fila) { return fila.esperada; }).length;
    var completasEsperadas = lista.filter(function (fila) { return fila.esperada && fila.estado === "completo"; }).length;
    var cargadas = lista.filter(function (fila) { return fila.cargada; }).length;
    var completasCargadas = lista.filter(function (fila) { return fila.cargada && fila.estado === "completo"; }).length;

    if (!esperadas) {
      if (tipo === "transversal") return cargadas ? completasCargadas + "/" + cargadas + " cargadas" : "0 cargadas";
      return cargadas ? completasCargadas + "/" + cargadas + " sin referencia" : "—";
    }
    return completasEsperadas + "/" + esperadas;
  }

  function renderResumenCarreras(filas) {
    var tbody = $("tablaCarreras");
    if (!tbody) return;
    var grupos = {};

    filas.forEach(function (fila) {
      if (!grupos[fila.carreraId]) grupos[fila.carreraId] = [];
      grupos[fila.carreraId].push(fila);
    });

    var ids = Object.keys(grupos).sort(function (a, b) {
      return grupos[a][0].carrera.localeCompare(grupos[b][0].carrera, "es");
    });

    if (!ids.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="est-empty">No hay carreras con los filtros seleccionados.</td></tr>';
      return;
    }

    tbody.innerHTML = ids.map(function (id) {
      var grupo = grupos[id];
      var esperadas = grupo.filter(function (fila) { return fila.esperada; }).length;
      var completas = grupo.filter(function (fila) { return fila.esperada && fila.estado === "completo"; }).length;
      var incompletas = grupo.filter(function (fila) { return fila.estado === "incompleto"; }).length;
      var faltantes = grupo.filter(function (fila) { return fila.estado === "faltante"; }).length;
      var noVinculadas = grupo.filter(function (fila) { return fila.estado === "no_vinculado"; }).length;
      var cobertura = porcentaje(completas, esperadas);

      return '<tr>' +
        '<td><strong>' + escapar(grupo[0].carrera) + '</strong></td>' +
        '<td>' + escapar(resumenGrupo(grupo, "nivel")) + '</td>' +
        '<td>' + escapar(resumenGrupo(grupo, "nucleo")) + '</td>' +
        '<td>' + escapar(resumenGrupo(grupo, "transversal")) + '</td>' +
        '<td>' + completas + '</td>' +
        '<td>' + incompletas + '</td>' +
        '<td>' + faltantes + '</td>' +
        '<td>' + (cobertura === null ? "—" : cobertura + "%") + (noVinculadas ? '<small class="est-inline-note"> +' + noVinculadas + ' no vinculada(s)</small>' : "") + '</td>' +
        '<td><button type="button" class="est-link-btn" data-ver-carrera="' + escapar(id) + '">Ver</button></td>' +
      '</tr>';
    }).join("");
  }

  function renderDetalle(filas) {
    var tbody = $("tablaDetalle");
    if (!tbody) return;
    var limite = 500;
    var visibles = filas.slice(0, limite);

    if (!visibles.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="est-empty">No hay materias con los filtros seleccionados.</td></tr>';
      setTexto("detalleConteo", "0 resultados");
      return;
    }

    tbody.innerHTML = visibles.map(function (fila) {
      var tipoLabel = fila.tipo === "nivel" ? "Nivel" : (fila.tipo === "nucleo" ? "Núcleo" : "Transversal");
      return '<tr>' +
        '<td>' + escapar(fila.carrera) + '</td>' +
        '<td><span class="est-type est-type-' + escapar(fila.tipo) + '">' + escapar(tipoLabel) + '</span></td>' +
        '<td>' + escapar(fila.estructura) + '</td>' +
        '<td><strong>' + escapar(fila.materia) + '</strong>' + (fila.codigo ? '<small>' + escapar(fila.codigo) + '</small>' : "") + '</td>' +
        '<td>' + badgeEstado(fila.pea.base) + '</td>' +
        '<td>' + badgeEstado(fila.pea.unidades) + '</td>' +
        '<td>' + badgeEstado(fila.pea.actividades) + '</td>' +
        '<td>' + badgeEstado(fila.estado) + '</td>' +
        '<td><small>' + escapar(fila.referencia) + '</small></td>' +
      '</tr>';
    }).join("");

    setTexto(
      "detalleConteo",
      filas.length > limite
        ? limite + " de " + filas.length + " resultados"
        : filas.length + " resultado" + (filas.length === 1 ? "" : "s")
    );
  }

  function renderCards(filas) {
    var carreras = {};
    filas.forEach(function (fila) { carreras[fila.carreraId] = true; });

    var esperadas = filas.filter(function (fila) { return fila.esperada; }).length;
    var completas = filas.filter(function (fila) { return fila.esperada && fila.estado === "completo"; }).length;
    var incompletas = filas.filter(function (fila) { return fila.estado === "incompleto"; }).length;
    var faltantes = filas.filter(function (fila) { return fila.estado === "faltante"; }).length;
    var noVinculadas = filas.filter(function (fila) { return fila.estado === "no_vinculado"; }).length;
    var cobertura = porcentaje(completas, esperadas);

    setTexto("statCarreras", Object.keys(carreras).length);
    setTexto("statEsperadas", esperadas);
    setTexto("statCompletas", completas);
    setTexto("statIncompletas", incompletas);
    setTexto("statFaltantes", faltantes);
    setTexto("statNoVinculadas", noVinculadas);
    setTexto("statCobertura", cobertura === null ? "—" : cobertura + "%");
  }

  function render() {
    actualizarFiltroEstructura();
    var filas = filasFiltradas();
    renderCards(filas);
    renderResumenCarreras(filas);
    renderDetalle(filas);
  }

  function sincronizarAtajosDesdeEstado() {
    var estadoFiltro = texto($("filtroEstado") && $("filtroEstado").value);
    if ($("soloFaltantes")) $("soloFaltantes").checked = estadoFiltro === "faltante";
    if ($("soloCompletos")) $("soloCompletos").checked = estadoFiltro === "completo";
    if (estadoFiltro === "completo" && $("soloProblemas")) $("soloProblemas").checked = false;
  }

  function conectarFiltros() {
    ["filtroCarrera", "filtroTipo", "filtroEstructura", "filtroEstado", "filtroPEA"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("change", function () {
        if (id === "filtroCarrera" || id === "filtroTipo") actualizarFiltroEstructura();
        if (id === "filtroEstado") sincronizarAtajosDesdeEstado();
        render();
      });
    });

    var buscar = $("filtroBuscar");
    if (buscar) buscar.addEventListener("input", render);

    var problemas = $("soloProblemas");
    if (problemas) problemas.addEventListener("change", function () {
      if (problemas.checked && $("filtroEstado") && $("filtroEstado").value === "completo") {
        $("filtroEstado").value = "";
        sincronizarAtajosDesdeEstado();
      }
      render();
    });

    var faltantes = $("soloFaltantes");
    if (faltantes) faltantes.addEventListener("change", function () {
      if (faltantes.checked) {
        $("filtroEstado").value = "faltante";
        if ($("soloCompletos")) $("soloCompletos").checked = false;
      } else if ($("filtroEstado").value === "faltante") {
        $("filtroEstado").value = "";
      }
      render();
    });

    var completos = $("soloCompletos");
    if (completos) completos.addEventListener("change", function () {
      if (completos.checked) {
        $("filtroEstado").value = "completo";
        if ($("soloFaltantes")) $("soloFaltantes").checked = false;
        if ($("soloProblemas")) $("soloProblemas").checked = false;
      } else if ($("filtroEstado").value === "completo") {
        $("filtroEstado").value = "";
      }
      render();
    });

    document.addEventListener("click", function (event) {
      var boton = event.target.closest("[data-ver-carrera]");
      if (!boton) return;
      $("filtroCarrera").value = boton.getAttribute("data-ver-carrera") || "";
      actualizarFiltroEstructura();
      render();
      var detalle = $("panelDetalle");
      if (detalle && typeof detalle.scrollIntoView === "function") {
        detalle.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    var limpiar = $("btnLimpiarFiltros");
    if (limpiar) limpiar.addEventListener("click", function () {
      ["filtroCarrera", "filtroTipo", "filtroEstructura", "filtroEstado", "filtroPEA"].forEach(function (id) {
        if ($(id)) $(id).value = "";
      });
      if ($("filtroBuscar")) $("filtroBuscar").value = "";
      if ($("soloProblemas")) $("soloProblemas").checked = false;
      if ($("soloFaltantes")) $("soloFaltantes").checked = false;
      if ($("soloCompletos")) $("soloCompletos").checked = false;
      actualizarFiltroEstructura();
      render();
    });
  }

  async function cargar() {
    if (estado.cargando) return;
    estado.cargando = true;
    setEstado("loading", "Cargando estadísticas", "Consultando carreras, materias y mallas vigentes.");

    try {
      if (!Firebase || typeof Firebase.obtenerCarreras !== "function") {
        throw new Error("No está disponible el módulo de Firebase Curriculo.");
      }

      await Firebase.ready();
      estado.carreras = await Firebase.obtenerCarreras();
      llenarCarreras();

      estado.carrerasDetalle = await cargarConcurrencia(estado.carreras, 4, cargarCarrera);
      estado.filas = [];
      estado.carrerasDetalle.forEach(function (detalle) {
        estado.filas = estado.filas.concat(detalle.filas || []);
      });

      render();

      var sinMalla = estado.carrerasDetalle.filter(function (detalle) {
        return !detalle.detalleMalla;
      }).length;
      setEstado(
        sinMalla ? "warn" : "ok",
        "Estadísticas actualizadas",
        sinMalla
          ? sinMalla + " carrera(s) no tienen malla vigente; se muestran sus cargas, pero no se calculan faltantes de malla."
          : "La cobertura fue comparada contra las mallas vigentes."
      );
    } catch (error) {
      console.error("[Estadisticas]", error);
      setEstado(
        "error",
        "No se pudieron cargar las estadísticas",
        error && error.message ? error.message : texto(error)
      );
    } finally {
      estado.cargando = false;
    }
  }

  window.CurriculoEstadisticas = {
    cargar: cargar,
    render: render,
    construirFilasCarrera: construirFilasCarrera,
    tipoElemento: tipoElemento,
    estadoMateria: estadoMateria,
    estadoPEA: estadoPEA,
    getEstado: function () { return estado; }
  };

  document.addEventListener("DOMContentLoaded", function () {
    conectarFiltros();
    cargar();
  });
})(window, document);
