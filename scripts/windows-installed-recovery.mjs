import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    throw new Error("The installed-package recovery gate only runs on Windows.");
}

const root = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.MDTXT_E2E_BINARY;
assert.ok(binary && existsSync(binary), `Installed mdtxt binary is unavailable: ${binary}`);

const powershell = resolve(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const inputScript = resolve(root, "scripts", "windows-send-input.ps1");
const uiaScript = resolve(root, "scripts", "windows-uia-wait.ps1");
const uiaInvokeScript = resolve(root, "scripts", "windows-uia-invoke.ps1");
const captureScript = resolve(root, "scripts", "windows-capture-screen.ps1");
const recoveryScreenshot = resolve(process.env.RUNNER_TEMP ?? tmpdir(), "mdtxt-windows-installed-recovery.png");
const deniedScreenshot = resolve(process.env.RUNNER_TEMP ?? tmpdir(), "mdtxt-windows-denied-share.png");
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
let application;
let lockProcess;

function runPowerShell(script, args = [], options = {}) {
    const result = spawnSync(powershell, [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...args,
    ], { cwd: root, encoding: "utf8", ...options });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
}

function send({ text, keys = [] }) {
    return runPowerShell(inputScript, [
        "-TargetProcessId", String(application.pid),
        ...(text ? ["-Text", text] : []),
        ...(keys.length ? ["-Keys", ...keys] : []),
    ]);
}

function waitForUi(pattern, timeoutSeconds = 30) {
    const output = runPowerShell(uiaScript, [
        "-TargetProcessId", String(application.pid),
        "-Pattern", pattern,
        "-TimeoutSeconds", String(timeoutSeconds),
    ]);
    console.log(output);
}

function invokeUi(pattern, timeoutSeconds = 30) {
    const output = runPowerShell(uiaInvokeScript, [
        "-TargetProcessId", String(application.pid),
        "-Pattern", pattern,
        "-TimeoutSeconds", String(timeoutSeconds),
    ]);
    console.log(output);
}

async function launch(args = []) {
    application = spawn(binary, args, {
        cwd: root,
        env: {
            ...process.env,
            WEBVIEW2_USER_DATA_FOLDER: resolve(process.env.RUNNER_TEMP ?? tmpdir(), "mdtxt-installed-webview2"),
        },
        stdio: ["ignore", process.stdout, process.stderr],
    });
    application.once("error", (error) => { throw error; });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        const probe = spawnSync(powershell, [
            "-NoProfile", "-NonInteractive", "-Command",
            `(Get-Process -Id ${application.pid} -ErrorAction SilentlyContinue).MainWindowHandle.ToInt64()`,
        ], { encoding: "utf8" });
        if (probe.status === 0 && Number(probe.stdout.trim()) > 0) return;
        await wait(200);
    }
    throw new Error("Installed mdtxt window did not appear");
}

function capture(path) {
    console.log(runPowerShell(captureScript, ["-Path", path]));
}

function readEditorThroughClipboard() {
    send({ keys: ["ControlA"] });
    send({ keys: ["ControlC"] });
    const clipboard = spawnSync(powershell, [
        "-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw",
    ], { encoding: "utf8" });
    assert.equal(clipboard.status, 0, clipboard.stderr || clipboard.stdout);
    return clipboard.stdout.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n$/, "");
}

function pasteExactText(text) {
    const clipboard = spawnSync(powershell, [
        "-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard -Value $env:MDTXT_CLIPBOARD_TEXT",
    ], {
        encoding: "utf8",
        env: { ...process.env, MDTXT_CLIPBOARD_TEXT: text },
    });
    assert.equal(clipboard.status, 0, clipboard.stderr || clipboard.stdout);
    send({ keys: ["ControlV"] });
}

async function forceKill() {
    if (!application || application.exitCode !== null) return;
    const killed = spawnSync("taskkill.exe", ["/PID", String(application.pid), "/T", "/F"], { encoding: "utf8" });
    assert.equal(killed.status, 0, killed.stderr || killed.stdout);
    await wait(1_000);
    application = undefined;
}

async function validateDeniedShare() {
    const lockedPath = resolve(process.env.RUNNER_TEMP ?? tmpdir(), "mdtxt-denied-share.md");
    const lockCommand = [
        `$path = '${lockedPath.replaceAll("'", "''")}';`,
        `[IO.File]::WriteAllText($path, 'locked markdown');`,
        `$stream = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None);`,
        `Write-Output 'MDTXT_LOCK_READY'; [Console]::Out.Flush();`,
        `Start-Sleep -Seconds 30; $stream.Dispose();`,
    ].join(" ");
    lockProcess = spawn(powershell, ["-NoProfile", "-NonInteractive", "-Command", lockCommand], {
        stdio: ["ignore", "pipe", process.stderr],
    });
    await new Promise((resolveReady, rejectReady) => {
        const timer = setTimeout(() => rejectReady(new Error("exclusive file lock did not become ready")), 10_000);
        lockProcess.stdout.on("data", (chunk) => {
            if (String(chunk).includes("MDTXT_LOCK_READY")) {
                clearTimeout(timer);
                resolveReady();
            }
        });
    });
    const forwarded = spawn(binary, [lockedPath], { cwd: root, stdio: "ignore" });
    await new Promise((resolveExit) => forwarded.once("exit", resolveExit));
    waitForUi("Could not open file|无法打开文件|being used by another process|另一个进程正在使用");
    capture(deniedScreenshot);
    if (lockProcess.exitCode === null) lockProcess.kill();
    lockProcess = undefined;
}

async function run() {
    const firstLines = ["installed recovery one"];
    const secondLines = ["installed recovery two", "line two", "line three", "line four", "active line five"];
    const firstText = firstLines.join("\n");
    const secondText = secondLines.join("\n");

    await launch();
    waitForUi("New File|新建文件");
    await validateDeniedShare();
    send({ keys: ["ControlN"] });
    invokeUi("Just start writing|直接开始写作");
    await wait(800);
    send({ keys: ["ClickEditor"] });
    pasteExactText(firstText);
    send({ keys: ["ControlN"] });
    await wait(800);
    send({ keys: ["ClickEditor"] });
    pasteExactText(secondText);
    await wait(3_500);
    assert.equal(readEditorThroughClipboard(), secondText);
    await forceKill();

    await launch();
    waitForUi("Restore all|全部恢复|Restore latest session|恢复最新会话");
    send({ keys: ["Enter"] });
    await wait(1_000);
    send({ keys: ["ClickEditor"] });
    assert.equal(readEditorThroughClipboard(), secondText);
    send({ keys: ["ControlShiftTab"] });
    await wait(500);
    assert.equal(readEditorThroughClipboard(), firstText);
    capture(recoveryScreenshot);
    console.log(`MDTXT_INSTALLED_RECOVERY platform=windows binary=${binary} signal=taskkill-F drafts=2 order=passed activeTab=second cursorLine=5 content=passed originalOverwrite=impossible deniedShareUx=passed recoveryScreenshot=${recoveryScreenshot} deniedScreenshot=${deniedScreenshot}`);
}

try {
    await run();
} finally {
    if (lockProcess && lockProcess.exitCode === null) lockProcess.kill();
    await forceKill();
}
