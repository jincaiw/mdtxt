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

    it("keeps Live and Source as the two primary title-bar modes", () => {
        const onSetMode = vi.fn();
        render(<ModeToggle mode="live" onSetMode={onSetMode} />);

        expect(screen.getByRole("group", { name: "View mode toggle" })).toBeInTheDocument();
        const live = screen.getByRole("button", { name: "Live mode" });
        const source = screen.getByRole("button", { name: "Code editor" });

        expect(live).toHaveAttribute("aria-pressed", "true");
        expect(source).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByRole("button", { name: "Reader mode" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Split view" })).not.toBeInTheDocument();

        fireEvent.click(source);
        expect(onSetMode).toHaveBeenCalledWith("code");
    });
});
