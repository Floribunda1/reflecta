import type {
  AgentCitationSource,
  AgentContextRef,
  AgentEntityCatalogEntry,
  AgentFileAttachment,
} from "@shared/agent";
import {
  selectedAgentContextBlockFromCatalog,
  selectedAgentContextBlockFromRefs,
} from "@shared/agent-context";
import { formatCitationSourcesForPrompt } from "./agent-citations";

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
  return `\n\n用户随消息上传了这些附件。这里只是附件元数据，不包含附件正文；需要正文时使用 attachment_read 读取对应 attachmentId。\n${lines}`;
}

export function buildPiPromptText({
  text,
  contextRefs = [],
  contextCatalog = [],
  citationSources = [],
  files = [],
}: {
  text: string;
  contextRefs?: AgentContextRef[];
  contextCatalog?: AgentEntityCatalogEntry[];
  citationSources?: AgentCitationSource[];
  files?: AgentFileAttachment[];
}): string {
  const contextBlock =
    contextCatalog.length > 0
      ? selectedAgentContextBlockFromCatalog(contextCatalog)
      : selectedAgentContextBlockFromRefs(contextRefs);

  return `${text}${contextBlock}${formatCitationSourcesForPrompt(citationSources)}${attachmentBlockFromFiles(files)}`;
}
