/**
 * Local-only font loading. Every font face the app uses is bundled with the
 * app — no requests to fonts.googleapis.com / fonts.gstatic.com — so MarkLite
 * looks identical with or without an internet connection.
 *
 * We import the `latin-*` CSS files from each @fontsource package because they
 * register only the latin subset's @font-face. That keeps the bundled woff2
 * footprint reasonable while still covering the full ASCII + western-European
 * character set the editor / preview ever displays. Each import resolves to a
 * woff2 URL that Vite fingerprints and copies into `dist/assets/`.
 *
 * Weights match the set the previous Google Fonts <link> tag pulled, so the
 * UI renders byte-identical to before — just served from disk.
 */

// Inter — primary sans (Settings → Appearance default)
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";

// JetBrains Mono — code editor + inline `code`
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";

// Merriweather — serif option
import "@fontsource/merriweather/latin-300.css";
import "@fontsource/merriweather/latin-400.css";
import "@fontsource/merriweather/latin-700.css";

// Lora — serif option
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";

// Source Serif 4 — serif option
import "@fontsource/source-serif-4/latin-300.css";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-500.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";

// Fira Sans — sans option
import "@fontsource/fira-sans/latin-300.css";
import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/fira-sans/latin-600.css";
import "@fontsource/fira-sans/latin-700.css";

// Material Symbols Outlined — every UI icon. The package ships the variable
// woff2 with the wght axis (100..700); FILL/GRAD/opsz are tuned via inline
// `font-variation-settings` in `index.css`, so the same icon glyphs render
// even when offline.
import "material-symbols/outlined.css";
