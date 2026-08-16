import { beforeEach, describe, expect, test, vi } from "vitest";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

const services = vi.hoisted(() => ({
  getContext: vi.fn(),
  getUnderstanding: vi.fn(),
  readAttachmentForTool: vi.fn(),
  retrieveKnowledge: vi.fn(),
  writeDiagnosticEvent: vi.fn(),
  getCanvasDetail: vi.fn(),
  listCanvases: vi.fn(),
  searchCanvases: vi.fn(),
}));

vi.mock("./attachment-read", () => ({
  HARD_ATTACHMENT_READ_MAX_CHARS: 500_000,
  readAttachmentForTool: services.readAttachmentForTool,
}));

vi.mock("../../logger", () => ({
  writeDiagnosticEvent: services.writeDiagnosticEvent,
}));

vi.mock("../core", () => ({
  contextCliService: {
    getContext: services.getContext,
  },
  domainCliService: {},
  searchCliService: {
    retrieveKnowledge: services.retrieveKnowledge,
  },
  understandingCanvasCliService: {
    getCanvasDetail: services.getCanvasDetail,
    listCanvases: services.listCanvases,
    searchCanvases: services.searchCanvases,
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
  "retrieve_knowledge",
  "canvas_read",
  "canvas_list",
  "canvas_search",
] as const;

describe("createPiReadOnlyTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("exposes the shared minimal read tool surface", () => {
    expect(PI_READ_ONLY_TOOL_NAMES).toEqual(expectedReadToolNames);
    expect(createPiReadOnlyTools().map((tool) => tool.name)).toEqual(expectedReadToolNames);
  });

  test("retrieve_knowledge caps limit at 20 (A3)", () => {
    const tool = createPiReadOnlyTools().find((item) => item.name === "retrieve_knowledge");
    expect(tool).toBeDefined();
    const schemaText = JSON.stringify(tool!.parameters);
    expect(schemaText).toContain('"maximum":20');
    expect(schemaText).not.toContain('"maximum":200');
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

  test("retrieve_knowledge forwards domainIds as domain anchors (A4)", async () => {
    const result = { candidates: [], trace: { query: "q" } };
    services.retrieveKnowledge.mockResolvedValue(result);
    const tool = createPiReadOnlyTools().find((item) => item.name === "retrieve_knowledge");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    await execute("tool-1", { query: "q", domainIds: ["d-1", "d-2"] });

    expect(services.retrieveKnowledge).toHaveBeenCalledWith({
      query: "q",
      anchors: [
        { type: "domain", id: "d-1" },
        { type: "domain", id: "d-2" },
      ],
    });
  });

  test("retrieve_knowledge exposes stable ids without display refs", async () => {
    const result = {
      candidates: [
        {
          id: "u_1",
          title: "Feedback Loop",
          matches: [
            {
              entityType: "context",
              id: "ctx_1",
              title: "一次复盘",
              medium: "experience",
              snippet: "excerpt",
              channels: ["dense"],
              rank: 0,
              reason: "semantic hit on Context",
            },
          ],
        },
      ],
    };
    services.retrieveKnowledge.mockResolvedValue(result);
    const catalog = new AgentEntityCatalog();
    const tool = createPiReadOnlyTools([], {
      collectToolOutput: (toolName, toolCallId, output) => {
        catalog.collectToolOutput(toolName, toolCallId, output);
      },
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
          id: "u_1",
          title: "Feedback Loop",
          matches: [
            {
              entityType: "context",
              id: "ctx_1",
              title: "一次复盘",
              medium: "experience",
              snippet: "excerpt",
              channels: ["dense"],
              rank: 0,
              reason: "semantic hit on Context",
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
      collectToolOutput: (toolName, toolCallId, output) => {
        catalog.collectToolOutput(toolName, toolCallId, output);
      },
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

  test("collects tool entities without decorating model-facing content", async () => {
    services.getUnderstanding.mockResolvedValue({
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
    });
    const collectToolOutput = vi.fn();
    const tool = createPiReadOnlyTools([], { collectToolOutput }).find(
      (item) => item.name === "understanding_get",
    );
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ content: Array<{ text: string }> }>;
    const output = await execute("tool_1", { understandingId: "u_1" });

    expect(collectToolOutput).toHaveBeenCalledWith("understanding_get", "tool_1", {
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
    });
    expect(output.content[0]?.text).toContain('"id": "u_1"');
    expect(output.content[0]?.text).not.toContain("<reflecta_entities");
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

  test("canvas_read passes includeBodies through and returns skeleton by default", async () => {
    const detail = {
      canvas: { id: "canvas-1", title: "调度" },
      elements: [],
      edges: [],
      understandingRefs: [{ id: "u_1", title: "反馈回路", body: "", deleted: false }],
      referencedCanvases: [],
    };
    services.getCanvasDetail.mockResolvedValue(detail);
    const tool = createPiReadOnlyTools().find((item) => item.name === "canvas_read");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", { canvasId: "canvas-1" });
    expect(services.getCanvasDetail).toHaveBeenCalledWith("canvas-1", { includeBodies: undefined });
    expect(output.details).toEqual(detail);

    await execute("tool-call-2", { canvasId: "canvas-1", includeBodies: true });
    expect(services.getCanvasDetail).toHaveBeenCalledWith("canvas-1", { includeBodies: true });
  });

  test("canvas_search passes query / understandingId / limit through", async () => {
    const hits = [{ canvas: { id: "canvas-1", title: "调度" }, snippet: "x", reason: "标题" }];
    services.searchCanvases.mockResolvedValue(hits);
    const tool = createPiReadOnlyTools().find((item) => item.name === "canvas_search");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    const output = await execute("tool-call-1", {
      query: "灌溉",
      understandingId: "u_1",
      limit: 5,
    });
    expect(services.searchCanvases).toHaveBeenCalledWith({
      query: "灌溉",
      understandingId: "u_1",
      limit: 5,
    });
    expect(output.details).toEqual(hits);
  });

  test("canvas_list passes titleSearchKeyword and limit through", async () => {
    services.listCanvases.mockResolvedValue([]);
    const tool = createPiReadOnlyTools().find((item) => item.name === "canvas_list");
    expect(tool).toBeDefined();

    const execute = tool!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ details: unknown }>;
    await execute("tool-call-1", { titleSearchKeyword: "调度", limit: 10 });
    expect(services.listCanvases).toHaveBeenCalledWith({ titleSearchKeyword: "调度", limit: 10 });
  });
});
