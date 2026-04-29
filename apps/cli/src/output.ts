export type OutputFormat = "json" | "jsonl";

export function writeData(data: unknown, format: OutputFormat): void {
  if (data === undefined || data === null) return;
  if (format === "jsonl" && Array.isArray(data)) {
    for (const item of data) {
      console.log(JSON.stringify(item));
    }
  } else {
    console.log(JSON.stringify(data));
  }
}

export function writeError(code: string, message: string, details?: unknown): void {
  const obj: Record<string, unknown> = { code, message };
  if (details !== undefined) {
    obj.details = details;
  }
  console.error(JSON.stringify(obj));
}
