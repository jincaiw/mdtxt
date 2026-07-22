import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "linux") {
    throw new Error("The IBus + XTEST smoke can only run on Linux.");
}

const root = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY
    ?? resolve(root, "src-tauri", "target", "debug", "mdtxt");
const bridgePort = Number(process.env.MDTXT_MCP_BRIDGE_PORT ?? 9223);
let application;
let bridge;
let requestSequence = 0;
const pending = new Map();

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

function execute(script, timeoutMs = 10_000) {
    const id = `mdtxt-linux-ime-${++requestSequence}`;
    return new Promise((resolveRequest, rejectRequest) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            rejectRequest(new Error(`Bridge execute request ${id} timed out`));
        }, timeoutMs);
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
        bridge.send(JSON.stringify({ id, command: "execute_js", args: { script } }));
    });
}

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

function runCommand(command, args, description) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    assert.equal(
        result.status,
        0,
        `${description} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
    return result.stdout.trim();
}

function processWindowIds() {
    const search = spawnSync("xdotool", ["search", "--onlyvisible", "--pid", String(application.pid)], { encoding: "utf8" });
    if (search.status !== 0) return [];
    return search.stdout.trim().split(/\s+/).filter(Boolean);
}

async function verifySystemPrintDialog() {
    const existing = new Set(processWindowIds());
    assert.equal(await execute(`
        const reader = document.querySelector("button[aria-label='阅读模式'], button[aria-label='Reader mode']");
        if (!(reader instanceof HTMLButtonElement)) throw new Error("Reader mode is unavailable");
        reader.click();
        return true;
    `), true);
    await waitForScript(`
        return document.querySelector("button[aria-label='阅读模式'][aria-pressed='true'], button[aria-label='Reader mode'][aria-pressed='true']")
            && Boolean(document.querySelector(".markdown-body"));
    `, "Reader preview before PDF export");
    assert.equal(await execute(`
        const exportButton = document.querySelector("button[aria-label='导出文档'], button[aria-label='Export document']");
        if (!(exportButton instanceof HTMLButtonElement)) throw new Error("Export menu is unavailable");
        if (exportButton.disabled) throw new Error("Export menu is disabled");
        exportButton.click();
        return true;
    `), true);
    await waitForScript(`
        return [...document.querySelectorAll("[role='menu'] [role='menuitem']")]
            .some((item) => [...item.querySelectorAll("span")]
                .some((label) => label.textContent?.trim() === "PDF"));
    `, "PDF export menu item");
    assert.equal(await execute(`
        const pdf = [...document.querySelectorAll("[role='menu'] button, [role='menuitem']")]
            .find((item) => [...item.querySelectorAll("span")]
                .some((label) => label.textContent?.trim() === "PDF"));
        if (!(pdf instanceof HTMLElement)) throw new Error("PDF export action is unavailable");
        pdf.click();
        return true;
    `), true);

    let printWindow = "";
    for (let attempt = 0; attempt < 100 && !printWindow; attempt += 1) {
        await wait(100);
        printWindow = processWindowIds().find((id) => !existing.has(id)) ?? "";
        if (!printWindow) {
            for (const pattern of ["Print", "打印"]) {
                const named = spawnSync("xdotool", ["search", "--onlyvisible", "--name", pattern], { encoding: "utf8" });
                if (named.status === 0) {
                    printWindow = named.stdout.trim().split(/\s+/).find((id) => id && !existing.has(id)) ?? "";
                }
            }
        }
    }
    if (!printWindow) {
        const tree = spawnSync("xwininfo", ["-root", "-tree"], { encoding: "utf8" });
        throw new Error(`WebKitGTK did not open a system Print dialog. X11 tree:\n${tree.stdout}`);
    }
    runCommand("scrot", ["/tmp/mdtxt-ubuntu-system-print-dialog.png"], "print-dialog screenshot");
    runCommand("xdotool", ["key", "--window", printWindow, "Escape"], "dismiss print dialog");
    console.log(`MDTXT_NATIVE_PDF platform=ubuntu engine=WebKitGTK systemPrintDialog=passed window=${printWindow}`);
}

async function focusEditorWindow() {
    assert.deepEqual(await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) return { ok: false, error: "Tauri invoke bridge is unavailable" };
        await invoke("plugin:window|show", { label: "main" });
        await invoke("plugin:window|set_focus", { label: "main" });
        return { ok: true };
    `), { ok: true });
    await wait(150);
    let search;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        for (const args of [
            ["search", "--onlyvisible", "--pid", String(application.pid)],
            ["search", "--onlyvisible", "--class", "mdtxt"],
            ["search", "--onlyvisible", "--classname", "mdtxt"],
            ["search", "--onlyvisible", "--name", "mdtxt"],
            ["search", "--onlyvisible", "--name", "Native IBus IME"],
            ["search", "--pid", String(application.pid)],
            ["search", "--class", "mdtxt"],
            ["search", "--classname", "mdtxt"],
            ["search", "--name", "mdtxt"],
        ]) {
            search = spawnSync("xdotool", args, { encoding: "utf8" });
            if (search.status === 0 && search.stdout.trim()) break;
        }
        if (search?.status === 0 && search.stdout.trim()) break;
        await wait(100);
    }
    if (search?.status !== 0 || !search.stdout.trim()) {
        const tree = spawnSync("xwininfo", ["-root", "-tree"], { encoding: "utf8" });
        const visible = spawnSync(
            "xdotool",
            ["search", "--onlyvisible", "--name", ".*"],
            { encoding: "utf8" },
        );
        console.error(`MDTXT_X11_DIAGNOSTIC applicationPid=${application.pid}`);
        console.error(`MDTXT_X11_TREE\n${tree.stdout || tree.stderr}`);
        console.error(`MDTXT_X11_VISIBLE\n${visible.stdout || visible.stderr}`);
    }
    assert.equal(
        search?.status,
        0,
        `finding the mdtxt X11 window failed (${search?.status}): ${search?.stderr || search?.stdout}`,
    );
    const ids = search.stdout.trim().split(/\s+/).filter(Boolean);
    const windowId = ids
        .map((id) => {
            const geometry = spawnSync(
                "xdotool",
                ["getwindowgeometry", "--shell", id],
                { encoding: "utf8" },
            );
            const width = Number(geometry.stdout.match(/^WIDTH=(\d+)$/m)?.[1] ?? 0);
            const height = Number(geometry.stdout.match(/^HEIGHT=(\d+)$/m)?.[1] ?? 0);
            return { id, area: width * height };
        })
        .sort((left, right) => right.area - left.area)[0]?.id;
    assert.ok(windowId, "xdotool returned no mdtxt X11 window");
    runCommand("xdotool", ["windowmap", "--sync", windowId], "mapping the mdtxt X11 window");
    runCommand("xdotool", ["windowactivate", windowId], "activating the mdtxt X11 window");
    await wait(150);
    runCommand("xdotool", ["mousemove", "--window", windowId, "80", "115", "click", "1"], "clicking the editor");
    const actualFocus = runCommand("xdotool", ["getwindowfocus"], "reading X11 keyboard focus");
    console.log(`MDTXT_X11_FOCUS target=${windowId} actual=${actualFocus}`);
    assert.equal(
        await execute("return document.activeElement?.classList.contains('cm-content') === true;"),
        true,
        `CodeMirror did not retain DOM focus after X11 activation (target=${windowId}, actual=${actualFocus})`,
    );
}

