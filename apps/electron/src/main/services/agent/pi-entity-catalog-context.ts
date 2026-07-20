import type { ContextEvent, InlineExtension } from "@earendil-works/pi-coding-agent";
import type { AgentEntityCatalogEntry } from "@shared/agent";
import { formatEntityRecordsForPrompt, RUNTIME_ENTITY_CATALOG_OPEN_TAG } from "./agent-citations";

type PiMessage = ContextEvent["messages"][number];

const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const RUNTIME_ENTITY_BLOCK_PATTERN =
  /(?:\n\n)?<reflecta_entities(?: source="reflecta-runtime" version="1")?>\n([\s\S]*?)\n<\/reflecta_entities>/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsRuntimeCatalog(value: unknown): boolean {
  if (typeof value === "string") return value.includes(RUNTIME_ENTITY_CATALOG_OPEN_TAG);
  if (Array.isArray(value)) return value.some(containsRuntimeCatalog);
  return isRecord(value) && Object.values(value).some(containsRuntimeCatalog);
}

function citationFor(type: string, id: string) {
  const prefix = type === "understanding" ? "u" : type === "context" ? "c" : "d";
  return `[[${prefix}:${id}]]`;
}

function isRuntimeEntityRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).sort().join(",") !== "citation,id,title,type") return false;
  const { type, id, citation, title } = value;
  if (type !== "understanding" && type !== "context" && type !== "domain") return false;
  if (typeof id !== "string" || !ENTITY_ID_PATTERN.test(id)) return false;
  if (citation !== citationFor(type, id)) return false;
  return title === null || typeof title === "string";
}

function isRuntimeEntityBlock(body: string): boolean {
  const lines = body.split("\n");
  if (lines.length === 0) return false;
  return lines.every((line) => {
    try {
      return isRuntimeEntityRecord(JSON.parse(line));
    } catch {
      return false;
    }
  });
}

function stripRuntimeEntityBlocks(text: string): string {
  return text.replace(RUNTIME_ENTITY_BLOCK_PATTERN, (block, body: string) =>
    isRuntimeEntityBlock(body) ? "" : block,
  );
}

function stripMessageCatalog(message: PiMessage): PiMessage {
  if (message.role === "user") {
    if (typeof message.content === "string") {
      return { ...message, content: stripRuntimeEntityBlocks(message.content) };
    }
    return {
      ...message,
      content: message.content.map((part) =>
        part.type === "text" ? { ...part, text: stripRuntimeEntityBlocks(part.text) } : part,
      ),
    };
  }
  if (message.role === "toolResult") {
    return {
      ...message,
      content: message.content.map((part) =>
        part.type === "text" ? { ...part, text: stripRuntimeEntityBlocks(part.text) } : part,
      ),
    };
  }
  return message;
}

function appendCatalog(message: PiMessage, catalog: string): PiMessage {
  if (message.role === "user") {
    const content =
      typeof message.content === "string"
        ? [{ type: "text" as const, text: message.content }]
        : message.content;
    return { ...message, content: [...content, { type: "text", text: catalog }] };
  }
  if (message.role === "toolResult") {
    return {
      ...message,
      content: [...message.content, { type: "text", text: catalog }],
    };
  }
  throw new Error("Entity Catalog requires a user or tool-result message");
}

export function projectEntityCatalogMessages(
  messages: ContextEvent["messages"],
  entries: AgentEntityCatalogEntry[],
): ContextEvent["messages"] {
  const projected = messages.map(stripMessageCatalog);
  const catalog = formatEntityRecordsForPrompt(entries);
  if (!catalog) return projected;
  const targetIndex = projected.findLastIndex(
    (message) => message.role === "user" || message.role === "toolResult",
  );
  if (targetIndex < 0) throw new Error("Entity Catalog has no model-visible target message");
  projected[targetIndex] = appendCatalog(projected[targetIndex]!, catalog);
  return projected;
}

function applyAnthropicCacheBoundary(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.messages)) return;
  let catalogBlock: Record<string, unknown> | undefined;
  let candidate: Record<string, unknown> | undefined;
  const cacheableTypes = new Set(["text", "image", "tool_use", "tool_result"]);

  for (const message of payload.messages) {
    if (!isRecord(message) || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (!isRecord(block)) continue;
      if (containsRuntimeCatalog(block)) {
        catalogBlock = block;
        break;
      }
      if (typeof block.type === "string" && cacheableTypes.has(block.type)) candidate = block;
    }
    if (catalogBlock) break;
  }

  if (!catalogBlock || !isRecord(catalogBlock.cache_control) || !candidate) return;
  candidate.cache_control = catalogBlock.cache_control;
  delete catalogBlock.cache_control;
}

function isOpenAiCacheableBlock(value: Record<string, unknown>) {
  return (
    value.type === "input_text" ||
    value.type === "input_image" ||
    value.type === "input_file" ||
    value.type === "text" ||
    value.type === "image_url" ||
    value.type === "input_audio" ||
    value.type === "file" ||
    value.type === "refusal"
  );
}

function applyOpenAiCacheBoundary(payload: Record<string, unknown>) {
  const sequence = Array.isArray(payload.input)
    ? payload.input
    : Array.isArray(payload.messages)
      ? payload.messages
      : undefined;
  if (!sequence) return;
  let candidate: Record<string, unknown> | undefined;

  for (const item of sequence) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.content)) {
      for (const block of item.content) {
        if (!isRecord(block)) continue;
        if (containsRuntimeCatalog(block)) {
          if (candidate) candidate.prompt_cache_breakpoint = { mode: "explicit" };
          return;
        }
        if (isOpenAiCacheableBlock(block)) candidate = block;
      }
      continue;
    }
    if (containsRuntimeCatalog(item)) {
      if (candidate) candidate.prompt_cache_breakpoint = { mode: "explicit" };
      return;
    }
  }
}

export function applyEntityCatalogCacheBoundary(
  payload: unknown,
  model: { provider?: string; id?: string } | undefined,
): unknown {
  if (!isRecord(payload) || !containsRuntimeCatalog(payload)) return payload;
  applyAnthropicCacheBoundary(payload);
  if (model?.provider === "openai" && /^gpt-5\.6(?:-|$)/.test(model.id ?? "")) {
    applyOpenAiCacheBoundary(payload);
  }
  return payload;
}

export function createPiEntityCatalogContext(
  getEntries: () => AgentEntityCatalogEntry[],
): InlineExtension {
  return {
    name: "reflecta-entity-catalog-context",
    factory: (pi) => {
      pi.on("context", (event, ctx) => {
        try {
          return { messages: projectEntityCatalogMessages(event.messages, getEntries()) };
        } catch (error) {
          ctx.abort();
          throw error;
        }
      });
      pi.on("before_provider_request", (event, ctx) =>
        applyEntityCatalogCacheBoundary(event.payload, ctx.model),
      );
    },
  };
}
