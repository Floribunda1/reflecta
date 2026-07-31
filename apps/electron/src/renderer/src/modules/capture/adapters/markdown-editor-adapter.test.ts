import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { ipcClient } from "@renderer/utils/ipc";
import { getMarkdownEditorSuggestions, uploadMarkdownAsset } from "./markdown-editor-adapter";

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    asset: {
      saveAsset: vi.fn(),
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

describe("Markdown editor adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the final asset URL expected by Markdown", async () => {
    vi.mocked(ipcClient.asset.saveAsset).mockResolvedValue("saved-image.png");
    const file = new File(["image"], "image.png", { type: "image/png" });

    await expect(uploadMarkdownAsset(file, new AbortController().signal)).resolves.toEqual({
      url: "asset:///saved-image.png",
      alt: "image.png",
    });
  });

  test("lists suggestions for an empty query", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue([
      understanding({ id: "understanding-1", title: "Alpha" }),
    ]);

    await expect(getMarkdownEditorSuggestions("", new AbortController().signal)).resolves.toEqual([
      {
        id: "understanding-1",
        type: "understanding",
        label: "Alpha",
        markdown: "[[u:understanding-1]]",
      },
    ]);
    expect(ipcClient.understanding.listUnderstandings).toHaveBeenCalledWith(undefined);
  });

  test("maps searchable records and limits the result", async () => {
    vi.mocked(ipcClient.understanding.listUnderstandings).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        understanding({
          id: `understanding-${index}`,
          title: index === 0 ? null : `Title ${index}`,
          body: index === 0 ? "\nBeta body\nSecond line" : "",
        }),
      ),
    );

    const suggestions = await getMarkdownEditorSuggestions(" beta ", new AbortController().signal);

    expect(ipcClient.understanding.listUnderstandings).toHaveBeenCalledWith({
      searchQuery: "beta",
    });
    expect(suggestions).toHaveLength(8);
    expect(suggestions[0]).toEqual({
      id: "understanding-0",
      type: "understanding",
      label: "Beta body",
      preview: "Beta body Second line",
      markdown: "[[u:understanding-0]]",
    });
  });
});
