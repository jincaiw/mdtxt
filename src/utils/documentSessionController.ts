import {
    acceptsSessionResult,
    applyExternalSessionContent,
    createDocumentSession,
    isSessionDirty,
    markSessionSaved,
    replaceSessionContent,
    setSessionViewMode,
    type DocumentSession,
    type DocumentSessionInput,
    type DocumentViewMode,
    type DiskSaveResult,
    type SessionResult,
} from "./documentSession";

/**
 * The React-safe projection of a session. Deliberately excludes the complete
 * Markdown buffer: UI consumers may render labels and dirty state, but cannot
 * become a second source of truth for the document text.
 */
export interface DocumentSessionSummary {
    id: string;
    path: string | null;
    name: string;
    version: number;
    savedVersion: number;
    diskRevision: number;
    diskHash: string;
    fileSize: number;
    viewMode: DocumentViewMode;
    cursorLine: number;
    recoveryPending: boolean;
    dirty: boolean;
}

export interface DocumentSessionSnapshot {
    activeId: string | null;
    sessions: readonly DocumentSessionSummary[];
}

export interface DocumentSessionFileMetadata {
    path: string | null;
    name: string;
    fileSize?: number;
    diskRevision?: number;
    diskHash?: string;
}

/** Immutable content read for work that may complete asynchronously. */
export interface DocumentSessionContentSnapshot extends SessionResult<string> {}

/** A dirty document read paired with the metadata needed by a save operation. */
export interface DirtyDocumentSessionSnapshot extends DocumentSessionContentSnapshot {
    path: string | null;
    name: string;
    diskRevision: number;
    diskHash: string;
}

type SnapshotListener = () => void;

/**
 * Framework-independent owner for document sessions during the P4 migration.
 * It emits only metadata snapshots, while full content remains accessible only
 * through an explicit session lookup for editor, save, preview, or AI work.
 */
export class DocumentSessionController {
    private readonly sessions = new Map<string, DocumentSession>();
    private readonly listeners = new Set<SnapshotListener>();
    private activeId: string | null = null;
    private snapshot: DocumentSessionSnapshot = { activeId: null, sessions: [] };
    private contentEmitTimer: ReturnType<typeof setTimeout> | null = null;

    subscribe(listener: SnapshotListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getSnapshot(): DocumentSessionSnapshot {
        return this.snapshot;
    }

    get(id: string): DocumentSession | null {
        return this.sessions.get(id) ?? null;
    }

    getActive(): DocumentSession | null {
        return this.activeId ? this.get(this.activeId) : null;
    }

    read(id: string): DocumentSessionContentSnapshot | null {
        const session = this.get(id);
        return session ? { documentId: session.id, version: session.version, value: session.content } : null;
    }

    readActive(): DocumentSessionContentSnapshot | null {
        return this.activeId ? this.read(this.activeId) : null;
    }

    /**
     * Versioned reads for the close-window save flow. Returning these from the
     * controller, rather than collecting tab buffers in React, prevents an old
     * tab projection from being written after a newer editor transaction.
     */
    readDirty(): readonly DirtyDocumentSessionSnapshot[] {
        return Array.from(this.sessions.values(), (session) => ({
            documentId: session.id,
            version: session.version,
            value: session.content,
            path: session.path,
            name: session.name,
            diskRevision: session.diskRevision,
            diskHash: session.diskHash,
            dirty: isSessionDirty(session),
        }))
            .filter((snapshot) => snapshot.dirty)
            .map(({ dirty: _dirty, ...snapshot }) => snapshot);
    }

    open(input: DocumentSessionInput, activate = true): DocumentSession {
        const session = createDocumentSession(input);
        this.sessions.set(session.id, session);
        if (activate) this.activeId = session.id;
        this.emit();
        return session;
    }

    /**
     * Transitional entry point for a session assembled by a file operation.
     * The controller remains the only owner and notification source; callers
     * must not retain or mutate a second Map of sessions.
     */
    replaceSession(session: DocumentSession): DocumentSession {
        const current = this.get(session.id);
        if (current !== session) {
            this.sessions.set(session.id, session);
            this.emit();
        }
        return session;
    }

    activate(id: string | null): DocumentSession | null {
        if (id === null) {
            if (this.activeId !== null) {
                this.activeId = null;
                this.emit();
            }
            return null;
        }
        const session = this.get(id);
        if (!session) return null;
        if (this.activeId !== id) {
            this.activeId = id;
            this.emit();
        }
        return session;
    }

    remove(id: string): boolean {
        const removed = this.sessions.delete(id);
        if (!removed) return false;
        if (this.activeId === id) this.activeId = null;
        this.emit();
        return true;
    }

    replaceContent(id: string, content: string): DocumentSession | null {
        const current = this.get(id);
        if (!current) return null;
        const next = replaceSessionContent(current, content);
        if (next === current) return next;
        this.sessions.set(id, next);

        // Keep the editor transaction authoritative immediately, but avoid a
        // synchronous full-workspace React render for every key. Publish the
        // first dirty transition at once, then coalesce preview/autosave reads.
        if (!isSessionDirty(current) && isSessionDirty(next)) this.emit();
        else this.scheduleContentEmit();
        return next;
    }

    setViewMode(id: string, viewMode: DocumentViewMode): DocumentSession | null {
        return this.replace(id, (session) => setSessionViewMode(session, viewMode));
    }

    updateFileMetadata(id: string, metadata: DocumentSessionFileMetadata): DocumentSession | null {
        return this.replace(id, (session) => ({
            ...session,
            path: metadata.path,
            name: metadata.name,
            fileSize: metadata.fileSize ?? session.fileSize,
            diskRevision: metadata.diskRevision ?? session.diskRevision,
            diskHash: metadata.diskHash ?? session.diskHash,
        }));
    }

    markSaved(id: string, result: SessionResult<DiskSaveResult>): DocumentSession | null {
        return this.replace(id, (session) => markSessionSaved(session, result));
    }

    applyExternalContent(id: string, content: string, diskRevision: number, diskHash: string): DocumentSession | null {
        return this.replace(id, (session) => applyExternalSessionContent(session, content, diskRevision, diskHash));
    }

    acceptsResult<T>(id: string, result: SessionResult<T>): boolean {
        const session = this.get(id);
        return session !== null && acceptsSessionResult(session, result);
    }

    private replace(id: string, update: (session: DocumentSession) => DocumentSession): DocumentSession | null {
        const current = this.get(id);
        if (!current) return null;
        const next = update(current);
        if (next !== current) {
            this.sessions.set(id, next);
            this.emit();
        }
        return next;
    }

    private emit(): void {
        if (this.contentEmitTimer !== null) {
            clearTimeout(this.contentEmitTimer);
            this.contentEmitTimer = null;
        }
        this.snapshot = {
            activeId: this.activeId,
            sessions: Array.from(this.sessions.values(), summarizeSession),
        };
        this.listeners.forEach((listener) => listener());
    }

    private scheduleContentEmit(): void {
        if (this.contentEmitTimer !== null) return;
        this.contentEmitTimer = setTimeout(() => {
            this.contentEmitTimer = null;
            this.emit();
        }, 80);
    }
}

function summarizeSession(session: DocumentSession): DocumentSessionSummary {
    const { content: _content, format: _format, ...summary } = session;
    return { ...summary, dirty: isSessionDirty(session) };
}
