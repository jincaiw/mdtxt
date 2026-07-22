import { describe, expect, it } from "vitest";
import { imageMimeType, isUnsafeRelativeImagePath, markdownBaseDir } from "./localImage";

describe("local image boundaries", () => {
    it("keeps local paths contained and supports both desktop separators", () => {
        expect(isUnsafeRelativeImagePath("assets/diagram.png")).toBe(false);
        expect(isUnsafeRelativeImagePath("../secret.png")).toBe(true);
        expect(isUnsafeRelativeImagePath("C:\\secret.png")).toBe(true);
        expect(markdownBaseDir("/tmp/docs/readme.md")).toBe("/tmp/docs");
        expect(markdownBaseDir("C:\\docs\\readme.md")).toBe("C:\\docs");
    });

    it("uses a bounded MIME allowlist", () => {
        expect(imageMimeType("diagram.svg")).toBe("image/svg+xml");
        expect(imageMimeType("unknown.bin")).toBe("image/png");
    });
});
