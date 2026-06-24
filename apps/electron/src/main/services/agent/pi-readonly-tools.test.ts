import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

const services = vi.hoisted(() => ({
  fetchWebPage: vi.fn(),
  retrieveKnowledge: vi.fn(),
}));

vi.mock("./web-fetch", () => ({
  fetchWebPage: services.fetchWebPage,
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
});
