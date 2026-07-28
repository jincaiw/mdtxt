import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    it("selects a tab through the standard activation event", () => {
        const onSelect = vi.fn();
        render(
            <TabBar
                tabs={[
                    { id: "a", name: "first.md", label: "first.md", dirty: false },
                    { id: "b", name: "second.md", label: "second.md", dirty: false },
                ]}
                activeId="b"
                onSelect={onSelect}
                onClose={() => {}}
                onNewTab={() => {}}
            />
        );

        fireEvent.click(screen.getByRole("tab", { name: /first\.md/ }));

        expect(onSelect).toHaveBeenCalledOnce();
        expect(onSelect).toHaveBeenCalledWith("a");
    });
});
