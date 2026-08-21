/* =========================================================
Nombre completo: estadisticas.js
Ruta o ubicación: /Curriculo/estadisticas/estadisticas.js
Funciones:
- Construir un tablero institucional de cobertura curricular por carrera.
- Comparar Firebase contra la malla vigente usando equivalencias aprobadas.
- Incorporar materias pendientes que no fueron importadas por estar incompletas.
- Separar Niveles, Núcleos y Transversales.
- Mostrar completas, incompletas, faltantes y no vinculadas.
- Filtrar por carrera, tipo, nivel/núcleo, estado, PEA y búsqueda.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var Comparador = window.MallasComparador;
  var estado = {
    carreras: [],
    carrerasDetalle: [],
    pendientes: [],
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

  function esPendiente(materia) {
    return !!(materia && materia.esPendienteCurricular === true);
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
    if (nombre && normalizar(nombre) !== "transversal" && !(tipo === "nucleo" && !/^nucleo/i.test(nombre))) {
      return nombre;
    }
    if (tipo === "nucleo") return n > 0 ? "Núcleo " + n : "Núcleo";
    return n > 0 ? "Nivel " + n : "Sin nivel";
  }

  function estadoMateria(materia) {
    if (!materia) return "faltante";
    if (esPendiente(materia)) return "incompleto";
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

    var directo = normalizar(materia.pea && materia.pea[tipo]);
    if (["completo", "incompleto", "faltante"].indexOf(directo) !== -1) return directo;

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

  function crearFila(carrera, tipo, esperado, actual, estadoForzado, referenciaForzada) {
    var base = actual || esperado || {};
    var pendiente = esPendiente(actual);
    return {
      id: [texto(carrera.id), tipo, texto((actual && actual.id) || (esperado && esperado.id) || nombreMateria(base))].join("|"),
      carreraId: texto(carrera.id),
      carrera: texto(carrera.nombre || carrera.carrera),
      tipo: tipo,
      estructuraNumero: numeroEstructura(esperado || actual, tipo),
      estructura: etiquetaEstructura(esperado || actual, tipo),
      materia: nombreMateria(esperado || actual) || nombreMateria(actual) || "Sin nombre",
      codigo: texto((actual && (actual.codigo || actual.codigoMateria)) || (esperado && esperado.codigo)),
      estado: estadoForzado || estadoMateria(actual),
      esperada: !!esperado,
      detectada: !!actual,
      cargada: !!actual && !pendiente,
      pendiente: pendiente,
      referencia: referenciaForzada || (esperado ? "Malla vigente" : "Sin referencia"),
      pea: {
        base: actual ? estadoPEA(actual, "base") : "faltante",
        unidades: actual ? estadoPEA(actual, "unidades") : "faltante",
        actividades: actual ? estadoPEA(actual, "actividades") : "faltante"
      },
      actual: actual || null,
      esperado: esperado || null
    };
  }

  function claveActual(item) {
    return texto(item && (item.id || item.materiaId));
  }

  function fusionarMaterias(materias, pendientes) {
    materias = arr(materias).filter(function (item) { return item && item.activo !== false; });
    pendientes = arr(pendientes).filter(Boolean);
    var actuales = {};
    var pendientesActuales = {};

    materias.forEach(function (item) {
      var id = claveActual(item);
      if (id) actuales[id] = item;
    });

    pendientes.forEach(function (item) {
      var id = claveActual(item);
      if (!id) return;
      if (item.origenPendiente === "registro_actual") pendientesActuales[id] = true;
    });

    var salida = materias.filter(function (item) {
      var id = claveActual(item);
      return !id || !pendientesActuales[id];
    });

    pendientes.forEach(function (item) {
      var id = claveActual(item);
      if (!id) return;
      if (item.origenPendiente === "auditoria_historica" && actuales[id]) return;
      if (actuales[id]) item = Object.assign({}, item, { tieneVersionFirebaseAnterior: true });
      salida.push(item);
    });

    return salida;
  }

  function compararCurriculares(actuales, esperadas, equivalencias) {
    if (Comparador && typeof Comparador.comparar === "function") {
      return Comparador.comparar(actuales, esperadas, equivalencias || []);
    }

    var usados = {};
    var coincidencias = [];
    actuales.forEach(function (actual) {
      var indice = esperadas.findIndex(function (esperado, idx) {
        return !usados[idx] &&
          normalizar(nombreMateria(esperado)) === normalizar(nombreMateria(actual)) &&
          numeroEstructura(esperado, tipoElemento(esperado)) === numeroEstructura(actual, tipoElemento(actual));
      });
      if (indice >= 0) {
        usados[indice] = true;
        coincidencias.push({ detectada: actual, oficial: esperadas[indice], criterio: "nombre_y_nivel" });
      }
    });
    return {
      coincidencias: coincidencias,
      faltantes: esperadas.filter(function (_, idx) { return !usados[idx]; }),
      noVinculadas: actuales.filter(function (actual) {
        return !coincidencias.some(function (item) { return item.detectada === actual; });
      })
    };
  }

  function construirFilasCarrera(carrera, materias, detalleMalla, pendientes) {
    var detectadas = fusionarMaterias(materias, pendientes);
    var transversales = detectadas.filter(esTransversal);
    var curriculares = detectadas.filter(function (item) { return !esTransversal(item); });
    var esperadas = arr(detalleMalla && detalleMalla.materias).filter(function (item) {
      return item && item.activa !== false && !esTransversal(item);
    });
    var tieneMalla = !!(detalleMalla && detalleMalla.malla);
    var filas = [];

    if (tieneMalla) {
      var comparacion = compararCurriculares(
        curriculares,
        esperadas,
        arr(detalleMalla && detalleMalla.equivalencias)
      );

      arr(comparacion.coincidencias).forEach(function (item) {
        var actual = item.detectada || item.referencia || null;
        var esperado = item.oficial || null;
        var tipo = tipoElemento(esperado || actual);
        var referencia = item.criterio === "equivalencia_guardada"
          ? "Malla vigente · equivalencia aprobada"
          : "Malla vigente";
        if (esPendiente(actual)) {
          referencia += actual.tieneVersionFirebaseAnterior
            ? " · pendiente de corrección (hay versión anterior)"
            : " · pendiente de corrección";
        }
        filas.push(crearFila(carrera, tipo, esperado, actual, esPendiente(actual) ? "incompleto" : null, referencia));
      });

      arr(comparacion.faltantes).forEach(function (esperado) {
        filas.push(crearFila(carrera, tipoElemento(esperado), esperado, null, "faltante", "Malla vigente"));
      });

      arr(comparacion.noVinculadas).forEach(function (item) {
        var actual = item.detectada || item.referencia || item;
        var pendiente = esPendiente(actual);
        filas.push(crearFila(
          carrera,
          tipoElemento(actual),
          null,
          actual,
          pendiente ? "incompleto" : "no_vinculado",
          pendiente ? "Pendiente de corrección · no vinculada a la malla" : "No vinculada a la malla"
        ));
      });
    } else {
      curriculares.forEach(function (actual) {
        filas.push(crearFila(
          carrera,
          tipoElemento(actual),
          null,
          actual,
          esPendiente(actual) ? "incompleto" : null,
          esPendiente(actual) ? "Pendiente de corrección · sin malla vigente" : "Sin malla vigente"
        ));
      });
    }

    transversales.forEach(function (actual) {
      filas.push(crearFila(
        carrera,
        "transversal",
        null,
        actual,
        esPendiente(actual) ? "incompleto" : null,
        esPendiente(actual)
          ? "Pendiente de corrección · sin catálogo institucional"
          : "Sin catálogo institucional"
      ));
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
    var pendientes = estado.pendientes.filter(function (item) {
      return texto(item && item.carreraId) === texto(carrera.id);
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
      pendientes: pendientes,
      detalleMalla: detalleMalla,
      errorMalla: errorMalla,
      filas: construirFilasCarrera(carrera, materias, detalleMalla, pendientes)
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

  function peaSeleccionado() {
    return texto($("filtroPEA") && $("filtroPEA").value);
  }

  function estadoEfectivo(fila, pea) {
    if (fila.estado === "no_vinculado") return "no_vinculado";
    if (!pea) return fila.estado;
    return fila.pea[pea] || fila.estado;
  }

  function estadoVista(fila) {
    return estadoEfectivo(fila, peaSeleccionado());
  }

  function filasFiltradas() {
    var carreraId = texto($("filtroCarrera") && $("filtroCarrera").value);
    var tipo = texto($("filtroTipo") && $("filtroTipo").value);
    var estructura = texto($("filtroEstructura") && $("filtroEstructura").value);
    var estadoFiltro = texto($("filtroEstado") && $("filtroEstado").value);
    var pea = peaSeleccionado();
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
        var bolsa = normalizar([fila.carrera, fila.estructura, fila.codigo, fila.materia, fila.estado, fila.referencia].join(" "));
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
    var completasEsperadas = lista.filter(function (fila) { return fila.esperada && estadoVista(fila) === "completo"; }).length;
    var detectadas = lista.filter(function (fila) { return fila.detectada; }).length;
    var completasDetectadas = lista.filter(function (fila) { return fila.detectada && estadoVista(fila) === "completo"; }).length;

    if (!esperadas) {
      if (tipo === "transversal") return detectadas ? completasDetectadas + "/" + detectadas + " detectadas" : "0 detectadas";
      return detectadas ? completasDetectadas + "/" + detectadas + " sin referencia" : "—";
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
      var completas = grupo.filter(function (fila) { return fila.esperada && estadoVista(fila) === "completo"; }).length;
      var incompletas = grupo.filter(function (fila) { return estadoVista(fila) === "incompleto"; }).length;
      var faltantes = grupo.filter(function (fila) { return estadoVista(fila) === "faltante"; }).length;
      var noVinculadas = grupo.filter(function (fila) { return estadoVista(fila) === "no_vinculado"; }).length;
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
    var completas = filas.filter(function (fila) { return fila.esperada && estadoVista(fila) === "completo"; }).length;
    var incompletas = filas.filter(function (fila) { return estadoVista(fila) === "incompleto"; }).length;
    var faltantes = filas.filter(function (fila) { return estadoVista(fila) === "faltante"; }).length;
    var noVinculadas = filas.filter(function (fila) { return estadoVista(fila) === "no_vinculado"; }).length;
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
    setEstado("loading", "Cargando estadísticas", "Consultando carreras, materias, pendientes y mallas vigentes.");

    try {
      if (!Firebase || typeof Firebase.obtenerCarreras !== "function") {
        throw new Error("No está disponible el módulo de Firebase Curriculo.");
      }

      await Firebase.ready();
      var iniciales = await Promise.all([
        Firebase.obtenerCarreras(),
        Firebase.Estadisticas && typeof Firebase.Estadisticas.obtenerPendientes === "function"
          ? Firebase.Estadisticas.obtenerPendientes()
          : Promise.resolve([])
      ]);
      estado.carreras = iniciales[0];
      estado.pendientes = iniciales[1];
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
      var pendientesActuales = estado.pendientes.filter(function (item) {
        return item.origenPendiente === "registro_actual";
      }).length;
      var partes = [];
      if (pendientesActuales) partes.push(pendientesActuales + " materia(s) pendientes de corrección");
      if (sinMalla) partes.push(sinMalla + " carrera(s) sin malla vigente");

      setEstado(
        partes.length ? "warn" : "ok",
        "Estadísticas actualizadas",
        partes.length
          ? partes.join(" · ") + "."
          : "La cobertura fue comparada contra las mallas vigentes y sus equivalencias aprobadas."
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
    fusionarMaterias: fusionarMaterias,
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
