import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", process.platform === "win32" ? "mdtxt.exe" : "mdtxt");
const tauriDriver = process.env.TAURI_DRIVER ?? resolve(homedir(), ".cargo", "bin", process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver");

export const config = {
    host: "127.0.0.1",
    port: 4444,
    specs: ["./e2e/native/**/*.e2e.mjs"],
    maxInstances: 1,
    services: [[
        "@wdio/tauri-service",
        {
            appBinaryPath: binary,
            driverProvider: "external",
            tauriDriverPath: tauriDriver,
            autoInstallTauriDriver: false,
            autoDownloadEdgeDriver: true,
            startTimeout: 60_000,
        },
    ]],
    capabilities: [{
        browserName: "tauri",
        maxInstances: 1,
        "tauri:options": { application: binary },
    }],
    reporters: ["spec"],
    framework: "mocha",
    connectionRetryTimeout: 120_000,
    connectionRetryCount: 3,
    mochaOpts: { ui: "bdd", timeout: 120_000 },
    onPrepare: () => {
        const result = spawnSync("bun", ["run", "tauri", "--", "build", "--debug", "--no-bundle"], {
            cwd: root,
            stdio: "inherit",
            shell: process.platform === "win32",
        });
        if (result.status !== 0) throw new Error(`Tauri debug build failed with status ${result.status}`);
    },
};
