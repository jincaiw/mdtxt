import { describe, expect, it, vi } from "vitest";
import { DocumentSessionController } from "./documentSessionController";

const input = (id: string, content = "first") => ({
    id,
    path: `/notes/${id}.md`,
    name: `${id}.md`,
    content,
    diskRevision: 10,
    diskHash: "original-hash",
});

describe("DocumentSessionController", () => {
    it("publishes only metadata while retaining full document content internally", () => {
        const controller = new DocumentSessionController();
        expect(controller.getSnapshot()).toBe(controller.getSnapshot());
        controller.open(input("a", "# private source"));

        const snapshot = controller.getSnapshot();
        expect(snapshot).toMatchObject({ activeId: "a", sessions: [{ id: "a", name: "a.md", dirty: false }] });
        expect(snapshot.sessions[0]).not.toHaveProperty("content");
        expect(controller.get("a")?.content).toBe("# private source");
    });

    it("owns activation and preserves independent document revisions", () => {
        const controller = new DocumentSessionController();
        controller.open(input("a"));
        controller.open(input("b", "second"));
        controller.replaceContent("a", "first changed");
        controller.activate("a");

        expect(controller.getSnapshot().activeId).toBe("a");
        expect(controller.get("a")).toMatchObject({ content: "first changed", version: 1, savedVersion: 0 });
        expect(controller.get("b")).toMatchObject({ content: "second", version: 0, savedVersion: 0 });
    });

    it("returns an immutable versioned read for save, preview, and AI work", () => {
        const controller = new DocumentSessionController();
        controller.open(input("a", "first"));
        const read = controller.readActive();
        controller.replaceContent("a", "second");

        expect(read).toEqual({ documentId: "a", version: 0, value: "first" });
        expect(controller.acceptsResult("a", read!)).toBe(false);
        expect(controller.read("missing")).toBeNull();
    });

    it("collects only dirty versioned reads for close-time saves", () => {
        const controller = new DocumentSessionController();
        controller.open(input("saved", "unchanged"));
        controller.open(input("dirty", "before"));
        controller.replaceContent("dirty", "after");

        expect(controller.readDirty()).toEqual([
            {
                documentId: "dirty",
                version: 1,
                value: "after",
                path: "/notes/dirty.md",
                name: "dirty.md",
                diskRevision: 10,
                diskHash: "original-hash",
            },
        ]);
    });

    it("notifies subscribers only when a session projection changes", () => {
        const controller = new DocumentSessionController();
        const listener = vi.fn();
        const unsubscribe = controller.subscribe(listener);
        controller.open(input("a"));
        controller.replaceContent("a", "first changed");
        controller.replaceContent("a", "first changed");
        unsubscribe();
        controller.setViewMode("a", "preview");

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("does not let old saves or async results apply to a newer revision", () => {
        const controller = new DocumentSessionController();
        controller.open(input("a"));
        controller.replaceContent("a", "second");
        const stale = { documentId: "a", version: 0, value: { modified: 11, hash: "stale-hash" } };

        controller.markSaved("a", stale);
        expect(controller.get("a")).toMatchObject({ version: 1, savedVersion: 0 });
        expect(controller.acceptsResult("a", { documentId: "a", version: 0, value: "old" })).toBe(false);
        expect(controller.acceptsResult("a", { documentId: "a", version: 1, value: "current" })).toBe(true);
    });

    it("handles external content, active removal, and missing sessions explicitly", () => {
        const controller = new DocumentSessionController();
        controller.open(input("a"));
        controller.applyExternalContent("a", "disk", 22, "disk-hash");
        expect(controller.get("a")).toMatchObject({ content: "disk", version: 1, savedVersion: 1, diskRevision: 22, diskHash: "disk-hash" });
        expect(controller.remove("a")).toBe(true);
        expect(controller.getSnapshot()).toEqual({ activeId: null, sessions: [] });
        expect(controller.remove("missing")).toBe(false);
        expect(controller.replaceContent("missing", "x")).toBeNull();
    });

    it("updates a saved document's metadata without changing its revision", () => {
        const controller = new DocumentSessionController();
        controller.open({ ...input("a"), path: null, name: "Untitled.md" });
        controller.updateFileMetadata("a", { path: "/notes/saved.md", name: "saved.md", fileSize: 10, diskRevision: 30, diskHash: "saved-hash" });

        expect(controller.get("a")).toMatchObject({
            path: "/notes/saved.md", name: "saved.md", fileSize: 10, diskRevision: 30, diskHash: "saved-hash", version: 0,
        });
    });
});
