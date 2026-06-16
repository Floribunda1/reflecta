import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { thoughtConnections } from "@reflecta/server";
import type {
  CategoryElectronBff,
  ContextElectronBff,
  ReflectaDb,
  SearchElectronBff,
  ThoughtElectronBff,
} from "@reflecta/server";
import type { ChatStreamEvent } from "@shared/chat";
import { z } from "zod";
import type { ToolApprovalHost } from "./runtime";

export const READ_TOOL_NAMES = new Set([
  "search_knowledge_base",
  "get_thought_detail",
  "get_graph_neighborhood",
]);

export const WRITE_TOOL_NAMES = new Set([
  "propose_create_thought",
  "propose_update_thought",
  "propose_add_context",
  "propose_create_connection",
]);

const SearchParams = z.object({
  query: z.string().describe("Search query"),
});

const ThoughtIdParams = z.object({
  thoughtId: z.string().describe("Thought ID"),
});

const CreateThoughtParams = z.object({
  title: z.string().describe("Thought title"),
  body: z.string().describe("Thought body in markdown"),
  categoryIds: z.array(z.string()).optional(),
});

const UpdateThoughtParams = z.object({
  thoughtId: z.string(),
  title: z.string().nullable().optional(),
  body: z.string().optional(),
});

const AddContextParams = z.object({
  thoughtId: z.string(),
  sourceType: z.enum(["experience", "video", "book", "article", "opinion", "ai"]),
  sourceName: z.string().optional(),
  content: z.string(),
});

const CreateConnectionParams = z.object({
  sourceId: z.string(),
  targetId: z.string(),
});

type SearchParams = z.infer<typeof SearchParams>;
type ThoughtIdParams = z.infer<typeof ThoughtIdParams>;
type CreateThoughtParams = z.infer<typeof CreateThoughtParams>;
type UpdateThoughtParams = z.infer<typeof UpdateThoughtParams>;
type AddContextParams = z.infer<typeof AddContextParams>;
type CreateConnectionParams = z.infer<typeof CreateConnectionParams>;

export type ReflectaToolDeps = {
  thoughtService: ThoughtElectronBff;
  contextService: ContextElectronBff;
  searchService: SearchElectronBff;
  categoryService: CategoryElectronBff;
  getDb: () => ReflectaDb;
};

