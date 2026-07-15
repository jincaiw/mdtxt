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
| | | | | | |
