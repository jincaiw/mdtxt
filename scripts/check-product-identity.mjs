import { readFileSync } from "node:fs";

const expected = {
  name: "mdtxt",
  version: "0.1.0",
  identifier: "app.mdtxt.desktop",
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");

const cargoPackage = /^name = "([^"]+)"/m.exec(cargo)?.[1];
const cargoVersion = /^version = "([^"]+)"/m.exec(cargo)?.[1];
const cargoLib = /\[lib\][\s\S]*?^name = "([^"]+)"/m.exec(cargo)?.[1];
const failures = [];

if (pkg.name !== expected.name) failures.push(`package name=${pkg.name}`);
if (pkg.version !== expected.version) failures.push(`package version=${pkg.version}`);
if (tauri.productName !== expected.name) failures.push(`productName=${tauri.productName}`);
if (tauri.version !== expected.version) failures.push(`tauri version=${tauri.version}`);
if (tauri.identifier !== expected.identifier) failures.push(`identifier=${tauri.identifier}`);
if (cargoPackage !== expected.name) failures.push(`cargo package=${cargoPackage ?? "missing"}`);
if (cargoVersion !== expected.version) failures.push(`cargo version=${cargoVersion ?? "missing"}`);
if (cargoLib !== "mdtxt_lib") failures.push(`cargo lib=${cargoLib ?? "missing"}`);
if (tauri.plugins?.updater) failures.push("updater must be disabled until mdtxt has an owned endpoint");
if (tauri.bundle?.createUpdaterArtifacts) failures.push("updater artifacts must be disabled without mdtxt signing keys");

if (failures.length) {
  throw new Error(`Product identity check failed: ${failures.join("; ")}`);
}

console.log(`Product identity passed: ${expected.name} v${expected.version} (${expected.identifier}).`);
