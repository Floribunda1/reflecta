import { formatEntityReference } from "@reflecta/shared";
import type { AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";

export const RUNTIME_ENTITY_CATALOG_OPEN_TAG =
  '<reflecta_entities source="reflecta-runtime" version="1">';
const RUNTIME_ENTITY_CATALOG_CLOSE_TAG = "</reflecta_entities>";

function entityKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}

export function formatEntityRecordsForPrompt(entries: AgentEntityCatalogEntry[]): string {
  if (entries.length === 0) return "";
  const seen = new Set<string>();
  const records = entries.flatMap(({ entity }) => {
    const key = entityKey(entity);
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      JSON.stringify({
        type: entity.type,
        id: entity.id,
        citation: formatEntityReference({ type: entity.type, id: entity.id }),
        title: entity.title?.trim() || null,
      }),
    ];
  });
  return `\n\n${RUNTIME_ENTITY_CATALOG_OPEN_TAG}\n${records.join("\n")}\n${RUNTIME_ENTITY_CATALOG_CLOSE_TAG}`;
}
