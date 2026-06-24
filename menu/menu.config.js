/* =========================================================
Nombre completo: menu.config.js
Ruta o ubicación: /menu/menu.config.js
Función o funciones:
- Definir la configuración central del menú Currículo
- Registrar las opciones Carreras, Materias, PEA, Fichas, Actas y Control
- Marcar la ruta por defecto del módulo
- Centralizar ids, títulos, hints y rutas del menú
========================================================= */
(function attachCurriculoMenuConfig(window) {
  "use strict";

  var items = [
    {
      id: "carreras",
      title: "Carreras",
      hint: "Gestión de carreras",
      routeFromMenu: "../carreras/frontend/carr.index.html"
    },
    {
      id: "materias",
      title: "Materias",
      hint: "Gestión de materias",
      routeFromMenu: "../materias/mat.index.html"
    },
    {
      id: "pea",
      title: "PEA",
      hint: "Gestión de PEA y versiones",
      routeFromMenu: "../pea_documentos/pea.index.html"
    },
    {
      id: "fichas",
      title: "Fichas",
      hint: "Gestión de fichas por asignatura",
      routeFromMenu: "../fichas/fch.index.html"
    },
    {
      id: "actas",
      title: "Actas",
      hint: "Gestión de actas por asignatura",
      routeFromMenu: "../actas/act.index.html"
    },
    {
      id: "control",
      title: "Control",
      hint: "Control global de PEA, fichas y actas",
      routeFromMenu: "../control/ctl.index.html"
    }
  ];

  window.CurriculoMenuConfig = {
    appTitle: "Currículo",
    defaultItemId: "carreras",
    items: items
  };
})(window);