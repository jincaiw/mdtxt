import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

describe("mdtxt native Tauri smoke", () => {
    const activate = async (element) => {
        await browser.execute((target) => target.click(), element);
    };

    const focusLinuxAppWindow = () => {
        const search = spawnSync("xdotool", ["search", "--onlyvisible", "--name", "mdtxt"], {
            encoding: "utf8",
        });
        const windowId = search.stdout.trim().split(/\s+/).filter(Boolean).at(-1);
        assert.equal(
            search.status,
            0,
            `xdotool could not find the mdtxt X11 window (${search.status}): ${search.stderr || search.stdout}`,
        );
        assert.ok(windowId, "xdotool returned no visible mdtxt X11 window");
        // GitHub's Xvfb session intentionally has no EWMH window manager, so
        // `_NET_ACTIVE_WINDOW` cannot be used. `windowfocus` calls
        // XSetInputFocus directly and still proves that native keyboard input
        // is delivered to the real Tauri window.
        const focusWindow = spawnSync("xdotool", ["windowfocus", "--sync", windowId], {
            encoding: "utf8",
        });
        assert.equal(
            focusWindow.status,
            0,
            `xdotool could not focus mdtxt window ${windowId} (${focusWindow.status}): ${focusWindow.stderr || focusWindow.stdout}`,
        );
    };

    const sendLinuxNativeKey = (key) => {
        const keyResult = spawnSync("xdotool", ["key", "--clearmodifiers", key], {
            encoding: "utf8",
        });
        assert.equal(
            keyResult.status,
            0,
            `xdotool ${key} failed (${keyResult.status}): ${keyResult.stderr || keyResult.stdout}`,
        );
    };

    const sendLinuxNativeText = (text, delay = 1) => {
        focusLinuxAppWindow();
        sendLinuxNativeKey("ctrl+End");
        const typeResult = spawnSync(
            "xdotool",
            ["type", "--clearmodifiers", "--delay", String(delay), "--", text],
            { encoding: "utf8" },
        );
        assert.equal(
            typeResult.status,
            0,
            `xdotool typing failed (${typeResult.status}): ${typeResult.stderr || typeResult.stdout}`,
        );
    };

    const editorText = () => browser.execute(() => {
        const content = document.querySelector(".cm-content");
        return content
            ? [...content.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\n")
            : null;
    });

    const stageSizedRecovery = async (targetBytes, name) => browser.executeAsync((bytes, entryName, done) => {
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) {
            done({ ok: false, error: "Tauri invoke bridge is unavailable" });
            return;
        }
        const prefix = "# Native WebView performance\n\n";
        // Keep the 10 MiB fixture representative of a large prose/source
        // document (~10k lines), rather than accidentally constructing more
        // than 400k tiny lines and benchmarking the separate line-count gate.
        const payloadWidth = bytes <= 1024 * 1024 ? 100 : 1000;
        const line = `plain markdown input ${"x".repeat(payloadWidth)}\n`;
        const repeated = line.repeat(Math.ceil((bytes - prefix.length) / line.length));
        const content = `${prefix}${repeated}`.slice(0, bytes - 1) + "\n";
        const timestamp = Date.now();
        const entry = {
            documentId: `native-performance-${timestamp}`,
            path: null,
            name: entryName,
            content,
            version: 1,
            context: {
                recoverySessionId: `native-performance-session-${timestamp}`,
                tabIndex: 0,
                wasActive: true,
                cursorLine: 1,
            },
        };
        invoke("list_recoveries")
            .then((existing) => Promise.all(existing.map((item) => invoke("discard_recovery", { documentId: item.documentId }))))
            .then(() => invoke("write_recovery", entry))
            .then(() => done({ ok: true, bytes: new TextEncoder().encode(content).byteLength }))
            .catch((error) => done({ ok: false, error: String(error) }));
    }, targetBytes, name);

    const restoreStagedRecovery = async () => {
        await browser.refresh();
        const dialog = await $("[role='alertdialog']");
        await dialog.waitForDisplayed({ timeout: 20_000 });
        const result = await browser.executeAsync((done) => {
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
                done({ error: "Restore button is unavailable" });
                return;
            }
            const started = performance.now();
            let timeoutId;
            const finish = () => {
                if (document.querySelector("[role='alertdialog']") || !document.querySelector(".cm-content")) return false;
                window.clearTimeout(timeoutId);
                done({ duration: performance.now() - started, metrics: window.__mdtxtNativeMetrics });
                return true;
            };
            const observer = new MutationObserver(() => {
                if (finish()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            timeoutId = window.setTimeout(() => {
                observer.disconnect();
                done({ error: "Restore did not reach an editable Source view within 60 seconds", metrics: window.__mdtxtNativeMetrics });
            }, 60_000);
            button.click();
            finish();
        });
        console.log(`MDTXT_NATIVE_TRACE ${JSON.stringify(result.metrics ?? [])}`);
        assert.equal(result.error, undefined, result.error);
        return result.duration;
    };

    it("launches the packaged WebView and renders the welcome screen", async () => {
        const title = await $("h1=mdtxt");
        await title.waitForDisplayed();
        assert.equal(await title.getText(), "mdtxt");
        await $("button[aria-label='Settings'], button[aria-label='设置']").waitForDisplayed();
    });

    it("opens the native settings menu", async () => {
        const settings = await $("button[aria-label='Settings'], button[aria-label='设置']");
        await settings.click();
        await browser.waitUntil(async () => (await settings.getAttribute("aria-expanded")) === "true");
        const menu = await $("[role='menu'][aria-label='Settings'], [role='menu'][aria-label='设置']");
        await menu.waitForDisplayed();
        assert.equal(await menu.isDisplayed(), true);
        await settings.click();
        await browser.waitUntil(async () => (await settings.getAttribute("aria-expanded")) !== "true");
    });

    it("exposes the approved workspace modes and keeps Live behind explicit opt-in", async () => {
        const newFile = await $("//button[contains(., '新建文件') or contains(., 'New File')]");
        await newFile.click();

        await browser.pause(250);
        const tour = await $("[role='dialog'][aria-label='欢迎导览'], [role='dialog'][aria-label='Welcome tour']");
        if (await tour.isExisting()) {
            await browser.keys(["Escape"]);
            await tour.waitForDisplayed({ reverse: true });
        }

        await $("[role='group'][aria-label='切换视图模式'], [role='group'][aria-label='View mode toggle']").waitForDisplayed();
        assert.equal(await $("button[aria-label='源码编辑器'], button[aria-label='Code editor']").getAttribute("aria-pressed"), "true");
        assert.equal(await $("button[aria-label='分栏视图'], button[aria-label='Split view']").isDisplayed(), true);
        assert.equal(await $("button[aria-label='阅读模式'], button[aria-label='Reader mode']").isDisplayed(), true);
        assert.equal(await $("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']").isExisting(), false);

        const settings = await $("button[aria-label='Settings'], button[aria-label='设置']");
        // Linux WebKitWebDriver can report the title-bar drag region as the
        // click target once a document toolbar is present, even though the
        // same settings button is user-clickable (covered by the preceding
        // welcome-screen test). Activate the control through the DOM here so
        // this test stays focused on the settings-to-Live integration.
        await activate(settings);
        const moreSettings = await $("//button[contains(., '更多设置') or contains(., 'More settings')]");
        await moreSettings.waitForDisplayed();
        await activate(moreSettings);
        await $("[role='dialog'][aria-label='设置'], [role='dialog'][aria-label='Settings']").waitForDisplayed();
        await activate(await $("//button[contains(., '编辑器') or normalize-space(.)='Editor']"));

        const switches = await $$("[role='switch']");
        let liveSwitch = null;
        for (const candidate of switches) {
            if ((await candidate.getText()).includes("Live Beta")) {
                liveSwitch = candidate;
                break;
            }
        }
        assert.ok(liveSwitch, "Live Beta settings switch must exist");
        await activate(liveSwitch);
        await activate(await $("button[aria-label='关闭设置'], button[aria-label='Close settings']"));

        const liveMode = await $("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
        await liveMode.waitForDisplayed();
        const editor = await $(".cm-content");
        await editor.setValue("# Native smoke\n\n## Modes\n\n- Source\n- Live\n- Split\n- Reader");

        await activate(liveMode);
        await $(".cm-editor[data-mdtxt-live='true']").waitForExist();
        assert.equal(await $(".cm-editor[data-mdtxt-live='true'] .cm-gutters").getCSSProperty("display").then((v) => v.value), "none");

        await activate(await $("button[aria-label='分栏视图'], button[aria-label='Split view']"));
        await $(".markdown-body").waitForDisplayed();
        await activate(await $("button[aria-label='阅读模式'], button[aria-label='Reader mode']"));
        assert.equal(await $(".markdown-body").isDisplayed(), true);
    });

    it("composes Chinese through the Ubuntu IBus engine without corrupting Source or Live", async function () {
        if (process.env.MDTXT_E2E_IBUS_ENGINE !== "libpinyin") this.skip();

        const sourceMode = await $("button[aria-label='源码编辑器'], button[aria-label='Code editor']");
        await activate(sourceMode);
        const editor = await $(".cm-content");
        await editor.waitForDisplayed();
        await editor.setValue("# IBus native IME\n\n");

        const prepared = await browser.execute(() => {
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
        });
        assert.deepEqual(prepared, { ok: true });

        // Keep the preedit visible long enough to capture the real X11 root
        // window, including IBus's out-of-process candidate panel.
        sendLinuxNativeText("zhongwen", 35);
        await browser.pause(350);
        const preedit = await browser.execute(() => ({
            events: window.__mdtxtImeEvents ?? [],
            text: document.querySelector(".cm-activeLine")?.textContent ?? "",
        }));
        assert.equal(preedit.events.some((event) => event.type === "compositionstart"), true);
        const screenshot = spawnSync("scrot", ["/tmp/mdtxt-ibus-preedit.png"], { encoding: "utf8" });
        assert.equal(
            screenshot.status,
            0,
            `scrot failed (${screenshot.status}): ${screenshot.stderr || screenshot.stdout}`,
        );

        sendLinuxNativeKey("space");
        await browser.pause(500);
        const committed = await browser.execute(() => ({
            events: window.__mdtxtImeEvents ?? [],
            text: document.querySelector(".cm-content")
                ? [...document.querySelectorAll(".cm-content .cm-line")].map((line) => line.textContent ?? "").join("\n")
                : "",
        }));
        assert.equal(committed.events.some((event) => event.type === "compositionend"), true);
        const sourceChinese = committed.text.match(/[\u3400-\u9fff]{2,}/u)?.[0];
        assert.ok(sourceChinese, `IBus did not commit multi-character Chinese: ${committed.text}`);
        assert.equal(committed.text.includes("zhongwen"), false);

        sendLinuxNativeKey("ctrl+z");
        await browser.pause(200);
        assert.equal((await editorText()).includes(sourceChinese), false);
        sendLinuxNativeKey("ctrl+shift+z");
        await browser.pause(200);
        assert.equal((await editorText()).includes(sourceChinese), true);

        const liveMode = await $("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
        await activate(liveMode);
        await $(".cm-editor[data-mdtxt-live='true']").waitForExist();
        await browser.execute(() => document.querySelector(".cm-content")?.focus());
        sendLinuxNativeText("wancheng", 35);
        sendLinuxNativeKey("space");
        await browser.pause(500);
        const liveText = await editorText();
        const allChinese = liveText.match(/[\u3400-\u9fff]{2,}/gu) ?? [];
        assert.ok(allChinese.length >= 2, `Live did not commit a second Chinese phrase: ${liveText}`);
        assert.equal(liveText.includes("wancheng"), false);

        // Exercise the native clipboard path while Chinese text is selected,
        // then prove a tab/mode round-trip preserves the exact document bytes.
        sendLinuxNativeKey("ctrl+a");
        sendLinuxNativeKey("ctrl+c");
        sendLinuxNativeKey("End");
        sendLinuxNativeKey("Return");
        sendLinuxNativeKey("ctrl+v");
        await browser.pause(300);
        const copiedText = await editorText();
        assert.ok(copiedText.endsWith(liveText), "Native Chinese clipboard paste did not preserve the document text");

        const firstTab = await $("[role='tab'][aria-selected='true']");
        const firstTabName = await firstTab.getAttribute("title");
        await activate(await $("button[aria-label='新建标签页'], button[aria-label='New tab']"));
        await activate(await $(`[role='tab'][title=${JSON.stringify(firstTabName)}]`));
        assert.equal(await editorText(), copiedText);
        await activate(await $("button[aria-label='源码编辑器'], button[aria-label='Code editor']"));
        assert.equal(await editorText(), copiedText);

        console.log(`MDTXT_NATIVE_IME platform=ubuntu engine=ibus-libpinyin sourcePhrase=${sourceChinese} compositionEvents=${committed.events.length} liveChineseRuns=${allChinese.length} clipboard=passed undoRedo=passed modeTabRoundTrip=passed screenshot=/tmp/mdtxt-ibus-preedit.png`);
    });

    it("round-trips a verified native recovery entry into an unsaved draft", async () => {
        const candidate = {
            documentId: `native-recovery-${Date.now()}`,
            path: null,
            name: "Native Recovery Probe.md",
            content: "# Native recovery\n\nWindows and Linux keep these bytes intact.\n",
            version: 7,
            context: {
                recoverySessionId: `native-session-${Date.now()}`,
                tabIndex: 0,
                wasActive: true,
                cursorLine: 3,
            },
        };

        const written = await browser.executeAsync((entry, done) => {
            const invoke = window.__TAURI_INTERNALS__?.invoke;
            if (!invoke) {
                done({ ok: false, error: "Tauri invoke bridge is unavailable" });
                return;
            }
            invoke("list_recoveries")
                .then((existing) => Promise.all(existing.map((item) => invoke("discard_recovery", { documentId: item.documentId }))))
                .then(() => invoke("write_recovery", entry))
                .then(() => done({ ok: true }))
                .catch((error) => done({ ok: false, error: String(error) }));
        }, candidate);
        assert.deepEqual(written, { ok: true });

        await browser.refresh();
        const dialog = await $("[role='alertdialog']");
        await dialog.waitForDisplayed({ timeout: 10_000 });
        const stored = await browser.executeAsync((done) => {
            window.__TAURI_INTERNALS__.invoke("list_recoveries")
                .then((entries) => done(entries))
                .catch((error) => done({ error: String(error) }));
        });
        assert.equal(
            Array.isArray(stored) && stored.some((entry) => entry.documentId === candidate.documentId && entry.name === candidate.name && entry.content === candidate.content),
            true,
        );

        const restore = await $("//*[@role='alertdialog']//button[contains(., '恢复') or contains(., 'Restore')]");
        await activate(restore);
        await dialog.waitForDisplayed({ reverse: true });

        const recovered = await $(".cm-content");
        await recovered.waitForDisplayed();
        const recoveredText = await browser.execute(
            (element) => [...element.querySelectorAll(".cm-line")].map((line) => line.textContent ?? "").join("\n"),
            recovered,
        );
        assert.equal(recoveredText.replaceAll("\u00a0", " "), candidate.content);

        await browser.executeAsync((done) => {
            const invoke = window.__TAURI_INTERNALS__?.invoke;
            if (!invoke) {
                done();
                return;
            }
            invoke("list_recoveries")
                .then((existing) => Promise.all(existing.map((item) => invoke("discard_recovery", { documentId: item.documentId }))))
                .then(() => done())
                .catch(() => done());
        });
    });

    it("measures a 10 MiB Source to restricted-Live path in the native WebView", async () => {
        const targetBytes = 10 * 1024 * 1024;
        const staged = await stageSizedRecovery(targetBytes, "Native 10 MiB.md");
        assert.deepEqual(staged, { ok: true, bytes: targetBytes });

        const sourceOpenMs = await restoreStagedRecovery();
        const restrictedLiveMs = await browser.executeAsync((done) => {
            const button = document.querySelector("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']");
            if (!(button instanceof HTMLButtonElement)) {
                done({ error: "Live Beta mode is unavailable" });
                return;
            }
            const started = performance.now();
            let timeoutId;
            const finish = () => {
                if (!document.querySelector(".cm-editor[data-mdtxt-live='restricted']")) return false;
                window.clearTimeout(timeoutId);
                done(performance.now() - started);
                return true;
            };
            const observer = new MutationObserver(() => {
                if (finish()) observer.disconnect();
            });
            observer.observe(document.body, { attributes: true, childList: true, subtree: true });
            timeoutId = window.setTimeout(() => {
                observer.disconnect();
                done({ error: "Restricted Live did not activate within 20 seconds" });
            }, 20_000);
            button.click();
            finish();
        });
        assert.equal(typeof restrictedLiveMs, "number", restrictedLiveMs.error);

        console.log(`MDTXT_NATIVE_PERF target=10MiB sourceOpenMs=${sourceOpenMs} restrictedLiveMs=${restrictedLiveMs}`);
        assert.ok(sourceOpenMs <= 3_000, `10 MiB Source open took ${sourceOpenMs} ms`);
        assert.ok(restrictedLiveMs <= 5_000, `10 MiB restricted Live took ${restrictedLiveMs} ms`);
    });

    it("measures 1 MiB editing transactions inside the native WebView", async () => {
        const targetBytes = 1024 * 1024;
        const staged = await stageSizedRecovery(targetBytes, "Native 1 MiB.md");
        assert.deepEqual(staged, { ok: true, bytes: targetBytes });
        await restoreStagedRecovery();

        const prepared = await browser.execute(() => {
            const content = document.querySelector(".cm-content");
            if (!(content instanceof HTMLElement)) {
                return { ok: false, error: "CodeMirror content is unavailable" };
            }
            content.focus();

            window.__mdtxtNativeInputSamples = {
                beforeinput: [],
                input: [],
                keydownMutation: [],
                keydownStarts: [],
            };
            const recordInputProcessing = (eventName) => {
                const started = performance.now();
                // A microtask runs after every listener for this event has
                // completed, including CodeMirror's synchronous transaction
                // work and mdtxt's incremental session consumers. Some
                // WebKitWebDriver versions edit contenteditable through
                // `input` without exposing `beforeinput`, so retain both
                // standards-based paths and report which event supplied the
                // complete forty-key sample.
                queueMicrotask(() => {
                    window.__mdtxtNativeInputSamples[eventName].push(performance.now() - started);
                });
            };
            const onBeforeInput = () => recordInputProcessing("beforeinput");
            const onInput = () => recordInputProcessing("input");
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
        });
        assert.deepEqual(prepared, { ok: true });

        // Drive the active X11 window through the operating-system input path.
        // WebKitWebDriver occasionally mutates contenteditable directly without
        // dispatching any keyboard/input events, which cannot prove native
        // editor latency even when the resulting text is correct.
        // `content.focus()` above already transfers DOM focus. A WebDriver
        // click on a 1 MiB contenteditable asks WebKit to target the midpoint
        // of its 300k-pixel layout box and is intercepted by the viewport.
        // Keep the click out of the measurement path and verify the focused
        // element directly before handing input to X11.
        const focused = await browser.execute(() => document.activeElement?.classList.contains("cm-content") === true);
        assert.equal(focused, true, "CodeMirror content did not retain focus before X11 input");
        sendLinuxNativeText("x".repeat(40));

        const result = await browser.execute(() => {
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
            const inputSamples = inputEvent === "keydown-mutation"
                ? eventSamples.keydownMutation
                : eventSamples[inputEvent];
            inputSamples.sort((left, right) => left - right);
            const inputP95 = inputSamples[Math.ceil(inputSamples.length * 0.95) - 1];
            const activeLine = content.querySelector(".cm-activeLine");
            return {
                ok: true,
                inputEvent,
                inputSamples: inputSamples.length,
                beforeInputSamples: eventSamples.beforeinput.length,
                inputEventSamples: eventSamples.input.length,
                keydownMutationSamples: eventSamples.keydownMutation.length,
                inputP50: inputSamples[Math.ceil(inputSamples.length * 0.5) - 1],
                inputP95,
                inputMax: inputSamples.at(-1),
                suffix: activeLine?.textContent?.slice(-40),
            };
        });

        console.log(`MDTXT_NATIVE_PERF target=1MiB inputMethod=x11-xdotool inputEvent=${result.inputEvent} beforeInputSamples=${result.beforeInputSamples} inputEventSamples=${result.inputEventSamples} keydownMutationSamples=${result.keydownMutationSamples} inputProcessingSamples=${result.inputSamples} inputProcessingP50Ms=${result.inputP50} inputProcessingP95Ms=${result.inputP95} inputProcessingMaxMs=${result.inputMax}`);
        assert.equal(result.ok, true);
        assert.equal(result.inputSamples, 40);
        assert.equal(result.suffix, "x".repeat(40));
        assert.ok(result.inputP95 <= 16, `1 MiB native WebView input-processing P95 was ${result.inputP95} ms`);
    });
});
