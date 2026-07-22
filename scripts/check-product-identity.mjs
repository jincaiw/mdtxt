import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const expected = {
  name: "mdtxt",
  version: "0.1.0",
  identifier: "app.mdtxt.desktop",
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const testBuildWorkflow = readFileSync(".github/workflows/test-build.yml", "utf8");
const issueConfig = readFileSync(".github/ISSUE_TEMPLATE/config.yml", "utf8");
const bugTemplate = readFileSync(".github/ISSUE_TEMPLATE/bug_report.yml", "utf8");

const collectText = (directory) => readdirSync(directory)
  .flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? collectText(path) : [path];
  })
  .filter((path) => /\.(astro|css|html|js|json|md|svg|ts|tsx)$/.test(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const docsSurface = [collectText("docs/src"), collectText("docs/public"), readFileSync("docs/assets/social-card.svg", "utf8")].join("\n");

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
if (tauri.bundle?.macOS?.signingIdentity !== "-") {
  failures.push("unsigned macOS prereleases must carry a complete ad-hoc app signature");
}
if (/paperling/i.test(releaseWorkflow) || /paperling/i.test(testBuildWorkflow)) {
  failures.push("release workflows retain Paperling identity");
}
if (/paperling/i.test(issueConfig) || /paperling/i.test(bugTemplate)) {
  failures.push("issue templates retain Paperling identity");
}
if (/paperling/i.test(docsSurface) || /github\.com\/jincaiw\/paperling/i.test(docsSurface)) {
  failures.push("public documentation retains Paperling identity or upstream links");
}
if (!/releaseName:\s*"mdtxt \$\{\{ needs\.metadata\.outputs\.tag \}\}"/.test(releaseWorkflow)) {
  failures.push("release workflow must publish under the mdtxt name");
}
if (!/includeUpdaterJson:\s*false/.test(releaseWorkflow)) {
  failures.push("release workflow must not publish updater metadata");
}

if (failures.length) {
  throw new Error(`Product identity check failed: ${failures.join("; ")}`);
}

console.log(`Product identity passed: ${expected.name} v${expected.version} (${expected.identifier}).`);
