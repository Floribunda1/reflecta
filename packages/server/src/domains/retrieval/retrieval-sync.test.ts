import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance } from "../../db";
import { ContextCliBff } from "../context/bff-cli";
import { DomainCliBff } from "../domain/bff-cli";
import { SearchCliBff } from "../search/bff-cli";
import { SearchCore } from "../search/core";
import { UnderstandingCliBff } from "../understanding/bff-cli";
import { configureRetrievalEmbedding } from "./embedding-config";
import {
  createRetrievalIndex,
  getRetrievalIndexStatus,
  isRetrievalIndexDirty,
  markRetrievalIndexDirty,
  rebuildRetrievalIndexWithStatus,
} from "./sync";

const tempDirs: string[] = [];
const servers: Server[] = [];
const previousIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;

afterEach(async () => {
  configureRetrievalEmbedding();
  if (previousIndexPath === undefined) {
    delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  } else {
    process.env.REFLECTA_RETRIEVAL_INDEX_PATH = previousIndexPath;
  }
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.length = 0;
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function setupServices() {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-retrieval-sync-"));
  tempDirs.push(tempDir);
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = join(tempDir, "index");
  const db = await createDBInstance(join(tempDir, "test.db"));
  return {
    db,
    contexts: new ContextCliBff(db),
    domains: new DomainCliBff(db),
    search: new SearchCliBff(db),
    understandings: new UnderstandingCliBff(db),
  };
}

async function indexIds(query: string) {
  return (await createRetrievalIndex().search(query, 10)).map((hit) => hit.id);
}

async function startEmbeddingServer() {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string[] };
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: body.input.map((text) => ({
            embedding: /semantic-source|semantic-query/.test(text) ? [1, 0] : [0, 1],
          })),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Embedding server failed to start");
  return `http://127.0.0.1:${address.port}/v1`;
}

async function startPartiallyBlockingEmbeddingServer() {
  let releaseBlockedResponse!: () => void;
  let resolveFirstBatchCompleted!: () => void;
  let requestCount = 0;
  const firstBatchCompleted = new Promise<void>((resolve) => {
    resolveFirstBatchCompleted = resolve;
  });
  const blockedResponseReleased = new Promise<void>((resolve) => {
    releaseBlockedResponse = resolve;
  });
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", async () => {
      requestCount += 1;
      if (requestCount > 1) await blockedResponseReleased;
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string[] };
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: body.input.map(() => ({ embedding: [1, 0] })),
        }),
      );
      if (requestCount === 1) resolveFirstBatchCompleted();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Embedding server failed to start");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    firstBatchCompleted,
    releaseBlockedResponse,
  };
}

async function waitForIndexingProgress() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const status = await getRetrievalIndexStatus();
    if (status.state === "indexing" && status.progress && status.progress.completed > 0) {
      return status;
    }
    await sleep(20);
  }
  return getRetrievalIndexStatus();
}

