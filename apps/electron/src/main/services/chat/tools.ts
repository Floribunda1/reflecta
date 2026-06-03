import { Type } from "@sinclair/typebox";
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
import type { ToolApprovalHost } from "./runtime";

export const READ_TOOL_NAMES = new Set([
  "search_knowledge_base",
  "get_thought_detail",
  "get_graph_neighborhood",
]);

export const WRITE_TOOL_NAMES = new Set([
  "propose_create_insight",
  "propose_update_thought",
  "propose_add_context",
  "propose_create_connection",
]);

const SearchParams = Type.Object({
  query: Type.String({ description: "Search query" }),
});

const ThoughtIdParams = Type.Object({
  thoughtId: Type.String({ description: "Thought ID" }),
});

const CreateInsightParams = Type.Object({
  title: Type.String({ description: "Insight title" }),
  body: Type.String({ description: "Insight body in markdown" }),
  categoryIds: Type.Optional(Type.Array(Type.String())),
});

const UpdateThoughtParams = Type.Object({
  thoughtId: Type.String(),
  title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  body: Type.Optional(Type.String()),
});

const AddContextParams = Type.Object({
  thoughtId: Type.String(),
  sourceType: Type.Union([
    Type.Literal("experience"),
    Type.Literal("video"),
    Type.Literal("book"),
    Type.Literal("article"),
    Type.Literal("opinion"),
    Type.Literal("ai"),
  ]),
  sourceName: Type.Optional(Type.String()),
  content: Type.String(),
});

const CreateConnectionParams = Type.Object({
  sourceId: Type.String(),
  targetId: Type.String(),
});

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
    createProposeCreateInsightTool(deps, runtime),
    createProposeUpdateThoughtTool(deps, runtime),
    createProposeAddContextTool(deps, runtime),
    createProposeCreateConnectionTool(deps, runtime),
  ];
}

function textResult(text: string, details: unknown): AgentToolResult<any> {
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
      const result = await deps.searchService.search(params.query, { limit: 10 });
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
      const thought = await deps.thoughtService.getThoughtById(params.thoughtId);
      if (!thought) {
        return textResult(`Thought ${params.thoughtId} not found.`, { found: false });
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
      const thought = await deps.thoughtService.getThoughtById(params.thoughtId);
      if (!thought) {
        return textResult(`Thought ${params.thoughtId} not found.`, { found: false });
      }
      const categories = await deps.categoryService.listCategories();
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const payload = {
        thought: {
          id: thought.id,
          title: thought.title,
          type: thought.type,
        },
        categories: thought.categoryIds.map((id) => ({
          id,
          name: categoryMap.get(id) ?? id,
        })),
        connections: thought.connections.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
        })),
        referencedBy: thought.referencedBy.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
        })),
      };
      return textResult(JSON.stringify(payload, null, 2), payload);
    },
  };
}

function createProposeCreateInsightTool(
  deps: ReflectaToolDeps,
  runtime: ToolApprovalHost,
): AgentTool<typeof CreateInsightParams> {
  return {
    name: "propose_create_insight",
    label: "Propose Create Insight",
    description: "Propose creating a new insight thought. Requires user confirmation.",
    parameters: CreateInsightParams,
    execute: async (toolCallId, params, signal) => {
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_create_insight",
        params,
        signal,
        async () => {
          const created = await deps.thoughtService.createThought({
            type: "insight",
            title: params.title,
            body: params.body,
            categoryIds: params.categoryIds,
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
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_update_thought",
        params,
        signal,
        async () => {
          const updated = await deps.thoughtService.updateThought(params.thoughtId, {
            title: params.title,
            body: params.body,
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
      return runWriteTool(runtime, toolCallId, "propose_add_context", params, signal, async () => {
        const created = await deps.contextService.createContext({
          thoughtId: params.thoughtId,
          sourceType: params.sourceType,
          sourceName: params.sourceName,
          content: params.content,
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
      return runWriteTool(
        runtime,
        toolCallId,
        "propose_create_connection",
        params,
        signal,
        async () => {
          await deps
            .getDb()
            .insert(thoughtConnections)
            .values({ sourceId: params.sourceId, targetId: params.targetId })
            .onConflictDoNothing();
          return { sourceId: params.sourceId, targetId: params.targetId };
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
): Promise<AgentToolResult<any>> {
  await runtime.emitToolEvent({
    type: "tool_pending",
    toolCallId,
    toolName,
    input,
  });

  const approved = await runtime.waitForToolApproval(toolCallId, signal);
  if (!approved) {
    return textResult("User rejected this action.", { rejected: true });
  }

  await runtime.emitToolEvent({
    type: "tool_running",
    toolCallId,
    toolName,
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
