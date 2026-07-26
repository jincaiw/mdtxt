import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFullscreen } from "./useFullscreen";

const native = vi.hoisted(() => {
  let fullscreen = false;
  let onResize: (() => void) | undefined;
  let onFocus: (() => void) | undefined;
  const windowHandle = {
    isFullscreen: vi.fn(async () => fullscreen),
    setFullscreen: vi.fn(async (next: boolean) => { fullscreen = next; }),
    onResized: vi.fn(async (listener: () => void) => {
      onResize = listener;
      return vi.fn();
    }),
    onFocusChanged: vi.fn(async (listener: () => void) => {
      onFocus = listener;
      return vi.fn();
    }),
  };
  return {
    windowHandle,
    setFullscreen: (next: boolean) => { fullscreen = next; },
    emitResize: () => onResize?.(),
    emitFocus: () => onFocus?.(),
    reset: () => {
      fullscreen = false;
      onResize = undefined;
      onFocus = undefined;
      windowHandle.isFullscreen.mockClear();
      windowHandle.setFullscreen.mockClear();
      windowHandle.onResized.mockClear();
      windowHandle.onFocusChanged.mockClear();
    },
  };
});

vi.mock("@tauri-apps/api/window", () => ({
  Window: { getCurrent: () => native.windowHandle },
}));

describe("useFullscreen", () => {
  afterEach(() => native.reset());

  it("resyncs React state when fullscreen changes through native window controls", async () => {
    const { result } = renderHook(() => useFullscreen(vi.fn()));
    await waitFor(() => expect(native.windowHandle.onResized).toHaveBeenCalledOnce());

    native.setFullscreen(true);
    await act(async () => { native.emitResize(); });
    await waitFor(() => expect(result.current.isFullscreen).toBe(true));

    native.setFullscreen(false);
    await act(async () => { native.emitFocus(); });
    await waitFor(() => expect(result.current.isFullscreen).toBe(false));
  });
});
