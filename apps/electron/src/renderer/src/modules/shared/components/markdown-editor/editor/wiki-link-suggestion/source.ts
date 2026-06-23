import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { ipcClient } from "@renderer/utils/ipc";
import { formatUnderstandingWikiLink } from "../../wiki-links";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";

const defaultLimit = 8;
const fallbackTitle = "未命名理解";
const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

function getUnderstandingTitle(understanding: UnderstandingSummaryDTO): string {
  const title = understanding.title?.trim();
  if (title) return title;

  const firstBodyLine = understanding.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstBodyLine ?? fallbackTitle;
}

function mapUnderstanding(understanding: UnderstandingSummaryDTO): WikiLinkSuggestionItem {
  const title = getUnderstandingTitle(understanding);
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

  const item: WikiLinkSuggestionItem = {
    id: understanding.id,
    title,
    markdown: formatUnderstandingWikiLink({ id: understanding.id, title }),
  };
  if (preview) item.preview = preview;
  return item;
}

export function createUnderstandingWikiLinkSuggestionSource(
  limit = defaultLimit,
): WikiLinkSuggestionSource {
  return async (query, signal) => {
    const normalizedQuery = query.trim();
    const understandings = await ipcClient.understanding.listUnderstandings(
      normalizedQuery ? { searchQuery: normalizedQuery } : undefined,
    );

    if (signal.aborted) return [];

    return understandings.slice(0, limit).map(mapUnderstanding);
  };
}
