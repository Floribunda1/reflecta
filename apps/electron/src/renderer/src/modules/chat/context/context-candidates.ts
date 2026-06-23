import type { Domain } from "@shared/domain";
import type { AgentContextRef } from "@shared/agent";
import type { SearchContextResult } from "@shared/search";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { truncate } from "../shared/text";
import { contextKey } from "./context-reference";

export const CONTEXT_LOOKUP_LIMIT = 8;

const MARK_TAG_PATTERN = /<\/?mark>/g;

export type ContextCandidate = AgentContextRef & { subtitle?: string };

function understandingCandidate(understanding: UnderstandingSummaryDTO): ContextCandidate {
  return {
    type: "understanding",
    id: understanding.id,
    title: (understanding.title ?? truncate(understanding.body, 48)) || "Untitled Understanding",
    subtitle: truncate(understanding.body, 96),
  };
}

function contextCandidate(context: SearchContextResult): ContextCandidate {
  return {
    type: "context",
    id: context.contextId,
    title: context.title ?? context.contextId,
    subtitle: truncate(context.snippet.replace(MARK_TAG_PATTERN, ""), 96),
  };
}

function domainCandidate(domain: Domain): ContextCandidate {
  return {
    type: "domain",
    id: domain.id,
    title: domain.name,
    subtitle: domain.parentId ? `parent: ${domain.parentId}` : "root domain",
  };
}

export function shouldSearchContexts(enabled: boolean, query: string) {
  return enabled && query.trim().length > 0;
}

export function buildContextCandidates({
  query,
  understandings,
  contexts,
  domains,
  selected,
}: {
  query: string;
  understandings: UnderstandingSummaryDTO[];
  contexts: SearchContextResult[];
  domains: Domain[];
  selected: AgentContextRef[];
}): ContextCandidate[] {
  const selectedKeys = new Set(selected.map(contextKey));
  const normalizedQuery = query.toLowerCase();
  const domainCandidates = domains
    .filter((domain) => !normalizedQuery || domain.name.toLowerCase().includes(normalizedQuery))
    .slice(0, CONTEXT_LOOKUP_LIMIT)
    .map(domainCandidate);

  return [
    ...understandings.slice(0, CONTEXT_LOOKUP_LIMIT).map(understandingCandidate),
    ...contexts.slice(0, CONTEXT_LOOKUP_LIMIT).map(contextCandidate),
    ...domainCandidates,
  ].filter((candidate) => !selectedKeys.has(contextKey(candidate)));
}
