import type { AgentCitationSource, AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";

function entityKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}

function sourceKey(source: Pick<AgentCitationSource, "entity">) {
  return entityKey(source.entity);
}

function titleFor(entity: AgentContextRef) {
  return entity.title?.trim() || `${entity.type}:${entity.id}`;
}

export function buildCitationSources(entries: AgentEntityCatalogEntry[]): AgentCitationSource[] {
  const seen = new Set<string>();
  const sources: AgentCitationSource[] = [];
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    sources.push({
      index: sources.length + 1,
      entity: entry.entity,
      origin: entry.origin,
    });
  }
  return sources;
}

export function mergeCitationSources(
  current: AgentCitationSource[],
  entries: AgentEntityCatalogEntry[],
): AgentCitationSource[] {
  const next = [...current];
  const sourceIndexes = new Map(current.map((source, index) => [sourceKey(source), index]));
  for (const entry of entries) {
    const existingIndex = sourceIndexes.get(entry.key);
    if (existingIndex !== undefined) {
      next[existingIndex] = {
        ...next[existingIndex],
        entity: entry.entity,
        origin: entry.origin,
      };
      continue;
    }
    sourceIndexes.set(entry.key, next.length);
    next.push({
      index: next.length + 1,
      entity: entry.entity,
      origin: entry.origin,
    });
  }
  return next;
}

export function formatCitationSourcesForPrompt(sources: AgentCitationSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources
    .map(
      (source) =>
        `[${source.index}] ${contextTypeLabel(source.entity.type)}: ${titleFor(source.entity)}; id=${source.entity.id}`,
    )
    .join("\n");
  return `\n\nAvailable Reflecta citation sources for the final answer:\n${lines}\n\nUse [n] only in final answer text. Tool calls must use the real id, never [n].`;
}

export function extractCitedSources(
  markdown: string,
  availableSources: AgentCitationSource[],
): AgentCitationSource[] {
  const availableByIndex = new Map(availableSources.map((source) => [source.index, source]));
  const cited = new Set<number>();
  for (const index of citationIndicesOutsideCode(markdown)) {
    if (availableByIndex.has(index)) cited.add(index);
  }
  return [...cited]
    .sort((left, right) => left - right)
    .map((index) => availableByIndex.get(index)!);
}

function citationIndicesOutsideCode(markdown: string): number[] {
  const indices: number[] = [];
  let index = 0;
  let inFence = false;
  let inInlineCode = false;

  while (index < markdown.length) {
    if (!inInlineCode && markdown.startsWith("```", index)) {
      inFence = !inFence;
      index += 3;
      continue;
    }

    const char = markdown[index];
    if (!inFence && char === "`") {
      inInlineCode = !inInlineCode;
      index += 1;
      continue;
    }

    if (!inFence && !inInlineCode && char === "[") {
      const close = markdown.indexOf("]", index + 1);
      const previous = index > 0 ? markdown[index - 1] : "";
      const next = close >= 0 ? markdown[close + 1] : "";
      if (close > index + 1 && previous !== "!" && next !== "(") {
        const label = markdown.slice(index + 1, close);
        if (/^\d+$/.test(label)) {
          indices.push(Number(label));
          index = close + 1;
          continue;
        }
      }
    }

    index += 1;
  }

  return indices;
}

function contextTypeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}
