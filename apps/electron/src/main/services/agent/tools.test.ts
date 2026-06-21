import { describe, expect, test, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentChatMessage } from "@shared/chat";
import {
  AGENT_MAX_STEPS,
  agentStopWhen,
  readAttachmentForTool,
  readLocalFileForTool,
  runBashForTool,
} from "./tools";

vi.mock("../core", () => ({
  categoryCliService: {},
  categoryService: {},
  contextCliService: {},
  contextService: {},
  graphService: {},
  searchCliService: {},
  snapshotService: {},
  thoughtCliService: {},
  thoughtService: {},
}));

function dataUrl(mediaType: string, buffer: Buffer) {
  return `data:${mediaType};base64,${buffer.toString("base64")}`;
}

function attachmentMessage(input: {
  attachmentId: string;
  filename: string;
  mediaType: string;
  buffer: Buffer;
}): AgentChatMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [
      {
        type: "file",
        mediaType: input.mediaType,
        filename: input.filename,
        url: dataUrl(input.mediaType, input.buffer),
        providerMetadata: {
          reflecta: {
            attachmentId: input.attachmentId,
            size: input.buffer.length,
          },
        },
      },
    ],
  };
}

function simplePdf(text: string) {
  const escaped = text.replace(/[\\()]/g, "\\$&");
  const stream = `BT /F1 24 Tf 72 72 Td (${escaped}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe("createAgentTools", () => {
  test("allows enough tool steps before forcing the final answer", () => {
    const stopCondition = agentStopWhen();

    expect(AGENT_MAX_STEPS).toBe(20);
    expect(
      stopCondition({
        steps: Array.from({ length: AGENT_MAX_STEPS }, () => ({ toolResults: [] })),
      } as never),
    ).toBe(true);
  });

  test("reads local text files with truncation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reflecta-tools-"));
    const path = join(dir, "note.txt");
    await writeFile(path, "hello local file");

    const result = await readLocalFileForTool({ path, maxBytes: 5 });

    expect(result).toMatchObject({
      path,
      encoding: "utf8",
      content: "hello",
      truncated: true,
    });
  });

  test("runs bash commands and returns stdout", async () => {
    const result = await runBashForTool({ command: "printf hello" });

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "hello",
    });
  });

  test("reads UTF-8 attachment text without relying on extension", async () => {
    const message = attachmentMessage({
      attachmentId: "att-text",
      filename: "README",
      mediaType: "application/octet-stream",
      buffer: Buffer.from("# hello\nplain text", "utf8"),
    });

    await expect(
      readAttachmentForTool([message], { attachmentId: "att-text" }),
    ).resolves.toMatchObject({
      kind: "text",
      encoding: "utf8",
      content: "# hello\nplain text",
    });
  });

  test("reads markdown, json, and env attachments by content", async () => {
    const messages = [
      attachmentMessage({
        attachmentId: "att-md",
        filename: "note.md",
        mediaType: "application/octet-stream",
        buffer: Buffer.from("## title", "utf8"),
      }),
      attachmentMessage({
        attachmentId: "att-json",
        filename: "data.json",
        mediaType: "application/octet-stream",
        buffer: Buffer.from('{"ok":true}', "utf8"),
      }),
      attachmentMessage({
        attachmentId: "att-env",
        filename: ".env",
        mediaType: "application/octet-stream",
        buffer: Buffer.from("FOO=bar", "utf8"),
      }),
    ];

    await expect(
      readAttachmentForTool(messages, { attachmentId: "att-md" }),
    ).resolves.toMatchObject({
      content: "## title",
    });
    await expect(
      readAttachmentForTool(messages, { attachmentId: "att-json" }),
    ).resolves.toMatchObject({
      content: '{"ok":true}',
    });
    await expect(
      readAttachmentForTool(messages, { attachmentId: "att-env" }),
    ).resolves.toMatchObject({
      content: "FOO=bar",
    });
  });

  test("rejects binary attachments without returning base64", async () => {
    const message = attachmentMessage({
      attachmentId: "att-bin",
      filename: "image.png",
      mediaType: "image/png",
      buffer: Buffer.from([0, 1, 2, 3, 4, 255]),
    });

    await expect(
      readAttachmentForTool([message], { attachmentId: "att-bin" }),
    ).resolves.toMatchObject({
      kind: "binary",
      error: expect.stringContaining("二进制"),
    });
  });

  test("extracts text from PDF attachments", async () => {
    const message = attachmentMessage({
      attachmentId: "att-pdf",
      filename: "fixture.bin",
      mediaType: "application/octet-stream",
      buffer: simplePdf("Hello PDF"),
    });

    await expect(
      readAttachmentForTool([message], { attachmentId: "att-pdf" }),
    ).resolves.toMatchObject({
      kind: "pdf",
      content: expect.stringContaining("Hello PDF"),
    });
  });

  test("returns a clear error when attachment is missing", async () => {
    await expect(readAttachmentForTool([], { attachmentId: "missing" })).resolves.toMatchObject({
      attachmentId: "missing",
      error: expect.stringContaining("找不到"),
    });
  });
});
