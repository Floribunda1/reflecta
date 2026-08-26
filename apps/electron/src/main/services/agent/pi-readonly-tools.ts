import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { PI_READ_ONLY_TOOL_NAMES, PI_TOOL_LABELS } from "@reflecta/shared";
import type { AgentFileAttachment } from "@shared/agent";
import { diagnosticErrorAttrs } from "../../diagnostic-log";
import { writeDiagnosticEvent } from "../../logger";
import {
  domainCliService,
  contextCliService,
  searchCliService,
  understandingCanvasCliService,
  understandingCliService,
} from "../core";
import { HARD_ATTACHMENT_READ_MAX_CHARS, readAttachmentForTool } from "./attachment-read";

export { PI_READ_ONLY_TOOL_NAMES };

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

export type PiReadOnlyToolEntityOptions = {
  collectToolOutput?: (toolName: string, toolCallId: string, output: unknown) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compactAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== undefined));
}

function toolInputKeys(input: unknown): string[] | undefined {
  return isRecord(input) ? Object.keys(input) : undefined;
}

function toolResultSummary(result: unknown): Record<string, unknown> {
  const details = isRecord(result) && "details" in result ? result.details : result;
  if (Array.isArray(details)) return { outputType: "array", outputCount: details.length };
  if (isRecord(details)) return { outputType: "object", outputKeys: Object.keys(details) };
  return { outputType: typeof details };
}

function withToolDiagnosticLog(tool: ToolDefinition): ToolDefinition {
  const execute = tool.execute;
  if (!execute) return tool;
  const wrapped = (async (...args: Parameters<typeof execute>) => {
    const [toolCallId, input] = args;
    const context = typeof toolCallId === "string" ? { toolCallId } : undefined;
    const startedAt = performance.now();
    writeDiagnosticEvent({
      level: "debug",
      event: "agent.tool.started",
      scope: "agent",
      context,
      attrs: compactAttrs({
        toolName: tool.name,
        inputKeys: toolInputKeys(input),
      }),
    });
    try {
      const result = await execute(...args);
      writeDiagnosticEvent({
        level: "debug",
        event: "agent.tool.completed",
        scope: "agent",
        context,
        attrs: compactAttrs({
          toolName: tool.name,
          durationMs: Math.round(performance.now() - startedAt),
          ...toolResultSummary(result),
        }),
      });
      return result;
    } catch (error) {
      writeDiagnosticEvent({
        level: "error",
        event: "agent.tool.failed",
        scope: "agent",
        context,
        attrs: compactAttrs({
          toolName: tool.name,
          durationMs: Math.round(performance.now() - startedAt),
          ...diagnosticErrorAttrs(error),
        }),
      });
      throw error;
    }
  }) as typeof execute;
  return { ...tool, execute: wrapped };
}

function createToolResult(
  toolName: string,
  toolCallId: string,
  details: unknown,
  entityOptions: PiReadOnlyToolEntityOptions,
) {
  entityOptions.collectToolOutput?.(toolName, toolCallId, details);
  return toolResult(details);
}

