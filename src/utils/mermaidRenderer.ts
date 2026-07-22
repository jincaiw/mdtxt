let mermaidPromise: Promise<typeof import("mermaid")["default"]> | null = null;
const svgCache = new Map<string, string>();
const SVG_CACHE_CAP = 64;
let nextId = 0;

export function nextMermaidRenderId(prefix = "mdtxt-mermaid"): string {
    nextId += 1;
    return `${prefix}-${nextId}`;
}

export function mermaidThemeFor(theme: string): "default" | "dark" | "neutral" {
    if (theme === "dark" || theme === "dracula") return "dark";
    if (theme === "paper") return "neutral";
    return "default";
}

function loadMermaid() {
    mermaidPromise ??= import("mermaid").then((module) => module.default);
    return mermaidPromise;
}

export async function renderMermaidSvg(code: string, theme: string, id: string): Promise<string> {
    const mermaidTheme = mermaidThemeFor(theme);
    const cacheKey = `${mermaidTheme}\u0000${code}`;
    const cached = svgCache.get(cacheKey);
    if (cached !== undefined) {
        svgCache.delete(cacheKey);
        svgCache.set(cacheKey, cached);
        return cached;
    }
    const mermaid = await loadMermaid();
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: mermaidTheme,
        fontFamily: "var(--font-body)",
    });
    const result = await mermaid.render(id, code);
    svgCache.set(cacheKey, result.svg);
    if (svgCache.size > SVG_CACHE_CAP) {
        const oldest = svgCache.keys().next().value;
        if (oldest !== undefined) svgCache.delete(oldest);
    }
    return result.svg;
}
