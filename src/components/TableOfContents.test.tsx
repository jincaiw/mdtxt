import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableOfContents } from "./TableOfContents";

describe("TableOfContents", () => {
    const content = "# Product\n\n## Goals\n\n### Fast\n\n## Scope\n\n# Appendix";

    it("collapses and expands heading descendants without losing source-line navigation", () => {
        const dispatch = vi.spyOn(window, "dispatchEvent");
        render(<TableOfContents isOpen content={content} onClose={() => {}} embedded />);

        const product = screen.getByRole("button", { name: "Go to heading: Product" });
        expect(screen.getByText("Goals")).toBeInTheDocument();

        fireEvent.keyDown(product, { key: "ArrowLeft" });
        expect(screen.queryByText("Goals")).not.toBeInTheDocument();
        expect(product).toHaveAttribute("aria-expanded", "false");

        fireEvent.keyDown(product, { key: "ArrowRight" });
        fireEvent.click(screen.getByRole("button", { name: "Go to heading: Goals" }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "mdtxt:goto-line",
            detail: { line: 3 },
        }));
        dispatch.mockRestore();
    });
});
