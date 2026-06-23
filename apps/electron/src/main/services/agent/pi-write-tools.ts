import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type {
  CreateDomainInput,
  CreateContextInput,
  CreateUnderstandingInput,
  ContextMedium,
  UpdateDomainInput,
  UpdateContextInput,
  UpdateUnderstandingInput,
} from "@reflecta/server";
import { domainService, contextService, understandingService } from "../core";

export const PI_APPROVAL_TOOL_NAMES = [
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
export type PiApprovalToolName = (typeof PI_APPROVAL_TOOL_NAMES)[number];

const mediums = ["experience", "video", "book", "article", "opinion", "ai", "other"] as const;
const domainIdsParameter = Type.Optional(Type.Array(Type.String()));
const nullableStringParameter = Type.Union([Type.String(), Type.Null()]);
const mediumParameter = Type.Union(mediums.map((medium) => Type.Literal(medium)));

type PiMutationOutput = {
  resultRefType: "understanding" | "domain" | "context";
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
    name: "understanding_create",
    label: "候选 Understanding",
    description:
      "Create a new Reflecta Understanding only after user approval. Call this when the user asks you to propose or create a Understanding. The tool requests approval; it must not change Reflecta until the user confirms.",
    promptSnippet:
      "understanding_create: propose a new Reflecta Understanding and request user approval.",
    promptGuidelines: [
      "When the user asks to create or propose a Understanding, call understanding_create and wait for user approval.",
      "Do not claim a Understanding has been written until approval is confirmed.",
    ],
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "Short Understanding title." })),
      body: Type.String({ minLength: 1, description: "Markdown body for the new Understanding." }),
      domainIds: domainIdsParameter,
    }),
  },
  {
    name: "understanding_update",
    label: "候选修改 Understanding",
    description:
      "Update an existing Reflecta Understanding only after user approval. Use this when the user asks to rewrite, retitle, or recategorize an existing Understanding.",
    promptSnippet: "understanding_update: propose an update to an existing Reflecta Understanding.",
    promptGuidelines: [
      "Read the existing Understanding first, then call understanding_update with the intended change.",
    ],
    parameters: Type.Object({
      understandingId: Type.String({ minLength: 1 }),
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
          domainIds: domainIdsParameter,
        }),
      ),
      title: Type.Optional(nullableStringParameter),
      body: Type.Optional(Type.String()),
      domainIds: domainIdsParameter,
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "understanding_delete",
    label: "候选删除 Understanding",
    description: "Delete an existing Reflecta Understanding only after user approval.",
    promptSnippet: "understanding_delete: propose deleting an existing Reflecta Understanding.",
    parameters: Type.Object({
      understandingId: Type.String({ minLength: 1 }),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "domain_create",
    label: "候选 Domain",
    description: "Create a new Reflecta Domain only after user approval.",
    promptSnippet: "domain_create: propose a new Reflecta Domain.",
    promptGuidelines: [
      "When the user asks to create or propose a Domain, call domain_create and wait for user approval.",
      "If the user gives a Domain name but no parent, call domain_create with that name and omit parentId instead of asking a follow-up question.",
      "Do not present a prose-only Domain proposal when domain_create can express it.",
    ],
    parameters: Type.Object({
      name: Type.String({ minLength: 1 }),
      parentId: Type.Optional(nullableStringParameter),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "domain_update",
    label: "候选修改 Domain",
    description: "Rename or move an existing Reflecta Domain only after user approval.",
    promptSnippet: "domain_update: propose updating or moving a Reflecta Domain.",
    parameters: Type.Object({
      domainId: Type.String({ minLength: 1 }),
      name: Type.Optional(Type.String()),
      parentId: Type.Optional(nullableStringParameter),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "domain_delete",
    label: "候选删除 Domain",
    description: "Delete an existing Reflecta Domain only after user approval.",
    promptSnippet: "domain_delete: propose deleting a Reflecta Domain.",
    parameters: Type.Object({
      domainId: Type.String({ minLength: 1 }),
      deleteUnderstandings: Type.Optional(Type.Boolean()),
      reason: Type.Optional(Type.String()),
    }),
  },
  {
    name: "context_create",
    label: "候选 Context",
    description: "Add Context to an existing Understanding only after user approval.",
    promptSnippet: "context_create: propose adding Context to an Understanding.",
    parameters: Type.Object({
      understandingId: Type.String({ minLength: 1 }),
      medium: mediumParameter,
      title: Type.Optional(Type.String()),
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
      medium: Type.Optional(mediumParameter),
      title: Type.Optional(Type.String()),
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
        text: "Approval requested. Reflecta has not been changed yet.",
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

function medium(payload: Record<string, unknown>, required: true): ContextMedium;
function medium(payload: Record<string, unknown>, required?: false): ContextMedium | undefined;
function medium(payload: Record<string, unknown>, required = false): ContextMedium | undefined {
  const value = payload.medium;
  if (mediums.includes(value as ContextMedium)) return value as ContextMedium;
  if (required) throw new Error("候选 Context 缺少 medium。");
  return undefined;
}

function asPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("候选操作参数无效。");
  return value;
}

function understandingCreateInput(payload: unknown): CreateUnderstandingInput {
  const record = asPayload(payload);
  return {
    title: optionalString(record, "title"),
    body: requiredString(record, "body"),
    domainIds: optionalStringArray(record, "domainIds"),
  };
}

function understandingUpdateInput(payload: unknown): {
  understandingId: string;
  input: UpdateUnderstandingInput;
} {
  const record = asPayload(payload);
  const after = optionalRecord(record, "after");
  return {
    understandingId: requiredString(record, "understandingId"),
    input: {
      title: optionalNullableString(after, "title") ?? optionalNullableString(record, "title"),
      body: optionalString(after, "body") ?? optionalString(record, "body"),
      domainIds:
        optionalStringArray(after, "domainIds") ?? optionalStringArray(record, "domainIds"),
    },
  };
}

function understandingDeleteInput(payload: unknown): string {
  return requiredString(asPayload(payload), "understandingId");
}

function domainCreateInput(payload: unknown): CreateDomainInput {
  const record = asPayload(payload);
  return {
    name: requiredString(record, "name"),
    parentId: optionalNullableString(record, "parentId"),
  };
}

function domainUpdateInput(payload: unknown): { domainId: string; input: UpdateDomainInput } {
  const record = asPayload(payload);
  return {
    domainId: requiredString(record, "domainId"),
    input: {
      name: optionalString(record, "name"),
      parentId: optionalNullableString(record, "parentId"),
    },
  };
}

function domainDeleteInput(payload: unknown): { domainId: string; deleteUnderstandings?: boolean } {
  const record = asPayload(payload);
  return {
    domainId: requiredString(record, "domainId"),
    deleteUnderstandings: optionalBoolean(record, "deleteUnderstandings"),
  };
}

function contextCreateInput(payload: unknown): CreateContextInput {
  const record = asPayload(payload);
  return {
    understandingId: requiredString(record, "understandingId"),
    medium: medium(record, true),
    title: optionalString(record, "title"),
    content: requiredString(record, "content"),
  };
}

function contextUpdateInput(payload: unknown): { contextId: string; input: UpdateContextInput } {
  const record = asPayload(payload);
  return {
    contextId: requiredString(record, "contextId"),
    input: {
      medium: medium(record),
      title: optionalString(record, "title"),
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
  if (toolName === "understanding_create") {
    const understanding = await understandingService.createUnderstanding(
      understandingCreateInput(payload),
    );
    return { resultRefType: "understanding", resultRefId: understanding.id };
  }

  if (toolName === "understanding_update") {
    const { understandingId, input } = understandingUpdateInput(payload);
    const understanding = await understandingService.updateUnderstanding(understandingId, input);
    return { resultRefType: "understanding", resultRefId: understanding.id };
  }

  if (toolName === "understanding_delete") {
    const understandingId = understandingDeleteInput(payload);
    await understandingService.deleteUnderstanding(understandingId);
    return { resultRefType: "understanding", resultRefId: understandingId };
  }

  if (toolName === "domain_create") {
    const domain = await domainService.createDomain(domainCreateInput(payload));
    return { resultRefType: "domain", resultRefId: domain.id };
  }

  if (toolName === "domain_update") {
    const { domainId, input } = domainUpdateInput(payload);
    const domain = await domainService.updateDomain(domainId, input);
    return { resultRefType: "domain", resultRefId: domain.id };
  }

  if (toolName === "domain_delete") {
    const { domainId, deleteUnderstandings } = domainDeleteInput(payload);
    await domainService.deleteDomain(domainId, deleteUnderstandings);
    return { resultRefType: "domain", resultRefId: domainId };
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
