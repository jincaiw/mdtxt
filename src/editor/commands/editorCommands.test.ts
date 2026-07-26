import { describe, expect, it } from "vitest";
import { runEditorCommand } from "./editorCommands";

describe("runEditorCommand", () => {
    it("shares formatting behavior between menu, toolbar and shortcuts", () => {
        expect(runEditorCommand({ text: "text", selStart: 0, selEnd: 4 }, "format.bold")).toEqual({
            text: "**text**", selStart: 2, selEnd: 6,
        });
        expect(runEditorCommand({ text: "line", selStart: 2, selEnd: 2 }, "format.heading3").text).toBe("### line");
        expect(runEditorCommand({ text: "### line", selStart: 4, selEnd: 4 }, "format.paragraph").text).toBe("line");
    });

    it("uses the documented fixed shortcuts' commands without changing unrelated text", () => {
        expect(runEditorCommand({ text: "item", selStart: 0, selEnd: 0 }, "format.taskList").text).toBe("- [ ] item");
        expect(runEditorCommand({ text: "x", selStart: 0, selEnd: 1 }, "insert.codeBlock").text).toBe("\n```\nx\n```\n");
        expect(runEditorCommand({ text: "x", selStart: 1, selEnd: 1 }, "insert.rule").text).toBe("x\n\n---\n\n");
    });
});
