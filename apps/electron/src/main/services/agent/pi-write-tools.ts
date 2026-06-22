import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type {
  CreateCategoryInput,
  CreateContextInput,
  CreateThoughtInput,
  SourceType,
  UpdateCategoryInput,
  UpdateContextInput,
  UpdateThoughtInput,
} from "@reflecta/server";
import { categoryService, contextService, thoughtService } from "../core";

export const PI_APPROVAL_TOOL_NAMES = [
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
export type PiApprovalToolName = (typeof PI_APPROVAL_TOOL_NAMES)[number];

const sourceTypes = ["experience", "video", "book", "article", "opinion", "ai"] as const;
const categoryIdsParameter = Type.Optional(Type.Array(Type.String()));
const nullableStringParameter = Type.Union([Type.String(), Type.Null()]);
const sourceTypeParameter = Type.Union(sourceTypes.map((sourceType) => Type.Literal(sourceType)));

type PiMutationOutput = {
  resultRefType: "thought" | "category" | "context";
  resultRefId: string;
};

type PiWriteToolSpec = {
  name: PiApprovalToolName;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines?: string[];
  parameters: ReturnType<typeof Type.Object>;
};

const toolSpecs: PiWriteToolSpec[] = [
  {
    name: "thought_create",
    label: "候选 Thought",
    description:
      "Create a new Reflecta Thought only after user approval. Call this when the user asks you to propose or create a Thought. The tool requests approval; it must not write the knowledge base until the user confirms.",
    promptSnippet: "thought_create: propose a new Reflecta Thought and request user approval.",
    promptGuidelines: [
      "When the user asks to create or propose a Thought, call thought_create and wait for user approval.",
      "Do not claim a Thought has been written until approval is confirmed.",
    ],
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "Short Thought title." })),
      body: Type.String({ minLength: 1, description: "Markdown body for the new Thought." }),
      categoryIds: categoryIdsParameter,
    }),
  },
  {
    name: "thought_update",
    label: "候选修改 Thought",
    description:
      "Update an existing Reflecta Thought only after user approval. Use this when the user asks to rewrite, retitle, or recategorize an existing Thought.",
    promptSnippet: "thought_update: propose an update to an existing Reflecta Thought.",
    promptGuidelines: [
      "Read the existing Thought first, then call thought_update with the intended change.",
    ],
    parameters: Type.Object({
      thoughtId: Type.String({ minLength: 1 }),
      before: Type.Optional(
        Type.Object({
          title: Type.Optional(nullableStringParameter),
          body: Type.Optional(Type.String()),
        }),
      ),
      after: Type.Optional(
        Type.Object({
          title: Type.Optional(nullableStringParameter),
          body: Type.Optional(Type.String()),
          categoryIds: categoryIdsParameter,
        }),
      ),
      title: Type.Optional(nullableStringParameter),
      body: Type.Optional(Type.String()),
      categoryIds: categoryIdsParameter,
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "thought_delete",
    label: "候选删除 Thought",
    description: "Delete an existing Reflecta Thought only after user approval.",
    promptSnippet: "thought_delete: propose deleting an existing Reflecta Thought.",
    parameters: Type.Object({
      thoughtId: Type.String({ minLength: 1 }),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "category_create",
    label: "候选 Category",
    description: "Create a new Reflecta Category only after user approval.",
    promptSnippet: "category_create: propose a new Reflecta Category.",
    promptGuidelines: [
      "When the user asks to create or propose a Category, call category_create and wait for user approval.",
      "If the user gives a Category name but no parent, call category_create with that name and omit parentId instead of asking a follow-up question.",
      "Do not present a prose-only Category proposal when category_create can express it.",
    ],
    parameters: Type.Object({
      name: Type.String({ minLength: 1 }),
      parentId: Type.Optional(nullableStringParameter),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "category_update",
    label: "候选修改 Category",
    description: "Rename or move an existing Reflecta Category only after user approval.",
    promptSnippet: "category_update: propose updating or moving a Reflecta Category.",
    parameters: Type.Object({
      categoryId: Type.String({ minLength: 1 }),
      name: Type.Optional(Type.String()),
      parentId: Type.Optional(nullableStringParameter),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "category_delete",
    label: "候选删除 Category",
    description: "Delete an existing Reflecta Category only after user approval.",
    promptSnippet: "category_delete: propose deleting a Reflecta Category.",
    parameters: Type.Object({
      categoryId: Type.String({ minLength: 1 }),
      deleteThoughts: Type.Optional(Type.Boolean()),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "context_create",
    label: "候选 Context",
    description: "Add source Context to an existing Thought only after user approval.",
    promptSnippet: "context_create: propose adding source Context to a Thought.",
    parameters: Type.Object({
      thoughtId: Type.String({ minLength: 1 }),
      sourceType: sourceTypeParameter,
      sourceName: Type.Optional(Type.String()),
      content: Type.String({ minLength: 1 }),
    }),
  },
  {
    name: "context_update",
    label: "候选修改 Context",
    description: "Update an existing Reflecta Context only after user approval.",
    promptSnippet: "context_update: propose updating an existing Context.",
    parameters: Type.Object({
      contextId: Type.String({ minLength: 1 }),
      sourceType: Type.Optional(sourceTypeParameter),
      sourceName: Type.Optional(Type.String()),
      content: Type.Optional(Type.String()),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "context_delete",
    label: "候选删除 Context",
    description: "Delete an existing Reflecta Context only after user approval.",
    promptSnippet: "context_delete: propose deleting an existing Context.",
    parameters: Type.Object({
      contextId: Type.String({ minLength: 1 }),
      reason: Type.Optional(Type.String()),
    }),
  },
];

export function isPiApprovalToolName(name: string): name is PiApprovalToolName {
  return PI_APPROVAL_TOOL_NAMES.includes(name as PiApprovalToolName);
}

export function approvalTitleForTool(toolName: PiApprovalToolName): string {
  return toolSpecs.find((spec) => spec.name === toolName)?.label ?? "候选操作";
}

function pendingToolResult(toolName: PiApprovalToolName, params: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: "Approval requested. The knowledge base has not been changed yet.",
      },
    ],
    details: {
      approvalStatus: "pending",
      proposalType: toolName,
      ...params,
    },
  };
}

export function createPiWriteTools(): ToolDefinition[] {
  return toolSpecs.map((spec) =>
    defineTool({
      ...spec,
      execute: async (_toolCallId, params) => pendingToolResult(spec.name, params),
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`候选操作缺少 ${field}。`);
  return value;
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  return typeof value === "string" ? value : undefined;
}

function optionalNullableString(
  payload: Record<string, unknown>,
  field: string,
): string | null | undefined {
  const value = payload[field];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function optionalBoolean(payload: Record<string, unknown>, field: string): boolean | undefined {
  const value = payload[field];
  return typeof value === "boolean" ? value : undefined;
}

function optionalStringArray(
  payload: Record<string, unknown>,
  field: string,
): string[] | undefined {
  const value = payload[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function optionalRecord(payload: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = payload[field];
  return isRecord(value) ? value : {};
}

function sourceType(payload: Record<string, unknown>, required: true): SourceType;
function sourceType(payload: Record<string, unknown>, required?: false): SourceType | undefined;
function sourceType(payload: Record<string, unknown>, required = false): SourceType | undefined {
  const value = payload.sourceType;
  if (sourceTypes.includes(value as SourceType)) return value as SourceType;
  if (required) throw new Error("候选 Context 缺少 sourceType。");
  return undefined;
}

function asPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("候选操作参数无效。");
  return value;
}

function thoughtCreateInput(payload: unknown): CreateThoughtInput {
  const record = asPayload(payload);
  return {
    title: optionalString(record, "title"),
    body: requiredString(record, "body"),
    categoryIds: optionalStringArray(record, "categoryIds"),
  };
}

function thoughtUpdateInput(payload: unknown): { thoughtId: string; input: UpdateThoughtInput } {
  const record = asPayload(payload);
  const after = optionalRecord(record, "after");
  return {
    thoughtId: requiredString(record, "thoughtId"),
    input: {
      title: optionalNullableString(after, "title") ?? optionalNullableString(record, "title"),
      body: optionalString(after, "body") ?? optionalString(record, "body"),
      categoryIds:
        optionalStringArray(after, "categoryIds") ?? optionalStringArray(record, "categoryIds"),
    },
  };
}

function thoughtDeleteInput(payload: unknown): string {
  return requiredString(asPayload(payload), "thoughtId");
}

function categoryCreateInput(payload: unknown): CreateCategoryInput {
  const record = asPayload(payload);
  return {
    name: requiredString(record, "name"),
    parentId: optionalNullableString(record, "parentId"),
  };
}

function categoryUpdateInput(payload: unknown): { categoryId: string; input: UpdateCategoryInput } {
  const record = asPayload(payload);
  return {
    categoryId: requiredString(record, "categoryId"),
    input: {
      name: optionalString(record, "name"),
      parentId: optionalNullableString(record, "parentId"),
    },
  };
}

function categoryDeleteInput(payload: unknown): { categoryId: string; deleteThoughts?: boolean } {
  const record = asPayload(payload);
  return {
    categoryId: requiredString(record, "categoryId"),
    deleteThoughts: optionalBoolean(record, "deleteThoughts"),
  };
}

function contextCreateInput(payload: unknown): CreateContextInput {
  const record = asPayload(payload);
  return {
    thoughtId: requiredString(record, "thoughtId"),
    sourceType: sourceType(record, true),
    sourceName: optionalString(record, "sourceName"),
    content: requiredString(record, "content"),
  };
}

function contextUpdateInput(payload: unknown): { contextId: string; input: UpdateContextInput } {
  const record = asPayload(payload);
  return {
    contextId: requiredString(record, "contextId"),
    input: {
      sourceType: sourceType(record),
      sourceName: optionalString(record, "sourceName"),
      content: optionalString(record, "content"),
    },
  };
}

function contextDeleteInput(payload: unknown): string {
  return requiredString(asPayload(payload), "contextId");
}

export async function executePiApprovedTool(
  toolName: PiApprovalToolName,
  payload: unknown,
): Promise<PiMutationOutput> {
  if (toolName === "thought_create") {
    const thought = await thoughtService.createThought(thoughtCreateInput(payload));
    return { resultRefType: "thought", resultRefId: thought.id };
  }

  if (toolName === "thought_update") {
    const { thoughtId, input } = thoughtUpdateInput(payload);
    const thought = await thoughtService.updateThought(thoughtId, input);
    return { resultRefType: "thought", resultRefId: thought.id };
  }

  if (toolName === "thought_delete") {
    const thoughtId = thoughtDeleteInput(payload);
    await thoughtService.deleteThought(thoughtId);
    return { resultRefType: "thought", resultRefId: thoughtId };
  }

  if (toolName === "category_create") {
    const category = await categoryService.createCategory(categoryCreateInput(payload));
    return { resultRefType: "category", resultRefId: category.id };
  }

  if (toolName === "category_update") {
    const { categoryId, input } = categoryUpdateInput(payload);
    const category = await categoryService.updateCategory(categoryId, input);
    return { resultRefType: "category", resultRefId: category.id };
  }

  if (toolName === "category_delete") {
    const { categoryId, deleteThoughts } = categoryDeleteInput(payload);
    await categoryService.deleteCategory(categoryId, deleteThoughts);
    return { resultRefType: "category", resultRefId: categoryId };
  }

  if (toolName === "context_create") {
    const context = await contextService.createContext(contextCreateInput(payload));
    return { resultRefType: "context", resultRefId: context.id };
  }

  if (toolName === "context_update") {
    const { contextId, input } = contextUpdateInput(payload);
    const context = await contextService.updateContext(contextId, input);
    return { resultRefType: "context", resultRefId: context.id };
  }

  const contextId = contextDeleteInput(payload);
  await contextService.deleteContext(contextId);
  return { resultRefType: "context", resultRefId: contextId };
}
