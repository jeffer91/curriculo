/* =========================================================
Nombre completo: mallas.main.js
Ruta o ubicación: /Curriculo/mallas/mallas.main.js
Funciones:
- Cargar las materias existentes de Firebase al seleccionar una carrera.
- Abrir la malla vigente cuando ya existe y añadir materias nuevas de Firebase.
- Mostrar y editar materias agrupadas por nivel.
- Agregar materias manualmente y guardar versiones de la malla.
- Mantener importación e historial como opciones secundarias.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var Parser = window.MallasParser;
  var estado = {
    carrera: null,
    mallaId: "",
    carreras: [],
    mallas: [],
    materias: [],
    requisitos: [],
    fuenteTipo: "firebase",
    archivoFuente: null,
    urlPreview: "",
    guardando: false,
    cargandoCarrera: false
  };

  function $(id) { return document.getElementById(id); }
  function texto(valor) { return String(valor === null || typeof valor === "undefined" ? "" : valor).trim(); }
  function numero(valor, defecto) { var n = Number(valor); return Number.isFinite(n) ? n : Number(defecto || 0); }
  function arr(valor) { return Array.isArray(valor) ? valor : []; }
  function escapar(valor) {
    return texto(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function normalizar(valor) {
    if (Parser && typeof Parser.normalizar === "function") return Parser.normalizar(valor);
    return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function pintarEstado(tipo, titulo, mensaje) {
    var el = $("mlEstado");
    if (!el) return;
    el.className = "ml-status ml-status-" + tipo;
    el.innerHTML = "<strong>" + escapar(titulo) + "</strong><span>" + escapar(mensaje) + "</span>";
  }

  function abrirModal(id) {
    var modal = $(id);
    if (!modal) return;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "open");
  }

  function cerrarModal(id) {
    var modal = $(id);
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  function setOcupado(valor) {
    estado.guardando = !!valor;
    [
      "btnGuardarMalla", "btnAgregarMateria", "btnOrdenarMaterias", "btnProcesarTexto",
      "btnProcesarExcel", "btnProcesarDocumento", "btnRecargarMallas", "btnNuevaVersion"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = estado.guardando;
    });
    if ($("inputCarrera")) $("inputCarrera").disabled = estado.guardando;
  }

  function nombreNivel(nivel) {
    nivel = Math.max(1, numero(nivel, 1));
    return "Nivel " + nivel;
  }

  function nombreMateriaFirebase(materia) {
    return texto(materia && (
      materia.nombreInstitucional || materia.nombreCorregido || materia.nombreMostrar ||
      materia.nombre || materia.nombreMateria || materia.materia
    ));
  }

  function tipoMateria(nombre, tipo) {
    var n = normalizar(nombre);
    if (texto(tipo)) return texto(tipo);
    return /integracion curricular/.test(n) ? "integracion_curricular" : "asignatura";
  }

  function normalizarOrdenes() {
    estado.materias.sort(function (a, b) {
      return numero(a.nivelNumero, 0) - numero(b.nivelNumero, 0) ||
        numero(a.orden, 0) - numero(b.orden, 0) ||
        texto(a.nombreOficial).localeCompare(texto(b.nombreOficial), "es");
    });
    var porNivel = {};
    estado.materias.forEach(function (materia) {
      materia.nivelNumero = Math.max(1, numero(materia.nivelNumero, 1));
      materia.nivelNombre = nombreNivel(materia.nivelNumero);
      porNivel[materia.nivelNumero] = (porNivel[materia.nivelNumero] || 0) + 1;
      materia.orden = porNivel[materia.nivelNumero];
    });
  }

  function convertirMateriaFirebase(materia, indice) {
    return {
      nivelNumero: Math.max(1, numero(materia.nivelNumero || materia.numeroNivel, 1)),
      nivelNombre: texto(materia.nivelNombre) || nombreNivel(materia.nivelNumero || materia.numeroNivel),
      orden: numero(materia.orden, indice + 1),
      codigo: texto(materia.codigo || materia.codigoMateria),
      nombreOficial: nombreMateriaFirebase(materia),
      tipo: tipoMateria(nombreMateriaFirebase(materia), materia.tipo),
      obligatoria: materia.obligatoria !== false,
      activa: materia.activo !== false,
      materiaFirebaseId: texto(materia.id),
      origen: "firebase"
    };
  }

  function convertirMateriaMalla(materia) {
    return {
      id: texto(materia.id),
      nivelNumero: Math.max(1, numero(materia.nivelNumero, 1)),
      nivelNombre: texto(materia.nivelNombre) || nombreNivel(materia.nivelNumero),
      orden: numero(materia.orden, 1),
      codigo: texto(materia.codigo),
      nombreOficial: texto(materia.nombreOficial),
      tipo: tipoMateria(materia.nombreOficial, materia.tipo),
      obligatoria: materia.obligatoria !== false,
      activa: materia.activa !== false,
      materiaFirebaseId: texto(materia.materiaFirebaseId),
      origen: "malla"
    };
  }

  function sonLaMismaMateria(a, b) {
    if (texto(a.materiaFirebaseId) && texto(b.materiaFirebaseId) && texto(a.materiaFirebaseId) === texto(b.materiaFirebaseId)) return true;
    var nivelA = numero(a.nivelNumero, 0);
    var nivelB = numero(b.nivelNumero, 0);
    if (nivelA !== nivelB) return false;
    var codigoA = normalizar(a.codigo);
    var codigoB = normalizar(b.codigo);
    if (codigoA && codigoB && codigoA === codigoB) return true;
    return normalizar(a.nombreOficial) === normalizar(b.nombreOficial);
  }

  function fusionarMaterias(base, nuevas, origenNuevo) {
    var resultado = arr(base).slice();
    var agregadas = 0;
    arr(nuevas).forEach(function (materia) {
      if (!texto(materia.nombreOficial)) return;
      if (resultado.some(function (existente) { return sonLaMismaMateria(existente, materia); })) return;
      materia.origen = origenNuevo || materia.origen || "nueva";
      resultado.push(materia);
      agregadas += 1;
    });
    return { materias: resultado, agregadas: agregadas };
  }

  function etiquetaOrigen(materia) {
    if (materia.origen === "firebase_nueva") return '<span class="ml-origin ml-origin-new">Nueva en Firebase</span>';
    if (materia.origen === "manual") return '<span class="ml-origin ml-origin-new">Agregada</span>';
    if (materia.origen === "importada") return '<span class="ml-origin ml-origin-new">Importada</span>';
    if (materia.origen === "firebase") return '<span class="ml-origin">Firebase</span>';
    return "";
  }

  function pintarMaterias() {
    var contenedor = $("listaMateriasMalla");
    if (!contenedor) return;
    normalizarOrdenes();

    if (!estado.materias.length) {
      contenedor.innerHTML = '<div class="ml-empty">No hay materias. Usa “Agregar materia”.</div>';
      actualizarResumen();
      return;
    }

    var niveles = {};
    estado.materias.forEach(function (materia, indice) {
      var nivel = materia.nivelNumero;
      if (!niveles[nivel]) niveles[nivel] = [];
      niveles[nivel].push({ materia: materia, indice: indice });
    });

    contenedor.innerHTML = Object.keys(niveles).sort(function (a, b) { return Number(a) - Number(b); }).map(function (nivel) {
      var items = niveles[nivel];
      var filas = items.map(function (item) {
        var materia = item.materia;
        return '<div class="ml-matter" data-index="' + item.indice + '">' +
          '<input class="ml-matter-level" data-campo="nivelNumero" type="number" min="1" max="20" value="' + escapar(materia.nivelNumero) + '" title="Nivel" />' +
          '<input class="ml-matter-code" data-campo="codigo" type="text" value="' + escapar(materia.codigo) + '" placeholder="Código" />' +
          '<div class="ml-matter-name-wrap"><input class="ml-matter-name" data-campo="nombreOficial" type="text" value="' + escapar(materia.nombreOficial) + '" />' + etiquetaOrigen(materia) + '</div>' +
          '<div class="ml-matter-actions">' +
            '<button class="ml-icon-action" type="button" data-mover="arriba" title="Subir">↑</button>' +
            '<button class="ml-icon-action" type="button" data-mover="abajo" title="Bajar">↓</button>' +
            '<button class="ml-icon-action ml-icon-action-danger" type="button" data-eliminar-materia title="Quitar de la malla">×</button>' +
          '</div>' +
        '</div>';
      }).join("");
      return '<section class="ml-level"><div class="ml-level-head"><h3>' + escapar(nombreNivel(nivel)) + '</h3><span>' + items.length + (items.length === 1 ? " materia" : " materias") + '</span></div><div class="ml-matter-list">' + filas + '</div></section>';
    }).join("");
    actualizarResumen();
  }

  function actualizarResumen() {
    var total = estado.materias.length;
    var nuevas = estado.materias.filter(function (materia) {
      return materia.origen === "firebase_nueva" || materia.origen === "manual" || materia.origen === "importada";
    }).length;
    if ($("resumenTotalMaterias")) $("resumenTotalMaterias").textContent = total + (total === 1 ? " materia" : " materias");
    if ($("resumenOrigen")) {
      $("resumenOrigen").textContent = estado.mallaId ? (nuevas ? nuevas + " nuevas" : "Malla vigente") : "Desde Firebase";
    }
    if ($("mlResumenCarrera")) $("mlResumenCarrera").hidden = !estado.carrera;
    if ($("textoVersionActual")) {
      $("textoVersionActual").textContent = estado.mallaId
        ? "Versión " + numero($("inputVersion").value, 1) + " vigente"
        : "Nueva malla · versión " + numero($("inputVersion").value, 1);
    }
  }

  function leerRequisitos() {
    return texto($("inputRequisitos") && $("inputRequisitos").value).split(/\r?\n/).map(function (linea) { return texto(linea); })
      .filter(Boolean).map(function (nombre, indice) {
        var n = normalizar(nombre);
        return {
          orden: indice + 1,
          tipo: /idioma|nivel [a-c]\d/.test(n) ? "idioma" : (/digital/.test(n) ? "competencia_digital" : (/practica/.test(n) ? "practicas" : (/vinculacion/.test(n) ? "vinculacion" : "otro"))),
          nombre: nombre,
          activo: true
        };
      });
  }

  function escribirRequisitos(requisitos) {
    estado.requisitos = arr(requisitos);
    if ($("inputRequisitos")) $("inputRequisitos").value = estado.requisitos.map(function (item) { return texto(item.nombre || item); }).join("\n");
  }

  function siguienteVersion(carreraId) {
    return estado.mallas.filter(function (malla) { return texto(malla.carreraId) === texto(carreraId); })
      .reduce(function (max, malla) { return Math.max(max, numero(malla.version, 0)); }, 0) + 1;
  }

  function limpiarConfiguracion(carreraId) {
    estado.mallaId = "";
    $("inputVersion").value = siguienteVersion(carreraId);
    $("inputEstadoMalla").value = "vigente";
    $("inputPeriodoInicio").value = "";
    $("inputPeriodoFin").value = "";
    $("inputObservaciones").value = "";
    $("checkVigente").checked = true;
    escribirRequisitos([]);
  }

  function aplicarDetalleMalla(detalle) {
    estado.mallaId = detalle.malla.id;
    $("inputVersion").value = detalle.malla.version || 1;
    $("inputEstadoMalla").value = detalle.malla.estado || "vigente";
    $("inputPeriodoInicio").value = detalle.malla.periodoInicio || "";
    $("inputPeriodoFin").value = detalle.malla.periodoFin || "";
    $("inputObservaciones").value = detalle.malla.observaciones || "";
    $("checkVigente").checked = detalle.malla.vigente === true || detalle.malla.estado === "vigente";
    escribirRequisitos(detalle.requisitos || []);
  }

  async function obtenerMateriasFirebase(carrera) {
    if (!Firebase || typeof Firebase.obtenerMateriasPorCarrera !== "function") return [];
    var materias = await Firebase.obtenerMateriasPorCarrera(carrera.id, { soloCompletas: false, incluirRetiradas: false });
    return materias.map(convertirMateriaFirebase);
  }

  async function cargarCarrera(carreraId) {
    if (estado.cargandoCarrera || estado.guardando) return;
    var carrera = estado.carreras.find(function (item) { return texto(item.id) === texto(carreraId); }) || null;
    estado.carrera = carrera;

    if (!carrera) {
      estado.mallaId = "";
      estado.materias = [];
      $("panelMaterias").hidden = true;
      $("mlResumenCarrera").hidden = true;
      pintarEstado("neutral", "Selecciona una carrera", "Las materias se cargarán desde Firebase.");
      return;
    }

    try {
      estado.cargandoCarrera = true;
      setOcupado(true);
      $("panelMaterias").hidden = false;
      pintarEstado("neutral", "Cargando " + carrera.nombre, "Consultando materias y malla vigente.");

      var resultados = await Promise.all([
        Firebase.Mallas.obtenerMallaVigenteParaCarrera(carrera),
        obtenerMateriasFirebase(carrera)
      ]);
      var detalle = resultados[0];
      var materiasFirebase = resultados[1];

      if (detalle) {
        aplicarDetalleMalla(detalle);
        var materiasMalla = detalle.materias.map(convertirMateriaMalla);
        var mezcla = fusionarMaterias(materiasMalla, materiasFirebase, "firebase_nueva");
        estado.materias = mezcla.materias;
        pintarEstado(
          mezcla.agregadas ? "warn" : "ok",
          mezcla.agregadas ? "Malla actualizada para revisión" : "Malla cargada",
          mezcla.agregadas
            ? mezcla.agregadas + " materias de Firebase todavía no estaban en la malla. Revisa y guarda."
            : detalle.materias.length + " materias cargadas."
        );
      } else {
        limpiarConfiguracion(carrera.id);
        estado.materias = materiasFirebase;
        pintarEstado(
          materiasFirebase.length ? "ok" : "warn",
          materiasFirebase.length ? "Materias cargadas desde Firebase" : "Carrera sin materias",
          materiasFirebase.length
            ? materiasFirebase.length + " materias listas para crear la malla."
            : "Agrega las materias manualmente."
        );
      }

      normalizarOrdenes();
      pintarMaterias();
    } catch (error) {
      estado.materias = [];
      pintarMaterias();
      pintarEstado("error", "No se pudo cargar la carrera", error.message || error);
    } finally {
      estado.cargandoCarrera = false;
      setOcupado(false);
    }
  }

  function abrirAgregarMateria() {
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "Primero selecciona la carrera.");
      return;
    }
    var ultimoNivel = estado.materias.reduce(function (max, materia) { return Math.max(max, numero(materia.nivelNumero, 0)); }, 1);
    $("inputNuevaNivel").value = ultimoNivel;
    $("inputNuevaCodigo").value = "";
    $("inputNuevaNombre").value = "";
    abrirModal("modalAgregarMateria");
    window.setTimeout(function () { $("inputNuevaNombre").focus(); }, 50);
  }

  function agregarMateriaNueva() {
    var nombre = texto($("inputNuevaNombre").value);
    var nivel = Math.max(1, numero($("inputNuevaNivel").value, 1));
    var codigo = texto($("inputNuevaCodigo").value);
    if (!nombre) {
      pintarEstado("warn", "Nombre requerido", "Escribe el nombre de la materia.");
      return false;
    }
    var candidata = { nivelNumero: nivel, codigo: codigo, nombreOficial: nombre };
    if (estado.materias.some(function (materia) { return sonLaMismaMateria(materia, candidata); })) {
      pintarEstado("warn", "Materia duplicada", "La materia ya está en ese nivel.");
      return false;
    }
    var totalNivel = estado.materias.filter(function (materia) { return numero(materia.nivelNumero, 0) === nivel; }).length;
    estado.materias.push({
      nivelNumero: nivel,
      nivelNombre: nombreNivel(nivel),
      orden: totalNivel + 1,
      codigo: codigo,
      nombreOficial: nombre,
      tipo: tipoMateria(nombre),
      obligatoria: true,
      activa: true,
      origen: "manual"
    });
    pintarMaterias();
    pintarEstado("ok", "Materia agregada", nombre + " fue añadida a la malla.");
    cerrarModal("modalAgregarMateria");
    return true;
  }

  function moverMateria(indice, direccion) {
    var materia = estado.materias[indice];
    if (!materia) return;
    var mismoNivel = estado.materias.map(function (item, index) { return { item: item, index: index }; })
      .filter(function (dato) { return numero(dato.item.nivelNumero, 0) === numero(materia.nivelNumero, 0); });
    var posicion = mismoNivel.findIndex(function (dato) { return dato.index === indice; });
    var destino = direccion === "arriba" ? posicion - 1 : posicion + 1;
    if (destino < 0 || destino >= mismoNivel.length) return;
    var otra = mismoNivel[destino].item;
    var orden = materia.orden;
    materia.orden = otra.orden;
    otra.orden = orden;
    pintarMaterias();
  }

  function quitarMateria(indice) {
    var materia = estado.materias[indice];
    if (!materia) return;
    if (!window.confirm("¿Quitar \"" + materia.nombreOficial + "\" de esta malla?")) return;
    estado.materias.splice(indice, 1);
    pintarMaterias();
    pintarEstado("neutral", "Materia retirada", "Solo se quitó de la malla; no se eliminó de Firebase.");
  }

  function fuenteActual() {
    var archivo = estado.archivoFuente;
    return {
      tipo: estado.fuenteTipo || "firebase",
      archivoNombre: archivo ? archivo.name : "",
      archivoTipo: archivo ? archivo.type : "",
      archivoTamano: archivo ? archivo.size : 0,
      revisadaManualmente: true
    };
  }

  async function guardarMalla() {
    if (estado.guardando) return;
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "No hay una carrera seleccionada.");
      return;
    }
    normalizarOrdenes();
    var validacion = Parser.validarMaterias(estado.materias);
    if (!validacion.ok) {
      pintarEstado("error", "Revisa las materias", validacion.errores.join(" | "));
      return;
    }

    try {
      setOcupado(true);
      pintarEstado("neutral", "Guardando", "Registrando la malla en Firebase.");
      var vigente = $("checkVigente").checked && $("inputEstadoMalla").value === "vigente";
      var detalle = await Firebase.Mallas.guardarMalla({
        id: estado.mallaId,
        carreraId: estado.carrera.id,
        carreraNombre: estado.carrera.nombre,
        nombre: "Malla curricular de " + estado.carrera.nombre,
        version: numero($("inputVersion").value, 1),
        periodoInicio: texto($("inputPeriodoInicio").value),
        periodoFin: texto($("inputPeriodoFin").value),
        estado: texto($("inputEstadoMalla").value),
        vigente: vigente,
        observaciones: texto($("inputObservaciones").value),
        fuente: fuenteActual(),
        materias: estado.materias,
        requisitos: leerRequisitos()
      });
      aplicarDetalleMalla(detalle);
      estado.materias = detalle.materias.map(convertirMateriaMalla);
      await cargarMallas();
      pintarMaterias();
      pintarEstado("ok", "Malla guardada", detalle.materias.length + " materias · versión " + detalle.malla.version + ".");
    } catch (error) {
      pintarEstado("error", "No se pudo guardar", error.message || error);
    } finally {
      setOcupado(false);
    }
  }

  function crearNuevaVersion() {
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "Primero selecciona la carrera.");
      return;
    }
    estado.mallaId = "";
    estado.materias = estado.materias.map(function (materia) {
      var copia = Object.assign({}, materia);
      delete copia.id;
      copia.origen = copia.origen === "malla" ? "firebase" : copia.origen;
      return copia;
    });
    $("inputVersion").value = siguienteVersion(estado.carrera.id);
    $("inputEstadoMalla").value = "vigente";
    $("checkVigente").checked = true;
    actualizarResumen();
    cerrarModal("modalOpciones");
    pintarEstado("neutral", "Nueva versión", "Revisa las materias y guarda la versión " + $("inputVersion").value + ".");
  }

  function aplicarResultadoParser(resultado) {
    resultado = resultado || {};
    var nuevas = arr(resultado.materias).map(function (materia) {
      return {
        nivelNumero: Math.max(1, numero(materia.nivelNumero, 1)),
        nivelNombre: nombreNivel(materia.nivelNumero),
        orden: numero(materia.orden, 1),
        codigo: texto(materia.codigo),
        nombreOficial: texto(materia.nombreOficial),
        tipo: tipoMateria(materia.nombreOficial, materia.tipo),
        obligatoria: true,
        activa: true,
        origen: "importada"
      };
    });
    var mezcla = fusionarMaterias(estado.materias, nuevas, "importada");
    estado.materias = mezcla.materias;
    var requisitosNuevos = arr(resultado.requisitos);
    if (requisitosNuevos.length) {
      var existentes = leerRequisitos().map(function (item) { return item.nombre; });
      requisitosNuevos.forEach(function (item) {
        var nombre = texto(item.nombre || item);
        if (nombre && !existentes.some(function (e) { return normalizar(e) === normalizar(nombre); })) existentes.push(nombre);
      });
      $("inputRequisitos").value = existentes.join("\n");
    }
    pintarMaterias();
    pintarEstado(mezcla.agregadas ? "ok" : "warn", mezcla.agregadas ? "Materias agregadas" : "Sin cambios", mezcla.agregadas ? mezcla.agregadas + " materias se añadieron para revisión." : "Todas las materias ya estaban registradas.");
  }

  function procesarTexto(inputId) {
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "Primero selecciona la carrera.");
      return;
    }
    var contenido = texto($(inputId) && $(inputId).value);
    if (!contenido) {
      pintarEstado("warn", "Sin contenido", "Pega el contenido antes de procesarlo.");
      return;
    }
    aplicarResultadoParser(Parser.parsearTexto(contenido, { carrera: estado.carrera.nombre }));
  }

  async function procesarExcel() {
    var archivo = $("inputExcelMalla") && $("inputExcelMalla").files && $("inputExcelMalla").files[0];
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "Primero selecciona la carrera.");
      return;
    }
    if (!archivo) {
      pintarEstado("warn", "Sin archivo", "Selecciona un Excel.");
      return;
    }
    if (!window.XLSX) {
      pintarEstado("error", "Excel no disponible", "No se cargó el lector de Excel.");
      return;
    }
    try {
      setOcupado(true);
      var buffer = await archivo.arrayBuffer();
      var libro = window.XLSX.read(buffer, { type: "array" });
      var hoja = libro.Sheets[libro.SheetNames[0]];
      var filas = window.XLSX.utils.sheet_to_json(hoja, { defval: "", raw: false });
      estado.archivoFuente = archivo;
      estado.fuenteTipo = "excel";
      aplicarResultadoParser(Parser.parsearFilasExcel(filas));
    } catch (error) {
      pintarEstado("error", "No se pudo leer el Excel", error.message || error);
    } finally {
      setOcupado(false);
    }
  }

  function cambiarFuente(tipo) {
    estado.fuenteTipo = tipo;
    document.querySelectorAll("[data-source]").forEach(function (boton) {
      boton.classList.toggle("ml-source-tab-active", boton.getAttribute("data-source") === tipo);
    });
    document.querySelectorAll("[data-pane]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-pane") !== tipo;
    });
  }

  function mostrarPreviewDocumento(archivo) {
    var preview = $("previewDocumento");
    if (!preview) return;
    if (estado.urlPreview) URL.revokeObjectURL(estado.urlPreview);
    estado.urlPreview = archivo ? URL.createObjectURL(archivo) : "";
    if (!archivo) {
      preview.innerHTML = "<p>Selecciona un archivo.</p>";
      return;
    }
    if (/^image\//i.test(archivo.type)) preview.innerHTML = '<img src="' + escapar(estado.urlPreview) + '" alt="Vista previa" />';
    else preview.innerHTML = '<object data="' + escapar(estado.urlPreview) + '" type="application/pdf"><p>No se pudo mostrar el PDF.</p></object>';
  }

  function pintarVersiones() {
    var contenedor = $("listaVersiones");
    if (!contenedor) return;
    var lista = estado.carrera
      ? estado.mallas.filter(function (malla) { return texto(malla.carreraId) === texto(estado.carrera.id); })
      : estado.mallas;
    if (!lista.length) {
      contenedor.innerHTML = '<p class="ml-muted">No hay versiones guardadas.</p>';
      return;
    }
    contenedor.innerHTML = lista.map(function (malla) {
      var vigente = malla.vigente === true || malla.estado === "vigente";
      return '<article class="ml-version"><div><strong>' + escapar(malla.carreraNombre) + ' · versión ' + escapar(malla.version) +
        '<span class="ml-badge ' + (vigente ? "ml-badge-ok" : "ml-badge-off") + '">' + (vigente ? "Vigente" : escapar(malla.estado || "Histórica")) + '</span></strong>' +
        '<small>' + escapar(malla.totalMaterias || 0) + ' materias</small></div>' +
        '<div class="ml-row-actions"><button class="ml-mini" type="button" data-cargar-malla="' + escapar(malla.id) + '">Abrir</button>' +
        (!vigente ? '<button class="ml-mini" type="button" data-activar-malla="' + escapar(malla.id) + '">Activar</button>' : "") + '</div></article>';
    }).join("");
  }

  async function cargarMallas() {
    estado.mallas = await Firebase.Mallas.obtenerMallas();
    pintarVersiones();
  }

  async function cargarDetalle(mallaId) {
    try {
      setOcupado(true);
      pintarEstado("neutral", "Cargando versión", "Consultando Firebase.");
      var detalle = await Firebase.Mallas.obtenerDetalleMalla(mallaId);
      var carrera = estado.carreras.find(function (item) { return texto(item.id) === texto(detalle.malla.carreraId); }) || {
        id: detalle.malla.carreraId,
        nombre: detalle.malla.carreraNombre
      };
      estado.carrera = carrera;
      $("inputCarrera").value = carrera.id;
      aplicarDetalleMalla(detalle);
      var materiasFirebase = await obtenerMateriasFirebase(carrera);
      estado.materias = fusionarMaterias(detalle.materias.map(convertirMateriaMalla), materiasFirebase, "firebase_nueva").materias;
      $("panelMaterias").hidden = false;
      pintarMaterias();
      cerrarModal("modalHistorial");
      pintarEstado("ok", "Versión cargada", carrera.nombre + " · versión " + detalle.malla.version + ".");
    } catch (error) {
      pintarEstado("error", "No se pudo cargar", error.message || error);
    } finally {
      setOcupado(false);
    }
  }

  async function cargarCarreras() {
    estado.carreras = typeof Firebase.obtenerCarreras === "function" ? await Firebase.obtenerCarreras() : [];
    var selector = $("inputCarrera");
    selector.innerHTML = '<option value="">Selecciona una carrera</option>' + estado.carreras.map(function (carrera) {
      return '<option value="' + escapar(carrera.id) + '">' + escapar(carrera.nombre) + '</option>';
    }).join("");
  }

  function conectarEventos() {
    $("inputCarrera").addEventListener("change", function () { cargarCarrera(this.value); });
    $("btnGuardarMalla").addEventListener("click", guardarMalla);
    $("btnAgregarMateria").addEventListener("click", abrirAgregarMateria);
    $("btnOrdenarMaterias").addEventListener("click", function () { pintarMaterias(); pintarEstado("neutral", "Materias ordenadas", "Se organizaron por nivel y nombre."); });
    $("btnMasOpciones").addEventListener("click", function () { abrirModal("modalOpciones"); });
    $("btnHistorial").addEventListener("click", function () { pintarVersiones(); abrirModal("modalHistorial"); });
    $("btnNuevaVersion").addEventListener("click", crearNuevaVersion);
    $("btnRecargarMallas").addEventListener("click", function () {
      cargarMallas().catch(function (error) { pintarEstado("error", "No se pudo recargar", error.message || error); });
    });

    $("formAgregarMateria").addEventListener("submit", function (event) {
      event.preventDefault();
      agregarMateriaNueva();
    });

    document.addEventListener("click", function (event) {
      var cerrar = event.target.closest && event.target.closest("[data-cerrar-modal]");
      if (cerrar) cerrarModal(cerrar.getAttribute("data-cerrar-modal"));

      var eliminar = event.target.closest && event.target.closest("[data-eliminar-materia]");
      if (eliminar) {
        var filaEliminar = eliminar.closest("[data-index]");
        if (filaEliminar) quitarMateria(Number(filaEliminar.getAttribute("data-index")));
      }

      var mover = event.target.closest && event.target.closest("[data-mover]");
      if (mover) {
        var filaMover = mover.closest("[data-index]");
        if (filaMover) moverMateria(Number(filaMover.getAttribute("data-index")), mover.getAttribute("data-mover"));
      }

      var source = event.target.closest && event.target.closest("[data-source]");
      if (source) cambiarFuente(source.getAttribute("data-source"));

      var cargar = event.target.closest && event.target.closest("[data-cargar-malla]");
      if (cargar) cargarDetalle(cargar.getAttribute("data-cargar-malla"));

      var activar = event.target.closest && event.target.closest("[data-activar-malla]");
      if (activar) {
        Firebase.Mallas.activarMalla(activar.getAttribute("data-activar-malla"))
          .then(cargarMallas)
          .then(function () { pintarEstado("ok", "Malla activada", "La versión seleccionada quedó vigente."); })
          .catch(function (error) { pintarEstado("error", "No se pudo activar", error.message || error); });
      }
    });

    $("listaMateriasMalla").addEventListener("input", function (event) {
      var campo = event.target.getAttribute("data-campo");
      var fila = event.target.closest("[data-index]");
      if (!campo || !fila) return;
      var materia = estado.materias[Number(fila.getAttribute("data-index"))];
      if (!materia) return;
      materia[campo] = campo === "nivelNumero" ? Math.max(1, numero(event.target.value, 1)) : event.target.value;
      if (campo === "nivelNumero") materia.nivelNombre = nombreNivel(materia.nivelNumero);
    });
    $("listaMateriasMalla").addEventListener("change", function (event) {
      if (event.target.getAttribute("data-campo") === "nivelNumero") pintarMaterias();
    });

    $("btnProcesarTexto").addEventListener("click", function () { procesarTexto("inputTextoMalla"); });
    $("btnProcesarDocumento").addEventListener("click", function () { procesarTexto("inputTextoDocumento"); });
    $("btnProcesarExcel").addEventListener("click", procesarExcel);
    $("inputDocumentoMalla").addEventListener("change", function (event) {
      estado.archivoFuente = event.target.files && event.target.files[0] || null;
      estado.fuenteTipo = "documento";
      mostrarPreviewDocumento(estado.archivoFuente);
    });
    $("inputExcelMalla").addEventListener("change", function (event) {
      estado.archivoFuente = event.target.files && event.target.files[0] || null;
      estado.fuenteTipo = "excel";
    });
    $("inputVersion").addEventListener("input", actualizarResumen);
  }

  async function iniciar() {
    if (!Firebase || !Firebase.Mallas || !Parser) {
      pintarEstado("error", "Módulos no disponibles", "No se cargaron los componentes del módulo.");
      return;
    }
    try {
      conectarEventos();
      await Firebase.ready();
      await Promise.all([cargarCarreras(), cargarMallas()]);
      pintarEstado("neutral", "Selecciona una carrera", "Las materias se cargarán desde Firebase.");
    } catch (error) {
      pintarEstado("error", "No se pudo iniciar", error.message || error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})(window, document);
