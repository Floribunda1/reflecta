import type { AgentContextRef, AgentEntityCatalogEntry, AgentFileAttachment } from "@shared/agent";
import {
  selectedAgentContextBlockFromCatalog,
  selectedAgentContextBlockFromRefs,
} from "@shared/agent-context";
import { attachmentIdFor, attachmentSizeFor } from "./attachment-metadata";

function attachmentBlockFromFiles(files: AgentFileAttachment[] = []): string {
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
  return `\n\n用户随消息上传了这些附件。这里只是附件元数据，不包含附件正文；需要正文时使用 attachment_read 读取对应 attachmentId。\n${lines}`;
}

export function buildPiPromptText({
  text,
  contextRefs = [],
  contextCatalog = [],
  files = [],
}: {
  text: string;
  contextRefs?: AgentContextRef[];
  contextCatalog?: AgentEntityCatalogEntry[];
  files?: AgentFileAttachment[];
}): string {
  const contextBlock =
    contextCatalog.length > 0
      ? selectedAgentContextBlockFromCatalog(contextCatalog)
      : selectedAgentContextBlockFromRefs(contextRefs);

  return `${text}${contextBlock}${attachmentBlockFromFiles(files)}`;
}
