"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function configurar(clave, valor) {
  try {
    execFileSync("git", ["config", "--local", clave, valor], {
      cwd: ROOT,
      stdio: "ignore",
      windowsHide: true
    });
  } catch (error) {
    // La app también puede ejecutarse fuera de un clon Git. No bloquear inicio.
  }
}

// Mantener `git pull` sin commits de merge ni apertura de editor.
// En una copia alineada con origin/main sigue siendo un fast-forward normal.
configurar("pull.rebase", "true");
configurar("rebase.autoStash", "true");
configurar("branch.main.rebase", "true");
