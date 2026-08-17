import type { ChatEntityPresentation, ChatEntityReference } from "@reflecta/ui/chat";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { getUnderstandingTitle } from "../understanding-title";

export function entityPresentationKey(reference: Pick<ChatEntityReference, "type" | "id">) {
  return `${reference.type}:${reference.id}`;
}

/** 网格里已有的理解标题，不必再走 getUnderstandingById。 */
export function presentationsFromUnderstandings(
  understandings: readonly UnderstandingSummaryDTO[],
): Map<string, ChatEntityPresentation> {
  const map = new Map<string, ChatEntityPresentation>();
  for (const understanding of understandings) {
    map.set(entityPresentationKey({ type: "understanding", id: understanding.id }), {
      state: "ready",
      label: getUnderstandingTitle(understanding),
      canOpen: true,
    });
  }
  return map;
}

export function remoteEntityReferences(
  references: readonly ChatEntityReference[],
  localPresentations: ReadonlyMap<string, ChatEntityPresentation>,
): ChatEntityReference[] {
  return references.filter(
    (reference) => !localPresentations.has(entityPresentationKey(reference)),
  );
}

export function mergeEntityPresentations(
  localPresentations: ReadonlyMap<string, ChatEntityPresentation>,
  remoteReferences: readonly ChatEntityReference[],
  remoteResults: readonly ({ title: string | null } | null | undefined)[],
): Map<string, ChatEntityPresentation> {
  const map = new Map(localPresentations);
  remoteReferences.forEach((reference, index) => {
    const result = remoteResults[index];
    if (!result) return;
    map.set(entityPresentationKey(reference), {
      state: "ready",
      label: result.title || reference.id,
      canOpen: reference.type !== "domain",
    });
  });
  return map;
}
