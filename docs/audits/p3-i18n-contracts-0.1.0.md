# mdtxt 0.1.0 P3 Localization Contracts

Date: 2026-07-15  
Scope: bilingual UI infrastructure and the user-copy gate.

## Decisions

- The application defaults to `zh-CN`, including the static HTML language and
  the runtime locale fallback.
- `mdtxt-locale` remains the authoritative preference. A legacy
  `paperling-locale` value is copied once without deleting the legacy key, so
  rollback remains possible.
- Both locales are exposed through a single typed catalogue. Tests assert the
  exact key set and placeholder variables are identical.
- `formatNumber` and `formatDate` are locale-aware helpers; switching locale
  changes only localized React output and does not remount an editor view.
- `check:user-copy -- --enforce` rejects direct visible and accessibility prose.
  It intentionally ignores Material Symbol glyph names, URLs, product names,
  keyboard notation and file-format identifiers, which are not locale copy.

## Verification

```bash
bun run check:i18n
bun run check:user-copy -- --enforce
bun run test -- src/context/LocaleContext.test.ts
bun run build
```

The release preflight executes both locale checks, so a missing static key or
new untranslated JSX/accessibility literal blocks release validation.

## Compatibility and rollback

The locale preference migration is additive and idempotent. Reverting this
stage restores the former English fallback while preserving both storage keys;
it does not modify Markdown content, file names, frontmatter or exported text.
