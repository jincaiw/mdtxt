import assert from "node:assert/strict";

describe("mdtxt native Tauri smoke", () => {
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
    });
});
