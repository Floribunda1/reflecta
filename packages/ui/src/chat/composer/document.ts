import type { ChatComposerEntityReference } from "../entity";
import { entityKey, parseEntityKey } from "../entity-visual";

export type ChatComposerDocumentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ChatComposerDocumentNode[];
};

export type ChatComposerDocument = ChatComposerDocumentNode;

export function createChatComposerDocument(
  text: string,
  entities: readonly ChatComposerEntityReference[] = [],
): ChatComposerDocument {
  const content: ChatComposerDocumentNode[] = entities.flatMap((entity) => [
    {
      type: "mention",
      attrs: { id: entityKey(entity), label: entity.label },
    },
    { type: "text", text: " " },
  ]);
  if (text) content.push({ type: "text", text });
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

export function getChatComposerText(node: ChatComposerDocument): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    return typeof node.attrs?.label === "string" ? node.attrs.label : "";
  }
  if (!node.content) return "";
  return node.content.map(getChatComposerText).join(node.type === "doc" ? "\n" : "");
}

export function getChatComposerEntities(node: ChatComposerDocument): ChatComposerEntityReference[] {
  const entities = new Map<string, ChatComposerEntityReference>();
  const visit = (current: ChatComposerDocumentNode) => {
    if (current.type === "mention") {
      const reference = parseEntityKey(current.attrs?.id);
      const label = current.attrs?.label;
      if (reference && typeof label === "string") {
        entities.set(entityKey(reference), { ...reference, label });
      }
    }
    current.content?.forEach(visit);
  };
  visit(node);
  return [...entities.values()];
}
