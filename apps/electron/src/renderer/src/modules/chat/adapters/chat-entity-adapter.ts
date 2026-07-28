import { useCallback, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  collectChatEntityReferences,
  type ChatEntityBindings,
  type ChatEntityPresentation,
  type ChatEntityReference,
} from "@reflecta/ui/chat";
import { captureQueryKeys, getEntityDisplay, type EntityDisplay } from "../../capture/queries";
import type { InspectableContextRef } from "../context/context-reference";

function referenceKey(reference: Pick<ChatEntityReference, "type" | "id">) {
  return `${reference.type}:${reference.id}`;
}

function typeLabel(reference: ChatEntityReference) {
  if (reference.type === "understanding") return "Understanding";
  if (reference.type === "context") return "Context";
  return "Domain";
}

export function useChatEntityBindings(
  markdownValues: readonly string[],
  onInspect?: (reference: InspectableContextRef) => void,
): ChatEntityBindings {
  const references = useMemo(() => {
    const unique = new Map<string, ChatEntityReference>();
    for (const markdown of markdownValues) {
      for (const reference of collectChatEntityReferences(markdown)) {
        unique.set(referenceKey(reference), reference);
      }
    }
    return [...unique.values()];
  }, [markdownValues]);
  const queries = useQueries({
    queries: references.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
    })),
  });
  const presentations = new Map<string, ChatEntityPresentation>();
  references.forEach((reference, index) => {
    const query = queries[index];
    const fallback = typeLabel(reference);
    if (query.isPending) {
      presentations.set(referenceKey(reference), { state: "loading", label: fallback });
    } else if (query.isError) {
      presentations.set(referenceKey(reference), { state: "error", label: "引用加载失败" });
    } else if (query.data === null) {
      presentations.set(referenceKey(reference), { state: "unavailable", label: "引用不可用" });
    } else {
      const display = query.data as EntityDisplay;
      presentations.set(referenceKey(reference), {
        state: "ready",
        label: display.title || `未命名 ${fallback}`,
        canOpen: reference.type !== "domain",
      });
    }
  });
  const onEntityOpen = useCallback(
    (reference: ChatEntityReference) => {
      if (reference.type === "domain") return;
      onInspect?.({
        type: reference.type,
        id: reference.id,
        title: presentations.get(referenceKey(reference))?.label,
      });
    },
    [onInspect, presentations],
  );

  return {
    resolveEntity: (reference) => presentations.get(referenceKey(reference)),
    onEntityOpen,
  };
}
