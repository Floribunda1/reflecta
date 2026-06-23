import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { ipcClient } from "@renderer/utils/ipc";
import { createUnderstandingWikiLinkSuggestionSource } from "./source";

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

function understanding(
  partial: Partial<UnderstandingSummaryDTO> & { id: string },
): UnderstandingSummaryDTO {
  return {
    id: partial.id,
    title: partial.title ?? null,
    body: partial.body ?? "",
    domainIds: partial.domainIds ?? [],
    contextCount: partial.contextCount ?? 0,
    connectionCount: partial.connectionCount ?? 0,
    connectionIds: partial.connectionIds ?? [],
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("understanding wiki link suggestion source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses listUnderstandings for an empty query", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue([
      understanding({ id: "understanding-1", title: "Alpha" }),
    ]);

    const source = createUnderstandingWikiLinkSuggestionSource();
    const items = await source("", new AbortController().signal);

    expect(ipcClient.understanding.listUnderstandings).toHaveBeenCalledOnce();
    expect(ipcClient.search.searchUnderstandings).not.toHaveBeenCalled();
    expect(items).toEqual([
      { id: "understanding-1", title: "Alpha", markdown: "[[Alpha#understanding-1]]" },
    ]);
  });

  test("uses listUnderstandings search filter for a non-empty query", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue([
      understanding({ id: "understanding-2", title: null, body: "\nBeta body\nSecond line" }),
    ]);

    const source = createUnderstandingWikiLinkSuggestionSource();
    const items = await source(" beta ", new AbortController().signal);

    expect(ipcClient.understanding.listUnderstandings).toHaveBeenCalledWith({
      searchQuery: "beta",
    });
    expect(ipcClient.search.searchUnderstandings).not.toHaveBeenCalled();
    expect(items).toEqual([
      {
        id: "understanding-2",
        title: "Beta body",
        preview: "Beta body Second line",
        markdown: "[[Beta body#understanding-2]]",
      },
    ]);
  });

  test("falls back to a default title and slices results", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        understanding({ id: `understanding-${index}`, title: "", body: "" }),
      ),
    );

    const source = createUnderstandingWikiLinkSuggestionSource();
    const items = await source("", new AbortController().signal);

    expect(items).toHaveLength(8);
    expect(items[0]).toEqual({
      id: "understanding-0",
      title: "未命名理解",
      markdown: "[[未命名理解#understanding-0]]",
    });
  });
});
