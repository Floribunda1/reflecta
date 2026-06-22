import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPiWriteTools,
  executePiApprovedTool,
  PI_APPROVAL_TOOL_NAMES,
  type PiApprovalToolName,
} from "./pi-write-tools";

const services = vi.hoisted(() => ({
  createThought: vi.fn(),
  updateThought: vi.fn(),
  deleteThought: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createContext: vi.fn(),
  updateContext: vi.fn(),
  deleteContext: vi.fn(),
}));

vi.mock("../core", () => ({
  categoryService: {
    createCategory: services.createCategory,
    updateCategory: services.updateCategory,
    deleteCategory: services.deleteCategory,
  },
  contextService: {
    createContext: services.createContext,
    updateContext: services.updateContext,
    deleteContext: services.deleteContext,
  },
  thoughtService: {
    createThought: services.createThought,
    updateThought: services.updateThought,
    deleteThought: services.deleteThought,
  },
}));

const knowledgeMutationNames = [
  "thought_create",
  "thought_update",
  "thought_delete",
  "category_create",
  "category_update",
  "category_delete",
  "context_create",
  "context_update",
  "context_delete",
] as const;

const samplePayloads: Record<(typeof knowledgeMutationNames)[number], Record<string, unknown>> = {
  thought_create: { title: "New Thought", body: "Body", categoryIds: ["cat-1"] },
  thought_update: {
    thoughtId: "thought-1",
    after: { title: "Updated Thought", body: "Updated body", categoryIds: ["cat-1"] },
  },
  thought_delete: { thoughtId: "thought-1", reason: "Duplicate" },
  category_create: { name: "New Category", parentId: "cat-parent" },
  category_update: { categoryId: "cat-1", name: "Renamed Category", parentId: "cat-parent" },
  category_delete: { categoryId: "cat-1", deleteThoughts: false },
  context_create: {
    thoughtId: "thought-1",
    sourceType: "ai",
    sourceName: "Agent",
    content: "Supporting context",
  },
  context_update: { contextId: "context-1", sourceType: "ai", content: "Updated context" },
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

    expect(services.createThought).not.toHaveBeenCalled();
    expect(services.updateThought).not.toHaveBeenCalled();
    expect(services.deleteThought).not.toHaveBeenCalled();
    expect(services.createCategory).not.toHaveBeenCalled();
    expect(services.updateCategory).not.toHaveBeenCalled();
    expect(services.deleteCategory).not.toHaveBeenCalled();
    expect(services.createContext).not.toHaveBeenCalled();
    expect(services.updateContext).not.toHaveBeenCalled();
    expect(services.deleteContext).not.toHaveBeenCalled();
  });

  test("executes approved mutation tools through domain services", async () => {
    services.createThought.mockResolvedValue({ id: "thought-created" });
    services.updateThought.mockResolvedValue({ id: "thought-updated" });
    services.createCategory.mockResolvedValue({ id: "category-created" });
    services.updateCategory.mockResolvedValue({ id: "category-updated" });
    services.createContext.mockResolvedValue({ id: "context-created" });
    services.updateContext.mockResolvedValue({ id: "context-updated" });

    const cases: Array<{
      toolName: PiApprovalToolName;
      expected: Record<string, unknown>;
    }> = [
      {
        toolName: "thought_create",
        expected: { resultRefType: "thought", resultRefId: "thought-created" },
      },
      {
        toolName: "thought_update",
        expected: { resultRefType: "thought", resultRefId: "thought-updated" },
      },
      {
        toolName: "thought_delete",
        expected: { resultRefType: "thought", resultRefId: "thought-1" },
      },
      {
        toolName: "category_create",
        expected: { resultRefType: "category", resultRefId: "category-created" },
      },
      {
        toolName: "category_update",
        expected: { resultRefType: "category", resultRefId: "category-updated" },
      },
      {
        toolName: "category_delete",
        expected: { resultRefType: "category", resultRefId: "cat-1" },
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

    expect(services.createThought).toHaveBeenCalledWith({
      title: "New Thought",
      body: "Body",
      categoryIds: ["cat-1"],
    });
    expect(services.updateThought).toHaveBeenCalledWith("thought-1", {
      title: "Updated Thought",
      body: "Updated body",
      categoryIds: ["cat-1"],
    });
    expect(services.deleteThought).toHaveBeenCalledWith("thought-1");
    expect(services.createCategory).toHaveBeenCalledWith({
      name: "New Category",
      parentId: "cat-parent",
    });
    expect(services.updateCategory).toHaveBeenCalledWith("cat-1", {
      name: "Renamed Category",
      parentId: "cat-parent",
    });
    expect(services.deleteCategory).toHaveBeenCalledWith("cat-1", false);
    expect(services.createContext).toHaveBeenCalledWith({
      thoughtId: "thought-1",
      sourceType: "ai",
      sourceName: "Agent",
      content: "Supporting context",
    });
    expect(services.updateContext).toHaveBeenCalledWith("context-1", {
      sourceType: "ai",
      sourceName: undefined,
      content: "Updated context",
    });
    expect(services.deleteContext).toHaveBeenCalledWith("context-1");
  });
});
