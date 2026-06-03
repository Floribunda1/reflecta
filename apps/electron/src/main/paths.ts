import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const mainDir = dirname(fileURLToPath(import.meta.url));

export const preloadScript = join(mainDir, "../preload/index.mjs");
export const rendererHtml = join(mainDir, "../renderer/index.html");