describe("retrieval index write-path sync", () => {
  test("Understanding create, update, and delete sync retrieval rows", async () => {
    const { understandings } = await setupServices();

    const created = await understandings.createUnderstanding({
      title: "Sync Understanding",
      body: "understandingsyncbeforemarker",
    });
    expect(await indexIds("understandingsyncbeforemarker")).toContain(
      `understanding:${created.id}`,
    );

    await understandings.updateUnderstanding(created.id, {
      body: "understandingsyncaftermarker",
    });
    expect(await indexIds("understandingsyncbeforemarker")).not.toContain(
      `understanding:${created.id}`,
    );
    expect(await indexIds("understandingsyncaftermarker")).toContain(`understanding:${created.id}`);

    await understandings.deleteUnderstanding(created.id);
    expect(await indexIds("understandingsyncaftermarker")).not.toContain(
      `understanding:${created.id}`,
    );
  });

  test("Context create, update, and delete sync parent retrieval rows", async () => {
    const { contexts, understandings } = await setupServices();
    const understanding = await understandings.createUnderstanding({
      title: "Sync Context Parent",
      body: "Parent body",
    });

    const context = await contexts.createContext({
      understandingId: understanding.id,
      medium: "experience",
      title: "Sync Context",
      content: "contextsyncbeforemarker",
    });
    expect(await indexIds("contextsyncbeforemarker")).toContain(`context:${context.id}`);

    await contexts.updateContext(context.id, { content: "contextsyncaftermarker" });
    expect(await indexIds("contextsyncbeforemarker")).not.toContain(`context:${context.id}`);
    expect(await indexIds("contextsyncaftermarker")).toContain(`context:${context.id}`);

    await contexts.deleteContext(context.id);
    expect(await indexIds("contextsyncaftermarker")).not.toContain(`context:${context.id}`);
  });

  test("Chinese context query finds lexical matches", async () => {
    const { contexts, search, understandings } = await setupServices();
    const understanding = await understandings.createUnderstanding({
      title: "中文搜索父理解",
      body: "父理解正文",
    });
    const context = await contexts.createContext({
      understandingId: understanding.id,
      medium: "article",
      title: "说不出口，就无法交易",
      content: "交易系统里有一段热烈讨论。",
    });

    const result = await search.search("热烈", { limit: 5 });

    expect(result.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "context",
          context: expect.objectContaining({ id: context.id }),
        }),
      ]),
    );
  });

  test("retrieveKnowledge rebuilds and clears a dirty retrieval index marker", async () => {
    const { search, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Dirty Marker",
      body: "dirtymarkerterm",
    });

    await markRetrievalIndexDirty();
    expect(await isRetrievalIndexDirty()).toBe(true);

    const result = await search.retrieveKnowledge({ query: "dirtymarkerterm", limit: 5 });

    expect(result.candidates.map((candidate) => candidate.id)).toContain(created.id);
    expect(await isRetrievalIndexDirty()).toBe(false);
  });

  test("retrieval index status follows ready, dirty, and rebuild states", async () => {
    const { db, understandings } = await setupServices();

    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "not_ready" });
    await understandings.createUnderstanding({
      title: "Index Status",
      body: "indexstatusmarker",
    });
    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "ready" });

    await markRetrievalIndexDirty();
    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "dirty" });

    await rebuildRetrievalIndexWithStatus(db);
    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "ready" });
  });

  test("rebuild status advances indexing progress before the rebuild finishes", async () => {
    const { db, understandings } = await setupServices();
    for (let index = 0; index < 40; index += 1) {
      await understandings.createUnderstanding({
        title: `Progress Status ${index}`,
        body: `progressstatusmarker ${index}`,
      });
    }
    const embeddingServer = await startPartiallyBlockingEmbeddingServer();
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: embeddingServer.baseUrl,
      modelId: "test-progress",
    });

    const rebuild = rebuildRetrievalIndexWithStatus(db);
    await embeddingServer.firstBatchCompleted;
    const status = await waitForIndexingProgress();
    embeddingServer.releaseBlockedResponse();
    await rebuild;

    expect(status).toMatchObject({
      state: "indexing",
      progress: expect.objectContaining({
        phase: "embedding",
        total: expect.any(Number),
        percent: expect.any(Number),
      }),
    });
    expect(status.progress?.completed).toBeGreaterThan(0);
    expect(status.progress?.completed).toBeLessThan(status.progress?.total ?? 0);
  });

  test("interactive Understanding search finds semantic matches without shared keywords", async () => {
    const baseUrl = await startEmbeddingServer();
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl,
      modelId: "test-openai-compatible",
    });
    const { db, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Semantic Picker Source",
      body: "semantic-source-without-query-keyword",
    });

    const rows = await new SearchCore(db).searchUnderstandingIds("semantic-query", { limit: 5 });

    expect(rows.map((row) => row.understandingId)).toContain(created.id);
  });

  test("retrieveKnowledge uses configured OpenAI-compatible embeddings for dense recall", async () => {
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startEmbeddingServer(),
      modelId: "test-openai-compatible",
    });
    const { search, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Semantic Source",
      body: "semantic-source-without-query-keyword",
    });

    const result = await search.retrieveKnowledge({ query: "semantic-query", limit: 5 });

    expect(result.candidates.map((candidate) => candidate.id)).toContain(created.id);
    expect(result.trace).toMatchObject({
      embeddingModel: "test-openai-compatible",
      dense: { searched: true, hits: 1 },
    });
  });

  test("retrieveKnowledge expands one-hop explicit Understanding relations from anchors", async () => {
    const { search, understandings } = await setupServices();
    const target = await understandings.createUnderstanding({
      title: "Relation Target",
      body: "Related target body",
    });
    const source = await understandings.createUnderstanding({
      title: "Relation Source",
      body: `See [[Relation Target#${target.id}]]`,
    });

    const result = await search.retrieveKnowledge({
      query: "nohitrelationmarker",
      anchors: [{ type: "understanding", id: source.id }],
      limit: 5,
    });

    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: target.id,
          evidence: expect.arrayContaining([expect.objectContaining({ channel: "relation" })]),
        }),
      ]),
    );
    expect(result.trace.relation.candidates).toBe(1);
    expect(result.trace).toMatchObject({
      embeddingModel: "lexical-only",
      projectionVersion: 2,
      dense: { searched: false },
      fusion: { method: "rrf" },
    });
  });

  test("retrieveKnowledge returns capped direct Understandings from Domain anchors", async () => {
    const { domains, search, understandings } = await setupServices();
    const domain = await domains.createDomain({ name: "Anchor Domain" });
    const first = await understandings.createUnderstanding({
      title: "Domain Anchor A",
      domainIds: [domain.id],
    });
    const second = await understandings.createUnderstanding({
      title: "Domain Anchor B",
      domainIds: [domain.id],
    });

    const result = await search.retrieveKnowledge({
      query: "zzznomtxq",
      anchors: [{ type: "domain", id: domain.id }],
      limit: 1,
    });

    expect(result.candidates).toHaveLength(1);
    expect([first.id, second.id]).toContain(result.candidates[0].id);
    expect(result.candidates[0]).toMatchObject({
      evidence: expect.arrayContaining([expect.objectContaining({ channel: "anchor" })]),
    });
    expect(result.trace.relation.candidates).toBe(1);
  });
});
