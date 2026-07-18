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

class QueryInstructionEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-query-instruction";
  readonly inputs: string[] = [];

  async embed(texts: string[]): Promise<number[][]> {
    this.inputs.push(...texts);
    return texts.map((text) => {
      if (text.endsWith("Query: 同一个经验连接多个理解\nContext Understanding")) return [1, 0];
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

function withContentHashes(
  docs: Array<Omit<RetrievalDocument, "contentHash">>,
): RetrievalDocument[] {
  return docs.map((doc) => ({ ...doc, contentHash: doc.id }));
}

function rrfDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return withContentHashes([
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
  ]);
}

function semanticOnlyDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return withContentHashes([
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
  ]);
}

function directionalDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return withContentHashes([
    {
      id: "understanding:same-direction",
      entityType: "understanding",
      entityId: "same-direction",
      parentUnderstandingId: "same-direction",
      textForEmbedding: "same semantic direction",
      textForLexicalSearch: "source without matching words",
      metadata,
    },
    {
      id: "understanding:near-magnitude",
      entityType: "understanding",
      entityId: "near-magnitude",
      parentUnderstandingId: "near-magnitude",
      textForEmbedding: "near magnitude but different direction",
      textForLexicalSearch: "another source without matching words",
      metadata,
    },
  ]);
}

function queryInstructionDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return withContentHashes([
    {
      id: "understanding:relevant",
      entityType: "understanding",
      entityId: "relevant",
      parentUnderstandingId: "relevant",
      textForEmbedding: "Context can support Understanding",
      textForLexicalSearch: "source without query terms",
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
  ]);
}

function keywordBagDocs(): RetrievalDocument[] {
  const metadata = { domainIds: [], domainNames: [] };
  return withContentHashes([
    {
      id: "understanding:insult",
      entityType: "understanding",
      entityId: "insult",
      parentUnderstandingId: "insult",
      textForEmbedding: "off topic one",
      textForLexicalSearch: "被侮辱以后如何维护尊严",
      metadata,
    },
    {
      id: "understanding:criticism",
      entityType: "understanding",
      entityId: "criticism",
      parentUnderstandingId: "criticism",
      textForEmbedding: "off topic two",
      textForLexicalSearch: "如何区分批评和人身攻击",
      metadata,
    },
    {
      id: "understanding:communication",
      entityType: "understanding",
      entityId: "communication",
      parentUnderstandingId: "communication",
      textForEmbedding: "off topic three",
      textForLexicalSearch: "冲突发生后的沟通方式",
      metadata,
    },
  ]);
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

  test("content hashes are stable when source collections arrive in a different order", () => {
    const source = {
      understanding: {
        id: "understanding-stable-hash",
        title: "Stable projection",
        body: "The same projection must produce the same hash.",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      domains: [
        { id: "domain-b", name: "Second" },
        { id: "domain-a", name: "First" },
      ],
      contexts: [
        {
          id: "context-b",
          medium: "note",
          title: "Second context",
          content: "Second context body",
          createdAt: "2026-01-04T00:00:00.000Z",
        },
        {
          id: "context-a",
          medium: "experience",
          title: "First context",
          content: "First context body",
          createdAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    };

    const first = buildRetrievalDocuments(source);
    const second = buildRetrievalDocuments({
      ...source,
      domains: [...source.domains].reverse(),
      contexts: [...source.contexts].reverse(),
    });

    expect(second).toEqual(first);
    expect(first.every((doc) => /^[a-f0-9]{64}$/.test(doc.contentHash))).toBe(true);
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

  test("lexical terms queries return documents that match any keyword", async () => {
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider: new RrfEmbeddingProvider(),
    });
    await index.replaceAll(keywordBagDocs());

    const hits = await index.searchLexical("侮辱 批评 区分 沟通", 5);

    expect(hits.map((hit) => hit.id)).toEqual(
      expect.arrayContaining([
        "understanding:insult",
        "understanding:criticism",
        "understanding:communication",
      ]),
    );
    expect(hits.every((hit) => hit.channels.includes("lexical"))).toBe(true);
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

  test("hybrid retrieval embeds the query with retrieval instructions and product synonyms", async () => {
    const embeddingProvider = new QueryInstructionEmbeddingProvider();
    const index = new LanceDbRetrievalIndex({
      uri: await tempIndexDir(),
      embeddingProvider,
    });
    await index.replaceAll(queryInstructionDocs());

    const [topHit] = await index.search("同一个经验连接多个理解", 2);

    expect(topHit).toMatchObject({
      id: "understanding:relevant",
      channels: ["dense"],
    });
    expect(embeddingProvider.inputs.at(-1)).toBe(
      "Instruct: Given a Reflecta user query, retrieve relevant personal knowledge documents.\n" +
        "Query: 同一个经验连接多个理解\nContext Understanding",
    );
  });
});
