import { beforeEach, describe, expect, test, vi } from "vitest";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

const services = vi.hoisted(() => ({
  getContext: vi.fn(),
  getUnderstanding: vi.fn(),
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
  contextCliService: {
    getContext: services.getContext,
  },
  domainCliService: {},
  graphCliService: {},
  searchCliService: {
    retrieveKnowledge: services.retrieveKnowledge,
  },
  understandingCliService: {
    getUnderstanding: services.getUnderstanding,
  },
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

  test("retrieve_knowledge exposes stable ids without display refs", async () => {
    const result = {
      candidates: [
        {
          understanding: { id: "u_1", title: "Feedback Loop", body: "body" },
          matchedContexts: [{ context: { id: "ctx_1", title: "一次复盘", excerpt: "excerpt" } }],
        },
      ],
    };
    services.retrieveKnowledge.mockResolvedValue(result);
    const catalog = new AgentEntityCatalog();
    const tool = createPiReadOnlyTools([], {
      collectToolOutput: (toolName, toolCallId, output) =>
        catalog.collectToolOutput(toolName, toolCallId, output),
    }).find((item) => item.name === "retrieve_knowledge");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown; content: Array<{ text: string }> }>;
    const output = await execute("tool_1", { query: "feedback", limit: 3 });

    expect(output.details).toEqual({
      candidates: [
        {
          understanding: {
            id: "u_1",
            title: "Feedback Loop",
            body: "body",
          },
          matchedContexts: [
            {
              context: {
                id: "ctx_1",
                title: "一次复盘",
                excerpt: "excerpt",
              },
            },
          ],
        },
      ],
    });
    expect(output.content[0]?.text).toContain('"id": "u_1"');
    expect(output.content[0]?.text).toContain('"id": "ctx_1"');
    expect(output.content[0]?.text).not.toContain('"ref"');
    expect(catalog.snapshot()).toEqual([
      {
        key: "understanding:u_1",
        entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
      },
      {
        key: "context:ctx_1",
        entity: { type: "context", id: "ctx_1", title: "一次复盘" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
      },
    ]);
  });

  test("understanding_get collects root entities without decorating model-facing content", async () => {
    services.getUnderstanding.mockResolvedValue({
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
      contexts: [{ id: "ctx_1", understandingId: "u_1", title: "一次复盘" }],
    });
    const catalog = new AgentEntityCatalog();
    const tool = createPiReadOnlyTools([], {
      collectToolOutput: (toolName, toolCallId, output) =>
        catalog.collectToolOutput(toolName, toolCallId, output),
    }).find((item) => item.name === "understanding_get");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown; content: Array<{ text: string }> }>;
    const output = await execute("tool_1", { understandingId: "u_1" });

    expect(output.details).toEqual({
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
      contexts: [
        {
          id: "ctx_1",
          understandingId: "u_1",
          title: "一次复盘",
        },
      ],
    });
    expect(output.content[0]?.text).toContain('"id": "u_1"');
    expect(output.content[0]?.text).toContain('"id": "ctx_1"');
    expect(output.content[0]?.text).not.toContain('"ref"');
    expect(output.content[0]?.text).not.toContain("understandingRef");
    expect(catalog.snapshot()).toEqual([
      {
        key: "understanding:u_1",
        entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "understanding_get" },
      },
      {
        key: "context:ctx_1",
        entity: { type: "context", id: "ctx_1", title: "一次复盘" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "understanding_get" },
      },
    ]);
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
