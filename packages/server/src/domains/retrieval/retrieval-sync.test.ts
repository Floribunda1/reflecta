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
  const db = await createDBInstance(join(tempDir, "test.db"), { runMigrations: true });
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

function semanticVectorFor(text: string) {
  const normalized = text.toLocaleLowerCase();
  if (/retrieval-overfetch-query/.test(normalized)) return [1, 0, 0];
  if (/retrieval-overfetch-primary-context/.test(normalized)) return [0.995, 0.01, 0];
  if (/retrieval-overfetch-primary/.test(normalized)) return [1, 0, 0];
  if (/retrieval-overfetch-secondary/.test(normalized)) return [0.98, 0.05, 0];
  if (
    /denseonlysourcewithoutsharedterms|semantic-query|retrieval-vector-feedback|持续改进/.test(
      normalized,
    )
  ) {
    return [1, 0, 0];
  }
  if (/retrieval-vector-environment|自控硬撑/.test(normalized)) return [0, 1, 0];
  if (/retrieval-vector-trading|下单失败/.test(normalized)) return [0, 0, 1];
  return [0, 0, 0];
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
            embedding: semanticVectorFor(text),
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

async function startSlowQueryEmbeddingServer(query: string, delayMs = 1_200) {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string[] };
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      const respond = () => {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            data: inputs.map((text) => ({
              embedding: semanticVectorFor(text),
            })),
          }),
        );
      };
      if (inputs.length === 1 && inputs[0] === query) {
        setTimeout(respond, delayMs);
        return;
      }
      respond();
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
  test("Understanding writes mark retrieval dirty instead of syncing immediately", async () => {
    const { db, understandings } = await setupServices();

    const created = await understandings.createUnderstanding({
      title: "Sync Understanding",
      body: "understandingsyncbeforemarker",
    });
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("understandingsyncbeforemarker")).not.toContain(
      `understanding:${created.id}`,
    );

    await rebuildRetrievalIndexWithStatus(db);
    expect(await indexIds("understandingsyncbeforemarker")).toContain(
      `understanding:${created.id}`,
    );

    await understandings.updateUnderstanding(created.id, {
      body: "understandingsyncaftermarker",
    });
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("understandingsyncbeforemarker")).toContain(
      `understanding:${created.id}`,
    );
    expect(await indexIds("understandingsyncaftermarker")).not.toContain(
      `understanding:${created.id}`,
    );

    await rebuildRetrievalIndexWithStatus(db);
    expect(await indexIds("understandingsyncbeforemarker")).not.toContain(
      `understanding:${created.id}`,
    );
    expect(await indexIds("understandingsyncaftermarker")).toContain(`understanding:${created.id}`);

    await understandings.deleteUnderstanding(created.id);
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("understandingsyncaftermarker")).toContain(`understanding:${created.id}`);

    await rebuildRetrievalIndexWithStatus(db);
    expect(await indexIds("understandingsyncaftermarker")).not.toContain(
      `understanding:${created.id}`,
    );
  });

  test("domain-only Understanding updates mark retrieval dirty instead of syncing immediately", async () => {
    const { db, domains, understandings } = await setupServices();
    const domain = await domains.createDomain({ name: "Dirty Domain" });
    const created = await understandings.createUnderstanding({
      title: "Domain Only Dirty",
      body: "domainonlydirtymarker",
    });
    await rebuildRetrievalIndexWithStatus(db);
    expect(await isRetrievalIndexDirty()).toBe(false);

    await understandings.updateUnderstanding(created.id, { domainIds: [domain.id] });

    expect(await isRetrievalIndexDirty()).toBe(true);
  });

  test("Context writes mark retrieval dirty instead of syncing immediately", async () => {
    const { contexts, db, understandings } = await setupServices();
    const understanding = await understandings.createUnderstanding({
      title: "Sync Context Parent",
      body: "Parent body",
    });
    await rebuildRetrievalIndexWithStatus(db);

    const context = await contexts.createContext({
      understandingId: understanding.id,
      medium: "experience",
      title: "Sync Context",
      content: "contextsyncbeforemarker",
    });
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("contextsyncbeforemarker")).not.toContain(`context:${context.id}`);

    await rebuildRetrievalIndexWithStatus(db);
    expect(await indexIds("contextsyncbeforemarker")).toContain(`context:${context.id}`);

    await contexts.updateContext(context.id, { content: "contextsyncaftermarker" });
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("contextsyncbeforemarker")).toContain(`context:${context.id}`);
    expect(await indexIds("contextsyncaftermarker")).not.toContain(`context:${context.id}`);

    await rebuildRetrievalIndexWithStatus(db);
    expect(await indexIds("contextsyncbeforemarker")).not.toContain(`context:${context.id}`);
    expect(await indexIds("contextsyncaftermarker")).toContain(`context:${context.id}`);

    await contexts.deleteContext(context.id);
    expect(await isRetrievalIndexDirty()).toBe(true);
    expect(await indexIds("contextsyncaftermarker")).toContain(`context:${context.id}`);

    await rebuildRetrievalIndexWithStatus(db);
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
    expect(await getRetrievalIndexStatus()).toMatchObject({ state: "not_ready" });

    await rebuildRetrievalIndexWithStatus(db);
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
    const completed = status.progress?.completed ?? 0;
    const total = status.progress?.total ?? 0;

    expect(status).toMatchObject({
      state: "indexing",
      progress: expect.objectContaining({
        phase: "embedding",
        total: expect.any(Number),
        percent: expect.any(Number),
      }),
    });
    expect(completed).toBeGreaterThan(0);
    expect(completed).toBeLessThan(total);
  });

  test("interactive Understanding search stays lexical-only even when semantic matches exist", async () => {
    const baseUrl = await startEmbeddingServer();
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl,
      modelId: "test-openai-compatible",
    });
    const { db, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Dense Only Picker Source",
      body: "denseonlysourcewithoutsharedterms",
    });

    const rows = await new SearchCore(db).searchUnderstandingIds("semantic-query", { limit: 5 });

    expect(rows.map((row) => row.understandingId)).not.toContain(created.id);
  });

  test("interactive Understanding search returns lexical matches without waiting for query embedding", async () => {
    const keyword = "slowkeywordmarker";
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startSlowQueryEmbeddingServer(keyword),
      modelId: "test-slow-query",
    });
    const { db, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Slow Query Keyword Source",
      body: `This row contains ${keyword}.`,
    });

    const startedAt = Date.now();
    const rows = await new SearchCore(db).searchUnderstandingIds(keyword, { limit: 1 });
    const elapsedMs = Date.now() - startedAt;

    expect(rows.map((row) => row.understandingId)).toContain(created.id);
    expect(elapsedMs).toBeLessThan(700);
  });

  test("interactive Understanding search returns no lexical matches without waiting for query embedding", async () => {
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startSlowQueryEmbeddingServer("semantic-query"),
      modelId: "test-slow-query",
    });
    const { db, understandings } = await setupServices();
    await understandings.createUnderstanding({
      title: "Semantic Only Source",
      body: "denseonlysourcewithoutsharedterms",
    });

    const startedAt = Date.now();
    const rows = await new SearchCore(db).searchUnderstandingIds("semantic-query", { limit: 5 });
    const elapsedMs = Date.now() - startedAt;

    expect(rows).toEqual([]);
    expect(elapsedMs).toBeLessThan(700);
  });

  test("retrieveKnowledge uses configured OpenAI-compatible embeddings for dense recall", async () => {
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startEmbeddingServer(),
      modelId: "test-openai-compatible",
    });
    const { search, understandings } = await setupServices();
    const created = await understandings.createUnderstanding({
      title: "Dense Source",
      body: "denseonlysourcewithoutsharedterms",
    });

    const result = await search.retrieveKnowledge({ query: "semantic-query", limit: 5 });

    expect(result.candidates.map((candidate) => candidate.id)).toContain(created.id);
    expect(result.trace).toMatchObject({
      embeddingModel: "test-openai-compatible",
      dense: { searched: true, hits: 1 },
    });
  });

  test("@AG-RETRIEVAL-003 retrieveKnowledge returns expected semantic candidates within the interactive budget", async () => {
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startEmbeddingServer(),
      modelId: "test-openai-compatible",
    });
    const { search, understandings } = await setupServices();
    const cases = [
      {
        title: "反馈回路让学习形成积累",
        body: "retrieval-vector-feedback 每次实践后的观察会变成下一轮验证标准。",
        query: "怎么让复盘不只是记录而能持续改进",
      },
      {
        title: "环境提示比意志力稳定",
        body: "retrieval-vector-environment 具体场景里的提醒会降低执行成本。",
        query: "怎样减少靠自控硬撑",
      },
      {
        title: "交易亏损要区分判断和纪律",
        body: "retrieval-vector-trading 亏损后要拆开市场假设与执行纪律。",
        query: "一次下单失败后应该怎么复盘",
      },
    ];
    const expectedIds = new Map<string, string>();
    for (const item of cases) {
      const created = await understandings.createUnderstanding({
        title: item.title,
        body: item.body,
      });
      expectedIds.set(item.query, created.id);
    }

    for (const item of cases) {
      const startedAt = Date.now();
      const result = await search.retrieveKnowledge({ query: item.query, limit: 3 });
      const elapsedMs = Date.now() - startedAt;

      expect(result.candidates.map((candidate) => candidate.id)).toContain(
        expectedIds.get(item.query),
      );
      expect(result.trace.dense.hits).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(1_200);
    }
  });

  test("retrieveKnowledge over-fetches retrieval documents before grouping parent candidates", async () => {
    configureRetrievalEmbedding({
      provider: "openai-compatible",
      baseUrl: await startEmbeddingServer(),
      modelId: "test-openai-compatible",
    });
    const { contexts, search, understandings } = await setupServices();
    const primary = await understandings.createUnderstanding({
      title: "Primary overfetch source",
      body: "retrieval-overfetch-primary",
    });
    await contexts.createContext({
      understandingId: primary.id,
      medium: "experience",
      title: "Primary overfetch context",
      content: "retrieval-overfetch-primary-context",
    });
    const secondary = await understandings.createUnderstanding({
      title: "Secondary overfetch source",
      body: "retrieval-overfetch-secondary",
    });

    const result = await search.retrieveKnowledge({ query: "retrieval-overfetch-query", limit: 2 });

    expect(result.candidates.map((candidate) => candidate.id)).toEqual([primary.id, secondary.id]);
    expect(result.trace.fusion.documentsAfterFusion).toBeGreaterThan(2);
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
