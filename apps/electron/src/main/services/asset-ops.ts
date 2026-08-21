/**
 * asset 域业务逻辑（删除式迁移：从 AssetService 抽出为纯函数，供 Effect handler 调用）。
 */
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { shell } from "electron";
import { getDBInstance } from "@main/db";
import { contexts, understandings } from "@reflecta/server";
import type { OrphanAssetInfo } from "@shared/asset";
import { getContentStorageRoot } from "../config";
import { saveAssetFile } from "./asset-storage";

/** Extract all asset filenames referenced in a piece of markdown/html content. */
function extractAssetRefs(content: string): Set<string> {
  const refs = new Set<string>();
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
  return Promise.all(files.map((name) => readFile(join(sessionsDir, name), "utf8")));
}

export async function saveAsset(buffer: ArrayBuffer, filename: string): Promise<string> {
  return saveAssetFile(getContentStorageRoot(), buffer, filename);
}

export async function scanOrphanAssets(): Promise<OrphanAssetInfo[]> {
  const contentStorageRoot = getContentStorageRoot();
  const assetsDir = join(contentStorageRoot, "assets");
  await mkdir(assetsDir, { recursive: true });

  const diskFiles = await readdir(assetsDir);
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

  const orphans = (
    await Promise.all(
      diskFiles.map(async (file) => {
        if (referenced.has(file)) return null;
        const info = await stat(join(assetsDir, file));
        return { filename: file, size: info.size };
      }),
    )
  ).filter((orphan): orphan is OrphanAssetInfo => orphan !== null);
  return orphans;
}

export async function cleanOrphanAssets(filenames: string[]): Promise<number> {
  if (filenames.length === 0) return 0;
  const assetsDir = join(getContentStorageRoot(), "assets");
  const orphans = await scanOrphanAssets();
  const safeToDelete = new Set(orphans.map((o) => o.filename));

  let deleted = 0;
  for (const filename of filenames) {
    if (!safeToDelete.has(filename) || filename.includes("/") || filename.includes("\\")) {
      continue;
    }
    await rm(join(assetsDir, filename), { force: true });
    deleted++;
  }
  return deleted;
}

export async function openAsset(filename: string): Promise<void> {
  if (filename.includes("/") || filename.includes("\\")) return;
  const filePath = join(getContentStorageRoot(), "assets", filename);
  await shell.openPath(filePath);
}

export async function openExternalPath(filePath: string): Promise<void> {
  if (!filePath) return;
  await shell.openPath(filePath);
}

export async function revealAsset(filename: string): Promise<void> {
  if (filename.includes("/") || filename.includes("\\")) return;
  const filePath = join(getContentStorageRoot(), "assets", filename);
  shell.showItemInFolder(filePath);
}
