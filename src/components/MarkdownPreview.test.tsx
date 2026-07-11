// Regression test for footnote navigation (CodenameFlux report): remark-rehype
// already prefixes footnote ids and hrefs with `user-content-`, and
// rehype-sanitize's default clobber pass used to prefix the id a SECOND time,
// so footnote refs and back-arrows pointed at ids that don't exist. The
// invariant asserted here — every in-page link's href resolves to a real id in
// the rendered document — is what keeps clicks working in the app and links
// working in exported HTML, regardless of prefix policy.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { MarkdownPreview } from "./MarkdownPreview";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(async () => null),
    convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

afterEach(cleanup);

function renderPreview(content: string, extraProps: Record<string, unknown> = {}) {
    return render(
        <MarkdownPreview
            content={content}
            fileName="test.md"
            fileSize={content.length}
            onEditClick={() => {}}
            {...extraProps}
        />,
    );
}

describe("footnote links", () => {
    it("gives every footnote ref and back-arrow an href that resolves to a real id", async () => {
        const { container } = renderPreview(
            "Some text[^1] and more[^2].\n\n[^1]: First note.\n[^2]: Second note.",
        );
        // The body renders through useTransition, so wait for the links.
        const links = await waitFor(() => {
            const ls = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href^='#']"));
            expect(ls.length).toBeGreaterThanOrEqual(4); // 2 refs + 2 back-arrows
            return ls;
        });
        for (const link of links) {
            const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
            expect(
                container.querySelector(`[id="${id}"]`),
                `no element with id "${id}" for href "${link.getAttribute("href")}"`,
            ).toBeTruthy();
        }
    });
});

// Relative .md links used to render as href="#" with the target held only in
// the onClick closure — exports captured dead anchors. The real href must be
// in the DOM, with in-app navigation still going through the callback.
describe("relative markdown links", () => {
    it("renders the real href and navigates in-app on click", async () => {
        const onNavigateRelative = vi.fn();
        const { container } = renderPreview("[other](notes/other.md)", { onNavigateRelative });
        const link = await waitFor(() => {
            const a = container.querySelector<HTMLAnchorElement>("a[data-relative-md]");
            expect(a).toBeTruthy();
            return a!;
        });
        expect(link.getAttribute("href")).toBe("notes/other.md");

        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        link.dispatchEvent(click);
        expect(onNavigateRelative).toHaveBeenCalledWith("notes/other.md");
        // preventDefault must fire or the webview would navigate to the .md URL.
        expect(click.defaultPrevented).toBe(true);
    });
});
