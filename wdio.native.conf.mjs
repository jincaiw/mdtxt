import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", process.platform === "win32" ? "mdtxt.exe" : "mdtxt");
const tauriDriver = process.env.TAURI_DRIVER ?? resolve(homedir(), ".cargo", "bin", process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver");
let driver;
let shuttingDown = false;

function waitForDriver(timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolveReady, rejectReady) => {
        const probe = () => {
            const socket = connect({ host: "127.0.0.1", port: 4444 });
            socket.once("connect", () => { socket.destroy(); resolveReady(); });
            socket.once("error", () => {
                socket.destroy();
                if (Date.now() >= deadline) rejectReady(new Error("tauri-driver did not become ready"));
                else setTimeout(probe, 100);
            });
        };
        probe();
    });
}

function stopDriver() {
    shuttingDown = true;
    driver?.kill();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
        stopDriver();
        process.exit(1);
    });
}

export const config = {
    host: "127.0.0.1",
    port: 4444,
    specs: ["./e2e/native/**/*.e2e.mjs"],
    maxInstances: 1,
    capabilities: [{
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
    beforeSession: async () => {
        driver = spawn(tauriDriver, [], { stdio: ["ignore", process.stdout, process.stderr] });
        driver.once("error", (error) => { throw error; });
        driver.once("exit", (code) => {
            if (!shuttingDown) throw new Error(`tauri-driver exited unexpectedly (${code})`);
        });
        await waitForDriver();
    },
    afterSession: stopDriver,
    onComplete: stopDriver,
};