export function createReflectaTools(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool[] {
  return [
    createSearchTool(deps),
    createThoughtDetailTool(deps),
    createGraphNeighborhoodTool(deps),
    createProposeCreateThoughtTool(deps, runtime),
    createProposeUpdateThoughtTool(deps, runtime),
    createProposeAddContextTool(deps, runtime),
    createProposeCreateConnectionTool(deps, runtime),
  ];
}

function textResult(text: string, details: unknown): AgentToolResult<unknown> {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function createSearchTool(deps: ReflectaToolDeps): AgentTool<typeof SearchParams> {
  return {
    name: "search_knowledge_base",
    label: "Search Knowledge Base",
    description: "Search thoughts and contexts in the user's knowledge base using FTS5.",
    parameters: SearchParams,
    execute: async (_toolCallId, params) => {
      const input: SearchParams = SearchParams.parse(params);
      const result = await deps.searchService.search(input.query, { limit: 10 });
      return textResult(JSON.stringify(result, null, 2), result);
    },
  };
}

function createThoughtDetailTool(deps: ReflectaToolDeps): AgentTool<typeof ThoughtIdParams> {
  return {
    name: "get_thought_detail",
    label: "Get Thought Detail",
    description: "Get full thought content including contexts and connections.",
    parameters: ThoughtIdParams,
    execute: async (_toolCallId, params) => {
      const input: ThoughtIdParams = ThoughtIdParams.parse(params);
      const thought = await deps.thoughtService.getThoughtById(input.thoughtId);
      if (!thought) {
        return textResult(`Thought ${input.thoughtId} not found.`, { found: false });
      }
      return textResult(JSON.stringify(thought, null, 2), thought);
    },
  };
}

function createGraphNeighborhoodTool(deps: ReflectaToolDeps): AgentTool<typeof ThoughtIdParams> {
  return {
    name: "get_graph_neighborhood",
    label: "Get Graph Neighborhood",
    description: "Get 1-hop neighbors and category info for a thought.",
    parameters: ThoughtIdParams,
    execute: async (_toolCallId, params) => {
      const input: ThoughtIdParams = ThoughtIdParams.parse(params);
      const thought = await deps.thoughtService.getThoughtById(input.thoughtId);
      if (!thought) {
        return textResult(`Thought ${input.thoughtId} not found.`, { found: false });
      }
      const categories = await deps.categoryService.listCategories();
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const payload = {
        thought: {
          id: thought.id,
          title: thought.title,
        },
        categories: thought.categoryIds.map((id) => ({
          id,
          name: categoryMap.get(id) ?? id,
        })),
        connections: thought.connections.map((c) => ({
          id: c.id,
          title: c.title,
        })),
        referencedBy: thought.referencedBy.map((c) => ({
          id: c.id,
          title: c.title,
        })),
      };
      return textResult(JSON.stringify(payload, null, 2), payload);
    },
  };
}

function createProposeCreateThoughtTool(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool<typeof CreateThoughtParams> {
  return {
    name: "propose_create_thought",
    label: "Propose Create Thought",
    description: "Propose creating a new thought. Requires user confirmation.",
    parameters: CreateThoughtParams,
    execute: async (toolCallId, params, signal) => {
      const input: CreateThoughtParams = CreateThoughtParams.parse(params);
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_create_thought",
        input,
        signal,
        async () => {
          const created = await deps.thoughtService.createThought({
            title: input.title,
            body: input.body,
            categoryIds: input.categoryIds,
          });
          return { thoughtId: created.id, title: created.title };
        },
      );
    },
    executionMode: "sequential",
  };
}

function createProposeUpdateThoughtTool(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool<typeof UpdateThoughtParams> {
  return {
    name: "propose_update_thought",
    label: "Propose Update Thought",
    description: "Propose updating an existing thought. Requires user confirmation.",
    parameters: UpdateThoughtParams,
    execute: async (toolCallId, params, signal) => {
      const input: UpdateThoughtParams = UpdateThoughtParams.parse(params);
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_update_thought",
        input,
        signal,
        async () => {
          const updated = await deps.thoughtService.updateThought(input.thoughtId, {
            title: input.title,
            body: input.body,
          });
          return { thoughtId: updated.id, title: updated.title };
        },
      );
    },
    executionMode: "sequential",
  };
}

function createProposeAddContextTool(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool<typeof AddContextParams> {
  return {
    name: "propose_add_context",
    label: "Propose Add Context",
    description: "Propose adding context to a thought. Requires user confirmation.",
    parameters: AddContextParams,
    execute: async (toolCallId, params, signal) => {
      const input: AddContextParams = AddContextParams.parse(params);
      return runWriteTool(runtime, toolCallId, "propose_add_context", input, signal, async () => {
        const created = await deps.contextService.createContext({
          thoughtId: input.thoughtId,
          sourceType: input.sourceType,
          sourceName: input.sourceName,
          content: input.content,
        });
        return { contextId: created.id, thoughtId: created.thoughtId };
      });
    },
    executionMode: "sequential",
  };
}

function createProposeCreateConnectionTool(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool<typeof CreateConnectionParams> {
  return {
    name: "propose_create_connection",
    label: "Propose Create Connection",
    description: "Propose creating a connection between two thoughts. Requires user confirmation.",
    parameters: CreateConnectionParams,
    execute: async (toolCallId, params, signal) => {
      const input: CreateConnectionParams = CreateConnectionParams.parse(params);
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_create_connection",
        input,
        signal,
        async () => {
          await deps
            .getDb()
            .insert(thoughtConnections)
            .values({ sourceId: input.sourceId, targetId: input.targetId })
            .onConflictDoNothing();
          return { sourceId: input.sourceId, targetId: input.targetId };
        },
      );
    },
    executionMode: "sequential",
  };
}

async function runWriteTool<TParams>(
  runtime: ToolApprovalHost,
  toolCallId: string,
  toolName: string,
  input: TParams,
  signal: AbortSignal | undefined,
  executeApproved: () => Promise<unknown>,
): Promise<AgentToolResult<unknown>> {
  await runtime.emitToolEvent({
    type: "tool_pending",
    toolCallId,
    toolName,
    input,
  });

  const approved = await runtime.waitForToolApproval(toolCallId, signal);
  if (!approved) {
    await runtime.emitToolEvent({
      type: "tool_result",
      toolCallId,
      toolName,
      result: { rejected: true, message: "User rejected this action." },
      isError: true,
    });
    return textResult("User rejected this action.", { rejected: true });
  }

  await runtime.emitToolEvent({
    type: "tool_running",
    toolCallId,
    toolName,
    input,
  });

  const result = await executeApproved();
  await runtime.emitToolEvent({
    type: "tool_result",
    toolCallId,
    toolName,
    result,
  });

  return textResult(JSON.stringify(result, null, 2), result);
}

export type ToolEventEmitter = (event: ChatStreamEvent) => Promise<void>;
