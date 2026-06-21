import { describe, expect, test } from "vitest";
import {
  buildContextCandidates,
  shouldSearchContexts,
  type ContextCandidate,
} from "./context-candidates";

describe("context mention lookup", () => {
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
