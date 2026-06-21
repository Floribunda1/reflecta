import type { Category } from "@shared/category";
import type { AgentContextRef } from "@shared/chat";
import type { FtsContextResult } from "@shared/search";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { truncate } from "../shared/text";
import { contextKey } from "./context-reference";

export const CONTEXT_LOOKUP_LIMIT = 8;

const MARK_TAG_PATTERN = /<\/?mark>/g;

export type ContextCandidate = AgentContextRef & { subtitle?: string };

function thoughtCandidate(thought: ThoughtSummaryDTO): ContextCandidate {
  return {
    type: "thought",
    id: thought.id,
    title: (thought.title ?? truncate(thought.body, 48)) || "Untitled Thought",
    subtitle: truncate(thought.body, 96),
  };
}

function contextCandidate(context: FtsContextResult): ContextCandidate {
  return {
    type: "context",
    id: context.contextId,
    title: context.sourceName ?? context.contextId,
    subtitle: truncate(context.snippet.replace(MARK_TAG_PATTERN, ""), 96),
  };
}

function categoryCandidate(category: Category): ContextCandidate {
  return {
    type: "category",
    id: category.id,
    title: category.name,
    subtitle: category.parentId ? `parent: ${category.parentId}` : "root category",
  };
}

export function shouldSearchContexts(enabled: boolean, query: string) {
  return enabled && query.trim().length > 0;
}

export function buildContextCandidates({
  query,
  thoughts,
  contexts,
  categories,
  selected,
}: {
  query: string;
  thoughts: ThoughtSummaryDTO[];
  contexts: FtsContextResult[];
  categories: Category[];
  selected: AgentContextRef[];
}): ContextCandidate[] {
  const selectedKeys = new Set(selected.map(contextKey));
  const normalizedQuery = query.toLowerCase();
  const categoryCandidates = categories
    .filter((category) => !normalizedQuery || category.name.toLowerCase().includes(normalizedQuery))
    .slice(0, CONTEXT_LOOKUP_LIMIT)
    .map(categoryCandidate);

  return [
    ...thoughts.slice(0, CONTEXT_LOOKUP_LIMIT).map(thoughtCandidate),
    ...contexts.slice(0, CONTEXT_LOOKUP_LIMIT).map(contextCandidate),
    ...categoryCandidates,
  ].filter((candidate) => !selectedKeys.has(contextKey(candidate)));
}
