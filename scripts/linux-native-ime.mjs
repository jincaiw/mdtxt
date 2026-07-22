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
    runCommand("xdotool", ["windowactivate", "--sync", windowId], "activating the mdtxt X11 window");
    runCommand("xdotool", ["windowfocus", "--sync", windowId], "focusing the mdtxt X11 window");
    runCommand("xdotool", ["mousemove", "--window", windowId, "80", "115", "click", "1"], "clicking the editor");
    const actualFocus = runCommand("xdotool", ["getwindowfocus"], "reading X11 keyboard focus");
    assert.equal(actualFocus, windowId);
    console.log(`MDTXT_X11_FOCUS target=${windowId} actual=${actualFocus}`);
}

function sendKey(key) {
    const tokens = key.split("+");
    const keyName = tokens.pop();
    const modifiers = tokens.map((token) => ({
        ctrl: "Control_L",
        shift: "Shift_L",
    })[token] ?? token);
    runCommand(
        "xte",
        [
            ...modifiers.map((modifier) => `keydown ${modifier}`),
            `key ${keyName}`,
            ...modifiers.reverse().map((modifier) => `keyup ${modifier}`),
        ],
        `sending ${key} through XTEST`,
    );
}

async function sendText(text, delayMilliseconds = 35) {
    await focusEditorWindow();
    sendKey("ctrl+End");
    runCommand(
        "xte",
        [...text].flatMap((character) => [
            `key ${character}`,
            `usleep ${Math.round(delayMilliseconds * 1000)}`,
        ]),
        `typing ${text} through XTEST`,
    );
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

    const fixture = "# IBus native IME\n\n";
    assert.deepEqual(await execute(`
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("Tauri invoke bridge is unavailable");
        const existing = await invoke("list_recoveries");
        await Promise.all(existing.map((entry) => invoke("discard_recovery", { documentId: entry.documentId })));
        const timestamp = Date.now();
        await invoke("write_recovery", {
            documentId: \`linux-ime-\${timestamp}\`,
            path: null,
            name: "Native IBus IME.md",
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
        for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
            content.addEventListener(type, (event) => {
                window.__mdtxtImeEvents.push({ type, data: event.data });
            });
        }
        return { ok: document.activeElement === content };
    `), { ok: true });

    await sendText("zhongwen");
    await wait(350);
    const preedit = await execute(`
        return {
            events: window.__mdtxtImeEvents ?? [],
            text: document.querySelector(".cm-activeLine")?.textContent ?? "",
        };
    `);
    runCommand("scrot", ["/tmp/mdtxt-ibus-preedit.png"], "capturing the IBus candidate window");
    assert.equal(preedit.events.some((event) => event.type === "compositionstart"), true);

    sendKey("space");
    await wait(500);
    const committed = await execute(`
        return {
            events: window.__mdtxtImeEvents ?? [],
            text: (() => {
                const content = document.querySelector(".cm-content");
                return content
                    ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\\n")
                    : null;
            })(),
        };
    `);
    assert.equal(committed.events.some((event) => event.type === "compositionend"), true);
    const sourceChinese = committed.text.match(/[\u3400-\u9fff]{2,}/u)?.[0];
    assert.ok(sourceChinese, `IBus did not commit multi-character Chinese: ${committed.text}`);
    assert.equal(committed.text.includes("zhongwen"), false);

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

    const firstTabName = await execute(`
        return document.querySelector("[role='tab'][aria-selected='true']")?.getAttribute("title");
    `);
    assert.ok(firstTabName);
    await execute(`
        document.querySelector("button[aria-label='新建标签页'], button[aria-label='New tab']")?.click();
        return true;
    `);
    await execute(`
        const name = ${JSON.stringify(firstTabName)};
        const tab = [...document.querySelectorAll("[role='tab']")]
            .find((candidate) => candidate.getAttribute("title") === name);
        if (!(tab instanceof HTMLButtonElement)) throw new Error("Original tab is unavailable");
        tab.click();
        return true;
    `);
    assert.equal(await execute(editorTextScript), copiedText);
    await execute(`
        document.querySelector("button[aria-label='源码编辑器'], button[aria-label='Code editor']")?.click();
        return true;
    `);
    assert.equal(await execute(editorTextScript), copiedText);

    console.log(`MDTXT_NATIVE_IME platform=ubuntu engine=ibus-libpinyin input=x11-xte-xtest sourcePhrase=${sourceChinese} compositionEvents=${committed.events.length} liveChineseRuns=${allChinese.length} clipboard=passed undoRedo=passed modeTabRoundTrip=passed screenshot=/tmp/mdtxt-ibus-preedit.png`);
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
