import { invoke } from "@tauri-apps/api/core";

const IMAGE_MIME_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
};

const LOCAL_IMAGE_CACHE = new Map<string, string>();
const LOCAL_IMAGE_CACHE_CAP = 100;

export function imageMimeType(path: string): string {
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_MIME_TYPES[extension] ?? "image/png";
}

export function isUnsafeRelativeImagePath(path: string): boolean {
    if (!path || /\0/.test(path) || /^([a-zA-Z]:|\/|\\)/.test(path)) return true;
    return path.split(/[/\\]+/).some((segment) => segment === "..");
}

export function markdownBaseDir(filePath: string | null): string | null {
    if (!filePath) return null;
    const separator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    return separator > 0 ? filePath.slice(0, separator) : null;
}

export async function getCachedLocalImageUrl(baseDir: string, relPath: string): Promise<string> {
    const cacheKey = `${baseDir}\u0000${relPath}`;
    const hit = LOCAL_IMAGE_CACHE.get(cacheKey);
    if (hit !== undefined) {
        LOCAL_IMAGE_CACHE.delete(cacheKey);
        LOCAL_IMAGE_CACHE.set(cacheKey, hit);
        return hit;
    }

    const buffer = await invoke<ArrayBuffer>("read_image_file", { baseDir, relPath });
    const url = URL.createObjectURL(new Blob([buffer], { type: imageMimeType(relPath) }));
    LOCAL_IMAGE_CACHE.set(cacheKey, url);
    if (LOCAL_IMAGE_CACHE.size > LOCAL_IMAGE_CACHE_CAP) {
        const oldestKey = LOCAL_IMAGE_CACHE.keys().next().value;
        if (oldestKey !== undefined) {
            const oldestUrl = LOCAL_IMAGE_CACHE.get(oldestKey);
            if (oldestUrl) URL.revokeObjectURL(oldestUrl);
            LOCAL_IMAGE_CACHE.delete(oldestKey);
        }
    }
    return url;
}
