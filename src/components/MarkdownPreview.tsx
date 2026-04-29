import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { readFile } from "@tauri-apps/plugin-fs";
import { parseFrontmatter } from "../utils/frontmatter";

interface MarkdownPreviewProps {
    content: string;
    fileName: string;
    lineCount: number;
    fileSize: number;
    onEditClick: () => void;
    onLineChange?: (line: number) => void;
    filePath?: string | null;
    markdownBodyRef?: React.RefObject<HTMLDivElement | null>;
    onContentChange?: (newContent: string) => void;
}

/** Slugify heading text into a stable, URL-safe id (GitHub-style). */
const slugify = (text: string): string =>
    text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

/** Extract the plain-text label from a React node tree (for slug + anchor link). */
function nodeText(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(nodeText).join("");
    if (node && typeof node === "object" && "props" in node) {
        // @ts-expect-error - children may exist on element
        return nodeText(node.props?.children);
    }
    return "";
}

// MIME type lookup for image extensions
const IMAGE_MIME_TYPES: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp'
};

// Component to handle local image loading
function LocalImage({ src, alt, baseDir, ...props }: { src: string; alt: string; baseDir: string | null } & React.ImgHTMLAttributes<HTMLImageElement>) {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;

        const loadImage = async () => {
            if (!baseDir || !src) return;

            // Check if it's a relative path
            if (src.startsWith('./') || src.startsWith('../') || (!src.includes('://') && !src.startsWith('data:'))) {
                try {
                    // Remove leading ./ if present
                    const cleanPath = src.startsWith('./') ? src.slice(2) : src;
                    // Construct full path - handle both Windows and Unix separators
                    const sep = baseDir.includes('\\') ? '\\' : '/';
                    const fullPath = `${baseDir}${sep}${cleanPath.replace(/[/\\]/g, sep)}`;

                    // Read the file as binary
                    const data = await readFile(fullPath);

                    // Detect image type from extension
                    const ext = cleanPath.split('.').pop()?.toLowerCase() || 'png';
                    const mimeType = IMAGE_MIME_TYPES[ext] || 'image/png';

                    // Use Blob + ObjectURL instead of base64 for better performance
                    const blob = new Blob([data], { type: mimeType });
                    objectUrl = URL.createObjectURL(blob);
                    setImageSrc(objectUrl);
                    setError(false);
                } catch (err) {
                    console.error('Failed to load image:', err);
                    setError(true);
                }
            } else {
                // External URL or data URL - use as is
                setImageSrc(src);
            }
        };

        loadImage();

        // Revoke object URL on cleanup to prevent memory leaks
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src, baseDir]);

    if (error) {
        return (
            <div className="my-4 p-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm">
                Failed to load image: {src}
            </div>
        );
    }

    if (!imageSrc) {
        return (
            <div className="my-4 p-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-secondary)] animate-pulse">
                <div className="h-32 bg-[var(--bg-tertiary)] rounded"></div>
            </div>
        );
    }

    return (
        <img
            src={imageSrc}
            alt={alt || 'image'}
            {...props}
            loading="lazy"
            className="max-w-full h-auto rounded-lg my-4 cursor-zoom-in transition-transform hover:scale-[1.01]"
            onClick={() => {
                const evt = new CustomEvent("marklite:zoom", { detail: { src: imageSrc, alt } });
                window.dispatchEvent(evt);
            }}
        />
    );
}

/** Code block with a copy-to-clipboard button. */
function CodeBlock({ children, ...rest }: React.HTMLAttributes<HTMLPreElement>) {
    const ref = useRef<HTMLPreElement>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = ref.current?.innerText ?? "";
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch {
            // ignore — clipboard may be unavailable in some webviews
        }
    };

    return (
        <div className="relative group">
            <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy code"
                className="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-opacity"
            >
                {copied ? "Copied!" : "Copy"}
            </button>
            <pre ref={ref} {...rest}>{children}</pre>
        </div>
    );
}

