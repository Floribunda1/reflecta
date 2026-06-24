import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

const services = vi.hoisted(() => ({
  fetchWebPage: vi.fn(),
  readAttachmentForTool: vi.fn(),
  readLocalFileForTool: vi.fn(),
  retrieveKnowledge: vi.fn(),
  writeDiagnosticEvent: vi.fn(),
}));

vi.mock("./attachment-read", () => ({
  HARD_ATTACHMENT_READ_MAX_CHARS: 500_000,
  readAttachmentForTool: services.readAttachmentForTool,
}));

vi.mock("./local-tools", () => ({
  HARD_FILE_READ_MAX_BYTES: 1_000_000,
  readLocalFileForTool: services.readLocalFileForTool,
}));

vi.mock("./web-fetch", () => ({
  fetchWebPage: services.fetchWebPage,
}));

vi.mock("../../logger", () => ({
  writeDiagnosticEvent: services.writeDiagnosticEvent,
}));

vi.mock("../core", () => ({
  contextCliService: {},
  domainCliService: {},
  graphCliService: {},
  searchCliService: {
    retrieveKnowledge: services.retrieveKnowledge,
  },
  understandingCliService: {},
}));

const expectedReadToolNames = [
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "attachment_read",
  "file_read",
  "web_fetch",
  "retrieve_knowledge",
  "graph",
] as const;

describe("createPiReadOnlyTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("exposes the shared minimal read tool surface", () => {
    expect(PI_READ_ONLY_TOOL_NAMES).toEqual(expectedReadToolNames);
    expect(createPiReadOnlyTools().map((tool) => tool.name)).toEqual(expectedReadToolNames);
  });

  test("executes retrieve_knowledge through the retrieval seam", async () => {
    const result = { candidates: [], trace: { query: "agent 标准" } };
    services.retrieveKnowledge.mockResolvedValue(result);
    const tool = createPiReadOnlyTools().find((item) => item.name === "retrieve_knowledge");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", { query: "agent 标准", limit: 3 });

    expect(services.retrieveKnowledge).toHaveBeenCalledWith({ query: "agent 标准", limit: 3 });
    expect(services.writeDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "debug",
        event: "agent.tool.completed",
        scope: "agent",
        context: { toolCallId: "tool-call-1" },
        attrs: expect.objectContaining({
          toolName: "retrieve_knowledge",
          outputKeys: ["candidates", "trace"],
          outputType: "object",
        }),
      }),
    );
    expect(output.details).toEqual(result);
  });

  test("executes web_fetch through the web fetch seam", async () => {
    const result = {
      url: "https://example.com",
      markdown: "# Example",
      provider: "curl.md",
      truncated: false,
    };
    services.fetchWebPage.mockResolvedValue(result);
    const tool = createPiReadOnlyTools().find((item) => item.name === "web_fetch");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", { url: "https://example.com" });

    expect(services.fetchWebPage).toHaveBeenCalledWith("https://example.com");
    expect(output.details).toEqual(result);
  });

  test("executes attachment_read through the current message files seam", async () => {
    const files = [
      {
        type: "file" as const,
        mediaType: "application/pdf",
        filename: "attachment.pdf",
        url: "data:application/pdf;base64,JVBERi0xLjQ=",
        providerMetadata: { reflecta: { attachmentId: "att-pdf" } },
      },
    ];
    const result = {
      attachmentId: "att-pdf",
      filename: "attachment.pdf",
      mediaType: "application/pdf",
      kind: "pdf",
      content: "PDF body",
      truncated: false,
    };
    services.readAttachmentForTool.mockResolvedValue(result);
    const tool = createPiReadOnlyTools(files).find((item) => item.name === "attachment_read");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", { attachmentId: "att-pdf" });

    expect(services.readAttachmentForTool).toHaveBeenCalledWith(files, { attachmentId: "att-pdf" });
    expect(output.details).toEqual(result);
  });

  test("executes file_read through the local file seam", async () => {
    const result = {
      path: "/tmp/note.txt",
      bytes: 5,
      encoding: "utf8",
      content: "hello",
      truncated: false,
    };
    services.readLocalFileForTool.mockResolvedValue(result);
    const tool = createPiReadOnlyTools().find((item) => item.name === "file_read");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", { path: "/tmp/note.txt", maxBytes: 5 });

    expect(services.readLocalFileForTool).toHaveBeenCalledWith({
      path: "/tmp/note.txt",
      maxBytes: 5,
    });
    expect(output.details).toEqual(result);
  });
});
