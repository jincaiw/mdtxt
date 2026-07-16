import { readFileSync } from "node:fs";

const persistence = readFileSync("src/utils/persistence.ts", "utf8");
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const tauriLib = readFileSync("src-tauri/src/lib.rs", "utf8");
const capability = readFileSync("src-tauri/capabilities/default.json", "utf8");
const failures = [];

const plaintextKeyWrites = [
    /safeSet\s*\(\s*KEY_AI_API_KEY/,
    /localStorage\.setItem\s*\(\s*KEY_AI_API_KEY/,
    /localStorage\.setItem\s*\(\s*["']mdtxt:aiApiKey["']/,
];
if (plaintextKeyWrites.some((pattern) => pattern.test(persistence))) {
    failures.push("AI API keys must never be written to browser storage");
}
if (!/getAIEnabled\s*=\s*\(\).*safeGet<boolean>\(KEY_AI_ENABLED,\s*false\)/.test(persistence)) {
    failures.push("AI surfaces must remain disabled until explicit opt-in");
}

const csp = tauriConfig.app?.security?.csp ?? "";
for (const directive of ["script-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'"]) {
    if (!csp.includes(directive)) failures.push(`production CSP is missing ${directive}`);
}
if (/unsafe-eval|script-src[^;]*\*/.test(csp)) failures.push("production CSP permits unsafe script execution");
if (tauriConfig.app?.security?.assetProtocol?.enable !== false) failures.push("Tauri asset protocol must remain disabled");

if (!/#\[cfg\(debug_assertions\)\][\s\S]{0,500}tauri_plugin_mcp_bridge/.test(tauriLib)) {
    failures.push("desktop automation bridge must be guarded by debug_assertions");
}
if (/mcp-bridge|fs:scope|fs:allow-write|tauri_plugin_fs::init/.test(capability + tauriLib)) {
    failures.push("production WebView capability must not expose debug automation or broad filesystem writes");
}

if (failures.length) throw new Error(`Security boundary check failed: ${failures.join("; ")}`);
console.log("Security boundaries passed: keychain-only AI, opt-in networking, strict CSP, native-only export writes, and no production automation permission.");
