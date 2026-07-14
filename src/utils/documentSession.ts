/** Kept independent from React components so sessions can be tested and owned
 * by the editor controller in P5. */
export type DocumentViewMode = "code" | "split" | "preview";

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
    fileSize?: number;
    viewMode?: DocumentViewMode;
    cursorLine?: number;
}

export interface SessionResult<T> {
    documentId: string;
    version: number;
    value: T;
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

/** Applies a successful save only when the request still describes this exact revision. */
export function markSessionSaved(session: DocumentSession, result: SessionResult<number>): DocumentSession {
    if (result.documentId !== session.id || result.version !== session.version) return session;
    return { ...session, savedVersion: session.version, diskRevision: result.value, recoveryPending: false };
}

/** Rejects stale preview/AI/export completions after a tab switch or a new edit. */
export function acceptsSessionResult<T>(session: DocumentSession, result: SessionResult<T>): boolean {
    return result.documentId === session.id && result.version === session.version;
}

export function applyExternalSessionContent(
    session: DocumentSession,
    content: string,
    diskRevision: number,
): DocumentSession {
    return {
        ...session,
        content,
        version: session.version + 1,
        savedVersion: session.version + 1,
        diskRevision,
        fileSize: content.length,
        format: inferDocumentFormat(content),
        recoveryPending: false,
    };
}
