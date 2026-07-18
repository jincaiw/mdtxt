import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", process.platform === "win32" ? "mdtxt.exe" : "mdtxt");
const tauriDriver = process.env.TAURI_DRIVER ?? resolve(homedir(), ".cargo", "bin", process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver");
const edgeDriver = process.env.EDGE_DRIVER ?? "msedgedriver.exe";
const windowsDebugPort = 9222;
let driver;
let application;
let shuttingDown = false;

function waitForPort(port, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolveReady, rejectReady) => {
        const probe = () => {
            const socket = connect({ host: "127.0.0.1", port });
            socket.once("connect", () => { socket.destroy(); resolveReady(); });
            socket.once("error", () => {
                socket.destroy();
                if (Date.now() >= deadline) rejectReady(new Error(`port ${port} did not become ready`));
                else setTimeout(probe, 100);
            });
        };
        probe();
    });
}

function stopDriver() {
    shuttingDown = true;
    driver?.kill();
    application?.kill();
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
    capabilities: process.platform === "win32"
        ? [{
            browserName: "webview2",
            "ms:edgeOptions": {
                debuggerAddress: `127.0.0.1:${windowsDebugPort}`,
            },
        }]
        : [{
            maxInstances: 1,
            "tauri:options": {
                application: binary,
            },
        }],
    reporters: ["spec"],
    framework: "mocha",
    connectionRetryTimeout: 45_000,
    connectionRetryCount: 0,
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
        shuttingDown = false;
        if (process.platform === "win32") {
            application = spawn(binary, [], {
                env: {
                    ...process.env,
                    TAURI_WEBVIEW_AUTOMATION: "true",
                    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${windowsDebugPort}`,
                },
                stdio: ["ignore", process.stdout, process.stderr],
            });
            application.once("error", (error) => { throw error; });
            application.once("exit", (code) => {
                if (!shuttingDown) throw new Error(`mdtxt exited unexpectedly (${code})`);
            });
            await waitForPort(windowsDebugPort);
            driver = spawn(edgeDriver, ["--port=4444", "--host=127.0.0.1"], {
                stdio: ["ignore", process.stdout, process.stderr],
            });
        } else {
            driver = spawn(tauriDriver, [], { stdio: ["ignore", process.stdout, process.stderr] });
        }
        driver.once("error", (error) => { throw error; });
        driver.once("exit", (code) => {
            if (!shuttingDown) throw new Error(`native WebDriver exited unexpectedly (${code})`);
        });
        await waitForPort(4444);
    },
    afterSession: stopDriver,
    onComplete: stopDriver,
};
