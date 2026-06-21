import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentContextRef } from "@shared/chat";
import {
  buildContextCandidates,
  CONTEXT_LOOKUP_LIMIT,
  shouldSearchContexts,
  type ContextCandidate,
} from "./context-candidates";

export { buildContextCandidates, shouldSearchContexts, type ContextCandidate };

export function useContextMentionLookup({
  disabled,
  selected,
}: {
  disabled: boolean;
  selected: AgentContextRef[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const enabled = open && !disabled;
  const debouncedQuery = useDebounce(query, { wait: 120 });

  const contextThoughtsQuery = useQuery({
    queryKey: ["agent.context.thoughts", debouncedQuery],
    queryFn: () =>
      ipcClient.thought.listThoughts({
        searchQuery: debouncedQuery || undefined,
        limit: CONTEXT_LOOKUP_LIMIT,
      }),
    enabled,
  });

  const contextSearchQuery = useQuery({
    queryKey: ["agent.context.contexts", debouncedQuery],
    queryFn: () => ipcClient.search.searchContexts(debouncedQuery, { limit: CONTEXT_LOOKUP_LIMIT }),
    enabled: shouldSearchContexts(enabled, debouncedQuery),
  });

  const categoriesQuery = useQuery({
    queryKey: ["agent.context.categories"],
    queryFn: () => ipcClient.category.listCategories(),
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
          thoughts: contextThoughtsQuery.data ?? [],
          contexts: contextSearchQuery.data ?? [],
          categories: categoriesQuery.data ?? [],
          selected,
        })
      : [],
    loading:
      contextThoughtsQuery.isFetching ||
      contextSearchQuery.isFetching ||
      categoriesQuery.isFetching,
  };
}
