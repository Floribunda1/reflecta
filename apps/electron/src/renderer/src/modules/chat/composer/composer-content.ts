import type { AgentContextRef } from "@shared/agent";
import {
  contextKey,
  contextRefFromMention,
  contextTitle,
  mentionId,
} from "../context/context-reference";

export type ComposerJSON = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ComposerJSON[];
};

export function composerContent(text: string, refs: AgentContextRef[] = []): ComposerJSON {
  const content: ComposerJSON[] = refs.flatMap((ref) => [
    { type: "mention", attrs: { id: mentionId(ref), label: contextTitle(ref) } },
    { type: "text", text: " " },
  ]);
  if (text) content.push({ type: "text", text });
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

export function composerTextFromJSON(node: ComposerJSON): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    return typeof node.attrs?.label === "string" ? node.attrs.label : "";
  }
  if (!node.content) return "";
  return node.content.map(composerTextFromJSON).join(node.type === "doc" ? "\n" : "");
}

export function composerRefsFromJSON(node: ComposerJSON) {
  const refs = new Map<string, AgentContextRef>();
  const visit = (current: ComposerJSON) => {
    if (current.type === "mention") {
      const ref = contextRefFromMention(current.attrs?.id, current.attrs?.label);
      if (ref) refs.set(contextKey(ref), ref);
    }
    current.content?.forEach(visit);
  };
  visit(node);
  return [...refs.values()];
}
