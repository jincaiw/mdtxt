import { useEffect, useState } from "react";
import type { DocumentSessionContentSnapshot } from "../utils/documentSessionController";

/**
 * A read-only projection for expensive document consumers. Switching documents
 * is immediate, while revisions within the same document are coalesced so
 * preview, outline, statistics, AI and export never sit on the typing path.
 */
export function useDocumentPresentationSnapshot(
  source: DocumentSessionContentSnapshot | null,
): DocumentSessionContentSnapshot | null {
  const [visible, setVisible] = useState<DocumentSessionContentSnapshot | null>(source);
  const sourceId = source?.documentId ?? null;
  const sourceVersion = source?.version ?? null;
  const sourceContent = source?.value ?? "";
  const delay = sourceContent.length > 40_000 ? 250 : sourceContent.length > 12_000 ? 160 : 80;

  useEffect(() => {
    if (!source || source.documentId !== visible?.documentId) {
      setVisible(source);
      return;
    }
    if (source.version === visible.version) return;
    const timer = window.setTimeout(() => setVisible(source), delay);
    return () => window.clearTimeout(timer);
  }, [delay, source, sourceContent, sourceId, sourceVersion, visible?.documentId, visible?.version]);

  return visible;
}
