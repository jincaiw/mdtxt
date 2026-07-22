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
const enablePinyinScript = resolve(root, "scripts", "windows-enable-pinyin.ps1");
const captureScreenScript = resolve(root, "scripts", "windows-capture-screen.ps1");
const pinyinScreenshot = resolve(process.env.RUNNER_TEMP ?? process.env.TEMP ?? root, "mdtxt-microsoft-pinyin-preedit.png");
const userDataFolderBase = resolve(process.env.RUNNER_TEMP ?? process.env.TEMP ?? root, `mdtxt-mcp-${process.pid}`);

let application;
let bridge;
let launchSequence = 0;
let requestSequence = 0;
const pending = new Map();
const stagedRecoveryIds = [];

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function launchApplication() {
    application = spawn(binary, [], {
        cwd: root,
        env: {
            ...process.env,
            TAURI_WEBVIEW_AUTOMATION: "true",
            WEBVIEW2_USER_DATA_FOLDER: `${userDataFolderBase}-${++launchSequence}`,
        },
        stdio: ["ignore", process.stdout, process.stderr],
    });
    application.once("error", (error) => {
        throw error;
    });
    await connectBridge();
}

async function stopApplication() {
    bridge?.close();
    bridge = undefined;
    if (application && application.exitCode === null) {
        spawnSync("taskkill.exe", ["/PID", String(application.pid), "/T", "/F"], {
            stdio: "ignore",
        });
    }
    application = undefined;
    await wait(500);
}

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

