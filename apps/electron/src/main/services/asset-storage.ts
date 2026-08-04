import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { nanoid } from "nanoid";

export async function saveAssetFile(
  contentStorageRoot: string,
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
): Promise<string> {
  const dir = join(contentStorageRoot, "assets");
  await mkdir(dir, { recursive: true });
  const id = `${nanoid()}${extname(filename) || ".bin"}`;
  await writeFile(
    join(dir, id),
    Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer),
  );
  return id;
}
