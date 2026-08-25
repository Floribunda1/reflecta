import { runPromise } from "@renderer/lib/effect-runtime";
import {
  type MarkdownAssetUploader,
  type MarkdownEditorSuggestion,
  type MarkdownEditorSuggestionSource,
} from "@reflecta/ui/editor";
import { formatEntityReference, replaceEntityReferences } from "@reflecta/shared";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { rpc } from "@renderer/lib/effect-rpc";

const suggestionLimit = 8;
const fallbackTitle = "未命名理解";

function getUnderstandingTitle(understanding: UnderstandingSummaryDTO): string {
  const title = understanding.title?.trim();
  if (title) return title;

  return (
    understanding.body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? fallbackTitle
  );
}

function toSuggestion(understanding: UnderstandingSummaryDTO): MarkdownEditorSuggestion {
  const label = getUnderstandingTitle(understanding);
  const preview = replaceEntityReferences(understanding.body, () => "")
    .replaceAll(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replaceAll(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replaceAll(/[`*_~>#-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return {
    id: understanding.id,
    type: "understanding",
    label,
    ...(preview ? { preview } : {}),
    markdown: formatEntityReference({ type: "understanding", id: understanding.id }),
  };
}

export const uploadMarkdownAsset: MarkdownAssetUploader = async (file, signal) => {
  signal.throwIfAborted();
  const filename = await runPromise(rpc.assetSave(await file.arrayBuffer(), file.name));
  signal.throwIfAborted();
  return { url: `asset:///${filename}`, alt: file.name };
};

export const getMarkdownEditorSuggestions: MarkdownEditorSuggestionSource = async (
  query,
  signal,
) => {
  const normalizedQuery = query.trim();
  const understandings = (await runPromise(
    rpc.understandingList(normalizedQuery ? { searchQuery: normalizedQuery } : undefined),
  )) as unknown as UnderstandingSummaryDTO[];
  if (signal.aborted) return [];
  return understandings.slice(0, suggestionLimit).map(toSuggestion);
};
