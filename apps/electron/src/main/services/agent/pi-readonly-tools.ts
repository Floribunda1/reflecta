import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  domainCliService,
  contextCliService,
  graphService,
  searchCliService,
  snapshotService,
  understandingCliService,
} from "../core";

export const PI_READ_ONLY_TOOL_NAMES = [
  "snapshot_project",
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "search_all",
  "search_understandings",
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
        "Get a compact Reflecta knowledge-base snapshot: domains, recent Understandings, and stats. Use this before broad exploration.",
      promptSnippet: "snapshot_project: get a compact Reflecta knowledge-base snapshot.",
      parameters: Type.Object({}),
      execute: async () => toolResult(await snapshotService.projectSnapshot()),
    }),
    defineTool({
      name: "domain_list",
      label: "列出 Domain",
      description: "List Reflecta domains.",
      promptSnippet: "domain_list: list Reflecta domains.",
      parameters: Type.Object({}),
      execute: async () => toolResult(await domainCliService.listDomains()),
    }),
    defineTool({
      name: "domain_inspect",
      label: "查看 Domain",
      description:
        "Inspect a Reflecta domain and optionally include its Understandings, Contexts, and graph edges.",
      promptSnippet: "domain_inspect: inspect one Reflecta domain.",
      parameters: Type.Object({
        domainId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeEdges: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { domainId, ...options }) =>
        toolResult(await domainCliService.inspectDomain(domainId, options)),
    }),
    defineTool({
      name: "understanding_list",
      label: "列出 Understanding",
      description: "List Reflecta Understandings, optionally filtered by domains.",
      promptSnippet: "understanding_list: list Reflecta Understandings.",
      parameters: Type.Object({
        domainIds: Type.Optional(Type.Array(Type.String())),
        includeDescendants: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, input) =>
        toolResult(await understandingCliService.listUnderstandings(input)),
    }),
    defineTool({
      name: "understanding_get",
      label: "读取 Understanding",
      description:
        "Get a Reflecta Understanding by id. Use includeContexts/includeReferences/includeReferencedBys for surrounding material.",
      promptSnippet: "understanding_get: read one Reflecta Understanding by id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeReferences: Type.Optional(Type.Boolean()),
        includeReferencedBys: Type.Optional(Type.Boolean()),
      }),
      execute: async (_toolCallId, { understandingId, ...options }) =>
        toolResult(await understandingCliService.getUnderstanding(understandingId, options)),
    }),
    defineTool({
      name: "context_list",
      label: "列出 Context",
      description: "List Contexts attached to a Reflecta Understanding.",
      promptSnippet: "context_list: list Contexts for a Understanding.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, { understandingId }) =>
        toolResult(await contextCliService.listContexts(understandingId)),
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
        "Search Reflecta Understandings and Contexts with a plain text query. Use this whenever the user asks to search the knowledge base.",
      promptSnippet: "search_all: search Reflecta Understandings and Contexts.",
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
      name: "search_understandings",
      label: "搜索 Understanding",
      description: "Search only Reflecta Understandings with a plain text query.",
      promptSnippet: "search_understandings: search Reflecta Understandings.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { query, ...options }) =>
        toolResult(await searchCliService.searchUnderstandings(query, options)),
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
      description: "Get nearby Understandings connected to a seed Understanding.",
      promptSnippet: "graph_neighborhood: inspect nearby connected Understandings.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
        includeContexts: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { understandingId, ...options }) =>
        toolResult(await graphService.graphNeighborhood(understandingId, options)),
    }),
    defineTool({
      name: "graph_path",
      label: "查找路径",
      description: "Find directed graph paths between two Understandings.",
      promptSnippet: "graph_path: find directed paths between two Understandings.",
      parameters: Type.Object({
        fromId: Type.String({ minLength: 1 }),
        toId: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, { fromId, toId }) =>
        toolResult(await graphService.graphPath(fromId, toId)),
    }),
  ];
}
