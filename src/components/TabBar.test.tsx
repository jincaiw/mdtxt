import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TabBar } from "./TabBar";

afterEach(cleanup);

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

describe("TabBar external conflicts", () => {
    it("shows an accessible persistent disk-change marker without changing dirty state", () => {
        render(
            <TabBar
                tabs={[{ id: "a", name: "draft.md", label: "draft.md", dirty: true, hasConflict: true }]}
                activeId="a"
                onSelect={() => {}}
                onClose={() => {}}
                onNewTab={() => {}}
            />
        );

        expect(screen.getByLabelText("External disk change")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /draft\.md/ })).toHaveAttribute("aria-selected", "true");
    });
});
