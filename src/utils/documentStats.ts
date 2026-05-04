/**
 * Pure markdown-document statistics. Strips frontmatter and code blocks before
 * counting prose-y things (words, sentences) so a fenced code listing doesn't
 * inflate the word count. Counts of structural elements (headings, links, etc.)
 * are taken from the raw source instead.
 */

export interface DocumentStats {
    chars: number;
    charsNoSpaces: number;
    words: number;
    sentences: number;
    paragraphs: number;
    lines: number;
    headings: number;
    links: number;
    images: number;
    codeBlocks: number;
    readingTimeMin: number;
}

const stripFrontmatter = (s: string): string => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
const stripFencedCode = (s: string): string => s.replace(/```[\s\S]*?```/g, "");
const stripInlineCode = (s: string): string => s.replace(/`[^`\n]*`/g, "");

export function computeStats(source: string): DocumentStats {
    const lines = source.length === 0 ? 0 : source.split("\n").length;

    const body = stripFrontmatter(source);
    const prose = stripInlineCode(stripFencedCode(body));

    const trimmed = prose.trim();
    const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

    // Sentences: split on . ! ? followed by whitespace or end. Imperfect but
    // good enough for an editor stats panel.
    const sentenceMatches = trimmed.match(/[^.!?\n]+[.!?]+/g);
    const sentences = sentenceMatches ? sentenceMatches.length : (trimmed.length > 0 ? 1 : 0);

    const paragraphs = trimmed.length === 0
        ? 0
        : trimmed.split(/\n\s*\n+/).filter((p) => p.trim().length > 0).length;

    const headings = (body.match(/^#{1,6}\s+\S/gm) || []).length;
    // Markdown links — exclude images by requiring no leading `!`.
    const links = (body.match(/(?<!\!)\[[^\]\n]*\]\([^)\n]+\)/g) || []).length;
    const images = (body.match(/!\[[^\]\n]*\]\([^)\n]+\)/g) || []).length;
    const codeBlocks = ((body.match(/```/g) || []).length / 2) | 0;

    return {
        chars: source.length,
        charsNoSpaces: source.replace(/\s/g, "").length,
        words,
        sentences,
        paragraphs,
        lines,
        headings,
        links,
        images,
        codeBlocks,
        readingTimeMin: words / 200,
    };
}
