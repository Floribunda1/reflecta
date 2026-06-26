import type { AgentContextRef, AgentEntitySource } from "@shared/agent";

type AgentEntitySourceOrigin = AgentEntitySource["origin"];
type AgentEntityType = AgentContextRef["type"];
type MutableRecord = Record<string, unknown>;

const REF_PATTERN = /^\[\[ref:([A-Za-z0-9_-]+)\]\]$/;
const ENTITY_KEYS = new Set(["understanding", "context", "domain"]);
const ENTITY_ARRAY_KEYS = new Map<string, AgentEntityType>([
  ["understandings", "understanding"],
  ["contexts", "context"],
  ["domains", "domain"],
]);

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entityKey(entity: AgentContextRef) {
  return `${entity.type}:${entity.id}`;
}

function titleFor(value: MutableRecord) {
  return typeof value.title === "string" ? value.title : undefined;
}

function sourceIdIndex(sourceId: string) {
  const match = /^S(\d+)$/.exec(sourceId);
  return match ? Number(match[1]) : 0;
}

function normalizeSourceId(value: string) {
  return REF_PATTERN.exec(value)?.[1] ?? value;
}

export class AgentEntitySourceRegistry {
  private readonly sources = new Map<string, AgentEntitySource>();
  private readonly keyToSourceId = new Map<string, string>();
  private pending: AgentEntitySource[] = [];
  private nextIndex = 1;

  constructor(existing: AgentEntitySource[] = []) {
    for (const source of existing) {
      this.sources.set(source.sourceId, source);
      this.keyToSourceId.set(entityKey(source.entity), source.sourceId);
      this.nextIndex = Math.max(this.nextIndex, sourceIdIndex(source.sourceId) + 1);
    }
  }

  addEntity(entity: AgentContextRef, origin: AgentEntitySourceOrigin): AgentEntitySource {
    const key = entityKey(entity);
    const existingId = this.keyToSourceId.get(key);
    if (existingId) {
      const existing = this.sources.get(existingId);
      if (!existing) throw new Error(`Missing entity source for ${existingId}`);
      const title = entity.title?.trim();
      const next =
        title && title !== existing.entity.title
          ? { ...existing, entity: { ...existing.entity, title } }
          : existing;
      if (next !== existing) {
        this.sources.set(existingId, next);
        this.pending.push(next);
      }
      return next;
    }

    const source: AgentEntitySource = {
      sourceId: `S${this.nextIndex++}`,
      entity,
      origin,
    };
    this.sources.set(source.sourceId, source);
    this.keyToSourceId.set(key, source.sourceId);
    this.pending.push(source);
    return source;
  }

  addUserContextRefs(messageId: string, refs: AgentContextRef[] = []): AgentEntitySource[] {
    return refs.map((ref) => this.addEntity(ref, { kind: "user_context", messageId }));
  }

  decorateToolOutput(toolName: string, toolCallId: string, output: unknown): unknown {
    return this.decorateValue(output, { kind: "tool_result", toolCallId, toolName });
  }

  resolveRef(sourceIdOrMarker: string, expectedType?: AgentEntityType): AgentContextRef | null {
    const source = this.sources.get(normalizeSourceId(sourceIdOrMarker));
    if (!source) return null;
    if (expectedType && source.entity.type !== expectedType) return null;
    return source.entity;
  }

  drainUpdates(): AgentEntitySource[] {
    const updates = this.pending;
    this.pending = [];
    return updates;
  }

  snapshot(): AgentEntitySource[] {
    return [...this.sources.values()];
  }

  private decorateValue(
    value: unknown,
    origin: AgentEntitySourceOrigin,
    parentKey?: string,
  ): unknown {
    if (Array.isArray(value)) {
      const entityType = parentKey ? ENTITY_ARRAY_KEYS.get(parentKey) : undefined;
      return value.map((item) => this.decorateValue(item, origin, entityType));
    }

    if (!isRecord(value)) return value;

    const explicitType =
      parentKey && ENTITY_KEYS.has(parentKey) ? (parentKey as AgentEntityType) : undefined;
    if (explicitType && typeof value.id === "string") {
      return this.decorateEntityObject(explicitType, value, origin);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const nextParent =
          ENTITY_KEYS.has(key) ||
          ENTITY_ARRAY_KEYS.has(key) ||
          key === "candidates" ||
          key === "matchedContexts"
            ? key
            : undefined;
        return [key, this.decorateValue(child, origin, nextParent)];
      }),
    );
  }

  private decorateEntityObject(
    type: AgentEntityType,
    value: MutableRecord,
    origin: AgentEntitySourceOrigin,
  ): MutableRecord {
    const source = this.addEntity({ type, id: String(value.id), title: titleFor(value) }, origin);
    const { id: _id, ...rest } = value;
    return { ref: `[[ref:${source.sourceId}]]`, ...rest };
  }
}
