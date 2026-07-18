import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    throw new Error("The MCP bridge + Win32 input smoke can only run on Windows.");
}

const root = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", "mdtxt.exe");
const bridgePort = Number(process.env.MDTXT_MCP_BRIDGE_PORT ?? 9223);
const powershell = resolve(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const sendInputScript = resolve(root, "scripts", "windows-send-input.ps1");
const userDataFolder = resolve(process.env.RUNNER_TEMP ?? process.env.TEMP ?? root, `mdtxt-mcp-${process.pid}`);

let application;
let bridge;
let requestSequence = 0;
const pending = new Map();
const stagedRecoveryIds = [];

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function waitForPort(port, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolveReady, rejectReady) => {
        const probe = () => {
            const socket = connect({ host: "127.0.0.1", port });
            socket.once("connect", () => {
                socket.destroy();
                resolveReady();
            });
            socket.once("error", () => {
                socket.destroy();
                if (Date.now() >= deadline) rejectReady(new Error(`port ${port} did not become ready`));
                else setTimeout(probe, 100);
            });
        };
        probe();
    });
}

async function connectBridge() {
    await waitForPort(bridgePort);
    bridge = new WebSocket(`ws://127.0.0.1:${bridgePort}`);
    await new Promise((resolveOpen, rejectOpen) => {
        const timer = setTimeout(() => rejectOpen(new Error("MCP bridge WebSocket did not open")), 10_000);
        bridge.addEventListener("open", () => {
            clearTimeout(timer);
            resolveOpen();
        }, { once: true });
        bridge.addEventListener("error", () => {
            clearTimeout(timer);
            rejectOpen(new Error("MCP bridge WebSocket failed to open"));
        }, { once: true });
    });
    bridge.addEventListener("message", (event) => {
        const response = JSON.parse(String(event.data));
        if (!response.id || !pending.has(response.id)) return;
        const request = pending.get(response.id);
        pending.delete(response.id);
        clearTimeout(request.timer);
        if (response.success) request.resolve(response.data);
        else request.reject(new Error(response.error ?? `Bridge request ${response.id} failed`));
    });
}

function bridgeCall(command, args = {}, timeoutMs = 10_000) {
    const id = `mdtxt-native-${++requestSequence}`;
    return new Promise((resolveRequest, rejectRequest) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            rejectRequest(new Error(`Bridge request ${id} (${command}) timed out`));
        }, timeoutMs);
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
        bridge.send(JSON.stringify({ id, command, args }));
    });
}

const execute = (script, timeoutMs) => bridgeCall("execute_js", { script }, timeoutMs);

async function waitForScript(script, description, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const result = await execute(script);
            if (result) return result;
        } catch (error) {
            lastError = error;
        }
        await wait(100);
    }
    throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function reload() {
    await execute("setTimeout(() => location.reload(), 0); return true;");
    await wait(250);
    await waitForScript("return Boolean(document.querySelector('main, #root'));", "application reload");
}

async function stageSizedRecovery(targetBytes, name) {
    const documentId = `windows-native-performance-${Date.now()}-${stagedRecoveryIds.length}`;
    const result = await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        const bytes = ${targetBytes};
        const prefix = "# Native WebView performance\\n\\n";
        const payloadWidth = bytes <= 1024 * 1024 ? 100 : 1000;
        const line = \`plain markdown input \${"x".repeat(payloadWidth)}\\n\`;
        const repeated = line.repeat(Math.ceil((bytes - prefix.length) / line.length));
        const content = \`\${prefix}\${repeated}\`.slice(0, bytes - 1) + "\\n";
        const entry = {
            documentId: ${JSON.stringify(documentId)},
            path: null,
            name: ${JSON.stringify(name)},
            content,
            version: 1,
            context: {
                recoverySessionId: ${JSON.stringify(`${documentId}-session`)},
                tabIndex: 0,
                wasActive: true,
                cursorLine: 1,
            },
        };
        await invoke("write_recovery", entry);
        return { ok: true, bytes: new TextEncoder().encode(content).byteLength };
    `);
    stagedRecoveryIds.push(documentId);
    return result;
}

