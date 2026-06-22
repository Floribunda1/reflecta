import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  categoryCliService,
  contextCliService,
  graphService,
  searchCliService,
  snapshotService,
  thoughtCliService,
} from "../core";

export const PI_READ_ONLY_TOOL_NAMES = [
  "snapshot_project",
  "category_list",
  "category_inspect",
  "thought_list",
  "thought_get",
  "context_list",
  "context_get",
  "search_all",
  "search_thoughts",
  "search_contexts",
  "graph_neighborhood",
  "graph_path",
] as const;

const paginationParameters = {
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 200,
      description: "Maximum number of records to return.",
    }),
  ),
  offset: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: "Number of records to skip.",
    }),
  ),
};

function toolResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}

export function createPiReadOnlyTools(): ToolDefinition[] {
  return [
    defineTool({
      name: "snapshot_project",
      label: "项目概览",
      description:
        "Get a compact Reflecta knowledge-base snapshot: categories, recent Thoughts, and stats. Use this before broad exploration.",
      promptSnippet: "snapshot_project: get a compact Reflecta knowledge-base snapshot.",
      parameters: Type.Object({}),
      execute: async () => toolResult(await snapshotService.projectSnapshot()),
    }),
    defineTool({
      name: "category_list",
      label: "列出 Category",
      description: "List Reflecta categories.",
      promptSnippet: "category_list: list Reflecta categories.",
      parameters: Type.Object({}),
      execute: async () => toolResult(await categoryCliService.listCategories()),
    }),
    defineTool({
      name: "category_inspect",
      label: "查看 Category",
      description:
        "Inspect a Reflecta category and optionally include its Thoughts, Contexts, and graph edges.",
      promptSnippet: "category_inspect: inspect one Reflecta category.",
      parameters: Type.Object({
        categoryId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeEdges: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { categoryId, ...options }) =>
        toolResult(await categoryCliService.inspectCategory(categoryId, options)),
    }),
    defineTool({
      name: "thought_list",
      label: "列出 Thought",
      description: "List Reflecta Thoughts, optionally filtered by categories.",
      promptSnippet: "thought_list: list Reflecta Thoughts.",
      parameters: Type.Object({
        categoryIds: Type.Optional(Type.Array(Type.String())),
        includeDescendants: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, input) =>
        toolResult(await thoughtCliService.listThoughts(input)),
    }),
    defineTool({
      name: "thought_get",
      label: "读取 Thought",
      description:
        "Get a Reflecta Thought by id. Use includeContexts/includeReferences/includeReferencedBys for surrounding material.",
      promptSnippet: "thought_get: read one Reflecta Thought by id.",
      parameters: Type.Object({
        thoughtId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeReferences: Type.Optional(Type.Boolean()),
        includeReferencedBys: Type.Optional(Type.Boolean()),
      }),
      execute: async (_toolCallId, { thoughtId, ...options }) =>
        toolResult(await thoughtCliService.getThought(thoughtId, options)),
    }),
    defineTool({
      name: "context_list",
      label: "列出 Context",
      description: "List Contexts attached to a Reflecta Thought.",
      promptSnippet: "context_list: list Contexts for a Thought.",
      parameters: Type.Object({
        thoughtId: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, { thoughtId }) =>
        toolResult(await contextCliService.listContexts(thoughtId)),
    }),
    defineTool({
      name: "context_get",
      label: "读取 Context",
      description: "Get one Reflecta Context by id.",
      promptSnippet: "context_get: read one Reflecta Context by id.",
      parameters: Type.Object({
        contextId: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, { contextId }) =>
        toolResult(await contextCliService.getContext(contextId)),
    }),
    defineTool({
      name: "search_all",
      label: "搜索知识库",
      description:
        "Search Reflecta Thoughts and Contexts with a plain text query. Use this whenever the user asks to search the knowledge base.",
      promptSnippet: "search_all: search Reflecta Thoughts and Contexts.",
      promptGuidelines: [
        "When the user asks to search or read Reflecta knowledge, call search_all before answering.",
      ],
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { query, ...options }) =>
        toolResult(await searchCliService.searchAll(query, options)),
    }),
    defineTool({
      name: "search_thoughts",
      label: "搜索 Thought",
      description: "Search only Reflecta Thoughts with a plain text query.",
      promptSnippet: "search_thoughts: search Reflecta Thoughts.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { query, ...options }) =>
        toolResult(await searchCliService.searchThoughts(query, options)),
    }),
    defineTool({
      name: "search_contexts",
      label: "搜索 Context",
      description: "Search only Reflecta Contexts with a plain text query.",
      promptSnippet: "search_contexts: search Reflecta Contexts.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { query, ...options }) =>
        toolResult(await searchCliService.searchContexts(query, options)),
    }),
    defineTool({
      name: "graph_neighborhood",
      label: "查看关联",
      description: "Get nearby Thoughts connected to a seed Thought.",
      promptSnippet: "graph_neighborhood: inspect nearby connected Thoughts.",
      parameters: Type.Object({
        thoughtId: Type.String({ minLength: 1 }),
        depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
        includeContexts: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { thoughtId, ...options }) =>
        toolResult(await graphService.graphNeighborhood(thoughtId, options)),
    }),
    defineTool({
      name: "graph_path",
      label: "查找路径",
      description: "Find directed graph paths between two Thoughts.",
      promptSnippet: "graph_path: find directed paths between two Thoughts.",
      parameters: Type.Object({
        fromId: Type.String({ minLength: 1 }),
        toId: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, { fromId, toId }) =>
        toolResult(await graphService.graphPath(fromId, toId)),
    }),
  ];
}
