import fs from "node:fs";
import type { AgentCitationSource, AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";

const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";

type MutableRecord = Record<string, unknown>;
type MigrationCatalogEntry = {
  entity: AgentContextRef;
  origin?: AgentEntityCatalogEntry["origin"];
};

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entityKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}

function contextType(value: unknown): AgentContextRef["type"] | null {
  return value === "understanding" || value === "context" || value === "domain" ? value : null;
}

function textPart(value: unknown): string | null {
  if (!isRecord(value) || value.type !== "text") return null;
  return typeof value.text === "string" ? value.text : "";
}

function entityRefPart(value: unknown): {
  entityType: AgentContextRef["type"];
  entityId: string;
  fallbackText?: string;
} | null {
  if (!isRecord(value) || value.type !== "entity_ref") return null;
  const entityType = contextType(value.entityType);
  if (!entityType || typeof value.entityId !== "string" || !value.entityId) return null;
  return {
    entityType,
    entityId: value.entityId,
    ...(typeof value.fallbackText === "string" ? { fallbackText: value.fallbackText } : {}),
  };
}

function sourceForEntityRef(
  part: NonNullable<ReturnType<typeof entityRefPart>>,
  catalog: Map<string, MigrationCatalogEntry>,
  byKey: Map<string, AgentCitationSource>,
): { source: AgentCitationSource; label: string } {
  const key = `${part.entityType}:${part.entityId}`;
  const existing = byKey.get(key);
  if (existing) {
    return { source: existing, label: existing.entity.title ?? part.fallbackText ?? part.entityId };
  }

  const catalogEntry = catalog.get(key);
  const label = catalogEntry?.entity.title?.trim() || part.fallbackText?.trim() || part.entityId;
  const source: AgentCitationSource = {
    index: byKey.size + 1,
    entity: { type: part.entityType, id: part.entityId, title: label },
    ...(catalogEntry?.origin ? { origin: catalogEntry.origin } : {}),
  };
  byKey.set(key, source);
  return { source, label };
}

function migrateTextBlock(
  block: MutableRecord,
  catalog: Map<string, MigrationCatalogEntry>,
  citationsByKey: Map<string, AgentCitationSource>,
): { block: MutableRecord; changed: boolean } {
  if (block.kind !== "text" || !Array.isArray(block.parts)) return { block, changed: false };

  const text = block.parts
    .map((part) => {
      const plainText = textPart(part);
      if (plainText !== null) return plainText;
      const ref = entityRefPart(part);
      if (!ref) return "";
      const { source, label } = sourceForEntityRef(ref, catalog, citationsByKey);
      return `${label} [${source.index}]`;
    })
    .join("");

  const rest = { ...block };
  delete rest.parts;
  delete rest.previewText;
  return { block: { ...rest, text }, changed: true };
}

function migrateAssistantTurn(
  event: MutableRecord,
  catalog: Map<string, MigrationCatalogEntry>,
): { event: MutableRecord; changed: boolean } {
  if (event.type !== "assistant.turn" || !Array.isArray(event.blocks)) {
    return { event, changed: false };
  }

  const citationsByKey = new Map<string, AgentCitationSource>();
  let changed = false;
  const blocks = event.blocks.map((block) => {
    if (!isRecord(block)) return block;
    const migrated = migrateTextBlock(block, catalog, citationsByKey);
    changed = changed || migrated.changed;
    return migrated.block;
  });

  if (!changed) return { event, changed: false };

  const text = blocks
    .flatMap((block) =>
      isRecord(block) && block.kind === "text" && typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("");
  const citationSources = [...citationsByKey.values()];
  return {
    event: {
      ...event,
      blocks,
      text,
      ...(citationSources.length > 0 ? { citationSources } : {}),
    },
    changed: true,
  };
}

function applyCatalogUpdate(event: MutableRecord, catalog: Map<string, MigrationCatalogEntry>) {
  if (event.type !== "entity.catalog.updated" || !Array.isArray(event.entries)) return;
  for (const entry of event.entries) {
    if (!isRecord(entry) || !isRecord(entry.entity)) continue;
    const type = contextType(entry.entity.type);
    const id = entry.entity.id;
    if (!type || typeof id !== "string") continue;
    const entity: AgentContextRef = {
      type,
      id,
      ...(typeof entry.entity.title === "string" ? { title: entry.entity.title } : {}),
    };
    const origin =
      isRecord(entry.origin) &&
      (entry.origin.kind === "user_context" || entry.origin.kind === "tool_result")
        ? (entry.origin as AgentEntityCatalogEntry["origin"])
        : undefined;
    catalog.set(entityKey(entity), {
      entity,
      ...(origin ? { origin } : {}),
    });
  }
}

export function migrateAgentSessionFileInlineReferences(sessionFile: string): boolean {
  if (!fs.existsSync(sessionFile)) return false;
  const raw = fs.readFileSync(sessionFile, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const catalog = new Map<string, MigrationCatalogEntry>();
  let changed = false;

  const nextLines = lines.map((line) => {
    const entry = JSON.parse(line) as MutableRecord;
    if (
      entry.type !== "custom" ||
      entry.customType !== REFLECTA_AGENT_EVENT_ENTRY ||
      !isRecord(entry.data)
    ) {
      return line;
    }

    const data = entry.data;
    const migrated = migrateAssistantTurn(data, catalog);
    const nextData = migrated.changed ? migrated.event : data;
    if (migrated.changed) {
      entry.data = nextData;
      changed = true;
    }
    applyCatalogUpdate(nextData, catalog);
    return migrated.changed ? JSON.stringify(entry) : line;
  });

  if (!changed) return false;
  fs.writeFileSync(sessionFile, `${nextLines.join("\n")}\n`, "utf-8");
  return true;
}
