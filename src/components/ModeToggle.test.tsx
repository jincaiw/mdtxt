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
});
