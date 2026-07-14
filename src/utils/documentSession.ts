/** Kept independent from React components so sessions can be tested and owned
 * by the editor controller in P5. */
export type DocumentViewMode = "code" | "split" | "preview" | "live";

export interface DocumentFormat {
    encoding: "utf-8";
    hasBom: boolean;
    eol: "lf" | "crlf";
    trailingNewline: boolean;
}

export interface DocumentSession {
    id: string;
    path: string | null;
    name: string;
    content: string;
    version: number;
    savedVersion: number;
    diskRevision: number;
    /** SHA-256 of the exact durable bytes associated with diskRevision. */
    diskHash: string;
    fileSize: number;
    format: DocumentFormat;
    viewMode: DocumentViewMode;
    cursorLine: number;
    recoveryPending: boolean;
}

export interface DocumentSessionInput {
    id: string;
    path: string | null;
    name: string;
    content: string;
    /** Content currently known to be durable. Defaults to `content`. */
    savedContent?: string;
    diskRevision?: number;
    diskHash?: string;
    fileSize?: number;
    viewMode?: DocumentViewMode;
    cursorLine?: number;
}

export interface SessionResult<T> {
    documentId: string;
    version: number;
    value: T;
}

/** Actual durable metadata returned by the native atomic-save command. */
export interface DiskSaveResult {
    modified: number;
    hash: string;
}

export const DEFAULT_FORMAT: DocumentFormat = {
    encoding: "utf-8",
    hasBom: false,
    eol: "lf",
    trailingNewline: false,
};

export function inferDocumentFormat(content: string): DocumentFormat {
    return {
        encoding: "utf-8",
        hasBom: content.startsWith("\uFEFF"),
        eol: content.includes("\r\n") ? "crlf" : "lf",
        trailingNewline: /(?:\r\n|\n)$/.test(content),
    };
}

export function createDocumentSession(input: DocumentSessionInput): DocumentSession {
    const savedContent = input.savedContent ?? input.content;
    const dirty = input.content !== savedContent;
    return {
        id: input.id,
        path: input.path,
        name: input.name,
        content: input.content,
        version: dirty ? 1 : 0,
        savedVersion: 0,
        diskRevision: input.diskRevision ?? 0,
        diskHash: input.diskHash ?? "",
        fileSize: input.fileSize ?? input.content.length,
        format: inferDocumentFormat(input.content),
        viewMode: input.viewMode ?? "code",
        cursorLine: input.cursorLine ?? 1,
        recoveryPending: false,
    };
}

export function isSessionDirty(session: DocumentSession): boolean {
    return session.version !== session.savedVersion;
}

export function replaceSessionContent(session: DocumentSession, content: string): DocumentSession {
    if (content === session.content) return session;
    return {
        ...session,
        content,
        version: session.version + 1,
        fileSize: content.length,
        format: inferDocumentFormat(content),
    };
}

export function setSessionViewMode(session: DocumentSession, viewMode: DocumentViewMode): DocumentSession {
    return session.viewMode === viewMode ? session : { ...session, viewMode };
}

/**
 * Live is persisted per document, but it cannot be restored until the user
 * has explicitly opted into the Beta in this installation. Keep the fallback
 * here, beside the session contract, so startup and tab activation use the
 * same rule instead of briefly exposing an ungated mode.
 */
export function resolveLiveBetaViewMode(viewMode: DocumentViewMode, liveBetaEnabled: boolean): DocumentViewMode {
    return viewMode === "live" && !liveBetaEnabled ? "code" : viewMode;
}

/** Applies a successful save only when the request still describes this exact revision. */
export function markSessionSaved(session: DocumentSession, result: SessionResult<DiskSaveResult>): DocumentSession {
    if (result.documentId !== session.id || result.version !== session.version) return session;
    return {
        ...session,
        savedVersion: session.version,
        diskRevision: result.value.modified,
        diskHash: result.value.hash,
        recoveryPending: false,
    };
}

/** Rejects stale preview/AI/export completions after a tab switch or a new edit. */
export function acceptsSessionResult<T>(session: DocumentSession, result: SessionResult<T>): boolean {
    return result.documentId === session.id && result.version === session.version;
}

export function applyExternalSessionContent(
    session: DocumentSession,
    content: string,
    diskRevision: number,
    diskHash: string,
): DocumentSession {
    return {
        ...session,
        content,
        version: session.version + 1,
        savedVersion: session.version + 1,
        diskRevision,
        diskHash,
        fileSize: content.length,
        format: inferDocumentFormat(content),
        recoveryPending: false,
    };
}