async function stageExactRecovery(content, name, purpose) {
    const documentId = `windows-native-${purpose}-${Date.now()}-${stagedRecoveryIds.length}`;
    const result = await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        await invoke("write_recovery", {
            documentId: ${JSON.stringify(documentId)},
            path: null,
            name: ${JSON.stringify(name)},
            content: ${JSON.stringify(content)},
            version: 1,
            context: {
                recoverySessionId: ${JSON.stringify(`${documentId}-session`)},
                tabIndex: 0,
                wasActive: true,
                cursorLine: 1,
            },
        });
        return { ok: true };
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

async function discardAllRecoveries() {
    return execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        const existing = await invoke("list_recoveries");
        await Promise.all(existing.map((entry) =>
            invoke("discard_recovery", { documentId: entry.documentId })
        ));
        return existing.map((entry) => ({
            documentId: entry.documentId,
            name: entry.name,
            bytes: new TextEncoder().encode(entry.content).byteLength,
        }));
    `);
}

async function restoreStagedRecovery({ captureNativeInput = false } = {}) {
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
            if (${captureNativeInput}) {
                window.__mdtxtNativeInputSamples = {
                    beforeinput: [],
                    input: [],
                    beforeinputData: [],
                    inputData: [],
                    composition: [],
                };
                const record = (eventName, event) => {
                    if (!(event.target instanceof Element) || !event.target.closest(".cm-content")) return;
                    if (typeof event.data === "string") {
                        window.__mdtxtNativeInputSamples[eventName + "Data"].push(event.data);
                    }
                    const started = performance.now();
                    queueMicrotask(() => {
                        window.__mdtxtNativeInputSamples[eventName].push(performance.now() - started);
                    });
                };
                const onBeforeInput = (event) => record("beforeinput", event);
                const onInput = (event) => record("input", event);
                const onComposition = (event) => {
                    if (!(event.target instanceof Element) || !event.target.closest(".cm-content")) return;
                    window.__mdtxtNativeInputSamples.composition.push({
                        type: event.type,
                        data: event.data,
                    });
                };
                document.addEventListener("beforeinput", onBeforeInput, true);
                document.addEventListener("input", onInput, true);
                for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
                    document.addEventListener(type, onComposition, true);
                }
                window.__mdtxtNativeInputCleanup = () => {
                    document.removeEventListener("beforeinput", onBeforeInput, true);
                    document.removeEventListener("input", onInput, true);
                    for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
                        document.removeEventListener(type, onComposition, true);
                    }
                };
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

function runPowerShell(script, args = []) {
    const result = spawnSync(powershell, [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...args,
    ], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(
        result.status,
        0,
        `PowerShell script ${script} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
    return result.stdout.trim();
}

function sendNativeText(text) {
    return runPowerShell(sendInputScript, [
        "-TargetProcessId",
        String(application.pid),
        "-Text",
        text,
        "-MoveToEnd",
    ]);
}

function sendNativeKeys(...keys) {
    return runPowerShell(sendInputScript, [
        "-TargetProcessId",
        String(application.pid),
        "-Keys",
        ...keys,
    ]);
}

function readNativeLayout() {
    return runPowerShell(sendInputScript, [
        "-TargetProcessId",
        String(application.pid),
    ]);
}

async function run() {
    await launchApplication();
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

    const target1MiB = 1024 * 1024;
    console.log("MDTXT_NATIVE_WINDOWS phase=stage-1MiB");
    assert.deepEqual(await stageSizedRecovery(target1MiB, "Windows Native 1 MiB.md"), {
        ok: true,
        bytes: target1MiB,
    });
    console.log("MDTXT_NATIVE_WINDOWS phase=restore-1MiB");
    await restoreStagedRecovery({ captureNativeInput: true });
    // Recovery resolves when the editable CodeMirror host is mounted. WebView2
    // can still be completing deferred syntax/layout work for the 1 MiB DOM;
    // keep that settling outside the input-processing measurement so the
    // fixed five-second bridge window does not race background initialization.
    await wait(2_000);
    console.log("MDTXT_NATIVE_WINDOWS phase=prepare-native-input");

    sendNativeText("x".repeat(40));
    // Event durations are captured in the input handlers themselves. Give
    // WebView2's deferred viewport/layout work time to settle before asking
    // the fixed five-second bridge to return the already-recorded samples.
    await wait(5_000);
    const inputResult = await execute(`
        const eventSamples = window.__mdtxtNativeInputSamples ?? {
            beforeinput: [],
            input: [],
            beforeinputData: [],
            inputData: [],
        };
        window.__mdtxtNativeInputCleanup?.();
        delete window.__mdtxtNativeInputCleanup;
        delete window.__mdtxtNativeInputSamples;
        const inputEvent = eventSamples.beforeinput.length === 40
            ? "beforeinput"
            : "input";
        const samples = eventSamples[inputEvent].sort((left, right) => left - right);
        return {
            inputEvent,
            beforeInputSamples: eventSamples.beforeinput.length,
            inputEventSamples: eventSamples.input.length,
            inputSamples: samples.length,
            inputP50: samples[Math.ceil(samples.length * 0.5) - 1],
            inputP95: samples[Math.ceil(samples.length * 0.95) - 1],
            inputMax: samples.at(-1),
            inputText: eventSamples[inputEvent + "Data"].join(""),
        };
    `);
    console.log(`MDTXT_NATIVE_PERF platform=windows target=1MiB inputMethod=win32-sendinput inputEvent=${inputResult.inputEvent} beforeInputSamples=${inputResult.beforeInputSamples} inputEventSamples=${inputResult.inputEventSamples} inputProcessingSamples=${inputResult.inputSamples} inputProcessingP50Ms=${inputResult.inputP50} inputProcessingP95Ms=${inputResult.inputP95} inputProcessingMaxMs=${inputResult.inputMax}`);
    assert.equal(inputResult.inputSamples, 40);
    assert.equal(inputResult.inputText, "x".repeat(40));
    assert.ok(inputResult.inputP95 <= 16, `1 MiB native WebView input-processing P95 was ${inputResult.inputP95} ms`);

    console.log("MDTXT_NATIVE_WINDOWS phase=discard-1MiB");
    await discardRecovery(stagedRecoveryIds.at(-1));

    // Isolate the 10 MiB open measurement from the dirty 1 MiB editor. A
    // reload of that editor legitimately writes a fresh recovery entry and
    // would make the next recovery dialog restore two large drafts, which is
    // not the single-document PRD scenario measured below.
    console.log("MDTXT_NATIVE_WINDOWS phase=restart-before-10MiB");
    await stopApplication();
    await launchApplication();
    await waitForScript(
        "return document.querySelector('h1')?.textContent === 'mdtxt';",
        "mdtxt welcome screen after input measurement",
    );
    await execute(`
        localStorage.setItem("mdtxt:liveBeta", "true");
        localStorage.setItem("mdtxt:tourDone", "true");
        return true;
    `);
    await reload();
    const staleRecoveries = await discardAllRecoveries();
    console.log(`MDTXT_NATIVE_WINDOWS staleRecoveriesBefore10MiB=${JSON.stringify(staleRecoveries)}`);

    const target10MiB = 10 * 1024 * 1024;
    console.log("MDTXT_NATIVE_WINDOWS phase=stage-10MiB");
    assert.deepEqual(await stageSizedRecovery(target10MiB, "Windows Native 10 MiB.md"), {
        ok: true,
        bytes: target10MiB,
    });
    console.log("MDTXT_NATIVE_WINDOWS phase=restore-10MiB");
    const restored10MiB = await restoreStagedRecovery();
    console.log("MDTXT_NATIVE_WINDOWS phase=activate-restricted-live");
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

    console.log("MDTXT_NATIVE_WINDOWS phase=configure-microsoft-pinyin");
    await discardRecovery(stagedRecoveryIds.at(-1));
    await stopApplication();
    console.log(runPowerShell(enablePinyinScript));
    await launchApplication();
    await waitForScript(
        "return document.querySelector('h1')?.textContent === 'mdtxt';",
        "mdtxt welcome screen before Microsoft Pinyin",
    );
    await execute(`
        localStorage.setItem("mdtxt:liveBeta", "true");
        localStorage.setItem("mdtxt:tourDone", "true");
        return true;
    `);
    await reload();
    await discardAllRecoveries();
    const imeFixture = "# Microsoft Pinyin native IME\n\n";
    assert.deepEqual(
        await stageExactRecovery(imeFixture, "Microsoft Pinyin IME.md", "microsoft-pinyin"),
        { ok: true },
    );
    await restoreStagedRecovery({ captureNativeInput: true });
    await wait(500);

    let layout = sendNativeKeys("ActivateChinese");
    await wait(500);
    layout = readNativeLayout();
    for (let attempt = 0; attempt < 3 && !/languageId=0x0804/i.test(layout); attempt += 1) {
        layout = sendNativeKeys("WinSpace");
        await wait(500);
    }
    assert.match(layout, /languageId=0x0804/i, `Microsoft Pinyin layout did not activate: ${layout}`);

    sendNativeText("zhongwen");
    await wait(500);
    const preedit = await execute(`
        return {
            events: window.__mdtxtNativeInputSamples?.composition ?? [],
            activeLine: document.querySelector(".cm-activeLine")?.textContent ?? "",
        };
    `);
    console.log(runPowerShell(captureScreenScript, ["-Path", pinyinScreenshot]));
    assert.equal(
        preedit.events.some((event) => event.type === "compositionstart"),
        true,
        `Microsoft Pinyin emitted no compositionstart: ${JSON.stringify(preedit)}`,
    );
    sendNativeKeys("Space");
    await wait(500);
    const committed = await execute(`
        const content = document.querySelector(".cm-content");
        return {
            events: window.__mdtxtNativeInputSamples?.composition ?? [],
            text: content
                ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
                : null,
        };
    `);
    assert.equal(committed.events.some((event) => event.type === "compositionend"), true);
    const sourceChinese = committed.text.match(/[\u3400-\u9fff]{2,}/u)?.[0];
    assert.ok(sourceChinese, `Microsoft Pinyin did not commit multi-character Chinese: ${committed.text}`);
    assert.equal(committed.text.includes("zhongwen"), false);

    sendNativeKeys("ControlZ");
    await wait(200);
    assert.equal((await execute("return document.querySelector('.cm-content')?.textContent ?? '';")).includes(sourceChinese), false);
    // Ctrl+Y is the platform-native redo binding and avoids Microsoft Pinyin
    // treating the shifted character chord as a fresh text-service input.
    sendNativeKeys("ControlY");
    await wait(200);
    assert.equal((await execute("return document.querySelector('.cm-content')?.textContent ?? '';")).includes(sourceChinese), true);

    await execute(`
        const button = document.querySelector("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
        if (!(button instanceof HTMLButtonElement)) throw new Error("Live Beta mode is unavailable");
        button.click();
        return true;
    `);
    await waitForScript(
        "return Boolean(document.querySelector(\".cm-editor[data-mdtxt-live='true']\"));",
        "Windows Live Beta mode",
    );
    await execute("document.querySelector('.cm-content')?.focus(); return true;");
    // Keep the Source and Live commits on separate lines so the evidence can
    // assert two Chinese runs instead of merging adjacent phrases into one.
    sendNativeKeys("Enter");
    sendNativeText("wancheng");
    await wait(300);
    sendNativeKeys("Space");
    await wait(500);
    const liveText = await execute(`
        const content = document.querySelector(".cm-content");
        return content
            ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
            : null;
    `);
    const liveChinese = liveText.match(/[\u3400-\u9fff]{2,}/gu) ?? [];
    assert.ok(liveChinese.length >= 2, `Live did not commit a second Chinese phrase: ${liveText}`);

    sendNativeKeys("ControlA");
    sendNativeKeys("ControlC");
    sendNativeKeys("Enter");
    sendNativeKeys("ControlV");
    await wait(300);
    const copiedText = await execute(`
        const content = document.querySelector(".cm-content");
        return content
            ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
            : null;
    `);
    assert.ok(copiedText.endsWith(liveText), "Microsoft Pinyin clipboard round trip changed the document text");

    await execute(`
        document.querySelector("button[aria-label='新建标签页'], button[aria-label='New tab']")?.click();
        return true;
    `);
    await execute(`
        const tab = document.querySelectorAll("[role='tab']")[0];
        if (!(tab instanceof HTMLElement)) throw new Error("Original tab is unavailable");
        tab.click();
        return true;
    `);
    assert.equal(
        await execute("return document.querySelector('.cm-content')?.textContent ?? '';"),
        copiedText,
    );
    await execute(`
        document.querySelector("button[aria-label='源码编辑器'], button[aria-label='Code editor']")?.click();
        return true;
    `);
    assert.equal(
        await execute("return document.querySelector('.cm-content')?.textContent ?? '';"),
        copiedText,
    );
    console.log(`MDTXT_NATIVE_IME platform=windows engine=microsoft-pinyin input=win32-sendinput sourcePhrase=${sourceChinese} compositionEvents=${committed.events.length} liveChineseRuns=${liveChinese.length} clipboard=passed undoRedo=passed modeTabRoundTrip=passed screenshot=${pinyinScreenshot}`);
    console.log("MDTXT_NATIVE_WINDOWS result=passed");
}

try {
    await run();
} finally {
    for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Windows native smoke stopped"));
    }
    pending.clear();
    await stopApplication();
}
