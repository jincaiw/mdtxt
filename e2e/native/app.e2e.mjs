import assert from "node:assert/strict";

describe("mdtxt native Tauri smoke", () => {
    const activate = async (element) => {
        await browser.execute((target) => target.click(), element);
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
        assert.equal(recoveredText.replaceAll("\u00a0", " "), candidate.content.trimEnd());

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
});
