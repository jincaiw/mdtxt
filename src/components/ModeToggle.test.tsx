import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModeToggle } from "./ModeToggle";

afterEach(cleanup);

describe("ModeToggle Live Beta gate", () => {
    it("keeps the Live entry hidden until the feature is explicitly enabled", () => {
        const onSetMode = vi.fn();
        const { rerender } = render(<ModeToggle mode="code" onSetMode={onSetMode} />);

        expect(screen.queryByRole("button", { name: "Live Beta mode" })).toBeNull();

        rerender(<ModeToggle mode="code" onSetMode={onSetMode} liveEnabled />);
        fireEvent.click(screen.getByRole("button", { name: "Live Beta mode" }));
        expect(onSetMode).toHaveBeenCalledWith("live");
    });

    it("marks Live as the active mode without exposing it when the gate is off", () => {
        const onSetMode = vi.fn();
        const { rerender } = render(<ModeToggle mode="live" onSetMode={onSetMode} liveEnabled />);

        expect(screen.getByRole("button", { name: "Live Beta mode" })).toHaveAttribute("aria-pressed", "true");

        rerender(<ModeToggle mode="code" onSetMode={onSetMode} />);
        expect(screen.queryByRole("button", { name: "Live Beta mode" })).toBeNull();
    });

    it("keeps every exposed mode as a named pressed-state button in one accessible group", () => {
        const onSetMode = vi.fn();
        render(<ModeToggle mode="live" onSetMode={onSetMode} liveEnabled />);

        expect(screen.getByRole("group", { name: "View mode toggle" })).toBeInTheDocument();
        const reader = screen.getByRole("button", { name: "Reader mode" });
        const live = screen.getByRole("button", { name: "Live Beta mode" });
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
