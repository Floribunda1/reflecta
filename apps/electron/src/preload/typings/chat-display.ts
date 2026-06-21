import type { AgentChatMessage, AgentComposerContentNode } from "./chat";

const SERIALIZED_CONTEXT_MENTION_PATTERN =
  /\[\[(?:(thought|context|category):)?([^#\]\n]+)#([^\]\n]+)\]\]/g;

function cleanSerializedMentions(value: string) {
  return value.replace(
    SERIALIZED_CONTEXT_MENTION_PATTERN,
    (_match, _type: string | undefined, title: string) => title,
  );
}

function composerDisplayText(node: AgentComposerContentNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    return typeof node.attrs?.label === "string" ? node.attrs.label : "";
  }
  if (!node.content) return "";
  return node.content.map(composerDisplayText).join(node.type === "doc" ? "\n" : "");
}

function textPartDisplayText(message: AgentChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function filePartDisplayText(message: AgentChatMessage) {
  return message.parts
    .filter((part) => part.type === "file")
    .map((part) => part.filename || part.mediaType)
    .filter(Boolean)
    .join(" ");
}

export function agentMessageDisplayText(message: AgentChatMessage) {
  const composerContent = message.metadata?.composerContent;
  const composerText = composerContent ? composerDisplayText(composerContent).trim() : "";
  return cleanSerializedMentions(
    composerText || textPartDisplayText(message) || filePartDisplayText(message),
  ).trim();
}
