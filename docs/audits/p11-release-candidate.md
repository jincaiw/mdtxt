# P11 v0.1.0 Release-Candidate Decision

Status: **candidate evidence accepted and ready for the final documentation-SHA
CI/tag gate. Publication is authorized only as an unsigned public prerelease,
never GA.**

## Acceptance summary

| Contract | Evidence | Decision |
| --- | --- | --- |
| AC-001/002 basic writing and marker reveal | CodeMirror-owned document sessions, Source/Live/Split/Reader native smoke, round-trip fixtures, focus/selection/undo tests | Passed; Live remains explicit Beta and is not the default |
| AC-003 Chinese input | Apple Simplified Pinyin on the macOS WKWebView plus Microsoft Pinyin and Fcitx5 Pinyin native jobs; source/live commit, clipboard, undo/redo and tab/mode round-trip | Passed for the declared Simplified-Chinese scope; Japanese IME is explicitly out of scope |
| AC-004 tables | Table model/command tests plus Source-preserving Live table Widget | Passed |
| AC-005 math and Mermaid | KaTeX/Mermaid strict renderers, failure fallback tests, eight-Widget native marker, inspected macOS PDF | Passed; CI `29954555501`, Ubuntu job `89040211517` |
| AC-006 conflict | Revision+hash save contract, comparison/reload/keep-local/save-as UI, Windows share denial, fault injection | Passed; no silent overwrite |
| AC-007 recovery | macOS force-terminate plus production MSI `taskkill /F` and DEB `SIGKILL`, two drafts/order/active tab/line/exact content | Passed; run `29948969306`, artifacts `8541635821` and `8541492677` |
| AC-008 identity/coexistence | `mdtxt` / `app.mdtxt.desktop` / `0.1.0` preflight; updater disabled; strict CSP; production bridge absent. Installed `/Applications/Paperling.app` (`com.mujizi.paperling`) and isolated production mdtxt were simultaneously running with distinct windows, bundle identifiers and app-data directories | Passed for prerelease identity and coexistence; uninstall/upgrade marketplace policy is not claimed |
| AC-009 localization | Default Simplified Chinese, live language switch/state preservation tests, 465/465 Chinese keys across 110 source files, zero direct JSX/accessibility literals | Passed |
| AC-010 platform | Three-platform CI/build packages, native WebViews, filesystem/recovery evidence, macOS inspected PDF/DOCX/HTML, Windows WebView2 PDF and Ubuntu WebKitGTK system-print evidence | Passed for unsigned prerelease; CI `29954555501` |

## Current release gates

- Frontend: 51 files / 353 tests passed; TypeScript/Vite production build and
  `bun run release:check` passed.
- Rust: format, clippy with warnings denied, and 32 tests passed.
- Security: cargo-deny, OSV scan, strict CSP, native-only writes, keychain-only
  AI secret storage, no production automation permission, and no updater.
- Packaging: macOS `.app` and DMG build; `codesign --verify --deep --strict`
  passes with ad-hoc identity `-`. This is bundle-integrity signing, not
  Developer ID or notarization.
- Exports: real macOS HTML/PDF/DOCX output inspected. Windows PDF and Ubuntu
  print-dialog assertions are part of the final native CI gate.
- Supply chain: release workflow generates aggregate SHA-256, SPDX SBOM and a
  third-party license inventory after all three build jobs finish.
- Candidate CI: commit `a71cea8`, run `29954555501`, all seven jobs passed;
  native artifacts `8543662129` (Windows PDF/Pinyin) and `8543607953`
  (Ubuntu print dialog/Fcitx5) were retained.

## Publication boundary

The PRD's V1 GA Definition of Done requires macOS Developer ID notarization and
Windows code signing. Those credentials do not exist for mdtxt, so v0.1.0 must
remain `prerelease=true`; updater metadata stays disabled. The release workflow
first creates a draft prerelease. P11 may publish that prerelease only after:

1. the final commit's complete CI is green and contains P7 plus Windows/Ubuntu
   native PDF markers;
2. the tag points exactly to that commit;
3. every release build and supply-chain job succeeds;
4. downloaded assets match `SHA256SUMS`; and
5. the GitHub release still reports prerelease and contains no updater JSON.

No missing signature/notarization item may be described as GA completion.
