import { describe, expect, test, vi } from "vitest";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";

vi.mock("../core", () => ({
  contextCliService: {},
  domainCliService: {},
  searchCliService: {},
  understandingCliService: {},
}));

const expectedReadToolNames = [
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "search",
] as const;

describe("createPiReadOnlyTools", () => {
  test("exposes the shared minimal read tool surface", () => {
    expect(PI_READ_ONLY_TOOL_NAMES).toEqual(expectedReadToolNames);
    expect(createPiReadOnlyTools().map((tool) => tool.name)).toEqual(expectedReadToolNames);
  });
});
