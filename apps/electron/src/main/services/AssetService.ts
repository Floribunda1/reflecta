import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { shell } from "electron";
import { getDBInstance } from "@main/db";
import { contexts, understandings } from "@reflecta/server";
import type { OrphanAssetInfo } from "@shared/asset";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { getContentStorageRoot } from "../config";
import { saveAssetFile } from "./asset-storage";

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

async function readSessionContents(contentStorageRoot: string): Promise<string[]> {
  const sessionsDir = join(contentStorageRoot, "Sessions");
  let files: string[];
  try {
    files = (await readdir(sessionsDir)).filter((name) => name.endsWith(".jsonl"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  // ponytail: scan session logs only during manual orphan cleanup; add an index if this becomes slow.
  return Promise.all(files.map((name) => readFile(join(sessionsDir, name), "utf8")));
}

export class AssetService extends IpcService {
  static groupName = "asset";

  @IpcMethod()
  async saveAsset(buffer: ArrayBuffer, filename: string): Promise<string> {
    return saveAssetFile(getContentStorageRoot(), buffer, filename);
  }

  @IpcMethod()
  async scanOrphanAssets(): Promise<OrphanAssetInfo[]> {
    const contentStorageRoot = getContentStorageRoot();
    const assetsDir = join(contentStorageRoot, "assets");
    await mkdir(assetsDir, { recursive: true });

    // Collect all files present on disk
    const diskFiles = await readdir(assetsDir);

    // Collect all asset references from understandings and contexts (including soft-deleted,
    // so we don't accidentally remove assets still referenced in trash)
    const db = getDBInstance();
    const [understandingRows, contextRows] = await Promise.all([
      db.select({ body: understandings.body }).from(understandings),
      db.select({ content: contexts.content }).from(contexts),
    ]);

    const referenced = new Set<string>();
    for (const row of understandingRows) {
      for (const ref of extractAssetRefs(row.body)) referenced.add(ref);
    }
    for (const row of contextRows) {
      for (const ref of extractAssetRefs(row.content)) referenced.add(ref);
    }
    for (const content of await readSessionContents(contentStorageRoot)) {
      for (const ref of extractAssetRefs(content)) referenced.add(ref);
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
    const assetsDir = join(getContentStorageRoot(), "assets");
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
    const filePath = join(getContentStorageRoot(), "assets", filename);
    await shell.openPath(filePath);
  }

  @IpcMethod()
  async revealAsset(filename: string): Promise<void> {
    if (filename.includes("/") || filename.includes("\\")) return;
    const filePath = join(getContentStorageRoot(), "assets", filename);
    shell.showItemInFolder(filePath);
  }
}
