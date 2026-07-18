import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance } from "../../db";
import { UnderstandingCliBff } from "../understanding/bff-cli";
import { ContextCliBff } from "../context/bff-cli";
import { DomainCliBff } from "../domain/bff-cli";
import { configureRetrievalEmbedding } from "./embedding-config";
import { RetrievalIndexCoordinator } from "./coordinator";
import {
  configureRetrievalEmbeddingProviderFactory,
  createRetrievalIndex,
  reconcileRetrievalIndex,
  syncRetrievalIndexByUnderstandingIds,
} from "./sync";
import type { EmbeddingProvider } from "./types";

const tempDirs: string[] = [];
const previousIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;

afterEach(async () => {
  configureRetrievalEmbedding();
  configureRetrievalEmbeddingProviderFactory();
  if (previousIndexPath === undefined) delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  else process.env.REFLECTA_RETRIEVAL_INDEX_PATH = previousIndexPath;
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function setup(automatic = false) {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-retrieval-rebuild-"));
  tempDirs.push(tempDir);
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = join(tempDir, "index");
  const db = await createDBInstance(join(tempDir, "test.db"), { runMigrations: true });
  const coordinator = new RetrievalIndexCoordinator({ getDb: () => db });
  const sink = automatic ? coordinator : undefined;
  return {
    db,
    coordinator,
    contexts: new ContextCliBff(db, sink),
    domains: new DomainCliBff(db, sink),
    understandings: new UnderstandingCliBff(db, sink),
  };
}

describe("retrieval index rebuild", () => {
  test("startup reconciliation builds a missing v4 table", async () => {
    const { coordinator, understandings } = await setup();
    const created = await understandings.createUnderstanding({
      title: "Startup rebuild",
      body: "startuprebuildmarker",
    });

    expect(await coordinator.getStatus()).toMatchObject({ state: "not_ready" });
    coordinator.start();
    await coordinator.flush();

    expect(await coordinator.getStatus()).toMatchObject({ state: "ready" });
    expect(
      (await createRetrievalIndex().searchLexical("startuprebuildmarker", 5))[0]?.entityId,
    ).toBe(created.id);
  });

  test("does not overlay unsynchronized SQLite changes during retrieval", async () => {
    const { coordinator, understandings } = await setup();
    const created = await understandings.createUnderstanding({
      title: "Indexed version",
      body: "indexedversionmarker",
    });
    await coordinator.rebuild();

    await understandings.updateUnderstanding(created.id, { body: "sqliteonlymarker" });

    expect(await createRetrievalIndex().searchLexical("sqliteonlymarker", 5)).toEqual([]);
    expect(
      (await createRetrievalIndex().searchLexical("indexedversionmarker", 5))[0]?.entityId,
    ).toBe(created.id);
  });

  test("atomically replaces one Understanding aggregate without removing another", async () => {
    const { db, understandings } = await setup();
    const first = await understandings.createUnderstanding({
      title: "First aggregate",
      body: "firstbeforemarker",
    });
    const second = await understandings.createUnderstanding({
      title: "Second aggregate",
      body: "secondstablemarker",
    });
    await new RetrievalIndexCoordinator({ getDb: () => db }).rebuild();

    await understandings.updateUnderstanding(first.id, { body: "firstaftermarker" });
    await syncRetrievalIndexByUnderstandingIds(db, [first.id]);

    expect(await createRetrievalIndex().searchLexical("firstbeforemarker", 5)).toEqual([]);
    expect((await createRetrievalIndex().searchLexical("firstaftermarker", 5))[0]?.entityId).toBe(
      first.id,
    );
    expect((await createRetrievalIndex().searchLexical("secondstablemarker", 5))[0]?.entityId).toBe(
      second.id,
    );
  });

  test("deletes removed Understanding rows while preserving other parents", async () => {
    const { db, understandings } = await setup();
    const removed = await understandings.createUnderstanding({
      title: "Removed aggregate",
      body: "removedaggregatemarker",
    });
    const kept = await understandings.createUnderstanding({
      title: "Kept aggregate",
      body: "keptaggregatemarker",
    });
    await new RetrievalIndexCoordinator({ getDb: () => db }).rebuild();

    await understandings.deleteUnderstanding(removed.id);
    await syncRetrievalIndexByUnderstandingIds(db, [removed.id]);

    expect(await createRetrievalIndex().searchLexical("removedaggregatemarker", 5)).toEqual([]);
    expect(
      (await createRetrievalIndex().searchLexical("keptaggregatemarker", 5))[0]?.entityId,
    ).toBe(kept.id);
  });

  test("startup reconciliation skips an unchanged manifest and repairs changed content", async () => {
    const { db, understandings } = await setup();
    const created = await understandings.createUnderstanding({
      title: "Reconcile aggregate",
      body: "reconcilebeforemarker",
    });
    await new RetrievalIndexCoordinator({ getDb: () => db }).rebuild();

    await expect(reconcileRetrievalIndex(db)).resolves.toEqual({
      modified: false,
      operationCount: 0,
    });

    await understandings.updateUnderstanding(created.id, { body: "reconcileaftermarker" });
    await expect(reconcileRetrievalIndex(db)).resolves.toMatchObject({ modified: true });
    expect(
      (await createRetrievalIndex().searchLexical("reconcileaftermarker", 5))[0]?.entityId,
    ).toBe(created.id);
  });

  test("an unchanged startup manifest does not invoke the embedding provider", async () => {
    let embeddedDocumentCount = 0;
    const provider: EmbeddingProvider = {
      modelId: "manifest-noop",
      async embed(texts) {
        embeddedDocumentCount += texts.length;
        return texts.map(() => [1, 0]);
      },
    };
    configureRetrievalEmbedding({
      provider: "local-llama-cpp",
      modelId: provider.modelId,
      modelPath: "/test/model.gguf",
    });
    configureRetrievalEmbeddingProviderFactory(() => provider);
    const { coordinator, understandings } = await setup();
    await understandings.createUnderstanding({
      title: "Manifest no-op",
      body: "manifestnoopmarker",
    });
    await coordinator.rebuild();
    const countAfterRebuild = embeddedDocumentCount;

    coordinator.start();
    await coordinator.flush();

    expect(embeddedDocumentCount).toBe(countAfterRebuild);
  });

  test("startup reconciliation repairs missing and excess documents", async () => {
    const { coordinator, understandings } = await setup();
    const missing = await understandings.createUnderstanding({
      title: "Missing from index",
      body: "missingdocumentmarker",
    });
    const excess = await understandings.createUnderstanding({
      title: "Excess in index",
      body: "excessdocumentmarker",
    });
    await coordinator.rebuild();

    await createRetrievalIndex().replaceUnderstandingDocuments([missing.id], []);
    await understandings.deleteUnderstanding(excess.id);

    coordinator.start();
    await coordinator.flush();

    expect(
      (await createRetrievalIndex().searchLexical("missingdocumentmarker", 5))[0]?.entityId,
    ).toBe(missing.id);
    expect(await createRetrievalIndex().searchLexical("excessdocumentmarker", 5)).toEqual([]);
  });

  test("automatic Context moves update both parent aggregates", async () => {
    const { contexts, coordinator, understandings } = await setup(true);
    const first = await understandings.createUnderstanding({
      title: "First context parent",
      body: "firstcontextparentmarker",
    });
    const second = await understandings.createUnderstanding({
      title: "Second context parent",
      body: "secondcontextparentmarker",
    });
    const context = await contexts.createContext({
      understandingId: first.id,
      medium: "experience",
      title: "Movable context",
      content: "movablecontextmarker",
    });
    await coordinator.flush();

    await contexts.updateContext(context.id, { understandingId: second.id });
    await coordinator.flush();

    const hit = (await createRetrievalIndex().searchLexical("movablecontextmarker", 5))[0];
    expect(hit).toMatchObject({
      entityId: context.id,
      parentUnderstandingId: second.id,
    });
  });

  test("automatic delete and restore flows keep Understanding aggregates current", async () => {
    const { contexts, coordinator, understandings } = await setup(true);
    const understanding = await understandings.createUnderstanding({
      title: "Restorable Understanding",
      body: "restorableunderstandingmarker",
    });
    const context = await contexts.createContext({
      understandingId: understanding.id,
      medium: "experience",
      title: "Restorable context",
      content: "restorablecontextmarker",
    });
    await coordinator.flush();

    await contexts.deleteContext(context.id);
    await coordinator.flush();
    expect(await createRetrievalIndex().searchLexical("restorablecontextmarker", 5)).toEqual([]);

    await contexts.restoreContext(context.id);
    await coordinator.flush();
    expect(
      (await createRetrievalIndex().searchLexical("restorablecontextmarker", 5))[0]?.entityId,
    ).toBe(context.id);

    await understandings.deleteUnderstanding(understanding.id);
    await coordinator.flush();
    expect(await createRetrievalIndex().searchLexical("restorableunderstandingmarker", 5)).toEqual(
      [],
    );

    await understandings.restoreUnderstanding(understanding.id);
    await coordinator.flush();
    expect(
      (await createRetrievalIndex().searchLexical("restorableunderstandingmarker", 5))[0]?.entityId,
    ).toBe(understanding.id);

    await understandings.permanentlyDeleteUnderstanding(understanding.id);
    await coordinator.flush();
    expect(await createRetrievalIndex().searchLexical("restorableunderstandingmarker", 5)).toEqual(
      [],
    );
  });

  test("automatic Domain rename and deletion refresh directly linked Understandings", async () => {
    const { coordinator, domains, understandings } = await setup(true);
    const domain = await domains.createDomainSummary({ name: "DomainBeforeMarker" });
    const understanding = await understandings.createUnderstanding({
      title: "Domain linked Understanding",
      body: "domainlinkedbodymarker",
      domainIds: [domain.id],
    });
    await coordinator.flush();

    await domains.updateDomainSummary(domain.id, { name: "DomainAfterMarker" });
    await coordinator.flush();
    expect((await createRetrievalIndex().searchLexical("DomainAfterMarker", 5))[0]?.entityId).toBe(
      understanding.id,
    );
    expect(await createRetrievalIndex().searchLexical("DomainBeforeMarker", 5)).toEqual([]);

    await domains.deleteDomain(domain.id);
    await coordinator.flush();
    expect(await createRetrievalIndex().searchLexical("DomainAfterMarker", 5)).toEqual([]);
    expect(await createRetrievalIndex().readManifest()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `understanding:${understanding.id}` }),
      ]),
    );
    expect(
      (await createRetrievalIndex().searchLexical("domainlinkedbodymarker", 5))[0]?.entityId,
    ).toBe(understanding.id);
  });

  test("saving does not wait for a slow embedding batch", async () => {
    let releaseEmbedding!: () => void;
    let markEmbeddingStarted!: () => void;
    const embeddingStarted = new Promise<void>((resolve) => {
      markEmbeddingStarted = resolve;
    });
    const embeddingReleased = new Promise<void>((resolve) => {
      releaseEmbedding = resolve;
    });
    const provider: EmbeddingProvider = {
      modelId: "deferred-embedding",
      async embed(texts) {
        markEmbeddingStarted();
        await embeddingReleased;
        return texts.map(() => [1, 0]);
      },
    };
    configureRetrievalEmbedding({
      provider: "local-llama-cpp",
      modelId: provider.modelId,
      modelPath: "/test/model.gguf",
    });
    configureRetrievalEmbeddingProviderFactory(() => provider);
    const { coordinator, understandings } = await setup(true);
    let saveCompleted = false;

    const save = understandings
      .createUnderstanding({ title: "Nonblocking save", body: "nonblockingsavemarker" })
      .then((value) => {
        saveCompleted = true;
        return value;
      });

    await embeddingStarted;
    const completedBeforeEmbedding = saveCompleted;
    releaseEmbedding();
    await save;
    await coordinator.flush();
    expect(completedBeforeEmbedding).toBe(true);
  });
});
