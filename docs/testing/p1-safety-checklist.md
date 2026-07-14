# P1 Safety Validation Checklist

Automated tests cover fixtures, format round-trip, editor-state isolation,
autosave, external change handling and session persistence. Run this checklist
on the native app before declaring any editor/state migration ready for P2+.

## Chinese IME composition

1. Open a Markdown file containing Chinese and English paragraphs.
2. In Source mode, use macOS Pinyin, Windows Microsoft Pinyin, or an available
   Linux Chinese IME to enter a multi-character phrase while completion is open.
3. Confirm the preedit text is not duplicated, the composition is not committed
   early, and undo removes the final phrase as one normal editing action.
4. Repeat after switching tabs and after switching Source/Split/Reader modes.

## Data-safety smoke paths

1. Open and save a CRLF Markdown file with a UTF-8 BOM and a trailing newline;
   compare its bytes before and after a no-change save.
2. Make local edits, change the file with another editor, focus mdtxt, and
   verify the conflict path never silently overwrites either version.
3. Edit two tabs, undo independently in each, then close and relaunch the app;
   verify the saved tab session reopens its intended files and active tab.
4. Open each P1 fixture in Source and Reader modes; unknown directives and raw
   HTML must remain in Source exactly as authored.

## Evidence to attach

Record platform, IME, input method, fixture name, command output, any
reproduction steps, and screenshots only when a behavior differs by platform.
