import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  domainCliService,
  contextCliService,
  graphCliService,
  searchCliService,
  understandingCliService,
} from "../core";

export const PI_READ_ONLY_TOOL_NAMES = [
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "retrieve_knowledge",
  "search",
  "graph",
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
        "Inspect a Reflecta domain and optionally include its Understandings, Contexts, and relations.",
      promptSnippet: "domain_inspect: inspect one Reflecta domain.",
      parameters: Type.Object({
        domainId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeRelations: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { domainId, includeRelations, ...options }) =>
        toolResult(
          await domainCliService.inspectDomain(domainId, {
            ...options,
            includeEdges: includeRelations,
          }),
        ),
    }),
    defineTool({
      name: "understanding_list",
      label: "列出 Understanding",
      description: "List Reflecta Understandings, optionally filtered by domains.",
      promptSnippet: "understanding_list: list Reflecta Understandings.",
      parameters: Type.Object({
        domainIds: Type.Optional(Type.Array(Type.String())),
        includeDescendants: Type.Optional(Type.Boolean()),
        includeContexts: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { includeContexts, ...input }) =>
        toolResult(
          includeContexts
            ? await understandingCliService.listUnderstandingsWithContexts(input)
            : await understandingCliService.listUnderstandings(input),
        ),
    }),
    defineTool({
      name: "understanding_get",
      label: "读取 Understanding",
      description:
        "Get a Reflecta Understanding by id. Use includeContexts for its Context and includeRelations for its wiki-link relations.",
      promptSnippet: "understanding_get: read one Reflecta Understanding by id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeRelations: Type.Optional(Type.Boolean()),
      }),
      execute: async (_toolCallId, { understandingId, includeRelations, ...options }) =>
        toolResult(
          await understandingCliService.getUnderstanding(understandingId, {
            ...options,
            includeRelations,
          }),
        ),
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
      name: "retrieve_knowledge",
      label: "检索知识",
      description:
        "Retrieve Reflecta Understanding candidates with matched Context evidence and suggested next reads.",
      promptSnippet:
        "retrieve_knowledge: retrieve Understanding candidates with matched Context evidence.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: paginationParameters.limit,
      }),
      execute: async (_toolCallId, { query, limit }) =>
        toolResult(await searchCliService.retrieveKnowledge({ query, limit })),
    }),
    defineTool({
      name: "search",
      label: "搜索",
      description: "Search Reflecta Understandings and Contexts with a plain text query.",
      promptSnippet: "search: search Reflecta Understandings and Contexts.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        ...paginationParameters,
      }),
      execute: async (_toolCallId, { query, ...options }) =>
        toolResult(await searchCliService.search(query, options)),
    }),
    defineTool({
      name: "graph",
      label: "查看关联图",
      description: "Get the wiki-link graph around one Reflecta Understanding.",
      promptSnippet: "graph: get the wiki-link graph around one Reflecta Understanding.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContext: Type.Optional(Type.Boolean()),
        depth: Type.Optional(Type.Integer({ minimum: 0, maximum: 6 })),
      }),
      execute: async (_toolCallId, { understandingId, ...options }) =>
        toolResult(await graphCliService.graph(understandingId, options)),
    }),
  ];
}
