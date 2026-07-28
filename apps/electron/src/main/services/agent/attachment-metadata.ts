import type { AgentFileAttachment } from "@shared/agent";

function reflectaMetadata(file: AgentFileAttachment): Record<string, unknown> {
  const metadata = file.providerMetadata?.reflecta;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

export function attachmentIdFor(file: AgentFileAttachment, index: number) {
  const id = reflectaMetadata(file).attachmentId;
  return typeof id === "string" && id.length > 0 ? id : `inline:${index}`;
}

export function attachmentSizeFor(file: AgentFileAttachment) {
  const size = reflectaMetadata(file).size;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}
