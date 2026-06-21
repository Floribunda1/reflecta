import { net, protocol } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getContentStorageRoot } from "./config";

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "asset",
      privileges: { secure: true, standard: true, corsEnabled: true, supportFetchAPI: true },
    },
  ]);
}

export function assetFilename(url: string): string | null {
  const parsed = new URL(url);
  const filename = decodeURIComponent(parsed.pathname.replace(/^\/+/, "") || parsed.hostname);
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename === "." ||
    filename === ".."
  ) {
    return null;
  }
  return filename;
}

export function handleAssetProtocol(): void {
  protocol.handle("asset", async (request) => {
    const fileName = assetFilename(request.url);
    if (!fileName) return new Response("Not Found", { status: 404 });

    try {
      const filePath = join(getContentStorageRoot(), "assets", fileName);
      return await net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}
