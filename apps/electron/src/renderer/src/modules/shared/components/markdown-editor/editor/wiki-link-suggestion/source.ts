import type { ThoughtSummaryDTO } from "@shared/thought";
import { ipcClient } from "@renderer/utils/ipc";
import { formatThoughtWikiLink } from "../../wiki-links";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";

const defaultLimit = 8;
const fallbackTitle = "未命名理解";

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
  return {
    id: thought.id,
    title,
    markdown: formatThoughtWikiLink({ id: thought.id, title }),
  };
}

export function createThoughtWikiLinkSuggestionSource(
  limit = defaultLimit,
): WikiLinkSuggestionSource {
  return async (query, signal) => {
    const normalizedQuery = query.trim();
    const thoughts = normalizedQuery
      ? await ipcClient.search.searchThoughts(normalizedQuery)
      : await ipcClient.thought.listThoughts();

    if (signal.aborted) return [];

    return thoughts.slice(0, limit).map(mapThought);
  };
}
