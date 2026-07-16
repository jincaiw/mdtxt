import { describe, it, expect, beforeEach } from "vitest";
import {
    getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles,
    getSplitRatio, setSplitRatio,
    getAIConfig, setAIConfig,
    getAIEnabled,
    getWordWrap,
    migrateLegacyKeys, getLastFile,
    getOpenInReader, setOpenInReader,
    getLiveBetaEnabled, setLiveBetaEnabled,
    getSession, setSession,
} from "./persistence";

beforeEach(() => localStorage.clear());

describe("legacy -> mdtxt key migration", () => {
    it("copies legacy values to the new prefix without deleting the originals", () => {
        localStorage.setItem("marklite:lastFile", JSON.stringify("C:/notes/old.md"));
        localStorage.setItem("marklite:wordWrap", JSON.stringify(false));
        migrateLegacyKeys();
        expect(getLastFile()).toBe("C:/notes/old.md");
        expect(getWordWrap()).toBe(false);
        expect(localStorage.getItem("marklite:lastFile")).not.toBeNull();
        expect(localStorage.getItem("marklite:wordWrap")).not.toBeNull();
    });

    it("never overwrites an existing mdtxt value", () => {
        localStorage.setItem("mdtxt:lastFile", JSON.stringify("C:/notes/new.md"));
        localStorage.setItem("paperling:lastFile", JSON.stringify("C:/notes/old.md"));
        migrateLegacyKeys();
        expect(getLastFile()).toBe("C:/notes/new.md");
    });
});

describe("recent files", () => {
    it("adds most-recent first and de-duplicates by path", () => {
        addRecentFile("/a.md", "a");
        addRecentFile("/b.md", "b");
        addRecentFile("/a.md", "a"); // re-open a -> moves to front
        const list = getRecentFiles();
        expect(list.map((f) => f.path)).toEqual(["/a.md", "/b.md"]);
    });

    it("caps the list at 25 entries", () => {
        for (let i = 0; i < 30; i++) addRecentFile(`/f${i}.md`, `f${i}`);
        expect(getRecentFiles()).toHaveLength(25);
    });

    it("removes and clears", () => {
        addRecentFile("/a.md", "a");
        addRecentFile("/b.md", "b");
        removeRecentFile("/a.md");
        expect(getRecentFiles().map((f) => f.path)).toEqual(["/b.md"]);
        clearRecentFiles();
        expect(getRecentFiles()).toEqual([]);
    });
});

describe("open in reader", () => {
    it("defaults off and round-trips", () => {
        expect(getOpenInReader()).toBe(false);
        setOpenInReader(true);
        expect(getOpenInReader()).toBe(true);
    });
    it("treats a malformed stored value as the default", () => {
        localStorage.setItem("mdtxt:openInReader", "{not json");
        expect(getOpenInReader()).toBe(false);
    });
});

describe("Live Beta", () => {
    it("defaults off and only changes after explicit opt-in", () => {
        expect(getLiveBetaEnabled()).toBe(false);
        setLiveBetaEnabled(true);
        expect(getLiveBetaEnabled()).toBe(true);
    });
});

describe("split ratio", () => {
    it("defaults to 0.5", () => {
        expect(getSplitRatio()).toBe(0.5);
    });
    it("persists a valid value and rejects out-of-range", () => {
        setSplitRatio(0.3);
        expect(getSplitRatio()).toBe(0.3);
        setSplitRatio(0.99); // out of (0.15, 0.85) -> falls back to 0.5
        expect(getSplitRatio()).toBe(0.5);
    });
});

describe("saved tab session", () => {
    it("round-trips tab paths and clamps the restored active index", () => {
        setSession({
            tabs: [{ path: "/notes/one.md", cursorLine: 4 }, { path: "/notes/two.md" }],
            activeIndex: 99,
        });

        expect(getSession()).toEqual({
            tabs: [{ path: "/notes/one.md", cursorLine: 4 }, { path: "/notes/two.md" }],
            activeIndex: 1,
        });
    });

    it("rejects malformed or empty recovery data instead of restoring arbitrary values", () => {
        localStorage.setItem("mdtxt:session", JSON.stringify({ tabs: [{ path: 123 }], activeIndex: -1 }));
        expect(getSession()).toBeNull();

        setSession(null);
        expect(getSession()).toBeNull();
    });
});

describe("AI config", () => {
    it("round-trips endpoint and model via localStorage", () => {
        setAIConfig({ endpoint: "https://x/v1/chat/completions", model: "m", apiKey: "" });
        const cfg = getAIConfig();
        expect(cfg.endpoint).toBe("https://x/v1/chat/completions");
        expect(cfg.model).toBe("m");
    });
    it("mirrors the API key in memory without writing plaintext browser storage", async () => {
        // The key is keychain-backed (SECURITY-01); setAIConfig updates a sync
        // cache that getAIConfig reads, so the value is available immediately
        // even though the keychain write happens asynchronously.
        const saved = setAIConfig({ endpoint: "e", model: "m", apiKey: "secret" });
        expect(getAIConfig().apiKey).toBe("secret");
        expect(localStorage.getItem("mdtxt:aiApiKey")).toBeNull();
        await saved;
        expect(localStorage.getItem("mdtxt:aiApiKey")).toBeNull();
    });
    it("reports empty endpoint/model when unset", () => {
        setAIConfig({ endpoint: "", model: "", apiKey: "" });
        const cfg = getAIConfig();
        expect(cfg.endpoint).toBe("");
        expect(cfg.model).toBe("");
    });
});

describe("defaults", () => {
    it("word wrap defaults to true", () => {
        expect(getWordWrap()).toBe(true);
    });
    it("keeps every AI surface disabled until explicit opt-in", () => {
        expect(getAIEnabled()).toBe(false);
    });
});
