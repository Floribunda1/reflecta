import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { ipcClient } from "@renderer/utils/ipc";
import { createThoughtWikiLinkSuggestionSource } from "./source";

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

function thought(partial: Partial<ThoughtSummaryDTO> & { id: string }): ThoughtSummaryDTO {
  return {
    id: partial.id,
    type: partial.type ?? "insight",
    title: partial.title ?? null,
    body: partial.body ?? "",
    categoryIds: partial.categoryIds ?? [],
    contextCount: partial.contextCount ?? 0,
    connectionCount: partial.connectionCount ?? 0,
    connectionIds: partial.connectionIds ?? [],
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("thought wiki link suggestion source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses listThoughts for an empty query", async () => {
    vi.mocked(ipcClient.thought.listThoughts).mockResolvedValue([
      thought({ id: "thought-1", title: "Alpha" }),
    ]);

    const source = createThoughtWikiLinkSuggestionSource();
    const items = await source("", new AbortController().signal);

    expect(ipcClient.thought.listThoughts).toHaveBeenCalledOnce();
    expect(ipcClient.search.searchThoughts).not.toHaveBeenCalled();
    expect(items).toEqual([{ id: "thought-1", title: "Alpha", markdown: "[[Alpha#thought-1]]" }]);
  });

  test("uses searchThoughts for a non-empty query", async () => {
    vi.mocked(ipcClient.search.searchThoughts).mockResolvedValue([
      thought({ id: "thought-2", title: null, body: "\nBeta body\nSecond line" }),
    ]);

    const source = createThoughtWikiLinkSuggestionSource();
    const items = await source(" beta ", new AbortController().signal);

    expect(ipcClient.search.searchThoughts).toHaveBeenCalledWith("beta");
    expect(ipcClient.thought.listThoughts).not.toHaveBeenCalled();
    expect(items).toEqual([
      { id: "thought-2", title: "Beta body", markdown: "[[Beta body#thought-2]]" },
    ]);
  });

  test("falls back to a default title and slices results", async () => {
    vi.mocked(ipcClient.thought.listThoughts).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        thought({ id: `thought-${index}`, title: "", body: "" }),
      ),
    );

    const source = createThoughtWikiLinkSuggestionSource();
    const items = await source("", new AbortController().signal);

    expect(items).toHaveLength(8);
    expect(items[0]).toEqual({
      id: "thought-0",
      title: "未命名理解",
      markdown: "[[未命名理解#thought-0]]",
    });
  });
});
