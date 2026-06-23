import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildUnderstandingCandidates } from "./candidate-builder";
import { LanceDbRetrievalIndex } from "./lancedb-index";
import { buildRetrievalDocuments } from "./projection";
import type { EmbeddingProvider } from "./types";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function tempIndexDir() {
  const dir = await mkdtemp(join(tmpdir(), "reflecta-lancedb-"));
  tempDirs.push(dir);
  return dir;
}

class KeywordEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const normalized = text.toLocaleLowerCase();
      if (/验收|标准|预期|check/.test(normalized)) return [1, 0, 0];
      if (/debug|workflow|human readable/.test(normalized)) return [0, 1, 0];
      return [0, 0, 1];
    });
  }
}

function sampleDocs() {
  return buildRetrievalDocuments({
    understanding: {
      id: "understanding-1",
      title: "AI 工作流的关键是验收标准，不是提示词堆叠",
      body: "Agent 产出质量取决于是否有明确 check 标准。",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    domains: [{ id: "domain-1", name: "AI / Agent" }],
    contexts: [
      {
        id: "context-1",
        medium: "experience",
        title: "一次写 human readable 文档失败的经历",
        content: "debug 很久后发现问题不是 prompt，而是没有定义 human readable 的标准。",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ],
  });
}

describe("retrieval projection", () => {
  test("context documents carry parent Understanding context", () => {
    const docs = sampleDocs();
    const contextDoc = docs.find((doc) => doc.id === "context:context-1");

    expect(contextDoc).toMatchObject({
      entityType: "context",
      entityId: "context-1",
      parentUnderstandingId: "understanding-1",
      metadata: {
        domainIds: ["domain-1"],
        domainNames: ["AI / Agent"],
        medium: "experience",
      },
    });
    expect(contextDoc?.textForEmbedding).toContain(
      "Parent Understanding: AI 工作流的关键是验收标准，不是提示词堆叠",
    );
    expect(contextDoc?.textForEmbedding).toContain("Domain: AI / Agent");
  });
});

describe("buildUnderstandingCandidates", () => {
  test("folds Context hits back to their parent Understanding", () => {
    const docs = sampleDocs();
    const contextDoc = docs.find((doc) => doc.id === "context:context-1");
    expect(contextDoc).toBeDefined();

    const [candidate] = buildUnderstandingCandidates({
      hits: [
        {
          ...contextDoc!,
          score: 0.9,
          rank: 0,
          snippet: "debug 很久后发现问题不是 prompt",
        },
      ],
      understandings: [
        {
          id: "understanding-1",
          title: "AI 工作流的关键是验收标准，不是提示词堆叠",
          body: "Agent 产出质量取决于是否有明确 check 标准。",
          domains: [{ id: "domain-1", name: "AI / Agent", parentId: null }],
        },
      ],
    });

    expect(candidate).toMatchObject({
      id: "understanding-1",
      type: "understanding",
      matchedContexts: [
        {
          contextId: "context-1",
          title: "一次写 human readable 文档失败的经历",
        },
      ],
      suggestedRead: {
        tool: "understanding_get",
        input: { understandingId: "understanding-1", includeContexts: true },
      },
    });
  });
});

describe("LanceDbRetrievalIndex", () => {
  test("reports readiness after documents are indexed", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new KeywordEmbeddingProvider(),
    });

    expect(await index.isReady()).toBe(false);
    await index.replaceAll(sampleDocs());
    expect(await index.isReady()).toBe(true);
  });

  test("stores RetrievalDocuments and retrieves semantic hits", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new KeywordEmbeddingProvider(),
    });
    await index.replaceAll(sampleDocs());

    const hits = await index.search("AI 产出不符合预期", 5);

    expect(hits.map((hit) => hit.parentUnderstandingId)).toContain("understanding-1");
    expect(hits.some((hit) => hit.id === "context:context-1")).toBe(true);
  });

  test("syncByUnderstandingId replaces all rows for one parent Understanding", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new KeywordEmbeddingProvider(),
    });
    await index.replaceAll(sampleDocs());

    await index.syncByUnderstandingId("understanding-1", []);

    expect(await index.search("验收标准", 5)).toEqual([]);
  });
});
