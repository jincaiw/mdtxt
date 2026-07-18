import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { connect } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", process.platform === "win32" ? "mdtxt.exe" : "mdtxt");
const tauriDriver = process.env.TAURI_DRIVER ?? resolve(homedir(), ".cargo", "bin", process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver");
const useManagedWindowsDriver = process.platform === "win32";
const windowsUserDataFolder = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "app.mdtxt.desktop")
    : undefined;
let driver;
let shuttingDown = false;
let devToolsPortSync;
let devToolsPortMirrored = false;

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

function startWindowsDevToolsPortSync() {
    if (!windowsUserDataFolder) return;
    const source = join(windowsUserDataFolder, "EBWebView", "DevToolsActivePort");
    const destination = join(windowsUserDataFolder, "DevToolsActivePort");
    rmSync(destination, { force: true });
    devToolsPortMirrored = false;
    devToolsPortSync = setInterval(() => {
        if (!existsSync(source)) return;
        try {
            // WebView2 appends EBWebView to Tauri's configured UDF, while
            // EdgeDriver 150 still watches the configured parent directory.
            // Mirror the live discovery file so the real EdgeDriver session
            // can attach; no renderer input or product code is bypassed.
            copyFileSync(source, destination);
            if (!devToolsPortMirrored) {
                console.log(`Mirrored WebView2 discovery file: ${source} -> ${destination}`);
                devToolsPortMirrored = true;
            }
        } catch {
            // The browser can replace this tiny file between exists/copy.
            // The next 50 ms probe retries it.
        }
    }, 50);
    devToolsPortSync.unref();
}

function stopWindowsDevToolsPortSync() {
    if (devToolsPortSync) clearInterval(devToolsPortSync);
    devToolsPortSync = undefined;
    if (windowsUserDataFolder) {
        rmSync(join(windowsUserDataFolder, "DevToolsActivePort"), { force: true });
    }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
        if (!useManagedWindowsDriver) stopDriver();
        process.exit(1);
    });
}

export const config = {
    host: "127.0.0.1",
    port: 4444,
    specs: ["./e2e/native/**/*.e2e.mjs"],
    maxInstances: 1,
    services: useManagedWindowsDriver ? [[
        "@wdio/tauri-service",
        {
            appBinaryPath: binary,
            driverProvider: "external",
            tauriDriverPath: tauriDriver,
            autoInstallTauriDriver: false,
            autoDownloadEdgeDriver: true,
            startTimeout: 60_000,
        },
    ]] : [],
    capabilities: [{
        // The managed Tauri service identifies its provider with browserName.
        // Upstream tauri-driver on Linux rejects that extra capability.
        ...(useManagedWindowsDriver ? { browserName: "tauri" } : {}),
        maxInstances: 1,
        "tauri:options": { application: binary },
        ...(windowsUserDataFolder ? {
            // Tauri 2 pins WebView2 to %LOCALAPPDATA%/<identifier>. Tell
            // EdgeDriver to watch that same profile for DevToolsActivePort
            // instead of an unrelated temporary user-data directory.
            "ms:edgeOptions": {
                webviewOptions: { userDataFolder: windowsUserDataFolder },
            },
        } : {}),
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
        if (useManagedWindowsDriver) {
            startWindowsDevToolsPortSync();
            return;
        }
        shuttingDown = false;
        driver = spawn(tauriDriver, [], { stdio: ["ignore", process.stdout, process.stderr] });
        driver.once("error", (error) => { throw error; });
        driver.once("exit", (code) => {
            if (!shuttingDown) throw new Error(`tauri-driver exited unexpectedly (${code})`);
        });
        await waitForDriver();
    },
    afterSession: () => {
        if (useManagedWindowsDriver) stopWindowsDevToolsPortSync();
        else stopDriver();
    },
    onComplete: () => {
        if (useManagedWindowsDriver) stopWindowsDevToolsPortSync();
        else stopDriver();
    },
};
