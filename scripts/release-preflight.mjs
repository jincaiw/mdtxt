import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const tauriVersion = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const cargoVersion = /^version = "([^"]+)"/m.exec(readFileSync("src-tauri/Cargo.toml", "utf8"))?.[1];

if (!cargoVersion || new Set([packageVersion, tauriVersion, cargoVersion]).size !== 1) {
    throw new Error(`Version mismatch: package=${packageVersion}, tauri=${tauriVersion}, cargo=${cargoVersion ?? "missing"}`);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes(`## [${packageVersion}]`)) {
    throw new Error(`CHANGELOG.md is missing the ${packageVersion} release section.`);
}

execFileSync(process.execPath, ["scripts/check-product-identity.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-i18n.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-user-copy.mjs", "--enforce"], { stdio: "inherit" });
console.log(`Release preflight passed for v${packageVersion}.`);
