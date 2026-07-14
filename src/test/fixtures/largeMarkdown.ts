const encoder = new TextEncoder();

/**
 * Deterministically creates a Markdown document of exactly `targetBytes` UTF-8
 * bytes. The repeated body is ASCII, so the final byte padding cannot split a
 * multibyte character. It keeps large-file tests representative without
 * committing multi-megabyte personal fixtures to the repository.
 */
export function createLargeMarkdown(targetBytes: number): string {
    if (!Number.isSafeInteger(targetBytes) || targetBytes < 0) {
        throw new RangeError("targetBytes must be a non-negative safe integer");
    }

    const header = "# mdtxt large-document fixture\n\n中文 English mixed content.\n\n";
    if (encoder.encode(header).byteLength > targetBytes) {
        return "x".repeat(targetBytes);
    }

    const paragraph =
        "## Repeated section\n\nThis deterministic paragraph exercises Markdown parsing, scrolling, and save paths without user data. 0123456789\n\n";
    let output = header;
    let remaining = targetBytes - encoder.encode(output).byteLength;
    while (remaining >= paragraph.length) {
        output += paragraph;
        remaining -= paragraph.length;
    }
    return output + "x".repeat(remaining);
}
