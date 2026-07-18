import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPiWriteTools,
  executePiApprovedTool,
  hydratePiApprovalPayload,
  PI_APPROVAL_TOOL_NAMES,
  type PiApprovedToolOutput,
  type PiApprovalToolName,
} from "./pi-write-tools";

const services = vi.hoisted(() => ({
  getUnderstandingById: vi.fn(),
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
    getUnderstandingById: services.getUnderstandingById,
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

const expectedApprovalToolNames = knowledgeMutationNames;

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
  context_update: {
    contextId: "context-1",
    understandingId: "understanding-2",
    medium: "ai",
    content: "Updated context",
  },
  context_delete: { contextId: "context-1", reason: "No longer relevant" },
};
const sampleApprovalPayloads: Record<PiApprovalToolName, Record<string, unknown>> = samplePayloads;

function parameterDescription(toolName: PiApprovalToolName, parameterName: string): string {
  const tool = createPiWriteTools().find((item) => item.name === toolName);
  const schema = tool?.parameters as { properties?: Record<string, { description?: string }> };
  return schema.properties?.[parameterName]?.description ?? "";
}

function expectNoKnowledgeMutationServicesCalled() {
  expect(services.createUnderstanding).not.toHaveBeenCalled();
  expect(services.updateUnderstanding).not.toHaveBeenCalled();
  expect(services.deleteUnderstanding).not.toHaveBeenCalled();
  expect(services.createDomain).not.toHaveBeenCalled();
  expect(services.updateDomain).not.toHaveBeenCalled();
  expect(services.deleteDomain).not.toHaveBeenCalled();
  expect(services.createContext).not.toHaveBeenCalled();
  expect(services.updateContext).not.toHaveBeenCalled();
  expect(services.deleteContext).not.toHaveBeenCalled();
}

describe("createPiWriteTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("registers Reflecta mutations as approval tools", async () => {
    expect(PI_APPROVAL_TOOL_NAMES).toEqual(expectedApprovalToolNames);

    const tools = createPiWriteTools();
    expect(tools.map((tool) => tool.name)).toEqual(expectedApprovalToolNames);

    for (const tool of tools) {
      const toolName = tool.name as PiApprovalToolName;
      const execute = tool.execute as (
        toolCallId: string,
        params: Record<string, unknown>,
      ) => Promise<unknown>;
      const result = await execute("tool-call-1", sampleApprovalPayloads[toolName]);
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

  test("documents stable id inputs for write tools", () => {
    expect(parameterDescription("understanding_create", "domainIds")).toContain(
      "Stable Domain ids",
    );
    expect(parameterDescription("understanding_create", "body")).toContain(
      "[[title#understanding-id]]",
    );
    expect(parameterDescription("understanding_update", "understandingId")).toContain(
      "Stable Understanding id",
    );
    expect(parameterDescription("understanding_update", "body")).toContain(
      "[[title#understanding-id]]",
    );
    expect(parameterDescription("understanding_update", "domainIds")).toContain(
      "Stable Domain ids",
    );
    const updateParameters = createPiWriteTools().find(
      (item) => item.name === "understanding_update",
    )?.parameters as { properties?: Record<string, unknown> } | undefined;
    expect(updateParameters?.properties?.before).toBeUndefined();
    expect(parameterDescription("domain_update", "domainId")).toContain("Stable Domain id");
    expect(parameterDescription("domain_update", "parentId")).toContain("Stable parent Domain id");
    expect(parameterDescription("context_create", "understandingId")).toContain(
      "Stable Understanding id",
    );
    expect(parameterDescription("context_update", "contextId")).toContain("Stable Context id");
    expect(parameterDescription("context_update", "understandingId")).toContain(
      "Stable Understanding id",
    );
  });

  test.each([
    {
      toolName: "domain_update" as const,
      payload: { domainId: "D1", name: "New name" },
    },
    {
      toolName: "domain_update" as const,
      payload: { domainId: "[D1]", name: "New name" },
    },
    {
      toolName: "domain_update" as const,
      payload: { domainId: "[[domain:domain_1]]", name: "New name" },
    },
    {
      toolName: "domain_update" as const,
      payload: { domainId: "ref:domain:domain_1", name: "New name" },
    },
    {
      toolName: "domain_create" as const,
      payload: { name: "Child", parentId: "rf_fjxcezk5az" },
    },
    {
      toolName: "understanding_update" as const,
      payload: { understandingId: "understanding-1", after: { domainIds: ["[1]"] } },
    },
    {
      toolName: "context_create" as const,
      payload: { understandingId: "[U1]", medium: "ai", content: "Supporting context" },
    },
    {
      toolName: "context_delete" as const,
      payload: { contextId: "prefix [[context:context_1]]" },
    },
    {
      toolName: "context_update" as const,
      payload: { contextId: "context-1", understandingId: "[U1]" },
    },
  ])(
    "rejects display identity tokens in write tool ids: $toolName",
    async ({ toolName, payload }) => {
      await expect(executePiApprovedTool(toolName, payload)).rejects.toThrow(/稳定实体 id/);
      expectNoKnowledgeMutationServicesCalled();
    },
  );

  test("keeps approval tools pending until the user decision resolves", async () => {
    let resolveApproval: (output: PiApprovedToolOutput) => void = () => {};
    const tools = createPiWriteTools({
      onApproval: () =>
        new Promise((resolve) => {
          resolveApproval = resolve;
        }),
    });
    const understandingCreate = tools.find((tool) => tool.name === "understanding_create")!;
    const execute = understandingCreate.execute as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<unknown>;
    let settled = false;

    const result = execute("tool-call-1", { body: "Candidate body" }).then((output) => {
      settled = true;
      return output;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    resolveApproval({
      resultRefType: "understanding",
      resultRefId: "understanding-created",
    });

    await expect(result).resolves.toMatchObject({
      details: {
        resultRefType: "understanding",
        resultRefId: "understanding-created",
      },
    });
    expect(settled).toBe(true);
  });

  test("hydrates understanding update before state from Reflecta", async () => {
    services.getUnderstandingById.mockResolvedValue({
      id: "understanding-1",
      title: "Old title",
      body: "Old body",
      domainIds: ["cat-old"],
    });

    await expect(
      hydratePiApprovalPayload("understanding_update", {
        understandingId: "understanding-1",
        after: { body: "Updated body" },
      }),
    ).resolves.toMatchObject({
      understandingId: "understanding-1",
      before: { title: "Old title", body: "Old body" },
      after: { body: "Updated body" },
    });
    expect(services.getUnderstandingById).toHaveBeenCalledWith("understanding-1");
  });

  test("executes approved mutation tools through domain services", async () => {
    services.createUnderstanding.mockResolvedValue({
      id: "understanding-created",
      title: "Stored Understanding",
    });
    services.updateUnderstanding.mockResolvedValue({
      id: "understanding-updated",
      title: "Stored Updated Understanding",
    });
    services.createDomain.mockResolvedValue({ id: "domain-created" });
    services.updateDomain.mockResolvedValue({ id: "domain-updated" });
    services.createContext.mockResolvedValue({ id: "context-created", title: "Stored Context" });
    services.updateContext.mockResolvedValue({
      id: "context-updated",
      title: "Stored Updated Context",
    });

    const cases: Array<{
      toolName: (typeof knowledgeMutationNames)[number];
      expected: Record<string, unknown>;
    }> = [
      {
        toolName: "understanding_create",
        expected: {
          resultRefType: "understanding",
          resultRefId: "understanding-created",
          resultRefTitle: "Stored Understanding",
        },
      },
      {
        toolName: "understanding_update",
        expected: {
          resultRefType: "understanding",
          resultRefId: "understanding-updated",
          resultRefTitle: "Stored Updated Understanding",
        },
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
        expected: {
          resultRefType: "context",
          resultRefId: "context-created",
          resultRefTitle: "Stored Context",
        },
      },
      {
        toolName: "context_update",
        expected: {
          resultRefType: "context",
          resultRefId: "context-updated",
          resultRefTitle: "Stored Updated Context",
        },
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
      understandingId: "understanding-2",
      medium: "ai",
      title: undefined,
      content: "Updated context",
    });
    expect(services.deleteContext).toHaveBeenCalledWith("context-1");
  });
});
