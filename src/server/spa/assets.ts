import { readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const NOT_BUILT_MESSAGE = "Backoffice assets are not built. Run: pnpm build:app";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain",
};
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Absolute path to the built SPA output (`dist/app`). */
export function resolveAssetsDir(): string {
  return stripSlash(fileURLToPath(new URL("../../app/", import.meta.url)));
}

/** Whether the SPA has been built into `assetsDir`. */
export function hasBuiltAssets(assetsDir: string): boolean {
  try {
    return statSync(join(assetsDir, "index.html")).isFile();
  } catch {
    return false;
  }
}

export function readIndex(assetsDir: string): Buffer {
  return readFileSync(join(assetsDir, "index.html"));
}

/** Read one asset, refusing any path that escapes `assetsDir`. */
export function readAsset(
  assetsDir: string,
  pathname: string,
): { body: Buffer; contentType: string } | null {
  const relative = pathname.replace(/^\/+/, "");
  const resolved = normalize(join(assetsDir, relative));
  if (resolved !== assetsDir && !resolved.startsWith(`${assetsDir}/`)) return null;
  try {
    if (!statSync(resolved).isFile()) return null;
    const extensionIndex = pathname.lastIndexOf(".");
    const extension = extensionIndex === -1 ? "" : pathname.slice(extensionIndex).toLowerCase();
    return {
      body: readFileSync(resolved),
      contentType: CONTENT_TYPES[extension] ?? DEFAULT_CONTENT_TYPE,
    };
  } catch {
    return null;
  }
}
