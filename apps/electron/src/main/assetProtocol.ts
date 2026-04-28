import { protocol } from "electron";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getStorageRoot } from "./config";

const ASSET_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
};

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "asset",
      privileges: { secure: true, standard: true, corsEnabled: true, supportFetchAPI: true },
    },
  ]);
}

export function handleAssetProtocol(): void {
  protocol.handle("asset", async (request) => {
    const fileName = request.url.replace("asset://", "").replace("/", "");
    try {
      const filePath = join(getStorageRoot(), "assets", fileName);
      const data = await readFile(filePath);
      const contentType = ASSET_MIME[extname(fileName).toLowerCase()] ?? "application/octet-stream";
      const totalLength = data.length;
      const rangeHeader = request.headers.get("range");

      if (rangeHeader) {
        const rangeStr = rangeHeader.replace(/^bytes=/, "");
        const [startStr, endStr] = rangeStr.split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalLength - 1;
        const chunk = data.subarray(start, end + 1);
        return new Response(chunk, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
          },
        });
      }

      return new Response(data, {
        headers: {
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Content-Length": String(totalLength),
        },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}
