import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModeToggle } from "./ModeToggle";

afterEach(cleanup);

describe("ModeToggle Live", () => {
    it("always exposes Live as a first-class editor mode", () => {
        const onSetMode = vi.fn();
        render(<ModeToggle mode="code" onSetMode={onSetMode} />);
        fireEvent.click(screen.getByRole("button", { name: "Live mode" }));
        expect(onSetMode).toHaveBeenCalledWith("live");
    });

    it("marks Live as the active mode", () => {
        const onSetMode = vi.fn();
        render(<ModeToggle mode="live" onSetMode={onSetMode} />);
        expect(screen.getByRole("button", { name: "Live mode" })).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps every exposed mode as a named pressed-state button in one accessible group", () => {
        const onSetMode = vi.fn();
        render(<ModeToggle mode="live" onSetMode={onSetMode} />);

        expect(screen.getByRole("group", { name: "View mode toggle" })).toBeInTheDocument();
        const reader = screen.getByRole("button", { name: "Reader mode" });
        const live = screen.getByRole("button", { name: "Live mode" });
        const split = screen.getByRole("button", { name: "Split view" });
        const source = screen.getByRole("button", { name: "Code editor" });

        expect(reader).toHaveAttribute("aria-pressed", "false");
        expect(live).toHaveAttribute("aria-pressed", "true");
        expect(split).toHaveAttribute("aria-pressed", "false");
        expect(source).toHaveAttribute("aria-pressed", "false");

        fireEvent.click(source);
        expect(onSetMode).toHaveBeenCalledWith("code");
    });
});