/** Render YAML frontmatter as a collapsible metadata card. */
function FrontmatterCard({ data }: { data: Record<string, string | number | boolean | string[]> }) {
    const [collapsed, setCollapsed] = useState(false);
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    const renderValue = (v: string | number | boolean | string[]) => {
        if (Array.isArray(v)) {
            return (
                <div className="flex flex-wrap gap-1">
                    {v.map((item, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-[var(--bg-hover)] rounded border border-[var(--border-subtle)] text-[var(--text-primary)]">
                            {item}
                        </span>
                    ))}
                </div>
            );
        }
        if (typeof v === "boolean") {
            return <span className="text-xs font-mono">{v ? "true" : "false"}</span>;
        }
        return <span className="text-sm">{String(v)}</span>;
    };

    return (
        <div className="mb-6 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-secondary)]">
            <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-[var(--bg-hover)] transition-colors"
                aria-expanded={!collapsed}
            >
                <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    Frontmatter
                </span>
                <span className="material-symbols-outlined text-[18px]">
                    {collapsed ? "expand_more" : "expand_less"}
                </span>
            </button>
            {!collapsed && (
                <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                        {entries.map(([k, v]) => (
                            <div key={k} className="contents">
                                <dt className="font-mono text-xs text-[var(--text-muted)] pt-0.5">{k}</dt>
                                <dd className="text-[var(--text-primary)]">{renderValue(v)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </div>
    );
}

/** Interactive task checkbox — local optimistic state, parent writes to source. */
function InteractiveTaskCheckbox({ initialChecked, onToggle }: { initialChecked: boolean; onToggle: (checked: boolean) => void }) {
    const [checked, setChecked] = useState(initialChecked);
    useEffect(() => setChecked(initialChecked), [initialChecked]);
    return (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
                const next = e.target.checked;
                setChecked(next);
                onToggle(next);
            }}
            className="mr-2 cursor-pointer accent-[var(--accent)]"
        />
    );
}

/** Heading with click-to-copy permalink (GitHub-style). */
function HeadingWithAnchor(
    props: { level: 1 | 2 | 3 | 4 | 5 | 6 } & React.HTMLAttributes<HTMLHeadingElement>
) {
    const { level, children, className, ...rest } = props;
    const text = nodeText(children);
    const id = slugify(text);
    const handleClick = () => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const inner = (
        <>
            <span>{children}</span>
            <button
                type="button"
                onClick={handleClick}
                aria-label={`Jump to ${text}`}
                className="opacity-0 group-hover/heading:opacity-60 hover:!opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)] transition-opacity"
                tabIndex={-1}
            >
                <span className="material-symbols-outlined" style={{ fontSize: "0.7em", verticalAlign: "middle" }}>link</span>
            </button>
        </>
    );
    const sharedProps = {
        id,
        ...rest,
        className: `${className ?? ""} group/heading flex items-baseline gap-2`,
    };
    switch (level) {
        case 1: return <h1 {...sharedProps}>{inner}</h1>;
        case 2: return <h2 {...sharedProps}>{inner}</h2>;
        case 3: return <h3 {...sharedProps}>{inner}</h3>;
        case 4: return <h4 {...sharedProps}>{inner}</h4>;
        case 5: return <h5 {...sharedProps}>{inner}</h5>;
        case 6: return <h6 {...sharedProps}>{inner}</h6>;
    }
}

export function MarkdownPreview({
    content,
    lineCount,
    onLineChange,
    filePath,
    markdownBodyRef,
    onContentChange,
}: MarkdownPreviewProps) {
    const mainRef = useRef<HTMLElement>(null);
    const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

    // Listen for zoom requests from LocalImage clicks
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.src) setZoomImage({ src: detail.src, alt: detail.alt || "" });
        };
        window.addEventListener("marklite:zoom", handler);
        return () => window.removeEventListener("marklite:zoom", handler);
    }, []);

    // Esc closes lightbox
    useEffect(() => {
        if (!zoomImage) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setZoomImage(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [zoomImage]);

    // Get the directory containing the markdown file
    const baseDir = useMemo(() => {
        if (!filePath) return null;
        const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        return lastSep > 0 ? filePath.slice(0, lastSep) : null;
    }, [filePath]);

    // Toggle a task list checkbox by index — write back to the source markdown.
    // Counts task items in document order; toggles the Nth one.
    const handleTaskToggle = useCallback((index: number, checked: boolean) => {
        if (!onContentChange) return;
        const lines = content.split("\n");
        let count = 0;
        const taskRe = /^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(taskRe);
            if (m) {
                if (count === index) {
                    lines[i] = lines[i].replace(taskRe, `$1${checked ? "x" : " "}$3`);
                    onContentChange(lines.join("\n"));
                    return;
                }
                count++;
            }
        }
    }, [content, onContentChange]);

    const components = useMemo(() => ({
        img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
            <LocalImage src={src || ''} alt={alt || 'image'} baseDir={baseDir} {...props} />
        ),
        pre: (props: React.HTMLAttributes<HTMLPreElement>) => <CodeBlock {...props} />,
        h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={1} {...props} />,
        h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={2} {...props} />,
        h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={3} {...props} />,
        h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={4} {...props} />,
        h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={5} {...props} />,
        h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => <HeadingWithAnchor level={6} {...props} />,
        // Interactive task checkbox: react-markdown + remarkGfm renders <input type="checkbox" disabled />
        input: ({ type, checked, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => {
            if (type !== "checkbox") return <input type={type} checked={checked} {...rest} />;
            return (
                <InteractiveTaskCheckbox
                    initialChecked={!!checked}
                    onToggle={(c) => handleTaskToggle(taskCheckboxCounter.current++, c)}
                />
            );
        },
    }), [baseDir, handleTaskToggle]);

    // Reset the task index counter on every render so the next render starts at 0.
    // (react-markdown renders synchronously top-to-bottom, so order matches doc order)
    const taskCheckboxCounter = useRef(0);
    taskCheckboxCounter.current = 0;

    // Parse YAML frontmatter once per content change. We render it as a
    // metadata card and pass the *body* (without the --- block) to react-markdown
    // so the raw YAML doesn't appear as a thematic break + heading.
    const { body: renderBody, data: frontmatter, hasFrontmatter } = useMemo(
        () => parseFrontmatter(content),
        [content]
    );

    // Calculate current line based on scroll position
    const handleScroll = useCallback(() => {
        if (!mainRef.current || !onLineChange) return;

        const element = mainRef.current;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight - element.clientHeight;

        if (scrollHeight <= 0) {
            onLineChange(1);
            return;
        }

        // Calculate approximate line based on scroll percentage
        const scrollPercentage = scrollTop / scrollHeight;
        const currentLine = Math.max(1, Math.ceil(scrollPercentage * lineCount));

        onLineChange(currentLine);
    }, [lineCount, onLineChange]);

    // Set up scroll listener
    useEffect(() => {
        const element = mainRef.current;
        if (!element) return;

        element.addEventListener("scroll", handleScroll);
        // Initial line
        handleScroll();

        return () => {
            element.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    return (
        <>
            <main
                ref={mainRef}
                className="flex-1 overflow-y-auto bg-[var(--bg-primary)] transition-colors"
            >
                <div className="max-w-[800px] mx-auto px-8 py-12">
                    {hasFrontmatter && <FrontmatterCard data={frontmatter} />}
                    <div className="markdown-body" ref={markdownBodyRef}>
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={components}
                        >
                            {renderBody}
                        </Markdown>
                    </div>
                </div>
            </main>

            {zoomImage && (
                <div
                    role="dialog"
                    aria-label={`Image: ${zoomImage.alt || "preview"}`}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out animate-fade-in"
                    onClick={() => setZoomImage(null)}
                >
                    <img
                        src={zoomImage.src}
                        alt={zoomImage.alt}
                        className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        type="button"
                        onClick={() => setZoomImage(null)}
                        aria-label="Close image"
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
            )}
        </>
    );
}
