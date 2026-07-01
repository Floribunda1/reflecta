import type { AgentEntityCatalogEntry, AgentTextPart } from "@shared/agent";

function catalogKey(part: Extract<AgentTextPart, { type: "entity_ref" }>) {
  return `${part.entityType}:${part.entityId}`;
}

function entityTitle(entry: AgentEntityCatalogEntry, fallbackText: string | undefined) {
  return entry.entity.title?.trim() || fallbackText || entry.entity.id;
}

export function normalizeAgentTextParts(
  parts: AgentTextPart[],
  catalog: AgentEntityCatalogEntry[],
): { text: string; parts: AgentTextPart[] } {
  const entries = new Map(catalog.map((entry) => [entry.key, entry]));
  const normalized: AgentTextPart[] = [];
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
      normalized.push(part);
      continue;
    }

    const entry = entries.get(catalogKey(part));
    if (!entry) {
      const fallback = part.fallbackText ?? "";
      text += fallback;
      normalized.push({ type: "text", text: fallback });
      continue;
    }

    text += entityTitle(entry, part.fallbackText);
    normalized.push(part);
  }

  return { text, parts: normalized };
}
