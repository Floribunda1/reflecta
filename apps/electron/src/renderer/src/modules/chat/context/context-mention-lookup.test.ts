import { beforeEach, describe, expect, test, vi } from "vitest";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";
import {
  buildContextCandidates,
  CONTEXT_LOOKUP_LIMIT,
  shouldSearchContexts,
  type ContextCandidate,
} from "./context-candidates";
import { listMentionThoughts } from "./context-mention-lookup";

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    search: {
      searchThoughts: vi.fn(),
    },
    thought: {
      listThoughts: vi.fn(),
    },
  },
}));

function thought(id: string): ThoughtSummaryDTO {
  return {
    id,
    title: id,
    body: "",
    categoryIds: [],
    contextCount: 0,
    connectionCount: 0,
    connectionIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("context mention lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses thought search for a non-empty query", async () => {
    vi.mocked(ipcClient.search.searchThoughts).mockResolvedValue([thought("thought-search")]);

    await expect(listMentionThoughts(" beta ")).resolves.toEqual([thought("thought-search")]);

    expect(ipcClient.search.searchThoughts).toHaveBeenCalledWith("beta", {
      limit: CONTEXT_LOOKUP_LIMIT,
    });
    expect(ipcClient.thought.listThoughts).not.toHaveBeenCalled();
  });

  test("uses recent thoughts for an empty query", async () => {
    vi.mocked(ipcClient.thought.listThoughts).mockResolvedValue([thought("thought-recent")]);

    await expect(listMentionThoughts("  ")).resolves.toEqual([thought("thought-recent")]);

    expect(ipcClient.thought.listThoughts).toHaveBeenCalledWith({ limit: CONTEXT_LOOKUP_LIMIT });
    expect(ipcClient.search.searchThoughts).not.toHaveBeenCalled();
  });

  test("orders thoughts, contexts, then filtered categories and removes selected refs", () => {
    const candidates = buildContextCandidates({
      query: "work",
      thoughts: [
        { id: "thought-1", title: "Thought A", body: "body a" },
        { id: "thought-2", title: null, body: "fallback body" },
      ] as Parameters<typeof buildContextCandidates>[0]["thoughts"],
      contexts: [
        {
          contextId: "context-1",
          sourceName: "Source A",
          snippet: "a <mark>matched</mark> source",
        },
      ] as Parameters<typeof buildContextCandidates>[0]["contexts"],
      categories: [
        { id: "category-1", name: "work", parentId: null },
        { id: "category-2", name: "life", parentId: null },
      ] as Parameters<typeof buildContextCandidates>[0]["categories"],
      selected: [{ type: "thought", id: "thought-1" }],
    });

    expect(candidates.map(candidateLabel)).toEqual([
      "thought:thought-2:fallback body",
      "context:context-1:Source A",
      "category:category-1:work",
    ]);
    expect(candidates[1]?.subtitle).toBe("a matched source");
  });

  test("disables context search for empty query", () => {
    expect(shouldSearchContexts(true, "")).toBe(false);
    expect(shouldSearchContexts(true, "   ")).toBe(false);
    expect(shouldSearchContexts(false, "workflow")).toBe(false);
    expect(shouldSearchContexts(true, "workflow")).toBe(true);
  });
});

function candidateLabel(candidate: ContextCandidate) {
  return `${candidate.type}:${candidate.id}:${candidate.title}`;
}
