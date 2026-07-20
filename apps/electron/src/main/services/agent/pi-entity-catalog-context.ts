import type { ContextEvent, InlineExtension } from "@earendil-works/pi-coding-agent";
import type { AgentEntityCatalogEntry } from "@shared/agent";
import { formatEntityRecordsForPrompt } from "./agent-citations";

type PiMessage = ContextEvent["messages"][number];

const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const RUNTIME_ENTITY_BLOCK_PATTERN =
  /(?:\n\n)?<reflecta_entities(?: source="reflecta-runtime" version="1")?>\n([\s\S]*?)\n<\/reflecta_entities>/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function stripRuntimeEntityBlocks(text: string): string {
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
    },
  };
}
