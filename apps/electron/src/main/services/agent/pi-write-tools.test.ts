import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPiWriteTools,
  executePiApprovedTool,
  PI_APPROVAL_TOOL_NAMES,
  type PiApprovalToolName,
} from "./pi-write-tools";

const services = vi.hoisted(() => ({
  createUnderstanding: vi.fn(),
  updateUnderstanding: vi.fn(),
  deleteUnderstanding: vi.fn(),
  createDomain: vi.fn(),
  updateDomain: vi.fn(),
  deleteDomain: vi.fn(),
  createContext: vi.fn(),
  updateContext: vi.fn(),
  deleteContext: vi.fn(),
}));

vi.mock("../core", () => ({
  domainService: {
    createDomain: services.createDomain,
    updateDomain: services.updateDomain,
    deleteDomain: services.deleteDomain,
  },
  contextService: {
    createContext: services.createContext,
    updateContext: services.updateContext,
    deleteContext: services.deleteContext,
  },
  understandingService: {
    createUnderstanding: services.createUnderstanding,
    updateUnderstanding: services.updateUnderstanding,
    deleteUnderstanding: services.deleteUnderstanding,
  },
}));

const knowledgeMutationNames = [
  "understanding_create",
  "understanding_update",
  "understanding_delete",
  "domain_create",
  "domain_update",
  "domain_delete",
  "context_create",
  "context_update",
  "context_delete",
] as const;

const samplePayloads: Record<(typeof knowledgeMutationNames)[number], Record<string, unknown>> = {
  understanding_create: { title: "New Understanding", body: "Body", domainIds: ["cat-1"] },
  understanding_update: {
    understandingId: "understanding-1",
    after: { title: "Updated Understanding", body: "Updated body", domainIds: ["cat-1"] },
  },
  understanding_delete: { understandingId: "understanding-1", reason: "Duplicate" },
  domain_create: { name: "New Domain", parentId: "cat-parent" },
  domain_update: { domainId: "cat-1", name: "Renamed Domain", parentId: "cat-parent" },
  domain_delete: { domainId: "cat-1", deleteUnderstandings: false },
  context_create: {
    understandingId: "understanding-1",
    medium: "ai",
    title: "Agent",
    content: "Supporting context",
  },
  context_update: { contextId: "context-1", medium: "ai", content: "Updated context" },
  context_delete: { contextId: "context-1", reason: "No longer relevant" },
};

describe("createPiWriteTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("registers every knowledge-base mutation as an approval tool", async () => {
    expect(PI_APPROVAL_TOOL_NAMES).toEqual(knowledgeMutationNames);

    const tools = createPiWriteTools();
    expect(tools.map((tool) => tool.name)).toEqual(knowledgeMutationNames);

    for (const tool of tools) {
      const toolName = tool.name as (typeof knowledgeMutationNames)[number];
      const execute = tool.execute as (
        toolCallId: string,
        params: Record<string, unknown>,
      ) => Promise<unknown>;
      const result = await execute("tool-call-1", samplePayloads[toolName]);
      expect(result).toMatchObject({
        details: {
          approvalStatus: "pending",
          proposalType: toolName,
        },
      });
    }

    expect(services.createUnderstanding).not.toHaveBeenCalled();
    expect(services.updateUnderstanding).not.toHaveBeenCalled();
    expect(services.deleteUnderstanding).not.toHaveBeenCalled();
    expect(services.createDomain).not.toHaveBeenCalled();
    expect(services.updateDomain).not.toHaveBeenCalled();
    expect(services.deleteDomain).not.toHaveBeenCalled();
    expect(services.createContext).not.toHaveBeenCalled();
    expect(services.updateContext).not.toHaveBeenCalled();
    expect(services.deleteContext).not.toHaveBeenCalled();
  });

  test("executes approved mutation tools through domain services", async () => {
    services.createUnderstanding.mockResolvedValue({ id: "understanding-created" });
    services.updateUnderstanding.mockResolvedValue({ id: "understanding-updated" });
    services.createDomain.mockResolvedValue({ id: "domain-created" });
    services.updateDomain.mockResolvedValue({ id: "domain-updated" });
    services.createContext.mockResolvedValue({ id: "context-created" });
    services.updateContext.mockResolvedValue({ id: "context-updated" });

    const cases: Array<{
      toolName: PiApprovalToolName;
      expected: Record<string, unknown>;
    }> = [
      {
        toolName: "understanding_create",
        expected: { resultRefType: "understanding", resultRefId: "understanding-created" },
      },
      {
        toolName: "understanding_update",
        expected: { resultRefType: "understanding", resultRefId: "understanding-updated" },
      },
      {
        toolName: "understanding_delete",
        expected: { resultRefType: "understanding", resultRefId: "understanding-1" },
      },
      {
        toolName: "domain_create",
        expected: { resultRefType: "domain", resultRefId: "domain-created" },
      },
      {
        toolName: "domain_update",
        expected: { resultRefType: "domain", resultRefId: "domain-updated" },
      },
      {
        toolName: "domain_delete",
        expected: { resultRefType: "domain", resultRefId: "cat-1" },
      },
      {
        toolName: "context_create",
        expected: { resultRefType: "context", resultRefId: "context-created" },
      },
      {
        toolName: "context_update",
        expected: { resultRefType: "context", resultRefId: "context-updated" },
      },
      {
        toolName: "context_delete",
        expected: { resultRefType: "context", resultRefId: "context-1" },
      },
    ];

    for (const item of cases) {
      await expect(
        executePiApprovedTool(item.toolName, samplePayloads[item.toolName]),
      ).resolves.toEqual(item.expected);
    }

    expect(services.createUnderstanding).toHaveBeenCalledWith({
      title: "New Understanding",
      body: "Body",
      domainIds: ["cat-1"],
    });
    expect(services.updateUnderstanding).toHaveBeenCalledWith("understanding-1", {
      title: "Updated Understanding",
      body: "Updated body",
      domainIds: ["cat-1"],
    });
    expect(services.deleteUnderstanding).toHaveBeenCalledWith("understanding-1");
    expect(services.createDomain).toHaveBeenCalledWith({
      name: "New Domain",
      parentId: "cat-parent",
    });
    expect(services.updateDomain).toHaveBeenCalledWith("cat-1", {
      name: "Renamed Domain",
      parentId: "cat-parent",
    });
    expect(services.deleteDomain).toHaveBeenCalledWith("cat-1", false);
    expect(services.createContext).toHaveBeenCalledWith({
      understandingId: "understanding-1",
      medium: "ai",
      title: "Agent",
      content: "Supporting context",
    });
    expect(services.updateContext).toHaveBeenCalledWith("context-1", {
      medium: "ai",
      title: undefined,
      content: "Updated context",
    });
    expect(services.deleteContext).toHaveBeenCalledWith("context-1");
  });
});