export function createPiReadOnlyTools(
  files: AgentFileAttachment[] = [],
  entityOptions: PiReadOnlyToolEntityOptions = {},
): ToolDefinition[] {
  const tools = [
    defineTool({
      name: "domain_list",
      label: PI_TOOL_LABELS.domain_list,
      description: "List Reflecta domains.",
      promptSnippet: "domain_list: list Reflecta domains.",
      parameters: Type.Object({}),
      execute: async (toolCallId) =>
        createToolResult(
          "domain_list",
          toolCallId,
          await domainCliService.listDomains(),
          entityOptions,
        ),
    }),
    defineTool({
      name: "domain_inspect",
      label: PI_TOOL_LABELS.domain_inspect,
      description:
        "Inspect a Reflecta domain by stable id and optionally include its Understandings, Contexts, and wiki-link mentions.",
      promptSnippet: "domain_inspect: inspect one Reflecta domain by stable id.",
      parameters: Type.Object({
        domainId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeMentions: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (toolCallId, { domainId, includeMentions, ...options }) =>
        createToolResult(
          "domain_inspect",
          toolCallId,
          await domainCliService.inspectDomain(domainId, {
            ...options,
            includeEdges: includeMentions,
          }),
          entityOptions,
        ),
    }),
    defineTool({
      name: "understanding_list",
      label: PI_TOOL_LABELS.understanding_list,
      description: "List Reflecta Understandings, optionally filtered by domains.",
      promptSnippet: "understanding_list: list Reflecta Understandings.",
      parameters: Type.Object({
        domainIds: Type.Optional(Type.Array(Type.String())),
        includeDescendants: Type.Optional(Type.Boolean()),
        includeContexts: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (toolCallId, { includeContexts, ...input }) =>
        createToolResult(
          "understanding_list",
          toolCallId,
          includeContexts
            ? await understandingCliService.listUnderstandingsWithContexts(input)
            : await understandingCliService.listUnderstandings(input),
          entityOptions,
        ),
    }),
    defineTool({
      name: "understanding_get",
      label: PI_TOOL_LABELS.understanding_get,
      description:
        "Get a Reflecta Understanding by stable id. Use includeContexts for its Context and includeMentions for its wiki-link mentions (weak citations, not structural relations). Also returns referencedByCanvases: the canvases this Understanding appears in.",
      promptSnippet: "understanding_get: read one Reflecta Understanding by stable id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeMentions: Type.Optional(Type.Boolean()),
      }),
      execute: async (toolCallId, { understandingId, includeMentions, ...options }) =>
        createToolResult(
          "understanding_get",
          toolCallId,
          await understandingCliService.getUnderstanding(understandingId, {
            ...options,
            includeMentions,
          }),
          entityOptions,
        ),
    }),
    defineTool({
      name: "context_list",
      label: PI_TOOL_LABELS.context_list,
      description: "List Contexts attached to a Reflecta Understanding by stable id.",
      promptSnippet: "context_list: list Contexts for a Understanding by stable id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
      }),
      execute: async (toolCallId, { understandingId }) =>
        createToolResult(
          "context_list",
          toolCallId,
          await contextCliService.listContexts(understandingId),
          entityOptions,
        ),
    }),
    defineTool({
      name: "context_get",
      label: PI_TOOL_LABELS.context_get,
      description: "Get one Reflecta Context by stable id.",
      promptSnippet: "context_get: read one Reflecta Context by stable id.",
      parameters: Type.Object({
        contextId: Type.String({ minLength: 1 }),
      }),
      execute: async (toolCallId, { contextId }) =>
        createToolResult(
          "context_get",
          toolCallId,
          await contextCliService.getContext(contextId),
          entityOptions,
        ),
    }),
    defineTool({
      name: "attachment_read",
      label: PI_TOOL_LABELS.attachment_read,
      description:
        "Read text from a user-uploaded attachment in the current message. Supports PDF and plain text attachments. Use attachmentId from the user message attachment metadata.",
      promptSnippet: "attachment_read: read a user-uploaded attachment by attachmentId.",
      parameters: Type.Object({
        attachmentId: Type.String({ minLength: 1 }),
        maxChars: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: HARD_ATTACHMENT_READ_MAX_CHARS,
            description: "Maximum number of extracted characters to return.",
          }),
        ),
      }),
      execute: async (toolCallId, input) =>
        createToolResult(
          "attachment_read",
          toolCallId,
          await readAttachmentForTool(files, input),
          entityOptions,
        ),
    }),
    defineTool({
      name: "retrieve_knowledge",
      label: PI_TOOL_LABELS.retrieve_knowledge,
      description:
        "Retrieve the user's prior Understandings and supporting Contexts when the discussion depends on their earlier views, experiences, comparisons, revisions, or possible conflicts.\n\nHow to query: describe in natural language the object and judgment the user is discussing, keeping proper nouns (titles, names, terms). Don't use keyword lists.\n\nAfter retrieval: read the 2-3 most relevant candidates. If coverage is insufficient, re-query using new clues from what you read (terms, experiences, connections), at most 2 more rounds — stop as soon as it's enough. If nothing relevant exists, say so instead of forcing an answer.\n\nA candidate Understanding is the user's judgment; matched Contexts are supporting material (experience/ai/article/video) — cite them as evidence, never as the user's understanding. When the user explicitly @-mentioned an entity, read it directly with understanding_get instead of retrieving.",
      promptSnippet:
        "retrieve_knowledge: recall prior Understandings when the discussion depends on them; query with natural language + proper nouns, iterate at most 2 rounds if insufficient, @-mentioned entities are read directly.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        // A3：检索候选上限遵循社区 top-k 实践（默认 10，上限 20）
        limit: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: 20,
            description: "Maximum number of candidates to return.",
          }),
        ),
        // A4：先圈定领域范围再检索（透传为 domain anchors）
        domainIds: Type.Optional(
          Type.Array(Type.String({ minLength: 1 }), {
            description: "Restrict retrieval to these Domains.",
          }),
        ),
      }),
      execute: async (toolCallId, { query, limit, domainIds }) =>
        createToolResult(
          "retrieve_knowledge",
          toolCallId,
          await Effect.runPromise(
            searchCliService.retrieveKnowledge({
              query,
              limit,
              anchors: domainIds?.map((id) => ({ type: "domain" as const, id })),
            }),
          ),
          entityOptions,
        ),
    }),
    defineTool({
      name: "canvas_read",
      label: PI_TOOL_LABELS.canvas_read,
      description:
        "Read one Reflecta canvas structure (elements / edges / groups / labels and referenced Understanding titles). Bodies of referenced Understandings are omitted by default to save tokens; pass includeBodies to fetch them.",
      promptSnippet:
        "canvas_read: read one Reflecta canvas structure by stable id (skeleton by default, bodies opt-in).",
      parameters: Type.Object({
        canvasId: Type.String({
          minLength: 1,
          description: "Stable canvas id returned by Reflecta tools. Do not pass chat refs.",
        }),
        includeBodies: Type.Optional(Type.Boolean()),
      }),
      execute: async (toolCallId, { canvasId, includeBodies }) =>
        createToolResult(
          "canvas_read",
          toolCallId,
          await Effect.runPromise(
            understandingCanvasCliService.getCanvasDetail(canvasId, {
              includeBodies,
            }),
          ),
          entityOptions,
        ),
    }),
    defineTool({
      name: "canvas_list",
      label: PI_TOOL_LABELS.canvas_list,
      description: "List Reflecta canvases, optionally filtered by title keyword, newest first.",
      promptSnippet: "canvas_list: list Reflecta canvases.",
      parameters: Type.Object({
        titleSearchKeyword: Type.Optional(Type.String()),
        limit: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: 200,
            description: "Maximum number of canvases to return.",
          }),
        ),
      }),
      execute: async (toolCallId, { titleSearchKeyword, limit }) =>
        createToolResult(
          "canvas_list",
          toolCallId,
          await Effect.runPromise(
            understandingCanvasCliService.listCanvases({ titleSearchKeyword, limit }),
          ),
          entityOptions,
        ),
    }),
    defineTool({
      name: "canvas_search",
      label: PI_TOOL_LABELS.canvas_search,
      description:
        "Discover Reflecta canvases. Pass a free-text query (matched OR across canvas title, elements, edge labels, group names, referenced Understanding titles) or an understandingId to find canvases that reference that Understanding.",
      promptSnippet:
        "canvas_search: discover canvases by free-text query or by referenced Understanding id.",
      parameters: Type.Object({
        query: Type.Optional(
          Type.String({
            minLength: 1,
            maxLength: 200,
            description: "Free-text query, 1-5 words, whitespace-split OR matching.",
          }),
        ),
        understandingId: Type.Optional(
          Type.String({
            minLength: 1,
            description:
              "Stable Understanding id returned by Reflecta tools. Do not pass chat refs.",
          }),
        ),
        limit: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: 100,
            description: "Maximum number of hits to return.",
          }),
        ),
      }),
      execute: async (toolCallId, { query, understandingId, limit }) =>
        createToolResult(
          "canvas_search",
          toolCallId,
          await Effect.runPromise(
            understandingCanvasCliService.searchCanvases({ query, understandingId, limit }),
          ),
          entityOptions,
        ),
    }),
  ];
  return tools.map(withToolDiagnosticLog);
}