async function discardRecovery(documentId) {
    await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        await invoke("discard_recovery", { documentId: ${JSON.stringify(documentId)} });
        return true;
    `);
}

async function restoreStagedRecovery() {
    await reload();
    await waitForScript(
        "return Boolean(document.querySelector(\"[role='alertdialog']\"));",
        "recovery dialog",
    );
    return execute(`
        return await new Promise((resolveRestore, rejectRestore) => {
            window.__mdtxtNativeMetrics = [];
            if (!window.__mdtxtNativeMetricListener) {
                window.__mdtxtNativeMetricListener = true;
                window.addEventListener("mdtxt:editor-metric", (event) => {
                    window.__mdtxtNativeMetrics.push(event.detail);
                });
            }
            const button = [...document.querySelectorAll("[role='alertdialog'] button")]
                .find((candidate) => /恢复|Restore/.test(candidate.textContent ?? ""));
            if (!(button instanceof HTMLButtonElement)) {
                rejectRestore(new Error("Restore button is unavailable"));
                return;
            }
            const started = performance.now();
            const finish = () => {
                if (document.querySelector("[role='alertdialog']") || !document.querySelector(".cm-content")) return false;
                resolveRestore({
                    duration: performance.now() - started,
                    metrics: window.__mdtxtNativeMetrics,
                });
                return true;
            };
            const observer = new MutationObserver(() => {
                if (finish()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                rejectRestore(new Error("Restore did not reach Source within four seconds"));
            }, 4_000);
            button.click();
            finish();
        });
    `);
}

function sendNativeText(text) {
    const result = spawnSync(powershell, [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        sendInputScript,
        "-TargetProcessId",
        String(application.pid),
        "-Text",
        text,
    ], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(
        result.status,
        0,
        `Win32 SendInput failed (${result.status}): ${result.stderr || result.stdout}`,
    );
}

async function run() {
    application = spawn(binary, [], {
        cwd: root,
        env: {
            ...process.env,
            TAURI_WEBVIEW_AUTOMATION: "true",
            WEBVIEW2_USER_DATA_FOLDER: userDataFolder,
        },
        stdio: ["ignore", process.stdout, process.stderr],
    });
    application.once("error", (error) => {
        throw error;
    });

    await connectBridge();
    await waitForScript(
        "return document.querySelector('h1')?.textContent === 'mdtxt';",
        "mdtxt welcome screen",
    );
    console.log("MDTXT_NATIVE_WINDOWS welcome=passed bridge=mcp-9223");

    await execute(`
        localStorage.setItem("mdtxt:liveBeta", "true");
        localStorage.setItem("mdtxt:tourDone", "true");
        return true;
    `);
    await reload();

    const target10MiB = 10 * 1024 * 1024;
    assert.deepEqual(await stageSizedRecovery(target10MiB, "Windows Native 10 MiB.md"), {
        ok: true,
        bytes: target10MiB,
    });
    const restored10MiB = await restoreStagedRecovery();
    const restrictedLiveMs = await execute(`
        return await new Promise((resolveLive, rejectLive) => {
            const button = document.querySelector("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
            if (!(button instanceof HTMLButtonElement)) {
                rejectLive(new Error("Live Beta mode is unavailable"));
                return;
            }
            const started = performance.now();
            const finish = () => {
                if (!document.querySelector(".cm-editor[data-mdtxt-live='restricted']")) return false;
                resolveLive(performance.now() - started);
                return true;
            };
            const observer = new MutationObserver(() => {
                if (finish()) observer.disconnect();
            });
            observer.observe(document.body, { attributes: true, childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                rejectLive(new Error("Restricted Live did not activate within four seconds"));
            }, 4_000);
            button.click();
            finish();
        });
    `);
    console.log(`MDTXT_NATIVE_TRACE ${JSON.stringify(restored10MiB.metrics ?? [])}`);
    console.log(`MDTXT_NATIVE_PERF platform=windows target=10MiB sourceOpenMs=${restored10MiB.duration} restrictedLiveMs=${restrictedLiveMs}`);
    assert.ok(restored10MiB.duration <= 3_000, `10 MiB Source open took ${restored10MiB.duration} ms`);
    assert.ok(restrictedLiveMs <= 5_000, `10 MiB restricted Live took ${restrictedLiveMs} ms`);
    await discardRecovery(stagedRecoveryIds.at(-1));

    const target1MiB = 1024 * 1024;
    assert.deepEqual(await stageSizedRecovery(target1MiB, "Windows Native 1 MiB.md"), {
        ok: true,
        bytes: target1MiB,
    });
    await restoreStagedRecovery();
    assert.deepEqual(await execute(`
        const content = document.querySelector(".cm-content");
        const lines = content?.querySelectorAll(".cm-line");
        const lastLine = lines?.item(lines.length - 1);
        if (!(content instanceof HTMLElement) || !(lastLine instanceof HTMLElement)) {
            return { ok: false, error: "CodeMirror content is unavailable" };
        }
        content.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(lastLine);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        window.__mdtxtNativeInputSamples = {
            beforeinput: [],
            input: [],
            keydownMutation: [],
            keydownStarts: [],
        };
        const record = (eventName) => {
            const started = performance.now();
            queueMicrotask(() => {
                window.__mdtxtNativeInputSamples[eventName].push(performance.now() - started);
            });
        };
        const onBeforeInput = () => record("beforeinput");
        const onInput = () => record("input");
        const onKeyDown = (event) => {
            if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
                window.__mdtxtNativeInputSamples.keydownStarts.push(performance.now());
            }
        };
        const mutationObserver = new MutationObserver(() => {
            const started = window.__mdtxtNativeInputSamples.keydownStarts.shift();
            if (started !== undefined) {
                window.__mdtxtNativeInputSamples.keydownMutation.push(performance.now() - started);
            }
        });
        content.addEventListener("beforeinput", onBeforeInput, true);
        content.addEventListener("input", onInput, true);
        content.addEventListener("keydown", onKeyDown, true);
        mutationObserver.observe(content, { childList: true, characterData: true, subtree: true });
        window.__mdtxtNativeInputCleanup = () => {
            content.removeEventListener("beforeinput", onBeforeInput, true);
            content.removeEventListener("input", onInput, true);
            content.removeEventListener("keydown", onKeyDown, true);
            mutationObserver.disconnect();
        };
        return { ok: true };
    `), { ok: true });

    sendNativeText("x".repeat(40));
    await wait(250);
    const inputResult = await execute(`
        const content = document.querySelector(".cm-content");
        const eventSamples = window.__mdtxtNativeInputSamples ?? {
            beforeinput: [],
            input: [],
            keydownMutation: [],
        };
        window.__mdtxtNativeInputCleanup?.();
        delete window.__mdtxtNativeInputCleanup;
        delete window.__mdtxtNativeInputSamples;
        const inputEvent = eventSamples.beforeinput.length === 40
            ? "beforeinput"
            : eventSamples.input.length === 40
                ? "input"
                : "keydown-mutation";
        const samples = (inputEvent === "keydown-mutation"
            ? eventSamples.keydownMutation
            : eventSamples[inputEvent]).sort((left, right) => left - right);
        const lines = content?.querySelectorAll(".cm-line");
        const lastLine = lines?.item(lines.length - 1);
        return {
            inputEvent,
            beforeInputSamples: eventSamples.beforeinput.length,
            inputEventSamples: eventSamples.input.length,
            keydownMutationSamples: eventSamples.keydownMutation.length,
            inputSamples: samples.length,
            inputP50: samples[Math.ceil(samples.length * 0.5) - 1],
            inputP95: samples[Math.ceil(samples.length * 0.95) - 1],
            inputMax: samples.at(-1),
            suffix: lastLine?.textContent?.slice(-40),
        };
    `);
    console.log(`MDTXT_NATIVE_PERF platform=windows target=1MiB inputMethod=win32-sendinput inputEvent=${inputResult.inputEvent} beforeInputSamples=${inputResult.beforeInputSamples} inputEventSamples=${inputResult.inputEventSamples} keydownMutationSamples=${inputResult.keydownMutationSamples} inputProcessingSamples=${inputResult.inputSamples} inputProcessingP50Ms=${inputResult.inputP50} inputProcessingP95Ms=${inputResult.inputP95} inputProcessingMaxMs=${inputResult.inputMax}`);
    assert.equal(inputResult.inputSamples, 40);
    assert.equal(inputResult.suffix, "x".repeat(40));
    assert.ok(inputResult.inputP95 <= 16, `1 MiB native WebView input-processing P95 was ${inputResult.inputP95} ms`);

    await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (invoke) {
            await Promise.all(${JSON.stringify(stagedRecoveryIds)}.map(
                (documentId) => invoke("discard_recovery", { documentId }),
            ));
        }
        return true;
    `);
    console.log("MDTXT_NATIVE_WINDOWS result=passed");
}

try {
    await run();
} finally {
    bridge?.close();
    for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Windows native smoke stopped"));
    }
    pending.clear();
    if (application && application.exitCode === null) {
        spawnSync("taskkill.exe", ["/PID", String(application.pid), "/T", "/F"], {
            stdio: "ignore",
        });
    }
}
