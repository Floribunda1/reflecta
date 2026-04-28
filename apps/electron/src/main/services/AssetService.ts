import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { shell } from "electron";
import { getDBInstance } from "@main/db";
import { contexts, thoughts } from "@main/db/schema";
import type { OrphanAssetInfo } from "@shared/asset";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { nanoid } from "nanoid";
import { getStorageRoot } from "../config";

/** Extract all asset filenames referenced in a piece of markdown/html content. */
function extractAssetRefs(content: string): Set<string> {
  const refs = new Set<string>();
  // Matches asset:///filename in markdown image/link syntax and HTML attributes
  const re = /asset:\/\/\/([^"')\s>]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

export class AssetService extends IpcService {
  static groupName = "asset";

  @IpcMethod()
  async saveAsset(base64: string, filename: string): Promise<string> {
    const dir = join(getStorageRoot(), "assets");
    await mkdir(dir, { recursive: true });
    const ext = extname(filename) || ".bin";
    const id = `${nanoid()}${ext}`;
    await writeFile(join(dir, id), Buffer.from(base64, "base64"));
    return id;
  }

  @IpcMethod()
  async scanOrphanAssets(): Promise<OrphanAssetInfo[]> {
    const assetsDir = join(getStorageRoot(), "assets");
    await mkdir(assetsDir, { recursive: true });

    // Collect all files present on disk
    const diskFiles = await readdir(assetsDir);

    // Collect all asset references from thoughts and contexts (including soft-deleted,
    // so we don't accidentally remove assets still referenced in trash)
    const db = getDBInstance();
    const [thoughtRows, contextRows] = await Promise.all([
      db.select({ body: thoughts.body }).from(thoughts),
      db.select({ content: contexts.content }).from(contexts),
    ]);

    const referenced = new Set<string>();
    for (const row of thoughtRows) {
      for (const ref of extractAssetRefs(row.body)) referenced.add(ref);
    }
    for (const row of contextRows) {
      for (const ref of extractAssetRefs(row.content)) referenced.add(ref);
    }

    // Orphans = on disk but not referenced
    const orphans: OrphanAssetInfo[] = [];
    for (const file of diskFiles) {
      if (!referenced.has(file)) {
        const filePath = join(assetsDir, file);
        const info = await stat(filePath);
        orphans.push({ filename: file, size: info.size });
      }
    }
    return orphans;
  }

  @IpcMethod()
  async cleanOrphanAssets(filenames: string[]): Promise<number> {
    if (filenames.length === 0) return 0;
    const assetsDir = join(getStorageRoot(), "assets");
    // Re-validate against current references before deleting
    const orphans = await this.scanOrphanAssets();
    const safeToDelete = new Set(orphans.map((o) => o.filename));

    let deleted = 0;
    for (const filename of filenames) {
      // Only delete files that are still confirmed orphans and have no path traversal
      if (!safeToDelete.has(filename) || filename.includes("/") || filename.includes("\\")) {
        continue;
      }
      await rm(join(assetsDir, filename), { force: true });
      deleted++;
    }
    return deleted;
  }

  @IpcMethod()
  async openAsset(filename: string): Promise<void> {
    if (filename.includes("/") || filename.includes("\\")) return;
    const filePath = join(getStorageRoot(), "assets", filename);
    await shell.openPath(filePath);
  }

  @IpcMethod()
  async revealAsset(filename: string): Promise<void> {
    if (filename.includes("/") || filename.includes("\\")) return;
    const filePath = join(getStorageRoot(), "assets", filename);
    shell.showItemInFolder(filePath);
  }
}
