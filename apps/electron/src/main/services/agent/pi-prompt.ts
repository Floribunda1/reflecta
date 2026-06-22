import type { AgentContextRef, AgentFileAttachment } from "@shared/agent";
import { selectedContextBlockFromRefs } from "@shared/chat-context";

type ReflectaAttachmentMetadata = {
  attachmentId?: unknown;
  size?: unknown;
};

function reflectaMetadata(file: AgentFileAttachment): ReflectaAttachmentMetadata {
  const metadata = file.providerMetadata?.reflecta;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function attachmentIdFor(file: AgentFileAttachment, index: number) {
  const id = reflectaMetadata(file).attachmentId;
  return typeof id === "string" && id.length > 0 ? id : `inline:${index}`;
}

function attachmentSizeFor(file: AgentFileAttachment) {
  const size = reflectaMetadata(file).size;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

export function attachmentBlockFromFiles(files: AgentFileAttachment[] = []): string {
  if (files.length === 0) return "";
  const lines = files
    .map((file, index) => {
      const name = file.filename || "未命名附件";
      const size = attachmentSizeFor(file);
      return (
        `- ${name}; attachmentId=${attachmentIdFor(file, index)}; mediaType=${file.mediaType}` +
        `${size === undefined ? "" : `; size=${size} bytes`}`
      );
    })
    .join("\n");
  return `\n\n用户随消息上传了这些附件。这里只是附件元数据，不包含附件正文。\n${lines}`;
}

export function buildPiPromptText({
  text,
  contextRefs = [],
  files = [],
}: {
  text: string;
  contextRefs?: AgentContextRef[];
  files?: AgentFileAttachment[];
}): string {
  return `${text}${selectedContextBlockFromRefs(contextRefs)}${attachmentBlockFromFiles(files)}`;
}
