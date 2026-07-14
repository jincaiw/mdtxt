import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ensureFontLoaded } from '../fonts';

export type Theme = 'dark' | 'light' | 'paper' | 'dracula';
export type FontFamily = 'inter' | 'merriweather' | 'lora' | 'source-serif' | 'fira-sans';
export type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    font: FontFamily;
    setFont: (font: FontFamily) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'mdtxt-theme';
const FONT_STORAGE_KEY = 'mdtxt-font';
const FONT_SIZE_STORAGE_KEY = 'mdtxt-font-size';
const LEGACY_STORAGE_KEYS: Array<[string, string]> = [
    ['paperling-theme', THEME_STORAGE_KEY],
    ['paperling-font', FONT_STORAGE_KEY],
    ['paperling-font-size', FONT_SIZE_STORAGE_KEY],
];

function migrateLegacyThemeKeys(): void {
    try {
        for (const [legacy, current] of LEGACY_STORAGE_KEYS) {
            if (localStorage.getItem(current) === null) {
                const value = localStorage.getItem(legacy);
                if (value !== null) localStorage.setItem(current, value);
            }
        }
    } catch { /* storage unavailable: defaults remain safe */ }
}

migrateLegacyThemeKeys();

// Valid values for validation against corrupted localStorage
const VALID_THEMES: Theme[] = ['dark', 'light', 'paper', 'dracula'];
const VALID_FONTS: FontFamily[] = ['inter', 'merriweather', 'lora', 'source-serif', 'fira-sans'];
const VALID_FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];

function getValidated<T extends string>(key: string, validValues: T[], fallback: T): T {
    const stored = localStorage.getItem(key);
    if (stored && validValues.includes(stored as T)) {
        return stored as T;
    }
    return fallback;
}

/** True when the OS reports a light color scheme. Guarded for non-browser
 *  contexts (SSR/tests) where matchMedia is absent. */
function prefersLight(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-color-scheme: light)').matches;
}

/** Theme to start with: a previously saved choice wins; otherwise match the OS
 *  so a first launch doesn't blast a dark UI at someone on a light desktop (or
 *  vice versa). Falls back to dark when the preference can't be read. */
function getInitialTheme(): Theme {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as Theme)) {
        return stored as Theme;
    }
    return prefersLight() ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    const [font, setFontState] = useState<FontFamily>(() =>
        getValidated(FONT_STORAGE_KEY, VALID_FONTS, 'inter')
    );

    const [fontSize, setFontSizeState] = useState<FontSize>(() =>
        getValidated(FONT_SIZE_STORAGE_KEY, VALID_FONT_SIZES, 'medium')
    );

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    const setFont = (newFont: FontFamily) => {
        setFontState(newFont);
        localStorage.setItem(FONT_STORAGE_KEY, newFont);
    };

    const setFontSize = (newSize: FontSize) => {
        setFontSizeState(newSize);
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, newSize);
    };

    // Apply theme, font, and font size to document in a single effect. Also
    // lazy-load the chosen body font's CSS (no-op for the eager Inter default).
    // Runs on mount too, so a persisted non-default font is fetched on launch.
    useEffect(() => {
        ensureFontLoaded(font);
        const el = document.documentElement;
        el.setAttribute('data-theme', theme);
        el.setAttribute('data-font', font);
        el.setAttribute('data-font-size', fontSize);
    }, [theme, font, fontSize]);

    // Track the OS theme until the user picks one explicitly. The handler
    // re-checks storage each time so flipping the OS appearance never overrides
    // a deliberate choice the user made earlier in the session.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                setThemeState(e.matches ? 'light' : 'dark');
            }
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, font, setFont, fontSize, setFontSize }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