function sendKey(key) {
    runCommand(
        "xdotool",
        ["key", "--clearmodifiers", key],
        `sending ${key} through XTEST`,
    );
}

async function sendText(text, delayMilliseconds = 35) {
    await focusEditorWindow();
    sendKey("ctrl+End");
    runCommand("xdotool", [
        "type",
        "--clearmodifiers",
        "--delay",
        String(delayMilliseconds),
        text,
    ], `typing ${text} through XTEST`);
}

const editorTextScript = `
    const content = document.querySelector(".cm-content");
    return content
        ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
        : null;
`;

async function run() {
    application = spawn(binary, [], {
        cwd: root,
        env: process.env,
        stdio: ["ignore", process.stdout, process.stderr],
    });
    application.once("error", (error) => { throw error; });
    await connectBridge();
    await waitForScript(
        "return document.querySelector('h1')?.textContent === 'mdtxt' || Boolean(document.querySelector(\"[role='alertdialog']\"));",
        "mdtxt startup",
    );

    const fixture = "# Fcitx5 native IME\n\n";
    assert.deepEqual(await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        const existing = await invoke("list_recoveries");
        await Promise.all(existing.map((entry) => invoke("discard_recovery", { documentId: entry.documentId })));
        const timestamp = Date.now();
        await invoke("write_recovery", {
            documentId: \`linux-ime-\${timestamp}\`,
            path: null,
            name: "Native Fcitx5 IME.md",
            content: ${JSON.stringify(fixture)},
            version: 1,
            context: {
                recoverySessionId: \`linux-ime-session-\${timestamp}\`,
                tabIndex: 0,
                wasActive: true,
                cursorLine: 1,
            },
        });
        localStorage.setItem("mdtxt:liveBeta", "true");
        localStorage.setItem("mdtxt:tourDone", "true");
        return { ok: true };
    `), { ok: true });
    await execute("setTimeout(() => location.reload(), 0); return true;");
    await waitForScript(
        "return Boolean(document.querySelector(\"[role='alertdialog']\"));",
        "recovery dialog",
    );
    await execute(`
        const button = [...document.querySelectorAll("[role='alertdialog'] button")]
            .find((candidate) => /恢复|Restore/.test(candidate.textContent ?? ""));
        if (!(button instanceof HTMLButtonElement)) throw new Error("Restore button is unavailable");
        button.click();
        return true;
    `);
    await waitForScript("return Boolean(document.querySelector('.cm-content'));", "restored editor");
    assert.equal(await execute(editorTextScript), fixture);

    assert.deepEqual(await execute(`
        const content = document.querySelector(".cm-content");
        if (!(content instanceof HTMLElement)) return { ok: false };
        content.focus();
        window.__mdtxtImeEvents = [];
        window.__mdtxtImeInputEvents = [];
        window.__mdtxtImeKeyEvents = [];
        for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
            content.addEventListener(type, (event) => {
                window.__mdtxtImeEvents.push({ type, data: event.data });
            });
        }
        for (const type of ["beforeinput", "input"]) {
            content.addEventListener(type, (event) => {
                window.__mdtxtImeInputEvents.push({
                    type,
                    inputType: event.inputType,
                    data: event.data,
                    composing: event.isComposing,
                });
            });
        }
        for (const type of ["keydown", "keyup"]) {
            content.addEventListener(type, (event) => {
                window.__mdtxtImeKeyEvents.push({ type, key: event.key, code: event.code });
            });
        }
        return { ok: document.activeElement === content };
    `), { ok: true });

    if ((process.env.MDTXT_LINUX_IME_ENGINE ?? "").startsWith("fcitx5")) {
        await focusEditorWindow();
        sendKey("ctrl+space");
        await wait(300);
        assert.equal(
            runCommand("fcitx5-remote", [], "reading the Fcitx5 activation state"),
            "2",
            "Fcitx5 did not activate for the focused editor",
        );
        assert.equal(
            runCommand("fcitx5-remote", ["-n"], "reading the active Fcitx5 engine"),
            "pinyin",
        );
    }

    await sendText("zhongwen");
    await wait(350);
    const preedit = await execute(`
        return {
            events: window.__mdtxtImeEvents ?? [],
            inputEvents: window.__mdtxtImeInputEvents ?? [],
            keyEvents: window.__mdtxtImeKeyEvents ?? [],
            text: document.querySelector(".cm-activeLine")?.textContent ?? "",
        };
    `);
    const configuredIme = process.env.MDTXT_LINUX_IME_ENGINE ?? "ibus-libpinyin";
    const activeEngine = configuredIme.startsWith("fcitx5")
        ? runCommand("fcitx5-remote", ["-n"], "reading the active Fcitx5 engine")
        : runCommand("ibus", ["engine"], "reading the active IBus engine");
    console.log(`MDTXT_LINUX_IME_PREEDIT ${JSON.stringify({
        engine: activeEngine,
        ...preedit,
    })}`);
    runCommand("scrot", ["/tmp/mdtxt-linux-ime-preedit.png"], "capturing the Chinese IME candidate window");
    const usingFcitx = configuredIme.startsWith("fcitx5");
    if (usingFcitx) {
        // WebKitGTK's XIM path keeps preedit in the native Fcitx candidate
        // surface instead of forwarding DOM composition events. Prove that
        // boundary explicitly: Pinyin is active, Latin keydowns were consumed,
        // no editor input occurred, and the candidate-window screenshot above
        // captures the visible preedit before the commit assertion below.
        assert.equal(activeEngine, "pinyin");
        assert.equal(preedit.text, "");
        assert.equal(preedit.inputEvents.length, 0);
        assert.equal(
            preedit.keyEvents.some((event) => event.type === "keydown" && /^Key[A-Z]$/.test(event.code)),
            false,
        );
    } else {
        assert.equal(preedit.events.some((event) => event.type === "compositionstart"), true);
    }

    sendKey("space");
    await wait(500);
    const committed = await execute(`
        return {
            events: window.__mdtxtImeEvents ?? [],
            inputEvents: window.__mdtxtImeInputEvents ?? [],
            text: (() => {
                const content = document.querySelector(".cm-content");
                return content
                    ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
                    : null;
            })(),
        };
    `);
    const sourceChinese = committed.text.match(/[\u3400-\u9fff]{2,}/u)?.[0];
    assert.ok(sourceChinese, `${activeEngine} did not commit multi-character Chinese: ${committed.text}`);
    assert.equal(committed.text.includes("zhongwen"), false);
    if (usingFcitx) {
        assert.equal(
            committed.inputEvents.some((event) =>
                typeof event.data === "string" && /[\u3400-\u9fff]{2,}/u.test(event.data)
            ),
            true,
            `Fcitx5 commit emitted no Chinese editor input: ${JSON.stringify(committed.inputEvents)}`,
        );
    } else {
        assert.equal(committed.events.some((event) => event.type === "compositionend"), true);
    }

    sendKey("ctrl+z");
    await wait(200);
    assert.equal((await execute(editorTextScript)).includes(sourceChinese), false);
    sendKey("ctrl+shift+z");
    await wait(200);
    assert.equal((await execute(editorTextScript)).includes(sourceChinese), true);

    await execute(`
        const button = document.querySelector("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
        if (!(button instanceof HTMLButtonElement)) throw new Error("Live Beta mode is unavailable");
        button.click();
        return true;
    `);
    await waitForScript(
        "return Boolean(document.querySelector(\".cm-editor[data-mdtxt-live='true']\"));",
        "Live Beta mode",
    );
    await execute("document.querySelector('.cm-content')?.focus(); return true;");
    // Keep the Source and Live commits on separate lines so two successful
    // Chinese phrases cannot collapse into one contiguous regex run.
    sendKey("Return");
    await sendText("wancheng");
    sendKey("space");
    await wait(500);
    const liveText = await execute(editorTextScript);
    const allChinese = liveText.match(/[\u3400-\u9fff]{2,}/gu) ?? [];
    assert.ok(allChinese.length >= 2, `Live did not commit a second Chinese phrase: ${liveText}`);
    assert.equal(liveText.includes("wancheng"), false);

    sendKey("ctrl+a");
    sendKey("ctrl+c");
    sendKey("End");
    sendKey("Return");
    sendKey("ctrl+v");
    await wait(300);
    const copiedText = await execute(editorTextScript);
    assert.ok(copiedText.endsWith(liveText), "Native Chinese clipboard paste did not preserve the document text");

    await execute(`
        document.querySelector("button[aria-label='新建标签页'], button[aria-label='New tab']")?.click();
        return true;
    `);
    await execute(`
        const tab = document.querySelectorAll("[role='tab']")[0];
        if (!(tab instanceof HTMLElement)) throw new Error("Original tab is unavailable");
        tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
        return true;
    `);
    await wait(200);
    assert.equal(await execute(editorTextScript), copiedText);
    await execute(`
        document.querySelector("button[aria-label='源码编辑器'], button[aria-label='Code editor']")?.click();
        return true;
    `);
    assert.equal(await execute(editorTextScript), copiedText);

    await verifySystemPrintDialog();

    console.log(`MDTXT_NATIVE_IME platform=ubuntu engine=${configuredIme} input=x11-xdotool-xtest sourcePhrase=${sourceChinese} compositionEvents=${committed.events.length} liveChineseRuns=${allChinese.length} clipboard=passed undoRedo=passed modeTabRoundTrip=passed screenshot=/tmp/mdtxt-linux-ime-preedit.png`);
}

try {
    await run();
} finally {
    for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Linux native IME smoke stopped"));
    }
    pending.clear();
    bridge?.close();
    if (application && application.exitCode === null) {
        application.kill("SIGTERM");
        await wait(500);
        if (application.exitCode === null) application.kill("SIGKILL");
    }
}
