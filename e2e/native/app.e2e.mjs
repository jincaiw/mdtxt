import assert from "node:assert/strict";

describe("mdtxt native Tauri smoke", () => {
    it("launches the packaged WebView and renders the welcome screen", async () => {
        const title = await $("h1=mdtxt");
        await title.waitForDisplayed();
        assert.equal(await title.getText(), "mdtxt");
        await $("button[aria-label='Settings'], button[aria-label='设置']").waitForDisplayed();
    });

    it("switches to Simplified Chinese through the native window", async () => {
        const settings = await $("button[aria-label='Settings'], button[aria-label='设置']");
        await settings.click();
        let chinese = await $("//button[normalize-space()='Simplified Chinese' or normalize-space()='简体中文']");
        if (!await chinese.isExisting()) {
            // The welcome screen's Settings button opens the full modal directly,
            // whereas the title-bar button opens the compact menu first.
            const moreSettings = await $("//button[normalize-space()='More settings…' or normalize-space()='更多设置…']");
            await moreSettings.waitForClickable();
            await moreSettings.click();
            chinese = await $("//button[normalize-space()='Simplified Chinese' or normalize-space()='简体中文']");
        }
        await chinese.waitForClickable();
        await chinese.click();
        const language = await $("h3=语言");
        await language.waitForDisplayed();
        assert.equal(await language.getText(), "语言");
        assert.equal(await browser.execute(() => document.documentElement.lang), "zh-CN");
    });
});
