"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts", "configurar-git-pull.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.ok(source.includes('pull.rebase'));
assert.ok(source.includes('rebase.autoStash'));
assert.ok(source.includes('branch.main.rebase'));
assert.strictEqual(pkg.scripts.prestart, "node scripts/configurar-git-pull.js");

console.log("Configuración automática de git pull verificada.");
