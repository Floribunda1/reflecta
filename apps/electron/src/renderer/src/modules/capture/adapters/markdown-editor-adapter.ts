import {
  formatUnderstandingWikiLink,
  type MarkdownAssetUploader,
  type MarkdownEditorSuggestion,
  type MarkdownEditorSuggestionSource,
} from "@reflecta/ui/editor";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { ipcClient } from "@renderer/utils/ipc";

const suggestionLimit = 8;
const fallbackTitle = "未命名理解";
const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

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
  const preview = understanding.body
    .replace(wikiLinkPattern, "$1")
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
    label,
    ...(preview ? { preview } : {}),
    markdown: formatUnderstandingWikiLink({ id: understanding.id, title: label }),
  };
}

export const uploadMarkdownAsset: MarkdownAssetUploader = async (file, signal) => {
  signal.throwIfAborted();
  const filename = await ipcClient.asset.saveAsset(await file.arrayBuffer(), file.name);
  signal.throwIfAborted();
  return { url: `asset:///${filename}`, alt: file.name };
};

export const getMarkdownEditorSuggestions: MarkdownEditorSuggestionSource = async (
  query,
  signal,
) => {
  const normalizedQuery = query.trim();
  const understandings = await ipcClient.understanding.listUnderstandings(
    normalizedQuery ? { searchQuery: normalizedQuery } : undefined,
  );
  if (signal.aborted) return [];
  return understandings.slice(0, suggestionLimit).map(toSuggestion);
};
