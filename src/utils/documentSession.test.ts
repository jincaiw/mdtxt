import { describe, expect, it } from "vitest";
import {
    acceptsSessionResult,
    applyExternalSessionContent,
    createDocumentSession,
    isSessionDirty,
    markSessionSaved,
    replaceSessionContent,
    resolveLiveBetaViewMode,
    setSessionViewMode,
} from "./documentSession";

const create = () => createDocumentSession({
    id: "doc-a", path: "/notes/a.md", name: "a.md", content: "first\r\n",
    diskRevision: 10, diskHash: "original-hash", viewMode: "split", cursorLine: 4,
});

describe("DocumentSession", () => {
    it("starts clean with durable document metadata", () => {
        const session = create();
        expect(session).toMatchObject({ version: 0, savedVersion: 0, diskRevision: 10, diskHash: "original-hash", viewMode: "split", cursorLine: 4 });
        expect(session.format).toMatchObject({ eol: "crlf", trailingNewline: true });
        expect(isSessionDirty(session)).toBe(false);
    });

    it("starts dirty when restored content differs from its durable snapshot", () => {
        const session = createDocumentSession({ id: "dirty", path: null, name: "Untitled.md", content: "draft", savedContent: "" });
        expect(session).toMatchObject({ version: 1, savedVersion: 0 });
        expect(isSessionDirty(session)).toBe(true);
    });

    it("increments only changed document revisions", () => {
        const session = create();
        expect(replaceSessionContent(session, session.content)).toBe(session);
        const changed = replaceSessionContent(session, "second");
        expect(changed.version).toBe(1);
        expect(isSessionDirty(changed)).toBe(true);
    });

    it("keeps view mode with its document without changing document revision", () => {
        const session = create();
        const changed = setSessionViewMode(session, "preview");
        expect(changed).toMatchObject({ viewMode: "preview", version: session.version, savedVersion: session.savedVersion });
        expect(setSessionViewMode(changed, "preview")).toBe(changed);

        const live = setSessionViewMode(changed, "live");
        expect(live).toMatchObject({ viewMode: "live", version: session.version, savedVersion: session.savedVersion });
    });

    it("restores a persisted Live mode only after explicit Beta consent", () => {
        expect(resolveLiveBetaViewMode("live", false)).toBe("code");
        expect(resolveLiveBetaViewMode("live", true)).toBe("live");
        expect(resolveLiveBetaViewMode("split", false)).toBe("split");
    });

    it("does not let an old save mark a newer edit clean", () => {
        const changed = replaceSessionContent(create(), "second");
        const newer = replaceSessionContent(changed, "third");
        expect(markSessionSaved(newer, { documentId: newer.id, version: changed.version, value: { modified: 11, hash: "stale" } })).toBe(newer);
        const saved = markSessionSaved(newer, { documentId: newer.id, version: newer.version, value: { modified: 12, hash: "saved-hash" } });
        expect(saved.savedVersion).toBe(saved.version);
        expect(saved.diskRevision).toBe(12);
        expect(saved.diskHash).toBe("saved-hash");
    });

    it("rejects asynchronous results from another document or revision", () => {
        const changed = replaceSessionContent(create(), "second");
        expect(acceptsSessionResult(changed, { documentId: "doc-b", version: 1, value: "x" })).toBe(false);
        expect(acceptsSessionResult(changed, { documentId: changed.id, version: 0, value: "x" })).toBe(false);
        expect(acceptsSessionResult(changed, { documentId: changed.id, version: 1, value: "x" })).toBe(true);
    });

    it("records externally reloaded text as a new saved revision", () => {
        const changed = replaceSessionContent(create(), "local");
        const reloaded = applyExternalSessionContent(changed, "disk\n", 22, "disk-hash");
        expect(reloaded).toMatchObject({ content: "disk\n", version: 2, savedVersion: 2, diskRevision: 22, diskHash: "disk-hash" });
        expect(isSessionDirty(reloaded)).toBe(false);
    });
});
