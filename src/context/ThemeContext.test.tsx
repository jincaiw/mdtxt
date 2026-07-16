import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
    const { theme } = useTheme();
    return <output aria-label="active theme">{theme}</output>;
}

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
    it("uses the approved Paper palette on a fresh install", async () => {
        localStorage.clear();
        render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

        expect(screen.getByLabelText("active theme")).toHaveTextContent("paper");
        await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "paper"));
    });

    it("preserves an explicit stored theme", async () => {
        localStorage.setItem("mdtxt-theme", "dracula");
        render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

        expect(screen.getByLabelText("active theme")).toHaveTextContent("dracula");
        await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dracula"));
    });
});
