import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildUnderstandingCandidates } from "./candidate-builder";
import { LanceDbRetrievalIndex } from "./lancedb-index";
import { LocalEmbeddingProvider } from "./local-embedding";
import { buildRetrievalDocuments } from "./projection";
import type { EmbeddingProvider, RetrievalDocument } from "./types";

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
  readonly modelId = "test-keyword";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const normalized = text.toLocaleLowerCase();
      if (/验收|标准|预期|check/.test(normalized)) return [1, 0, 0];
      if (/debug|workflow|human readable/.test(normalized)) return [0, 1, 0];
      return [0, 0, 1];
    });
  }
}

class RrfEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-rrf";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) =>
      /semantic-match|lexicalterm/.test(text.toLocaleLowerCase()) ? [1, 0] : [0, 1],
    );
  }
}

class SemanticOnlyEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-semantic-only";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const normalized = text.toLocaleLowerCase();
      if (/nonliteral user need/.test(normalized)) return [1, 0];
      if (/nearest semantic candidate/.test(normalized)) return [0.5, 0.8660254];
      return [-1, 0];
    });
  }
}

class DirectionalEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-directional";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const normalized = text.toLocaleLowerCase();
      if (/directional query/.test(normalized)) return [1, 0];
      if (/same semantic direction/.test(normalized)) return [100, 0];
      return [1, 0.2];
    });
  }
}

class ProductTermEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-product-term";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      if (/Query: 同一个经验连接多个理解[\s\S]*Context Understanding/.test(text)) {
        return [1, 0];
      }
      if (/Context can support Understanding/.test(text)) return [1, 0];
      return [0, 1];
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

function rrfDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return [
    {
      id: "understanding:lexical-only",
      entityType: "understanding",
      entityId: "lexical-only",
      parentUnderstandingId: "lexical-only",
      textForEmbedding: "off topic",
      textForLexicalSearch: "lexicalterm contextword lexicalterm",
      metadata,
    },
    {
      id: "understanding:both",
      entityType: "understanding",
      entityId: "both",
      parentUnderstandingId: "both",
      textForEmbedding: "semantic-match",
      textForLexicalSearch: "lexicalterm contextword",
      metadata,
    },
    {
      id: "understanding:semantic-only",
      entityType: "understanding",
      entityId: "semantic-only",
      parentUnderstandingId: "semantic-only",
      textForEmbedding: "semantic-match",
      textForLexicalSearch: "unrelated",
      metadata,
    },
  ];
}

function semanticOnlyDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return [
    {
      id: "understanding:nearest",
      entityType: "understanding",
      entityId: "nearest",
      parentUnderstandingId: "nearest",
      textForEmbedding: "nearest semantic candidate",
      textForLexicalSearch: "plain source text without matching query words",
      metadata,
    },
    {
      id: "understanding:distractor",
      entityType: "understanding",
      entityId: "distractor",
      parentUnderstandingId: "distractor",
      textForEmbedding: "distant semantic candidate",
      textForLexicalSearch: "another unrelated source text",
      metadata,
    },
  ];
}

function directionalDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return [
    {
      id: "understanding:same-direction",
      entityType: "understanding",
      entityId: "same-direction",
      parentUnderstandingId: "same-direction",
      textForEmbedding: "same semantic direction",
      textForLexicalSearch: "source without query words",
      metadata,
    },
    {
      id: "understanding:near-magnitude",
      entityType: "understanding",
      entityId: "near-magnitude",
      parentUnderstandingId: "near-magnitude",
      textForEmbedding: "near magnitude but different direction",
      textForLexicalSearch: "another source without query words",
      metadata,
    },
  ];
}

function productTermDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return [
    {
      id: "understanding:context-term",
      entityType: "understanding",
      entityId: "context-term",
      parentUnderstandingId: "context-term",
      textForEmbedding: "Context can support Understanding",
      textForLexicalSearch: "product vocabulary source",
      metadata,
    },
    {
      id: "understanding:generic-term",
      entityType: "understanding",
      entityId: "generic-term",
      parentUnderstandingId: "generic-term",
      textForEmbedding: "generic unrelated source",
      textForLexicalSearch: "generic source",
      metadata,
    },
  ];
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
          channels: ["lexical"],
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

describe("LocalEmbeddingProvider", () => {
  test("does not match ai inside unrelated words", async () => {
    const [domainVector, aiVector] = await new LocalEmbeddingProvider().embed(["domain", "AI"]);

    expect(Math.hypot(...domainVector)).toBe(0);
    expect(Math.hypot(...aiVector)).toBeGreaterThan(0);
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

  test("RRF boosts documents found by both lexical and dense search", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new RrfEmbeddingProvider(),
    });
    await index.replaceAll(rrfDocs());

    const [topHit] = await index.search("lexicalterm contextword", 3);

    expect(topHit).toMatchObject({
      id: "understanding:both",
      channels: expect.arrayContaining(["lexical", "dense"]),
    });
  });

  test("semantic retrieval returns nearest candidates when lexical terms do not match", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new SemanticOnlyEmbeddingProvider(),
    });
    await index.replaceAll(semanticOnlyDocs());

    const [topHit] = await index.search("nonliteral user need", 3);

    expect(topHit).toMatchObject({
      id: "understanding:nearest",
      channels: ["dense"],
    });
  });

  test("semantic retrieval ranks by vector direction instead of raw magnitude", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new DirectionalEmbeddingProvider(),
    });
    await index.replaceAll(directionalDocs());

    const [topHit] = await index.search("directional query", 2);

    expect(topHit).toMatchObject({
      id: "understanding:same-direction",
      channels: ["dense"],
    });
  });

  test("semantic retrieval embeds queries with retrieval instructions", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new ProductTermEmbeddingProvider(),
    });
    await index.replaceAll(productTermDocs());

    const [topHit] = await index.search("同一个经验连接多个理解", 2);

    expect(topHit).toMatchObject({
      id: "understanding:context-term",
      channels: ["dense"],
    });
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
