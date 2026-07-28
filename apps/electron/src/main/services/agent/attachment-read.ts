import { TextDecoder } from "node:util";
import { isBinaryFile } from "isbinaryfile";
import { extractText } from "unpdf";
import type { AgentFileAttachment } from "@shared/agent";
import { attachmentIdFor } from "./attachment-metadata";

type AttachmentReadToolInput = {
  attachmentId: string;
  maxChars?: number;
};

const DEFAULT_ATTACHMENT_READ_MAX_CHARS = 120_000;
export const HARD_ATTACHMENT_READ_MAX_CHARS = 500_000;

function clampInt(value: number | undefined, fallback: number, max: number) {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 1), max);
}

function truncateChars(value: string, limit: number) {
  if (value.length <= limit) return { value, truncated: false };
  return { value: value.slice(0, limit), truncated: true };
}

function parseDataUrl(url: string, fallbackMediaType: string) {
  const match = /^data:([^,]*),([\s\S]*)$/i.exec(url);
  if (!match) return null;
  const header = match[1] ?? "";
  const mediaType = header.split(";")[0] || fallbackMediaType;
  try {
    const buffer = /(?:^|;)base64(?:;|$)/i.test(header)
      ? Buffer.from(match[2] ?? "", "base64")
      : Buffer.from(decodeURIComponent(match[2] ?? ""), "utf8");
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

function isPdf(mediaType: string, buffer: Buffer) {
  return (
    mediaType.toLowerCase() === "application/pdf" ||
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  );
}

function decodeWithBom(buffer: Buffer) {
  try {
    if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
      return {
        encoding: "utf8-bom",
        content: new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(3)),
      };
    }
    if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) {
      return {
        encoding: "utf16le-bom",
        content: new TextDecoder("utf-16le", { fatal: true }).decode(buffer.subarray(2)),
      };
    }
    if (buffer.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
      return {
        encoding: "utf16be-bom",
        content: new TextDecoder("utf-16be", { fatal: true }).decode(buffer.subarray(2)),
      };
    }
  } catch {
    return { error: "附件带有文本 BOM，但内容无法可靠解码。" };
  }
  return null;
}

function decodeUtf8(buffer: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

export async function readAttachmentForTool(
  files: AgentFileAttachment[],
  input: AttachmentReadToolInput,
) {
  const found = files.find((file, index) => attachmentIdFor(file, index) === input.attachmentId);
  if (!found) return { attachmentId: input.attachmentId, error: "找不到这个附件。" };

  const parsed = parseDataUrl(found.url, found.mediaType);
  const base = {
    attachmentId: input.attachmentId,
    filename: found.filename,
    mediaType: parsed?.mediaType ?? found.mediaType,
    bytes: parsed?.buffer.length ?? 0,
  };
  if (!parsed) return { ...base, error: "附件不是可读取的 data URL。" };

  const limit = clampInt(
    input.maxChars,
    DEFAULT_ATTACHMENT_READ_MAX_CHARS,
    HARD_ATTACHMENT_READ_MAX_CHARS,
  );

  if (isPdf(parsed.mediaType, parsed.buffer)) {
    try {
      const extracted = await extractText(new Uint8Array(parsed.buffer), { mergePages: true });
      const content = truncateChars(extracted.text, limit);
      return {
        ...base,
        kind: "pdf",
        encoding: "pdf-text",
        totalPages: extracted.totalPages,
        content: content.value,
        truncated: content.truncated,
      };
    } catch (error) {
      return { ...base, kind: "pdf", error: `PDF 文本提取失败：${String(error)}` };
    }
  }

  const bom = decodeWithBom(parsed.buffer);
  if (bom) {
    if ("error" in bom) return { ...base, kind: "text", error: bom.error };
    const content = truncateChars(bom.content, limit);
    return {
      ...base,
      kind: "text",
      encoding: bom.encoding,
      content: content.value,
      truncated: content.truncated,
    };
  }

  if (await isBinaryFile(parsed.buffer, { size: parsed.buffer.length })) {
    return { ...base, kind: "binary", error: "附件看起来是二进制文件，当前工具不会返回 base64。" };
  }

  const decoded = decodeUtf8(parsed.buffer);
  if (decoded === null) {
    return {
      ...base,
      kind: "text",
      error: "附件看起来像文本，但不是有效 UTF-8/BOM 编码，暂时无法可靠解码。",
    };
  }
  const content = truncateChars(decoded, limit);
  return {
    ...base,
    kind: "text",
    encoding: "utf8",
    content: content.value,
    truncated: content.truncated,
  };
}
