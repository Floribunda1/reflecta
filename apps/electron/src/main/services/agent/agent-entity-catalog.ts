import type { AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";

type AgentEntityCatalogOrigin = AgentEntityCatalogEntry["origin"];
type AgentEntityType = AgentContextRef["type"];
type MutableRecord = Record<string, unknown>;

const ENTITY_KEYS = new Set(["understanding", "context", "domain"]);
const ENTITY_ARRAY_KEYS = new Map<string, AgentEntityType>([
  ["understandings", "understanding"],
  ["contexts", "context"],
  ["domains", "domain"],
  ["nodes", "understanding"],
]);
const TOOL_ROOT_PARENT_KEYS = new Map<string, string>([
  ["domain_list", "domains"],
  ["domain_inspect", "domain"],
  ["understanding_list", "understandings"],
  ["understanding_get", "understanding"],
  ["context_list", "contexts"],
  ["context_get", "context"],
]);
const ENTITY_ID_FIELDS = new Map<string, AgentEntityType>([
  ["understandingId", "understanding"],
  ["sourceUnderstandingId", "understanding"],
  ["targetUnderstandingId", "understanding"],
  ["contextId", "context"],
  ["domainId", "domain"],
  ["parentId", "domain"],
  ["seed", "understanding"],
  ["from", "understanding"],
  ["to", "understanding"],
]);
const ENTITY_ID_ARRAY_FIELDS = new Map<string, AgentEntityType>([
  ["understandingIds", "understanding"],
  ["contextIds", "context"],
  ["domainIds", "domain"],
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

export class AgentEntityCatalog {
  private readonly entries = new Map<string, AgentEntityCatalogEntry>();
  private pending: AgentEntityCatalogEntry[] = [];

  constructor(existing: AgentEntityCatalogEntry[] = []) {
    for (const entry of existing) this.entries.set(entry.key, entry);
  }

  addEntity(entity: AgentContextRef, origin: AgentEntityCatalogOrigin): AgentEntityCatalogEntry {
    const key = entityKey(entity);
    const existing = this.entries.get(key);
    if (existing) {
      const title = entity.title?.trim();
      const next =
        title && title !== existing.entity.title
          ? { ...existing, entity: { ...existing.entity, title } }
          : existing;
      if (next !== existing) {
        this.entries.set(key, next);
        this.pending.push(next);
      }
      return next;
    }

    const entry: AgentEntityCatalogEntry = { key, entity, origin };
    this.entries.set(key, entry);
    this.pending.push(entry);
    return entry;
  }

  addUserContextRefs(messageId: string, refs: AgentContextRef[] = []): AgentEntityCatalogEntry[] {
    return refs.map((ref) => this.addEntity(ref, { kind: "user_context", messageId }));
  }

  collectToolOutput(toolName: string, toolCallId: string, output: unknown): void {
    const origin = { kind: "tool_result" as const, toolCallId, toolName };
    if (toolName === "retrieve_knowledge") {
      this.collectRetrievalValue(output, origin);
      return;
    }
    this.collectValue(output, origin, TOOL_ROOT_PARENT_KEYS.get(toolName));
  }

  drainUpdates(): AgentEntityCatalogEntry[] {
    const updates = this.pending;
    this.pending = [];
    return updates;
  }

  snapshot(): AgentEntityCatalogEntry[] {
    return [...this.entries.values()];
  }

  private collectValue(value: unknown, origin: AgentEntityCatalogOrigin, parentKey?: string): void {
    if (Array.isArray(value)) {
      const entityType = parentKey ? ENTITY_ARRAY_KEYS.get(parentKey) : undefined;
      for (const item of value) this.collectValue(item, origin, entityType);
      return;
    }

    if (!isRecord(value)) return;

    const explicitType =
      parentKey && ENTITY_KEYS.has(parentKey) ? (parentKey as AgentEntityType) : undefined;
    if (explicitType && typeof value.id === "string") {
      this.addEntity({ type: explicitType, id: value.id, title: titleFor(value) }, origin);
    }

    for (const [key, child] of Object.entries(value)) {
      this.collectRelationship(key, child, origin);
      const nextParent =
        ENTITY_KEYS.has(key) ||
        ENTITY_ARRAY_KEYS.has(key) ||
        key === "candidates" ||
        key === "matchedContexts"
          ? key
          : undefined;
      this.collectValue(child, origin, nextParent);
    }
  }

  private collectRelationship(key: string, value: unknown, origin: AgentEntityCatalogOrigin): void {
    if (key === "contextsByUnderstandingId" && isRecord(value)) {
      for (const [understandingId, contexts] of Object.entries(value)) {
        this.addEntity({ type: "understanding", id: understandingId }, origin);
        this.collectValue(contexts, origin, "contexts");
      }
      return;
    }

    const scalarType = ENTITY_ID_FIELDS.get(key);
    if (scalarType && typeof value === "string") {
      this.addEntity({ type: scalarType, id: value }, origin);
      return;
    }

    const arrayType = ENTITY_ID_ARRAY_FIELDS.get(key);
    if (arrayType && Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") this.addEntity({ type: arrayType, id: item }, origin);
      }
    }
  }

  private collectRetrievalValue(
    value: unknown,
    origin: AgentEntityCatalogOrigin,
    parentKey?: string,
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) this.collectRetrievalValue(item, origin, parentKey);
      return;
    }

    if (!isRecord(value)) return;

    if (parentKey === "candidates" && typeof value.id === "string") {
      this.addEntity({ type: "understanding", id: value.id, title: titleFor(value) }, origin);
    }

    if (parentKey === "matchedContexts" && typeof value.contextId === "string") {
      this.addEntity({ type: "context", id: value.contextId, title: titleFor(value) }, origin);
    }

    if (isRecord(value.suggestedRead) && isRecord(value.suggestedRead.input)) {
      const understandingId = value.suggestedRead.input.understandingId;
      if (typeof understandingId === "string") {
        this.addEntity({ type: "understanding", id: understandingId }, origin);
      }
    }

    this.collectValue(value, origin, parentKey);
    for (const [key, child] of Object.entries(value)) {
      const nextParent = key === "candidates" || key === "matchedContexts" ? key : undefined;
      this.collectRetrievalValue(child, origin, nextParent);
    }
  }
}
