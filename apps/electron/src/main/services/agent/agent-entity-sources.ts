import { customAlphabet } from "nanoid";
import type { AgentContextRef, AgentEntitySource } from "@shared/agent";

type AgentEntitySourceOrigin = AgentEntitySource["origin"];
type AgentEntityType = AgentContextRef["type"];
type MutableRecord = Record<string, unknown>;
type SourceIdFactory = () => string;

const createRandomSourceId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
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
const ENTITY_ID_FIELDS = new Map<string, { type: AgentEntityType; refKey: string }>([
  ["understandingId", { type: "understanding", refKey: "understandingRef" }],
  ["sourceUnderstandingId", { type: "understanding", refKey: "sourceUnderstandingRef" }],
  ["targetUnderstandingId", { type: "understanding", refKey: "targetUnderstandingRef" }],
  ["contextId", { type: "context", refKey: "contextRef" }],
  ["domainId", { type: "domain", refKey: "domainRef" }],
  ["parentId", { type: "domain", refKey: "parentRef" }],
  ["seed", { type: "understanding", refKey: "seedRef" }],
  ["from", { type: "understanding", refKey: "fromRef" }],
  ["to", { type: "understanding", refKey: "toRef" }],
]);
const ENTITY_ID_ARRAY_FIELDS = new Map<string, { type: AgentEntityType; refKey: string }>([
  ["understandingIds", { type: "understanding", refKey: "understandingRefs" }],
  ["contextIds", { type: "context", refKey: "contextRefs" }],
  ["domainIds", { type: "domain", refKey: "domainRefs" }],
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

function randomSourceId() {
  return `rf_${createRandomSourceId()}`;
}

export class AgentEntitySourceRegistry {
  private readonly sources = new Map<string, AgentEntitySource>();
  private readonly keyToSourceId = new Map<string, string>();
  private pending: AgentEntitySource[] = [];

  constructor(
    existing: AgentEntitySource[] = [],
    private readonly createSourceId: SourceIdFactory = randomSourceId,
  ) {
    for (const source of existing) {
      this.sources.set(source.sourceId, source);
      const key = entityKey(source.entity);
      if (!this.keyToSourceId.has(key)) this.keyToSourceId.set(key, source.sourceId);
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
      sourceId: this.nextSourceId(),
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
    const origin = { kind: "tool_result" as const, toolCallId, toolName };
    const retrievalOutput =
      toolName === "retrieve_knowledge" ? this.decorateRetrievalValue(output, origin) : output;
    return this.decorateValue(retrievalOutput, origin, TOOL_ROOT_PARENT_KEYS.get(toolName));
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
      Object.entries(value).flatMap(([key, child]) => {
        const relationship = this.decorateRelationshipEntries(key, child, origin);
        if (relationship) return relationship;
        const nextParent =
          ENTITY_KEYS.has(key) ||
          ENTITY_ARRAY_KEYS.has(key) ||
          key === "candidates" ||
          key === "matchedContexts"
            ? key
            : undefined;
        return [[key, this.decorateValue(child, origin, nextParent)]];
      }),
    );
  }

  private decorateEntityObject(
    type: AgentEntityType,
    value: MutableRecord,
    origin: AgentEntitySourceOrigin,
  ): MutableRecord {
    const id = String(value.id);
    this.addEntity({ type, id, title: titleFor(value) }, origin);
    const rest = value;
    const decoratedRest = this.decorateValue(rest, origin);
    return {
      id,
      ref: this.entityRef(type, id),
      ...(isRecord(decoratedRest) ? decoratedRest : rest),
    };
  }

  private decorateRelationshipEntries(
    key: string,
    value: unknown,
    origin: AgentEntitySourceOrigin,
  ): Array<[string, unknown]> | null {
    if (key === "contextsByUnderstandingId" && isRecord(value)) {
      return [
        [
          key,
          Object.fromEntries(
            Object.entries(value).map(([understandingId, contexts]) => [
              understandingId,
              this.decorateValue(contexts, origin, "contexts"),
            ]),
          ),
        ],
        [
          "contextsByUnderstandingRef",
          Object.entries(value).map(([understandingId, contexts]) => ({
            understandingId,
            understandingRef: this.entityMarker("understanding", understandingId, origin),
            contexts: this.decorateValue(contexts, origin, "contexts"),
          })),
        ],
      ];
    }

    const scalar = ENTITY_ID_FIELDS.get(key);
    if (scalar) {
      return [
        [key, value],
        [
          scalar.refKey,
          typeof value === "string" ? this.entityMarker(scalar.type, value, origin) : null,
        ],
      ];
    }

    const array = ENTITY_ID_ARRAY_FIELDS.get(key);
    if (array && Array.isArray(value)) {
      return [
        [key, value],
        [
          array.refKey,
          value
            .filter((item): item is string => typeof item === "string")
            .map((id) => this.entityMarker(array.type, id, origin)),
        ],
      ];
    }

    return null;
  }

  private entityMarker(type: AgentEntityType, id: string, origin: AgentEntitySourceOrigin): string {
    this.addEntity({ type, id }, origin);
    return this.entityRef(type, id);
  }

  private entityRef(type: AgentEntityType, id: string): string {
    return `[[${type}:${id}]]`;
  }

  private nextSourceId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const sourceId = this.createSourceId();
      if (sourceId && !this.sources.has(sourceId)) return sourceId;
    }
    throw new Error("Unable to allocate entity source id");
  }

  private decorateRetrievalValue(
    value: unknown,
    origin: AgentEntitySourceOrigin,
    parentKey?: string,
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.decorateRetrievalValue(item, origin, parentKey));
    }

    if (!isRecord(value)) return value;

    const normalized =
      parentKey === "candidates" && typeof value.id === "string"
        ? this.decorateFlatRetrievalUnderstanding(value, origin)
        : parentKey === "matchedContexts" && typeof value.contextId === "string"
          ? this.decorateFlatRetrievalContext(value, origin)
          : value;

    return Object.fromEntries(
      Object.entries(normalized).map(([key, child]) => {
        if (key === "suggestedRead") return [key, this.decorateSuggestedRead(child, origin)];
        const nextParent = key === "candidates" || key === "matchedContexts" ? key : undefined;
        return [key, this.decorateRetrievalValue(child, origin, nextParent)];
      }),
    );
  }

  private decorateFlatRetrievalUnderstanding(
    value: MutableRecord,
    origin: AgentEntitySourceOrigin,
  ): MutableRecord {
    const id = String(value.id);
    this.addEntity({ type: "understanding", id, title: titleFor(value) }, origin);
    return { ...value, id, ref: this.entityRef("understanding", id) };
  }

  private decorateFlatRetrievalContext(
    value: MutableRecord,
    origin: AgentEntitySourceOrigin,
  ): MutableRecord {
    const contextId = String(value.contextId);
    this.addEntity({ type: "context", id: contextId, title: titleFor(value) }, origin);
    return { ...value, contextId, ref: this.entityRef("context", contextId) };
  }

  private decorateSuggestedRead(value: unknown, origin: AgentEntitySourceOrigin): unknown {
    if (!isRecord(value) || !isRecord(value.input)) return value;
    const understandingId = value.input.understandingId;
    if (typeof understandingId !== "string") return value;

    this.addEntity({ type: "understanding", id: understandingId }, origin);
    return value;
  }
}
