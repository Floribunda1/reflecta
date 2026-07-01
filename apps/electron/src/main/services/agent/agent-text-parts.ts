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

export type ValidateFinalAnswerPartsResult =
  | { ok: true; text: string; parts: AgentTextPart[] }
  | { ok: false; error: string };

export function validateFinalAnswerParts(
  parts: AgentTextPart[],
  catalog: AgentEntityCatalogEntry[],
): ValidateFinalAnswerPartsResult {
  const entries = new Map(catalog.map((entry) => [entry.key, entry]));
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
      continue;
    }

    const entry = entries.get(catalogKey(part));
    if (!entry) {
      return { ok: false, error: `引用实体不存在: ${part.entityType}/${part.entityId}` };
    }
    text += entityTitle(entry, part.fallbackText);
  }

  return { ok: true, text, parts };
}
