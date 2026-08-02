# P6 Live Beta IME Validation Checklist

This is a native-WebView gate, not a jsdom or browser-automation substitute.
Record the app commit, OS version, WebView, input method, fixture, and result
in the P6 tracking record for every candidate build.

## Required platforms and input methods

| Platform | Required input method | Status required for P6 Beta |
| --- | --- | --- |
| macOS | Simplified Pinyin | Manual pass or explicit unverified note |
| Windows | Microsoft Pinyin | Manual pass or explicit unverified note |
| Linux | IBus or Fcitx5 Chinese IME | Manual pass or explicit unverified note |

## Procedure

1. Open `src/test/fixtures/markdown/live-beta.md` in Source, Live and Split.
2. Compose a multi-character Chinese phrase inside a heading, emphasis, list,
   task item and inline-code-adjacent prose.
3. While composing, move the caret, accept a candidate, press Space and Enter,
   then undo and redo. Repeat after switching tabs and modes.
4. Verify the preedit range is neither duplicated nor committed early; the
   candidate window stays near the caret; source delimiters recover when the
   focused node is edited; undo removes one normal editing action.
5. Treat missing/duplicated text, premature commit, candidate-window offset or
   cursor jump as P0. Do not enable Live by default while any row is unverified.

## Evidence template

| Commit | OS/WebView | IME | Mode and node | Result | Issue link / notes |
| --- | --- | --- | --- | --- | --- |
| `f0839d8` | macOS Darwin 25.5.0 / WKWebView | Accessibility value injection (not an IME) | Live heading, emphasis and task list; undo/redo and Source fallback | Basic source editing passed | This does **not** validate Pinyin composition or candidate-window positioning; keep macOS IME status unverified. |
| `007843b` | macOS 26.5.2 (25F84) / WKWebView; Debug bundle SHA-256 `0d21df9b078036cad6ed86a13ca6b02652295c62354660fa4eb0d56399774235` | Apple Pinyin – Simplified | Source and Live plain Chinese lines; selection/clipboard, undo/redo, mode and tab switching | **Passed** | `anquanceshi` committed as `安全测试`; Live committed `完成` and Source round-tripped `安全测试完成`; copied Chinese remained exact across two lines; undo/redo and tab switching preserved source; `houxuan` preedit displayed its native candidate strip directly below the caret. ABC was restored after the run. |
| `6ac73e0` | GitHub-hosted Windows / WebView2; CI `29946140453`, job `89011866641` | Microsoft Pinyin / TSF, native Win32 `SendInput` | Source and Live Chinese commits; selection/clipboard, undo/redo, mode and tab switching | **Passed** | Source committed `中文`, 12 composition events were observed, Live committed a second Chinese run, and preedit artifact `8540422494` shows the Microsoft Pinyin candidate surface. |
| `6ac73e0` | Ubuntu 24.04 / WebKitGTK; CI `29946140453`, job `89011866563` | Fcitx5 Pinyin / X11 XTEST | Source and Live Chinese commits; selection/clipboard, undo/redo, mode and tab switching | **Passed** | Source committed `中文`, Live produced two Chinese runs, and preedit artifact `8540348396` shows the Fcitx5 candidate list at the caret. |
| Current working tree (`e844906` + local changes) | macOS 26.6 (25G72) / WKWebView; debug executable SHA-256 `ccde99751e5822b7b5dfa021112e1ac10035264fac17a46c8320cffb6deb8888` | Apple Pinyin – Simplified; native per-key input | Live plain text | **Composition and commit passed; candidate-window placement not captured** | Per-key `n i h a o` produced underlined `ni hao` preedit, and Space committed the system candidate `你好`. Evidence: [`macos-apple-pinyin-preedit-2026-08-01.jpeg`](evidence/macos-apple-pinyin-preedit-2026-08-01.jpeg) (SHA-256 `5f941141…`) and [`macos-apple-pinyin-commit-2026-08-01.jpeg`](evidence/macos-apple-pinyin-commit-2026-08-01.jpeg) (SHA-256 `ad2196c9…`). The app-scoped capture did not include the separate InputMethodKit candidate window, so its caret-relative placement remains explicitly unverified. |
| Current working tree (`e844906` + local changes) | macOS 26.6 (25G72) / WKWebView; current app executable SHA-256 `a08e473a496fcbabd231d6d2978c58f791f1869c0ffe8f53b378cd9db038a1ba` | Apple Pinyin – Simplified; physical keyboard plus full-screen capture | Live plain text | **Candidate-window placement passed** | Underlined `hou xuan` remained in the active editor line while the native candidate strip appeared immediately below it; first candidate was `候选`. Evidence: [`macos-apple-pinyin-candidate-2026-08-02.png`](evidence/macos-apple-pinyin-candidate-2026-08-02.png), 3840×2160, SHA-256 `40e9fc7e617968c6698bb724b71f0e669d0ad1a9776178fd19597182ff1a25f9`. Together with the preceding current-tree composition/commit record, this closes the macOS IME gate. |

Japanese IME is explicitly outside the mdtxt 0.1.0 support scope and is not an unchecked row in this matrix.
