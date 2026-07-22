import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { remote } from "webdriverio";

if (process.platform !== "linux") {
    throw new Error("The installed-package recovery gate only runs on Linux.");
}

const binary = process.env.MDTXT_E2E_BINARY ?? "/usr/bin/mdtxt";
const driverBinary = process.env.TAURI_DRIVER ?? `${process.env.HOME}/.cargo/bin/tauri-driver`;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let driver;
let browser;

function waitForPort(port, shouldBeOpen, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const probe = () => {
            const socket = connect({ host: "127.0.0.1", port });
            socket.once("connect", () => {
                socket.destroy();
                if (shouldBeOpen) resolve();
                else if (Date.now() >= deadline) reject(new Error(`port ${port} remained open`));
                else setTimeout(probe, 100);
            });
            socket.once("error", () => {
                socket.destroy();
                if (!shouldBeOpen) resolve();
                else if (Date.now() >= deadline) reject(new Error(`port ${port} did not open`));
                else setTimeout(probe, 100);
            });
        };
        probe();
    });
}

async function startSession() {
    driver = spawn(driverBinary, [], { stdio: ["ignore", process.stdout, process.stderr] });
    driver.once("error", (error) => { throw error; });
    await waitForPort(4444, true);
    browser = await remote({
        hostname: "127.0.0.1",
        port: 4444,
        logLevel: "warn",
        capabilities: { "tauri:options": { application: binary } },
    });
}

async function stopDriver() {
    browser = undefined;
    const stopping = driver;
    if (stopping && stopping.exitCode === null) {
        stopping.kill("SIGTERM");
        await Promise.race([
            new Promise((resolve) => stopping.once("exit", resolve)),
            wait(3_000),
        ]);
        if (stopping.exitCode === null) stopping.kill("SIGKILL");
    }
    driver = undefined;
    await waitForPort(4444, false);
}

async function dismissTour() {
    await browser.execute(() => {
        localStorage.setItem("mdtxt:tourDone", "true");
        const dialog = document.querySelector(
            "[role='dialog'][aria-label='欢迎引导'], [role='dialog'][aria-label='Welcome tour']",
        );
        const button = dialog && [...dialog.querySelectorAll("button")]
            .find((candidate) => /直接开始写作|Just start writing/.test(candidate.textContent ?? ""));
        if (button instanceof HTMLButtonElement) button.click();
    });
}

async function editorText() {
    return browser.execute(() => {
        const content = document.querySelector(".cm-content");
        return content
            ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\n")
            : null;
    });
}

async function run() {
    const firstText = "# Installed recovery one\n\nUbuntu force-kill keeps draft one intact.";
    const secondText = "# Installed recovery two\nline two\nline three\nline four\nactive line five";

    await startSession();
    await browser.$("h1=mdtxt").waitForDisplayed({ timeout: 20_000 });
    await browser.$("//button[contains(., '新建文件') or contains(., 'New File')]").click();
    await browser.$(".cm-content").waitForDisplayed();
    await dismissTour();
    await browser.$(".cm-content").setValue(firstText);
    await browser.execute(() => {
        document.querySelector("button[aria-label='新建标签页'], button[aria-label='New tab']")?.click();
    });
    await browser.waitUntil(async () => (await browser.$$("[role='tab']")).length === 2);
    await browser.$(".cm-content").setValue(secondText);
    await browser.pause(3_500);

    const beforeKill = await browser.execute(() => ({
        tabs: [...document.querySelectorAll("[role='tab']")].map((tab) => tab.getAttribute("title")),
        active: document.querySelector("[role='tab'][aria-selected='true']")?.getAttribute("title"),
        body: document.body.innerText,
    }));
    assert.equal(beforeKill.tabs.length, 2);
    assert.match(beforeKill.body, /Ln 5/);

    const pgrep = spawnSync("pgrep", ["-n", "-x", "mdtxt"], { encoding: "utf8" });
    assert.equal(pgrep.status, 0, `installed mdtxt PID was not found: ${pgrep.stderr}`);
    const appPid = Number(pgrep.stdout.trim());
    assert.ok(Number.isInteger(appPid) && appPid > 1);
    const killed = spawnSync("kill", ["-KILL", String(appPid)], { encoding: "utf8" });
    assert.equal(killed.status, 0, `SIGKILL failed: ${killed.stderr}`);
    await wait(500);
    await stopDriver();

    await startSession();
    const dialog = await browser.$("[role='alertdialog']");
    await dialog.waitForDisplayed({ timeout: 20_000 });
    const candidates = await browser.execute(() => (
        [...document.querySelectorAll("[role='alertdialog'] li")].map((entry) => entry.textContent ?? "")
    ));
    assert.equal(candidates.some((entry) => entry.includes("Untitled-1.md")), true);
    assert.equal(candidates.some((entry) => entry.includes("Untitled-2.md")), true);
    await browser.execute(() => {
        const button = [...document.querySelectorAll("[role='alertdialog'] button")]
            .find((candidate) => /恢复全部|恢复最新会话|Restore all|Restore latest session/.test(candidate.textContent ?? ""));
        if (!(button instanceof HTMLButtonElement)) throw new Error("Restore-all action is unavailable");
        button.click();
    });
    await dialog.waitForDisplayed({ reverse: true });

    const restored = await browser.execute(() => ({
        tabs: [...document.querySelectorAll("[role='tab']")].map((tab) => tab.getAttribute("title")),
        active: document.querySelector("[role='tab'][aria-selected='true']")?.getAttribute("title"),
        body: document.body.innerText,
    }));
    assert.equal(restored.tabs.length, 2);
    assert.match(restored.tabs[0] ?? "", /已恢复|Recovered/);
    assert.match(restored.tabs[1] ?? "", /已恢复|Recovered/);
    assert.equal(restored.active, restored.tabs[1]);
    assert.match(restored.body, /Ln 5/);
    assert.equal((await editorText()).replaceAll("\u00a0", " "), secondText);

    await browser.execute(() => {
        const first = document.querySelectorAll("[role='tab']")[0];
        if (!(first instanceof HTMLButtonElement)) throw new Error("first restored tab is unavailable");
        first.click();
    });
    assert.equal((await editorText()).replaceAll("\u00a0", " "), firstText);
    await browser.saveScreenshot("/tmp/mdtxt-ubuntu-installed-recovery.png");
    console.log(`MDTXT_INSTALLED_RECOVERY platform=ubuntu binary=${binary} signal=SIGKILL drafts=2 order=passed activeTab=second cursorLine=5 content=passed originalOverwrite=impossible`);
}

try {
    await run();
} finally {
    if (browser) await browser.deleteSession().catch(() => {});
    await stopDriver();
}
