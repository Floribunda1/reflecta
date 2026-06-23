import { beforeEach, describe, expect, test, vi } from "vitest";
import { ipcClient } from "@renderer/utils/ipc";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  buildContextCandidates,
  CONTEXT_LOOKUP_LIMIT,
  shouldSearchContexts,
  type ContextCandidate,
} from "./context-candidates";
import { listMentionUnderstandings } from "./context-mention-lookup";

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    search: {
      searchUnderstandings: vi.fn(),
    },
    understanding: {
      listUnderstandings: vi.fn(),
    },
  },
}));

function understanding(id: string): UnderstandingSummaryDTO {
  return {
    id,
    title: id,
    body: "",
    domainIds: [],
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

  test("uses understanding search for a non-empty query", async () => {
    vi.mocked(ipcClient.search.searchUnderstandings).mockResolvedValue([
      understanding("understanding-search"),
    ]);

    await expect(listMentionUnderstandings(" beta ")).resolves.toEqual([
      understanding("understanding-search"),
    ]);

    expect(ipcClient.search.searchUnderstandings).toHaveBeenCalledWith("beta", {
      limit: CONTEXT_LOOKUP_LIMIT,
    });
    expect(ipcClient.understanding.listUnderstandings).not.toHaveBeenCalled();
  });

  test("uses recent understandings for an empty query", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue([
      understanding("understanding-recent"),
    ]);

    await expect(listMentionUnderstandings("  ")).resolves.toEqual([
      understanding("understanding-recent"),
    ]);

    expect(ipcClient.understanding.listUnderstandings).toHaveBeenCalledWith({
      limit: CONTEXT_LOOKUP_LIMIT,
    });
    expect(ipcClient.search.searchUnderstandings).not.toHaveBeenCalled();
  });

  test("orders understandings, contexts, then filtered domains and removes selected refs", () => {
    const candidates = buildContextCandidates({
      query: "work",
      understandings: [
        { id: "understanding-1", title: "Understanding A", body: "body a" },
        { id: "understanding-2", title: null, body: "fallback body" },
      ] as Parameters<typeof buildContextCandidates>[0]["understandings"],
      contexts: [
        {
          contextId: "context-1",
          title: "Context A",
          snippet: "a <mark>matched</mark> context",
        },
      ] as Parameters<typeof buildContextCandidates>[0]["contexts"],
      domains: [
        { id: "domain-1", name: "work", parentId: null },
        { id: "domain-2", name: "life", parentId: null },
      ] as Parameters<typeof buildContextCandidates>[0]["domains"],
      selected: [{ type: "understanding", id: "understanding-1" }],
    });

    expect(candidates.map(candidateLabel)).toEqual([
      "understanding:understanding-2:fallback body",
      "context:context-1:Context A",
      "domain:domain-1:work",
    ]);
    expect(candidates[1]?.subtitle).toBe("a matched context");
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
