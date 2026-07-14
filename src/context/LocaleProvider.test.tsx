import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale } from "./LocaleContext";

function Probe({ onEditorMount }: { onEditorMount: () => void }) {
    const { locale, setLocale, t } = useLocale();
    useEffect(onEditorMount, [onEditorMount]);
    return (
        <>
            <output data-testid="locale">{locale}:{t("Settings")}</output>
            <button onClick={() => setLocale("en")}>switch</button>
        </>
    );
}

describe("LocaleProvider", () => {
    beforeEach(() => localStorage.clear());

    it("starts in Simplified Chinese and switches UI copy without remounting children", () => {
        const onEditorMount = vi.fn();
        render(<LocaleProvider><Probe onEditorMount={onEditorMount} /></LocaleProvider>);

        expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN:设置");
        expect(onEditorMount).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "switch" }));
        expect(screen.getByTestId("locale")).toHaveTextContent("en:Settings");
        expect(localStorage.getItem("mdtxt-locale")).toBe("en");
        expect(onEditorMount).toHaveBeenCalledTimes(1);
    });
});
