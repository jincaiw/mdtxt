import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "../context/LocaleContext";

interface TourProps {
    /** Called when the tour finishes or is skipped. Caller persists the done flag. */
    onClose: () => void;
    /** Opens the interactive feature guide (offered on the final step). */
    onOpenTutorial?: () => void;
}

interface Step {
    id: string;
    /** CSS selector of the element to spotlight. Omit for a centered card over a full dim. */
    target?: string;
    /** Where the card sits relative to the (padded) target rect. */
    placement: "center" | "left-of" | "below" | "above";
    icon: string;
    title: string;
    body: string;
}

const STEPS: Step[] = [
    {
        id: "welcome",
        placement: "center",
        icon: "tour",
        title: "Hey, welcome to mdtxt!",
        body: "Welcome to mdtxt. Want a quick look around? It takes about 15 seconds, and you can replay it anytime from the command palette.",
    },
    {
        id: "explorer",
        target: "[data-tour='file-explorer']",
        placement: "above",
        icon: "folder_open",
        title: "Your folder, one click away",
        body: "This opens the file explorer. It lists every markdown file next to the one you're editing, so you can jump between notes without leaving mdtxt. (Ctrl+Shift+E)",
    },
    {
        id: "toc",
        target: "[data-tour='toc']",
        placement: "above",
        icon: "menu_book",
        title: "Outline of your doc",
        body: "This is the table of contents. Every heading you write shows up here, and it tracks where you are as you scroll. Click any heading to jump straight to it. (Ctrl+Shift+O)",
    },
    {
        id: "palette",
        placement: "center",
        icon: "search",
        title: "One box for everything",
        body: "Press Ctrl+P after the tour to open the command palette. Files, views, themes, AI: it's all in there.",
    },
    {
        id: "done",
        placement: "center",
        icon: "check",
        title: "That's it, you're ready!",
        body: "Want to see it all in action? Open the interactive guide: a real document with live math, diagrams, tables and more, all ready for you to poke at. You can also replay this tour anytime from the command palette.",
    },
];

const SPOT_PAD = 8;   // breathing room around the spotlit element
const CARD_GAP = 16;  // gap between card and spotlight
const MARGIN = 16;    // minimum distance from the viewport edge

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface SpotRect { left: number; top: number; width: number; height: number }

