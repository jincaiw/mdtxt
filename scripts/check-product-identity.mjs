import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const expected = {
  name: "mdtxt",
  identifier: "app.mdtxt.desktop",
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
// Policy comments intentionally name prohibited signing tools. Inspect only
// executable workflow lines so the guard can explain the boundary without
// treating that explanation as a signing invocation.
const executableReleaseWorkflow = releaseWorkflow
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");
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
const expectedVersion = pkg.version;

if (pkg.name !== expected.name) failures.push(`package name=${pkg.name}`);
if (!/^0\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expectedVersion)) failures.push(`package version=${expectedVersion}`);
if (tauri.productName !== expected.name) failures.push(`productName=${tauri.productName}`);
if (tauri.version !== expectedVersion) failures.push(`tauri version=${tauri.version}`);
if (tauri.identifier !== expected.identifier) failures.push(`identifier=${tauri.identifier}`);
if (cargoPackage !== expected.name) failures.push(`cargo package=${cargoPackage ?? "missing"}`);
if (cargoVersion !== expectedVersion) failures.push(`cargo version=${cargoVersion ?? "missing"}`);
if (cargoLib !== "mdtxt_lib") failures.push(`cargo lib=${cargoLib ?? "missing"}`);
if (tauri.plugins?.updater) failures.push("updater must be disabled until mdtxt has an owned endpoint");
if (tauri.bundle?.createUpdaterArtifacts) failures.push("updater artifacts must be disabled without mdtxt signing keys");
if (tauri.bundle?.macOS?.signingIdentity) {
  failures.push("unsigned releases must not configure a macOS signing identity");
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
if (!/gh release (?:edit|create) "\$tag" --draft --title "mdtxt \$tag"/.test(releaseWorkflow)) {
  failures.push("release workflow must publish under the mdtxt name");
}
if (tauri.bundle?.createUpdaterArtifacts !== false) {
  failures.push("release workflow must not publish updater metadata");
}
if (!/unsigned/.test(releaseWorkflow) || /uses:\s*tauri-apps\/tauri-action/.test(releaseWorkflow)) {
  failures.push("release workflow must build and label unsigned artifacts without platform signing tools");
}
if (/\b(?:codesign|notarytool|signtool)\b/i.test(executableReleaseWorkflow)) {
  failures.push("unsigned release workflow must not execute codesign, notarytool, or signtool");
}
if (/\$\{\{\s*secrets\./i.test(executableReleaseWorkflow)) {
  failures.push("unsigned release workflow must not consume signing or other repository secrets");
}
const requiredUnsignedArtifacts = [
  /windows_x64_portable-unsigned\.exe/,
  /windows_x64-unsigned\.msi/,
  /windows_x64_setup-unsigned\.exe/,
  /macos-unsigned\.dmg/,
  /linux_amd64-unsigned\.deb/,
  /linux_amd64-unsigned\.AppImage/,
];
if (requiredUnsignedArtifacts.some((pattern) => !pattern.test(executableReleaseWorkflow))) {
  failures.push("every Windows, macOS, and Linux release package must carry the -unsigned suffix");
}

if (failures.length) {
  throw new Error(`Product identity check failed: ${failures.join("; ")}`);
}

console.log(`Product identity passed: ${expected.name} v${expectedVersion} (${expected.identifier}).`);
