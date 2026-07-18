import type { AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";

function entityKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}

function citationPrefix(type: AgentContextRef["type"]) {
  if (type === "understanding") return "u";
  if (type === "context") return "c";
  return "d";
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
        citation: `[[${citationPrefix(entity.type)}:${entity.id}]]`,
        title: entity.title?.trim() || null,
      }),
    ];
  });
  return `\n\n<reflecta_entities>\n${records.join("\n")}\n</reflecta_entities>`;
}
