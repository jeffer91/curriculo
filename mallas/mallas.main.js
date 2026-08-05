/* =========================================================
Nombre completo: mallas.main.js
Ruta o ubicación: /Curriculo/mallas/mallas.main.js
Funciones:
- Cargar materias existentes de Firebase al seleccionar una carrera.
- Corregir el nombre oficial de la carrera y de las materias.
- Agregar, ordenar y retirar materias sin utilizar códigos.
- Guardar versiones automáticas únicamente cuando existen cambios reales.
- Mantener importación e historial como opciones secundarias.
========================================================= */
(function (window, document) {
  "use strict";

  var Firebase = window.CurriculoFirebase;
  var Parser = window.MallasParser;
  var estado = {
    carrera: null,
    mallaId: "",
    mallaVersion: 0,
    carreras: [],
    mallas: [],
    materias: [],
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
      "btnProcesarExcel", "btnProcesarDocumento", "btnRecargarMallas"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = estado.guardando;
    });
    if ($("inputCarrera")) $("inputCarrera").disabled = estado.guardando;
    if ($("inputNombreCarrera")) $("inputNombreCarrera").disabled = estado.guardando || !estado.carrera;
  }

  function nombreNivel(nivel) {
    return "Nivel " + Math.max(1, numero(nivel, 1));
  }

  function nombreCarreraFirebase(carrera) {
    return texto(carrera && (carrera.nombreInstitucional || carrera.nombreCorregido || carrera.nombre));
  }

  function nombreMateriaFirebase(materia) {
    return texto(materia && (
      materia.nombreInstitucional || materia.nombreCorregido || materia.nombreMostrar ||
      materia.nombre || materia.nombreMateria || materia.materia
    ));
  }

  function tipoMateria(nombre, tipo) {
    if (texto(tipo)) return texto(tipo);
    return /integracion curricular/.test(normalizar(nombre)) ? "integracion_curricular" : "asignatura";
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
      delete materia.codigo;
    });
  }

  function convertirMateriaFirebase(materia, indice) {
    var nombre = nombreMateriaFirebase(materia);
    var nivel = Math.max(1, numero(materia.nivelNumero || materia.numeroNivel, 1));
    return {
      nivelNumero: nivel,
      nivelNombre: nombreNivel(nivel),
      orden: numero(materia.orden, indice + 1),
      nombreOficial: nombre,
      tipo: tipoMateria(nombre, materia.tipo),
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
      nivelNombre: nombreNivel(materia.nivelNumero),
      orden: numero(materia.orden, 1),
      nombreOficial: texto(materia.nombreOficial),
      tipo: tipoMateria(materia.nombreOficial, materia.tipo),
      obligatoria: materia.obligatoria !== false,
      activa: materia.activa !== false,
      materiaFirebaseId: texto(materia.materiaFirebaseId),
      origen: "malla"
    };
  }

  function sonLaMismaMateria(a, b) {
    if (texto(a.materiaFirebaseId) && texto(b.materiaFirebaseId)) {
      return texto(a.materiaFirebaseId) === texto(b.materiaFirebaseId);
    }
    return numero(a.nivelNumero, 0) === numero(b.nivelNumero, 0) &&
      normalizar(a.nombreOficial) === normalizar(b.nombreOficial);
  }

  function fusionarMaterias(base, nuevas, origenNuevo) {
    var resultado = arr(base).slice();
    var agregadas = 0;
    arr(nuevas).forEach(function (materia) {
      if (!texto(materia.nombreOficial)) return;
      var existente = resultado.find(function (item) { return sonLaMismaMateria(item, materia); });
      if (existente) {
        if (!existente.materiaFirebaseId && materia.materiaFirebaseId) existente.materiaFirebaseId = materia.materiaFirebaseId;
        return;
      }
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
    if (materia.materiaFirebaseId) return '<span class="ml-origin">Firebase</span>';
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
          '<div class="ml-matter-name-wrap"><input class="ml-matter-name" data-campo="nombreOficial" type="text" value="' + escapar(materia.nombreOficial) + '" aria-label="Nombre oficial de la materia" />' + etiquetaOrigen(materia) + '</div>' +
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
      $("resumenOrigen").textContent = estado.mallaVersion > 0 ? (nuevas ? nuevas + " nuevas" : "Malla vigente") : "Desde Firebase";
    }
    if ($("mlResumenCarrera")) $("mlResumenCarrera").hidden = !estado.carrera;
    if ($("textoVersionActual")) {
      $("textoVersionActual").textContent = estado.mallaVersion > 0
        ? "Versión " + estado.mallaVersion + " vigente"
        : "La versión se asignará al guardar";
    }
  }

  function limpiarConfiguracion() {
    estado.mallaId = "";
    estado.mallaVersion = 0;
    if ($("inputObservaciones")) $("inputObservaciones").value = "";
  }

  function aplicarDetalleMalla(detalle) {
    estado.mallaId = detalle.malla.id;
    estado.mallaVersion = numero(detalle.malla.version, 1);
    $("inputNombreCarrera").value = texto(detalle.malla.carreraNombre) || nombreCarreraFirebase(estado.carrera);
    $("inputObservaciones").value = texto(detalle.malla.observaciones);
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
      limpiarConfiguracion();
      estado.materias = [];
      $("inputNombreCarrera").value = "";
      $("inputNombreCarrera").disabled = true;
      $("panelMaterias").hidden = true;
      $("mlResumenCarrera").hidden = true;
      pintarEstado("neutral", "Selecciona una carrera", "Las materias se cargarán desde Firebase.");
      return;
    }

    try {
      estado.cargandoCarrera = true;
      setOcupado(true);
      $("panelMaterias").hidden = false;
      $("inputNombreCarrera").value = nombreCarreraFirebase(carrera);
      pintarEstado("neutral", "Cargando " + nombreCarreraFirebase(carrera), "Consultando materias y malla vigente.");

      var resultados = await Promise.all([
        Firebase.Mallas.obtenerMallaVigenteParaCarrera(carrera),
        obtenerMateriasFirebase(carrera)
      ]);
      var detalle = resultados[0];
      var materiasFirebase = resultados[1];

      if (detalle) {
        aplicarDetalleMalla(detalle);
        var mezcla = fusionarMaterias(detalle.materias.map(convertirMateriaMalla), materiasFirebase, "firebase_nueva");
        estado.materias = mezcla.materias;
        pintarEstado(
          mezcla.agregadas ? "warn" : "ok",
          mezcla.agregadas ? "Revisa las materias nuevas" : "Malla cargada",
          mezcla.agregadas
            ? mezcla.agregadas + " materias de Firebase todavía no estaban en la malla."
            : detalle.materias.length + " materias cargadas."
        );
      } else {
        limpiarConfiguracion();
        estado.materias = materiasFirebase;
        pintarEstado(
          materiasFirebase.length ? "ok" : "warn",
          materiasFirebase.length ? "Materias cargadas desde Firebase" : "Carrera sin materias",
          materiasFirebase.length
            ? materiasFirebase.length + " materias listas para crear la malla."
            : "Agrega las materias manualmente."
        );
      }

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
    $("inputNuevaNombre").value = "";
    abrirModal("modalAgregarMateria");
    window.setTimeout(function () { $("inputNuevaNombre").focus(); }, 50);
  }

  function agregarMateriaNueva() {
    var nombre = texto($("inputNuevaNombre").value);
    var nivel = Math.max(1, numero($("inputNuevaNivel").value, 1));
    if (!nombre) {
      pintarEstado("warn", "Nombre requerido", "Escribe el nombre de la materia.");
      return false;
    }
    var candidata = { nivelNumero: nivel, nombreOficial: nombre };
    if (estado.materias.some(function (materia) { return sonLaMismaMateria(materia, candidata); })) {
      pintarEstado("warn", "Materia duplicada", "La materia ya está en ese nivel.");
      return false;
    }
    var totalNivel = estado.materias.filter(function (materia) { return numero(materia.nivelNumero, 0) === nivel; }).length;
    estado.materias.push({
      nivelNumero: nivel,
      nivelNombre: nombreNivel(nivel),
      orden: totalNivel + 1,
      nombreOficial: nombre,
      tipo: tipoMateria(nombre),
      obligatoria: true,
      activa: true,
      materiaFirebaseId: "",
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

  function ordenarMaterias() {
    var niveles = {};
    estado.materias.forEach(function (materia) {
      var nivel = Math.max(1, numero(materia.nivelNumero, 1));
      if (!niveles[nivel]) niveles[nivel] = [];
      niveles[nivel].push(materia);
    });
    Object.keys(niveles).forEach(function (nivel) {
      niveles[nivel].sort(function (a, b) { return texto(a.nombreOficial).localeCompare(texto(b.nombreOficial), "es"); });
      niveles[nivel].forEach(function (materia, indice) { materia.orden = indice + 1; });
    });
    pintarMaterias();
    pintarEstado("neutral", "Materias ordenadas", "Se organizaron alfabéticamente dentro de cada nivel.");
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

  function actualizarNombreCarreraLocal(nombreOficial) {
    if (!estado.carrera) return;
    estado.carrera.nombre = nombreOficial;
    estado.carrera.nombreInstitucional = nombreOficial;
    estado.carrera.nombreCorregido = nombreOficial;
    var opcion = $("inputCarrera").querySelector('option[value="' + estado.carrera.id.replace(/"/g, '\\"') + '"]');
    if (opcion) opcion.textContent = nombreOficial;
  }

  async function guardarMalla() {
    if (estado.guardando) return;
    if (!estado.carrera) {
      pintarEstado("warn", "Selecciona una carrera", "No hay una carrera seleccionada.");
      return;
    }

    var nombreCarrera = texto($("inputNombreCarrera").value);
    if (!nombreCarrera) {
      pintarEstado("warn", "Nombre requerido", "Escribe el nombre oficial de la carrera.");
      $("inputNombreCarrera").focus();
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
      pintarEstado("neutral", "Guardando", "Comprobando cambios y actualizando Firebase.");
      var detalle = await Firebase.Mallas.guardarMalla({
        carreraId: estado.carrera.id,
        carreraNombre: nombreCarrera,
        observaciones: texto($("inputObservaciones").value),
        fuente: fuenteActual(),
        materias: estado.materias
      });
      actualizarNombreCarreraLocal(nombreCarrera);
      aplicarDetalleMalla(detalle);
      estado.materias = detalle.materias.map(convertirMateriaMalla);
      await cargarMallas();
      pintarMaterias();
      cerrarModal("modalOpciones");
      pintarEstado(
        detalle.sinCambios ? "neutral" : "ok",
        detalle.sinCambios ? "Sin cambios" : "Malla guardada",
        detalle.sinCambios
          ? "La malla ya estaba actualizada."
          : detalle.materias.length + " materias · versión " + detalle.malla.version + " creada automáticamente."
      );
    } catch (error) {
      pintarEstado("error", "No se pudo guardar", error.message || error);
    } finally {
      setOcupado(false);
    }
  }

  function aplicarResultadoParser(resultado) {
    resultado = resultado || {};
    var nuevas = arr(resultado.materias).map(function (materia) {
      return {
        nivelNumero: Math.max(1, numero(materia.nivelNumero, 1)),
        nivelNombre: nombreNivel(materia.nivelNumero),
        orden: numero(materia.orden, 1),
        nombreOficial: texto(materia.nombreOficial),
        tipo: tipoMateria(materia.nombreOficial, materia.tipo),
        obligatoria: true,
        activa: true,
        materiaFirebaseId: "",
        origen: "importada"
      };
    });
    var mezcla = fusionarMaterias(estado.materias, nuevas, "importada");
    estado.materias = mezcla.materias;
    pintarMaterias();
    pintarEstado(
      mezcla.agregadas ? "ok" : "warn",
      mezcla.agregadas ? "Materias agregadas" : "Sin cambios",
      mezcla.agregadas ? mezcla.agregadas + " materias se añadieron para revisión." : "Todas las materias ya estaban registradas."
    );
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
    aplicarResultadoParser(Parser.parsearTexto(contenido, { carrera: texto($("inputNombreCarrera").value) }));
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
        '<span class="ml-badge ' + (vigente ? "ml-badge-ok" : "ml-badge-off") + '">' + (vigente ? "Vigente" : "Histórica") + '</span></strong>' +
        '<small>' + escapar(malla.totalMaterias || 0) + ' materias</small></div>' +
        '<div class="ml-row-actions"><button class="ml-mini" type="button" data-cargar-malla="' + escapar(malla.id) + '">Abrir</button></div></article>';
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
      $("inputNombreCarrera").disabled = false;
      pintarMaterias();
      cerrarModal("modalHistorial");
      pintarEstado(
        detalle.malla.vigente === true ? "ok" : "neutral",
        detalle.malla.vigente === true ? "Versión vigente cargada" : "Versión histórica cargada",
        "Al guardar cambios se creará automáticamente una nueva versión vigente."
      );
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
      return '<option value="' + escapar(carrera.id) + '">' + escapar(nombreCarreraFirebase(carrera)) + '</option>';
    }).join("");
  }

  function conectarEventos() {
    $("inputCarrera").addEventListener("change", function () { cargarCarrera(this.value); });
    $("btnGuardarMalla").addEventListener("click", guardarMalla);
    $("btnAgregarMateria").addEventListener("click", abrirAgregarMateria);
    $("btnOrdenarMaterias").addEventListener("click", ordenarMaterias);
    $("btnMasOpciones").addEventListener("click", function () { abrirModal("modalOpciones"); });
    $("btnHistorial").addEventListener("click", function () { pintarVersiones(); abrirModal("modalHistorial"); });
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
