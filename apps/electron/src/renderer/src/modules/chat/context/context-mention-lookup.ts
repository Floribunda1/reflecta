import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentContextRef } from "@shared/agent";
import {
  buildContextCandidates,
  CONTEXT_LOOKUP_LIMIT,
  shouldSearchContexts,
  type ContextCandidate,
} from "./context-candidates";

export { buildContextCandidates, shouldSearchContexts, type ContextCandidate };

export function listMentionUnderstandings(query: string) {
  const normalizedQuery = query.trim();
  return normalizedQuery
    ? ipcClient.search.searchUnderstandings(normalizedQuery, { limit: CONTEXT_LOOKUP_LIMIT })
    : ipcClient.understanding.listUnderstandings({ limit: CONTEXT_LOOKUP_LIMIT });
}

export function useContextMentionLookup({ selected }: { selected: AgentContextRef[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const enabled = open;
  const debouncedQuery = useDebounce(query, { wait: 120 });

  const contextUnderstandingsQuery = useQuery({
    queryKey: ["agent.context.understandings", debouncedQuery],
    queryFn: () => listMentionUnderstandings(debouncedQuery),
    enabled,
  });

  const contextSearchQuery = useQuery({
    queryKey: ["agent.context.contexts", debouncedQuery],
    queryFn: () => ipcClient.search.searchContexts(debouncedQuery, { limit: CONTEXT_LOOKUP_LIMIT }),
    enabled: shouldSearchContexts(enabled, debouncedQuery),
  });

  const domainsQuery = useQuery({
    queryKey: ["agent.context.domains"],
    queryFn: () => ipcClient.domain.listDomains(),
    enabled,
    staleTime: 60_000,
  });

  return {
    isOpen: enabled,
    query,
    setQuery,
    open: (nextQuery: string) => {
      setOpen(true);
      setQuery(nextQuery);
    },
    close: () => {
      setOpen(false);
      setQuery("");
    },
    candidates: enabled
      ? buildContextCandidates({
          query: debouncedQuery,
          understandings: contextUnderstandingsQuery.data ?? [],
          contexts: contextSearchQuery.data ?? [],
          domains: domainsQuery.data ?? [],
          selected,
        })
      : [],
    loading:
      contextUnderstandingsQuery.isFetching ||
      contextSearchQuery.isFetching ||
      domainsQuery.isFetching,
  };
}
