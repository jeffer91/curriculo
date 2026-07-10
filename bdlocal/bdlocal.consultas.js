/* =========================================================
Nombre completo: bdlocal.consultas.js
Ruta o ubicación: /gestion-curricular-ccc/bdlocal/bdlocal.consultas.js
Función o funciones:
- Crear consultas avanzadas para futuras pantallas.
- Obtener árbol curricular completo: carrera, matriz, niveles, materias y archivos.
- Buscar materias, carreras, niveles y archivos por texto.
- Consultar resumen por carrera, nivel, estado y tipo de archivo.
- Entregar datos ya organizados para pantallas rápidas sin volver a leer el ZIP.
========================================================= */

(function (window) {
  "use strict";

  window.BDLocalCCC = window.BDLocalCCC || {};

  var NS = window.BDLocalCCC;
  var Schema = NS.Schema;
  var Core = NS.Core;

  if (!Schema) {
    console.error("[BDLocalCCC.Consultas] Falta cargar primero bdlocal.schema.js");
    return;
  }

  if (!Core) {
    console.error("[BDLocalCCC.Consultas] Falta cargar primero bdlocal.core.js");
    return;
  }

  function fecha() {
    return Schema.fechaISO();
  }

  function ordenarNombre(a, b) {
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
      sensitivity: "base"
    });
  }

  function ordenarNivel(a, b) {
    var na = Number(a.numero || 0);
    var nb = Number(b.numero || 0);

    if (na !== nb) return na - nb;

    return ordenarNombre(a, b);
  }

  function ordenarMateria(a, b) {
    var ca = String(a.codigo || "");
    var cb = String(b.codigo || "");

    if (ca && cb && ca !== cb) {
      return ca.localeCompare(cb, "es", { sensitivity: "base" });
    }

    return ordenarNombre(a, b);
  }

  function limpiarTexto(valor) {
    return Schema.normalizarTexto(valor || "");
  }

  function coincideTexto(valor, consulta) {
    return limpiarTexto(valor).includes(consulta);
  }

  async function obtenerTodo() {
    var carreras = await Core.getAll(Schema.STORES.CARRERAS);
    var matrices = await Core.getAll(Schema.STORES.MATRICES);
    var niveles = await Core.getAll(Schema.STORES.NIVELES);
    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var archivos = await Core.getAll(Schema.STORES.PEA_ARCHIVOS);
    var validaciones = await Core.getAll(Schema.STORES.VALIDACIONES);
    var cargas = await Core.getAll(Schema.STORES.CARGAS_ZIP);

    return {
      generadoEn: fecha(),
      carreras: carreras,
      matrices: matrices,
      niveles: niveles,
      materias: materias,
      archivos: archivos,
      validaciones: validaciones,
      cargas: cargas
    };
  }

  async function obtenerArbolCurricular() {
    var data = await obtenerTodo();

    var arbol = data.carreras.sort(ordenarNombre).map(function (carrera) {
      var matricesCarrera = data.matrices
        .filter(function (matriz) {
          return matriz.carreraId === carrera.id;
        })
        .sort(ordenarNombre)
        .map(function (matriz) {
          var nivelesMatriz = data.niveles
            .filter(function (nivel) {
              return nivel.carreraId === carrera.id && (!nivel.matrizId || nivel.matrizId === matriz.id);
            })
            .sort(ordenarNivel)
            .map(function (nivel) {
              var materiasNivel = data.materias
                .filter(function (materia) {
                  return materia.nivelId === nivel.id;
                })
                .sort(ordenarMateria)
                .map(function (materia) {
                  var archivosMateria = data.archivos.filter(function (archivo) {
                    return archivo.materiaId === materia.id;
                  });

                  var validacionesMateria = data.validaciones.filter(function (validacion) {
                    return validacion.materiaId === materia.id && validacion.estado !== "resuelto";
                  });

                  return Object.assign({}, materia, {
                    archivos: archivosMateria,
                    validaciones: validacionesMateria,
                    resumenArchivos: resumenArchivosMateria(archivosMateria)
                  });
                });

              return Object.assign({}, nivel, {
                materias: materiasNivel,
                resumen: resumenMaterias(materiasNivel)
              });
            });

          return Object.assign({}, matriz, {
            niveles: nivelesMatriz,
            resumen: resumenNiveles(nivelesMatriz)
          });
        });

      return Object.assign({}, carrera, {
        matrices: matricesCarrera,
        resumen: resumenCarrera(carrera.id, data.niveles, data.materias, data.archivos)
      });
    });

    return {
      generadoEn: fecha(),
      arbol: arbol
    };
  }

  function resumenArchivosMateria(archivos) {
    archivos = Array.isArray(archivos) ? archivos : [];

    return {
      total: archivos.length,
      base: archivos.some(function (a) { return a.tipo === Schema.TIPOS_PEA.BASE; }),
      unidades: archivos.some(function (a) { return a.tipo === Schema.TIPOS_PEA.UNIDADES; }),
      actividades: archivos.some(function (a) { return a.tipo === Schema.TIPOS_PEA.ACTIVIDADES; }),
      noIdentificados: archivos.filter(function (a) { return !a.tipo; }).length,
      bajaConfianza: archivos.filter(function (a) {
        return typeof a.confianza === "number" && a.confianza > 0 && a.confianza < 70;
      }).length
    };
  }

  function resumenMaterias(materias) {
    materias = Array.isArray(materias) ? materias : [];

    return {
      totalMaterias: materias.length,
      completas: materias.filter(function (m) {
        return m.estadoValidacion === Schema.ESTADOS_VALIDACION.COMPLETO;
      }).length,
      incompletas: materias.filter(function (m) {
        return m.estadoValidacion === Schema.ESTADOS_VALIDACION.INCOMPLETO;
      }).length,
      revision: materias.filter(function (m) {
        return m.estadoValidacion === Schema.ESTADOS_VALIDACION.REVISION;
      }).length,
      pendientes: materias.filter(function (m) {
        return !m.estadoValidacion || m.estadoValidacion === Schema.ESTADOS_VALIDACION.PENDIENTE;
      }).length
    };
  }

  function resumenNiveles(niveles) {
    niveles = Array.isArray(niveles) ? niveles : [];

    var totalMaterias = 0;
    var completas = 0;
    var incompletas = 0;
    var revision = 0;

    niveles.forEach(function (nivel) {
      var r = resumenMaterias(nivel.materias || []);
      totalMaterias += r.totalMaterias;
      completas += r.completas;
      incompletas += r.incompletas;
      revision += r.revision;
    });

    return {
      totalNiveles: niveles.length,
      totalMaterias: totalMaterias,
      completas: completas,
      incompletas: incompletas,
      revision: revision
    };
  }

  function resumenCarrera(carreraId, niveles, materias, archivos) {
    var nivelesCarrera = niveles.filter(function (nivel) {
      return nivel.carreraId === carreraId;
    });

    var materiasCarrera = materias.filter(function (materia) {
      return materia.carreraId === carreraId;
    });

    var archivosCarrera = archivos.filter(function (archivo) {
      return archivo.carreraId === carreraId;
    });

    var resumen = resumenMaterias(materiasCarrera);

    return Object.assign({}, resumen, {
      totalNiveles: nivelesCarrera.length,
      totalArchivos: archivosCarrera.length,
      archivosBase: archivosCarrera.filter(function (a) {
        return a.tipo === Schema.TIPOS_PEA.BASE;
      }).length,
      archivosUnidades: archivosCarrera.filter(function (a) {
        return a.tipo === Schema.TIPOS_PEA.UNIDADES;
      }).length,
      archivosActividades: archivosCarrera.filter(function (a) {
        return a.tipo === Schema.TIPOS_PEA.ACTIVIDADES;
      }).length
    });
  }

  async function obtenerDashboard() {
    var data = await obtenerTodo();

    var resumenGeneral = {
      generadoEn: fecha(),
      totalCargas: data.cargas.length,
      totalCarreras: data.carreras.length,
      totalMatrices: data.matrices.length,
      totalNiveles: data.niveles.length,
      totalMaterias: data.materias.length,
      totalArchivos: data.archivos.length,
      totalValidaciones: data.validaciones.filter(function (v) {
        return v.estado !== "resuelto";
      }).length,
      materias: resumenMaterias(data.materias),
      archivos: {
        base: data.archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.BASE; }).length,
        unidades: data.archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.UNIDADES; }).length,
        actividades: data.archivos.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.ACTIVIDADES; }).length,
        noIdentificados: data.archivos.filter(function (a) { return !a.tipo; }).length
      },
      ultimaCarga: data.cargas.sort(function (a, b) {
        return String(b.fechaCarga || b.creadoEn || "").localeCompare(String(a.fechaCarga || a.creadoEn || ""));
      })[0] || null
    };

    return resumenGeneral;
  }

  async function obtenerResumenPorNivel(carreraId) {
    var niveles = await Core.getAllByIndex(Schema.STORES.NIVELES, "carreraId", carreraId);
    var materias = await Core.getAllByIndex(Schema.STORES.MATERIAS, "carreraId", carreraId);
    var archivos = await Core.getAllByIndex(Schema.STORES.PEA_ARCHIVOS, "carreraId", carreraId);

    return niveles.sort(ordenarNivel).map(function (nivel) {
      var materiasNivel = materias.filter(function (materia) {
        return materia.nivelId === nivel.id;
      });

      var archivosNivel = archivos.filter(function (archivo) {
        return archivo.nivelId === nivel.id;
      });

      return Object.assign({}, nivel, {
        resumen: Object.assign({}, resumenMaterias(materiasNivel), {
          totalArchivos: archivosNivel.length,
          archivosBase: archivosNivel.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.BASE; }).length,
          archivosUnidades: archivosNivel.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.UNIDADES; }).length,
          archivosActividades: archivosNivel.filter(function (a) { return a.tipo === Schema.TIPOS_PEA.ACTIVIDADES; }).length
        })
      });
    });
  }

  async function obtenerMateriasPorEstado(estado) {
    var materias = await Core.getAll(Schema.STORES.MATERIAS);

    return materias
      .filter(function (materia) {
        return materia.estadoValidacion === estado;
      })
      .sort(ordenarMateria);
  }

  async function obtenerMateriasCompletas() {
    return await obtenerMateriasPorEstado(Schema.ESTADOS_VALIDACION.COMPLETO);
  }

  async function obtenerMateriasIncompletasDetalle() {
    var materias = await Core.getAll(Schema.STORES.MATERIAS);
    var archivos = await Core.getAll(Schema.STORES.PEA_ARCHIVOS);
    var validaciones = await Core.getAll(Schema.STORES.VALIDACIONES);

    return materias
      .filter(function (materia) {
        return materia.estadoValidacion !== Schema.ESTADOS_VALIDACION.COMPLETO;
      })
      .sort(ordenarMateria)
      .map(function (materia) {
        var archivosMateria = archivos.filter(function (archivo) {
          return archivo.materiaId === materia.id;
        });

        var validacionesMateria = validaciones.filter(function (validacion) {
          return validacion.materiaId === materia.id && validacion.estado !== "resuelto";
        });

        return Object.assign({}, materia, {
          archivos: archivosMateria,
          validaciones: validacionesMateria,
          resumenArchivos: resumenArchivosMateria(archivosMateria)
        });
      });
  }

  async function obtenerDetalleMateria(materiaId) {
    var materia = await Core.get(Schema.STORES.MATERIAS, materiaId);

    if (!materia) {
      throw new Error("No se encontró la materia con id: " + materiaId);
    }

    var carrera = materia.carreraId ? await Core.get(Schema.STORES.CARRERAS, materia.carreraId) : null;
    var matriz = materia.matrizId ? await Core.get(Schema.STORES.MATRICES, materia.matrizId) : null;
    var nivel = materia.nivelId ? await Core.get(Schema.STORES.NIVELES, materia.nivelId) : null;
    var archivos = await Core.getAllByIndex(Schema.STORES.PEA_ARCHIVOS, "materiaId", materiaId);
    var validaciones = await Core.getAllByIndex(Schema.STORES.VALIDACIONES, "materiaId", materiaId);
    var base = await Core.get(Schema.STORES.PEA_BASE, materiaId);
    var unidades = await Core.getAllByIndex(Schema.STORES.PEA_UNIDADES, "materiaId", materiaId);
    var actividades = await Core.getAllByIndex(Schema.STORES.PEA_ACTIVIDADES, "materiaId", materiaId);

    return {
      generadoEn: fecha(),
      carrera: carrera,
      matriz: matriz,
      nivel: nivel,
      materia: materia,
      archivos: archivos,
      resumenArchivos: resumenArchivosMateria(archivos),
      validaciones: validaciones,
      pea: {
        base: base || null,
        unidades: unidades || [],
        actividades: actividades || []
      }
    };
  }

  async function buscarGlobal(textoBusqueda, opciones) {
    opciones = opciones || {};

    var consulta = limpiarTexto(textoBusqueda);

    if (!consulta) {
      return {
        generadoEn: fecha(),
        consulta: "",
        carreras: [],
        niveles: [],
        materias: [],
        archivos: []
      };
    }

    var data = await obtenerTodo();

    var carreras = data.carreras.filter(function (carrera) {
      return coincideTexto(carrera.nombre, consulta);
    });

    var niveles = data.niveles.filter(function (nivel) {
      return coincideTexto(nivel.nombre, consulta) || coincideTexto(nivel.numero, consulta);
    });

    var materias = data.materias.filter(function (materia) {
      return coincideTexto(materia.codigo, consulta) ||
        coincideTexto(materia.nombre, consulta) ||
        coincideTexto(materia.estadoValidacion, consulta);
    });

    var archivos = data.archivos.filter(function (archivo) {
      return coincideTexto(archivo.nombreArchivo, consulta) ||
        coincideTexto(archivo.rutaOriginal, consulta) ||
        coincideTexto(archivo.tipo, consulta);
    });

    var limite = Number(opciones.limite || 100);

    return {
      generadoEn: fecha(),
      consulta: textoBusqueda,
      carreras: carreras.sort(ordenarNombre).slice(0, limite),
      niveles: niveles.sort(ordenarNivel).slice(0, limite),
      materias: materias.sort(ordenarMateria).slice(0, limite),
      archivos: archivos.slice(0, limite)
    };
  }

  async function obtenerArchivosPorTipo(tipo) {
    var archivos = await Core.getAllByIndex(Schema.STORES.PEA_ARCHIVOS, "tipo", tipo);

    return archivos.sort(function (a, b) {
      return String(a.nombreArchivo || "").localeCompare(String(b.nombreArchivo || ""), "es", {
        sensitivity: "base"
      });
    });
  }

  async function obtenerUltimasCargas(limite) {
    limite = Number(limite || 10);

    var cargas = await Core.getAll(Schema.STORES.CARGAS_ZIP);

    return cargas
      .sort(function (a, b) {
        return String(b.fechaCarga || b.creadoEn || "").localeCompare(String(a.fechaCarga || a.creadoEn || ""));
      })
      .slice(0, limite);
  }

  async function obtenerMapaRapido() {
    var data = await obtenerTodo();

    var mapa = {
      generadoEn: fecha(),
      carrerasPorId: {},
      matricesPorId: {},
      nivelesPorId: {},
      materiasPorId: {},
      archivosPorMateriaId: {}
    };

    data.carreras.forEach(function (item) {
      mapa.carrerasPorId[item.id] = item;
    });

    data.matrices.forEach(function (item) {
      mapa.matricesPorId[item.id] = item;
    });

    data.niveles.forEach(function (item) {
      mapa.nivelesPorId[item.id] = item;
    });

    data.materias.forEach(function (item) {
      mapa.materiasPorId[item.id] = item;
      mapa.archivosPorMateriaId[item.id] = [];
    });

    data.archivos.forEach(function (archivo) {
      if (!mapa.archivosPorMateriaId[archivo.materiaId]) {
        mapa.archivosPorMateriaId[archivo.materiaId] = [];
      }

      mapa.archivosPorMateriaId[archivo.materiaId].push(archivo);
    });

    return mapa;
  }

  async function construirTablaMaterias() {
    var data = await obtenerTodo();

    return data.materias.sort(ordenarMateria).map(function (materia) {
      var carrera = data.carreras.find(function (c) {
        return c.id === materia.carreraId;
      });

      var nivel = data.niveles.find(function (n) {
        return n.id === materia.nivelId;
      });

      var archivosMateria = data.archivos.filter(function (archivo) {
        return archivo.materiaId === materia.id;
      });

      var resumenArchivos = resumenArchivosMateria(archivosMateria);

      return {
        carreraId: materia.carreraId,
        carrera: carrera ? carrera.nombre : "",
        nivelId: materia.nivelId,
        nivel: nivel ? nivel.nombre : "",
        numeroNivel: nivel ? nivel.numero : 0,
        materiaId: materia.id,
        codigo: materia.codigo,
        materia: materia.nombre,
        estado: materia.estadoValidacion,
        peaBase: resumenArchivos.base,
        peaUnidades: resumenArchivos.unidades,
        peaActividades: resumenArchivos.actividades,
        totalArchivos: resumenArchivos.total,
        noIdentificados: resumenArchivos.noIdentificados,
        bajaConfianza: resumenArchivos.bajaConfianza
      };
    });
  }

  NS.Consultas = {
    obtenerTodo: obtenerTodo,
    obtenerArbolCurricular: obtenerArbolCurricular,
    obtenerDashboard: obtenerDashboard,
    obtenerResumenPorNivel: obtenerResumenPorNivel,
    obtenerMateriasPorEstado: obtenerMateriasPorEstado,
    obtenerMateriasCompletas: obtenerMateriasCompletas,
    obtenerMateriasIncompletasDetalle: obtenerMateriasIncompletasDetalle,
    obtenerDetalleMateria: obtenerDetalleMateria,
    buscarGlobal: buscarGlobal,
    obtenerArchivosPorTipo: obtenerArchivosPorTipo,
    obtenerUltimasCargas: obtenerUltimasCargas,
    obtenerMapaRapido: obtenerMapaRapido,
    construirTablaMaterias: construirTablaMaterias,
    resumenArchivosMateria: resumenArchivosMateria
  };

  NS.obtenerArbolCurricular = obtenerArbolCurricular;
  NS.obtenerDashboard = obtenerDashboard;
  NS.obtenerResumenPorNivel = obtenerResumenPorNivel;
  NS.obtenerMateriasCompletas = obtenerMateriasCompletas;
  NS.obtenerMateriasIncompletasDetalle = obtenerMateriasIncompletasDetalle;
  NS.obtenerDetalleMateria = obtenerDetalleMateria;
  NS.buscarGlobal = buscarGlobal;
  NS.obtenerUltimasCargas = obtenerUltimasCargas;
  NS.construirTablaMaterias = construirTablaMaterias;
})(window);