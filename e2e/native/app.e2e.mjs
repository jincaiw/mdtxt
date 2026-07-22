import assert from "node:assert/strict";

describe("mdtxt native Tauri smoke", () => {
    const activate = async (element) => {
        await browser.execute((target) => target.click(), element);
    };

    const dismissTourIfPresent = async () => {
        // The tour is mounted by a hasFile/booting effect after the editor
        // itself becomes visible. Let that effect settle before deciding the
        // native input surface is unobstructed.
        await browser.pause(300);
        const dismissed = await browser.execute(() => {
            const dialog = document.querySelector(
                "[role='dialog'][aria-label='欢迎引导'], [role='dialog'][aria-label='Welcome tour']",
            );
            if (!dialog) return false;
            const button = [...dialog.querySelectorAll("button")]
                .find((candidate) => /直接开始写作|Just start writing/.test(candidate.textContent ?? ""));
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error("Welcome tour is visible without its skip button");
            }
            button.click();
            return true;
        });
        if (dismissed) {
            await browser.waitUntil(async () => browser.execute(() => !document.querySelector(
                "[role='dialog'][aria-label='欢迎引导'], [role='dialog'][aria-label='Welcome tour']",
            )));
        }
        assert.equal(await browser.execute(() => document.querySelectorAll("[role='dialog']").length), 0);
    };

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

    const stageExactRecovery = async (content, name) => browser.executeAsync((entryContent, entryName, done) => {
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) {
            done({ ok: false, error: "Tauri invoke bridge is unavailable" });
            return;
        }
        const timestamp = Date.now();
        const entry = {
            documentId: `native-exact-${timestamp}`,
            path: null,
            name: entryName,
            content: entryContent,
            version: 1,
            context: {
                recoverySessionId: `native-exact-session-${timestamp}`,
                tabIndex: 0,
                wasActive: true,
                cursorLine: 5,
            },
        };
        invoke("list_recoveries")
            .then((existing) => Promise.all(existing.map((item) => invoke("discard_recovery", { documentId: item.documentId }))))
            .then(() => invoke("write_recovery", entry))
            .then(() => done({ ok: true }))
            .catch((error) => done({ ok: false, error: String(error) }));
    }, content, name);

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
        const tour = await $("[role='dialog'][aria-label='欢迎引导'], [role='dialog'][aria-label='Welcome tour']");
        if (await tour.isExisting()) {
            const skipTour = await $("//button[contains(., '直接开始写作') or contains(., 'Just start writing')]");
            await skipTour.waitForDisplayed();
            await activate(skipTour);
            await tour.waitForDisplayed({ reverse: true });
        }
        await browser.execute(() => localStorage.setItem("mdtxt:tourDone", "true"));

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

    it("renders every P7 Live widget in the native viewport and round-trips source", async () => {
        const fixture = [
            "---",
            "title: Native widgets",
            "---",
            "",
            "# P7 widgets",
            "",
            "![pixel](data:image/svg+xml;base64,PHN2Zy8+)",
            "",
            "```ts",
            "const native = true;",
            "```",
            "",
            "| Name | Value |",
            "| --- | ---: |",
            "| native | 8 |",
            "",
            "$$",
            "x^2 + y^2 = z^2",
            "$$",
            "",
            "```mermaid",
            "graph TD; A-->B",
            "```",
            "",
            "Text[^1]",
            "",
            "[^1]: Native footnote",
            "",
            "> [!NOTE]",
            "> Native callout",
        ].join("\n");
        assert.deepEqual(await stageExactRecovery(fixture, "P7 Native Widgets.md"), { ok: true });
        await restoreStagedRecovery();
        await dismissTourIfPresent();
        const editor = await $(".cm-content");
        await browser.waitUntil(async () => (await $$(".cm-line")).length >= 5, {
            timeout: 10_000,
            timeoutMsg: "restored P7 fixture did not expose its heading line",
        });
        await (await $$(".cm-line"))[4].click();

        const started = await browser.execute(() => performance.now());
        await activate(await $("button[aria-label='Live Beta 模式'], button[aria-label='Live Beta mode']"));
        const widgetSelectors = [
            ".cm-live-frontmatter-widget",
            ".cm-live-image-widget",
            ".cm-live-code-widget",
            ".cm-live-table-widget",
            ".cm-live-math-widget",
            ".cm-live-mermaid-widget",
            ".cm-live-footnote-widget",
            ".cm-live-callout-widget",
        ];
        // Widgets are deliberately bounded to CodeMirror's visible ranges. A
        // single viewport cannot contain all eight blocks on every runner, so
        // bring each source block into the native viewport before asserting
        // its corresponding decoration.
        for (const selector of widgetSelectors) {
            await browser.waitUntil(async () => browser.execute((target) => {
                if (document.querySelector(target)) return true;
                const scroller = document.querySelector(".cm-scroller");
                if (!(scroller instanceof HTMLElement)) return false;
                scroller.scrollTop = Math.min(
                    scroller.scrollHeight,
                    scroller.scrollTop + Math.max(120, scroller.clientHeight * 0.55),
                );
                return false;
            }, selector), {
                timeout: 20_000,
                interval: 100,
                timeoutMsg: `${selector} did not enter the native CodeMirror viewport`,
            });
            if (selector === ".cm-live-mermaid-widget") {
                await $(".cm-live-mermaid-widget svg").waitForExist({ timeout: 20_000 });
            }
        }
        const duration = await browser.execute((start) => performance.now() - start, started);

        await activate(await $("button[aria-label='源码编辑器'], button[aria-label='Code editor']"));
        const roundTrip = await browser.execute(() => (
            [...document.querySelectorAll(".cm-content .cm-line")].map((line) => line.textContent ?? "").join("\n")
        ));
        assert.equal(roundTrip.replaceAll("\u00a0", " "), fixture);
        console.log(`MDTXT_NATIVE_P7 platform=ubuntu widgets=${widgetSelectors.length} liveActivationMs=${duration} mermaid=passed sourceRoundTrip=passed`);
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
        await dismissTourIfPresent();

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

        // Measure inside the packaged Linux WebKit view through its W3C key
        // endpoint. Real IBus/XTEST input runs separately without a WebDriver
        // automation session, because WebKitGTK suppresses external XTEST
        // events while that session owns the page.
        const focused = await browser.execute(() => document.activeElement?.classList.contains("cm-content") === true);
        assert.equal(focused, true, "CodeMirror content did not retain focus before WebKit input");
        const editor = await $(".cm-content");
        await editor.addValue("x".repeat(40));
        await browser.pause(100);

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
                activeLineText: activeLine?.textContent,
            };
        });

        console.log(`MDTXT_NATIVE_PERF target=1MiB inputMethod=webkit-webdriver-w3c-native-view inputEvent=${result.inputEvent} beforeInputSamples=${result.beforeInputSamples} inputEventSamples=${result.inputEventSamples} keydownMutationSamples=${result.keydownMutationSamples} inputProcessingSamples=${result.inputSamples} inputProcessingP50Ms=${result.inputP50} inputProcessingP95Ms=${result.inputP95} inputProcessingMaxMs=${result.inputMax}`);
        assert.equal(result.ok, true);
        assert.equal(result.inputSamples, 40);
        assert.equal(result.activeLineText?.startsWith("x".repeat(40)), true);
        assert.ok(result.inputP95 <= 16, `1 MiB native WebView input-processing P95 was ${result.inputP95} ms`);
    });
});
