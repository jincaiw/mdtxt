import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentPresentationSnapshot } from "./useDocumentPresentationSnapshot";

describe("useDocumentPresentationSnapshot", () => {
  afterEach(() => vi.useRealTimers());

  it("switches documents immediately and coalesces revisions within one document", () => {
    vi.useFakeTimers();
    const first = { documentId: "a", version: 0, value: "first" };
    const changed = { documentId: "a", version: 1, value: "first changed" };
    const other = { documentId: "b", version: 0, value: "other" };
    const { result, rerender } = renderHook(({ snapshot }) => useDocumentPresentationSnapshot(snapshot), {
      initialProps: { snapshot: first },
    });

    expect(result.current).toEqual(first);
    rerender({ snapshot: changed });
    expect(result.current).toEqual(first);
    act(() => vi.advanceTimersByTime(80));
    expect(result.current).toEqual(changed);

    rerender({ snapshot: other });
    expect(result.current).toEqual(other);
  });
});
