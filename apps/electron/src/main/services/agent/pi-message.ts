function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractPiAssistantText(message: unknown): string {
  if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter(
      (part): part is Record<string, unknown> =>
        isRecord(part) && part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
}

export function extractPiAssistantError(message: unknown): string {
  if (!isRecord(message) || message.role !== "assistant" || message.stopReason !== "error") {
    return "";
  }
  return typeof message.errorMessage === "string" ? message.errorMessage : "";
}
