import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance } from "../../db";
import { UnderstandingCliBff } from "../understanding/bff-cli";
import { configureRetrievalEmbedding } from "./embedding-config";
import {
  createRetrievalIndex,
  getRetrievalIndexStatus,
  rebuildRetrievalIndexWithStatus,
} from "./sync";

const tempDirs: string[] = [];
const previousIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;

afterEach(async () => {
  configureRetrievalEmbedding();
  if (previousIndexPath === undefined) delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  else process.env.REFLECTA_RETRIEVAL_INDEX_PATH = previousIndexPath;
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function setup() {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-retrieval-rebuild-"));
  tempDirs.push(tempDir);
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = join(tempDir, "index");
  const db = await createDBInstance(join(tempDir, "test.db"), { runMigrations: true });
  return { db, understandings: new UnderstandingCliBff(db) };
}

describe("retrieval index rebuild", () => {
  test("builds the current SQLite projection explicitly", async () => {
    const { db, understandings } = await setup();
    const created = await understandings.createUnderstanding({
      title: "Explicit rebuild",
      body: "explicitrebuildmarker",
    });

    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "not_ready" });
    await rebuildRetrievalIndexWithStatus(db);

    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "ready" });
    expect(
      (await createRetrievalIndex().searchLexical("explicitrebuildmarker", 5))[0]?.entityId,
    ).toBe(created.id);
  });

  test("does not overlay unsynchronized SQLite changes during retrieval", async () => {
    const { db, understandings } = await setup();
    const created = await understandings.createUnderstanding({
      title: "Indexed version",
      body: "indexedversionmarker",
    });
    await rebuildRetrievalIndexWithStatus(db);

    await understandings.updateUnderstanding(created.id, { body: "sqliteonlymarker" });

    expect(await createRetrievalIndex().searchLexical("sqliteonlymarker", 5)).toEqual([]);
    expect(
      (await createRetrievalIndex().searchLexical("indexedversionmarker", 5))[0]?.entityId,
    ).toBe(created.id);
  });
});