export function Tour({ onClose, onOpenTutorial }: TourProps) {
    const { t } = useLocale();
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<SpotRect | null>(null);
    const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);

    const step = STEPS[stepIndex];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === STEPS.length - 1;

    const measure = useCallback(() => {
        if (!step.target) {
            setRect(null);
            return;
        }
        const el = document.querySelector(step.target);
        if (!el) {
            setRect(null);
            return;
        }
        const r = el.getBoundingClientRect();
        setRect({
            left: r.left - SPOT_PAD,
            top: r.top - SPOT_PAD,
            width: r.width + SPOT_PAD * 2,
            height: r.height + SPOT_PAD * 2,
        });
    }, [step.target]);

    // Measure after a frame so any pending layout changes have settled.
    useLayoutEffect(() => {
        const raf = requestAnimationFrame(measure);
        return () => cancelAnimationFrame(raf);
    }, [measure]);

    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    // Position the card relative to the spotlight once both are measurable.
    useLayoutEffect(() => {
        const card = cardRef.current;
        if (!card || step.placement === "center" || !rect) {
            setCardPos(null);
            return;
        }
        const cw = card.offsetWidth;
        const ch = card.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left: number;
        let top: number;
        if (step.placement === "left-of") {
            left = rect.left - cw - CARD_GAP;
            top = rect.top + rect.height / 2 - ch / 2;
        } else if (step.placement === "above") {
            // above, left-aligned to the target (used for the status-bar toggles
            // at the bottom edge, where "below" would fall off screen)
            left = rect.left;
            top = rect.top - ch - CARD_GAP;
        } else {
            // below, right-aligned to the target (used for the titlebar gear)
            left = rect.left + rect.width - cw;
            top = rect.top + rect.height + CARD_GAP;
        }
        setCardPos({
            left: clamp(left, MARGIN, vw - cw - MARGIN),
            top: clamp(top, MARGIN, vh - ch - MARGIN),
        });
    }, [rect, step.placement, stepIndex]);

    // Final CTA: open the interactive guide, then close the tour. Enter/→ on the
    // last step run this too, so the keyboard path matches the primary button.
    const finish = useCallback(() => {
        onOpenTutorial?.();
        onClose();
    }, [onOpenTutorial, onClose]);

    const advance = useCallback(() => {
        if (isLast) finish();
        else setStepIndex((i) => i + 1);
    }, [isLast, finish]);

    const back = useCallback(() => {
        setStepIndex((i) => Math.max(0, i - 1));
    }, []);

    // Modal keyboard handling: capture phase so app shortcuts (Ctrl+P, Ctrl+E…)
    // don't fire underneath the overlay while the tour is up.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            e.stopPropagation();
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (e.key === "Enter" || e.key === "ArrowRight") {
                e.preventDefault();
                advance();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                back();
            }
        };
        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [advance, back, onClose]);

    // Keep focus on the primary action so Enter/Space always work.
    useEffect(() => {
        nextRef.current?.focus();
    }, [stepIndex]);

    const centered = step.placement === "center" || !rect;

    return (
        <div
            className="fixed inset-0 z-[300] no-select"
            role="dialog"
            aria-modal="true"
            aria-label={t("Welcome tour")}
        >
            {/* Dim layer. With a target, a spotlight hole punched via box-shadow;
                without one, a plain full dim. */}
            {rect ? (
                <div
                    className="absolute rounded-xl border border-[var(--accent)] pointer-events-none"
                    style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        boxShadow: "0 0 0 100vmax rgba(0, 0, 0, 0.55)",
                        transition: "all 0.25s ease",
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-black/55" />
            )}

            {/* Card */}
            <div
                className={centered ? "absolute inset-0 flex items-center justify-center p-6" : undefined}
                style={centered ? undefined : { position: "absolute", left: cardPos?.left ?? -9999, top: cardPos?.top ?? -9999 }}
            >
                <div
                    ref={cardRef}
                    // 400px: wide enough that the last step's three buttons
                    // ("Just start writing" / "Back" / "Open the guide") fit on
                    // one row without their labels wrapping to two lines.
                    className="w-[400px] max-w-[calc(100vw-2rem)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 text-center animate-fade-in"
                >
                    <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--accent)]" aria-hidden="true">
                        <span className="material-symbols-outlined text-[30px]">{step.icon}</span>
                    </span>
                    <div className="flex flex-col gap-1.5">
                        <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">{t(step.title)}</h2>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{t(step.body)}</p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center gap-1.5" aria-label={t("Step {current} of {total}", { current: stepIndex + 1, total: STEPS.length })}>
                        {STEPS.map((s, i) => (
                            <span
                                key={s.id}
                                className={`rounded-full transition-all duration-200 ${i === stepIndex ? "w-4 h-1.5 bg-[var(--accent)]" : "w-1.5 h-1.5 bg-[var(--border)]"}`}
                            />
                        ))}
                    </div>

                    <div className="w-full flex items-center justify-between gap-2">
                        <button
                            onClick={onClose}
                            className="btn-press whitespace-nowrap text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-all duration-200"
                        >
                            {t(isFirst || isLast ? "Just start writing" : "Skip tour")}
                        </button>
                        <div className="flex items-center gap-2">
                            {!isFirst && (
                                <button
                                    onClick={back}
                                    className="btn-press whitespace-nowrap text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-all duration-200"
                                >
                                    {t("Back")}
                                </button>
                            )}
                            <button
                                ref={nextRef}
                                onClick={advance}
                                className="btn-press whitespace-nowrap text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-text)] transition-all duration-200"
                            >
                                {t(isLast ? "Open the guide" : isFirst ? "Show me around" : "Next")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
