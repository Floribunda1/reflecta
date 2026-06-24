import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

const services = vi.hoisted(() => ({
  retrieveKnowledge: vi.fn(),
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
});
