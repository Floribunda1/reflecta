import { isFileUIPart, type FileUIPart } from "ai";
import type { AgentChatMessage } from "@shared/chat";

type ReflectaAttachmentMetadata = {
  attachmentId?: unknown;
  size?: unknown;
};

function reflectaMetadata(part: FileUIPart): ReflectaAttachmentMetadata {
  const metadata = part.providerMetadata?.reflecta;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

export function attachmentIdFor(part: FileUIPart, messageId: string, index: number) {
  const id = reflectaMetadata(part).attachmentId;
  return typeof id === "string" && id.length > 0 ? id : `legacy:${messageId}:${index}`;
}

export function attachmentSizeFor(part: FileUIPart) {
  const size = reflectaMetadata(part).size;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

export function findAttachment(messages: AgentChatMessage[], attachmentId: string) {
  for (const message of messages) {
    for (const [index, part] of message.parts.entries()) {
      if (!isFileUIPart(part)) continue;
      if (attachmentIdFor(part, message.id, index) === attachmentId)
        return { message, part, index };
    }
  }
  return null;
}
