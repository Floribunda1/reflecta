import type { ThoughtSummaryDTO } from "@shared/thought";
import { ipcClient } from "@renderer/utils/ipc";
import { formatThoughtWikiLink } from "../../wiki-links";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";

const defaultLimit = 8;
const fallbackTitle = "未命名理解";
const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

function getThoughtTitle(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;

  const firstBodyLine = thought.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstBodyLine ?? fallbackTitle;
}

function mapThought(thought: ThoughtSummaryDTO): WikiLinkSuggestionItem {
  const title = getThoughtTitle(thought);
  const preview = thought.body
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
    id: thought.id,
    title,
    markdown: formatThoughtWikiLink({ id: thought.id, title }),
  };
  if (preview) item.preview = preview;
  return item;
}

export function createThoughtWikiLinkSuggestionSource(
  limit = defaultLimit,
): WikiLinkSuggestionSource {
  return async (query, signal) => {
    const normalizedQuery = query.trim();
    const thoughts = await ipcClient.thought.listThoughts(
      normalizedQuery ? { searchQuery: normalizedQuery } : undefined,
    );

    if (signal.aborted) return [];

    return thoughts.slice(0, limit).map(mapThought);
  };
}
