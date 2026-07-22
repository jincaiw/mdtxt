export type LiveLocale = "zh-CN" | "en";

export function liveText(locale: LiveLocale, chinese: string, english: string): string {
    return locale === "zh-CN" ? chinese : english;
}

const CALLOUT_TITLES: Record<string, readonly [string, string]> = {
    NOTE: ["说明", "Note"],
    TIP: ["提示", "Tip"],
    IMPORTANT: ["重要", "Important"],
    WARNING: ["警告", "Warning"],
    CAUTION: ["注意", "Caution"],
};

export function liveCalloutTitle(locale: LiveLocale, type: string): string {
    const labels = CALLOUT_TITLES[type];
    if (!labels) return type;
    return locale === "zh-CN" ? labels[0] : labels[1];
}
