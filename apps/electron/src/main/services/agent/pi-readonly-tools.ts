import { performance } from "node:perf_hooks";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentFileAttachment } from "@shared/agent";
import { diagnosticErrorAttrs } from "../../diagnostic-log";
import { writeDiagnosticEvent } from "../../logger";
import {
  domainCliService,
  contextCliService,
  graphCliService,
  searchCliService,
  understandingCliService,
} from "../core";
import { HARD_ATTACHMENT_READ_MAX_CHARS, readAttachmentForTool } from "./attachment-read";
import { HARD_FILE_READ_MAX_BYTES, readLocalFileForTool } from "./local-tools";
import { fetchWebPage } from "./web-fetch";

export const PI_READ_ONLY_TOOL_NAMES = [
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "attachment_read",
  "file_read",
  "web_fetch",
  "retrieve_knowledge",
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

export type PiReadOnlyToolEntityOptions = {
  collectToolOutput?: (toolName: string, toolCallId: string, output: unknown) => string | undefined;
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
  const citationBlock = entityOptions.collectToolOutput?.(toolName, toolCallId, details);
  const result = toolResult(details);
  if (!citationBlock) return result;
  return {
    ...result,
    content: result.content.map((part) =>
      part.type === "text" ? { ...part, text: `${part.text}${citationBlock}` } : part,
    ),
  };
}

export function createPiReadOnlyTools(
  files: AgentFileAttachment[] = [],
  entityOptions: PiReadOnlyToolEntityOptions = {},
): ToolDefinition[] {
  const tools = [
    defineTool({
      name: "domain_list",
      label: "列出 Domain",
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
      label: "查看 Domain",
      description:
        "Inspect a Reflecta domain by stable id and optionally include its Understandings, Contexts, and relations.",
      promptSnippet: "domain_inspect: inspect one Reflecta domain by stable id.",
      parameters: Type.Object({
        domainId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeRelations: Type.Optional(Type.Boolean()),
        ...paginationParameters,
      }),
      execute: async (toolCallId, { domainId, includeRelations, ...options }) =>
        createToolResult(
          "domain_inspect",
          toolCallId,
          await domainCliService.inspectDomain(domainId, {
            ...options,
            includeEdges: includeRelations,
          }),
          entityOptions,
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
      label: "读取 Understanding",
      description:
        "Get a Reflecta Understanding by stable id. Use includeContexts for its Context and includeRelations for its wiki-link relations.",
      promptSnippet: "understanding_get: read one Reflecta Understanding by stable id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContexts: Type.Optional(Type.Boolean()),
        includeRelations: Type.Optional(Type.Boolean()),
      }),
      execute: async (toolCallId, { understandingId, includeRelations, ...options }) =>
        createToolResult(
          "understanding_get",
          toolCallId,
          await understandingCliService.getUnderstanding(understandingId, {
            ...options,
            includeRelations,
          }),
          entityOptions,
        ),
    }),
    defineTool({
      name: "context_list",
      label: "列出 Context",
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
      label: "读取 Context",
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
      label: "读取附件",
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
      name: "file_read",
      label: "读取本地文件",
      description:
        "Read a local file by absolute path, relative path, or ~/ path. Use this when the user types a local file path in chat and asks you to inspect it. Returns UTF-8 text or base64 for binary files.",
      promptSnippet: "file_read: read a local file path.",
      parameters: Type.Object({
        path: Type.String({ minLength: 1 }),
        maxBytes: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: HARD_FILE_READ_MAX_BYTES,
            description: "Maximum number of bytes to read.",
          }),
        ),
      }),
      execute: async (toolCallId, input) =>
        createToolResult("file_read", toolCallId, await readLocalFileForTool(input), entityOptions),
    }),
    defineTool({
      name: "web_fetch",
      label: "读取网页",
      description:
        "Read a user-provided public http/https URL as markdown. Use this before answering questions about a pasted web page. Returns blocked=true when the page is login-gated or protected.",
      promptSnippet: "web_fetch: read a user-provided public URL as markdown.",
      parameters: Type.Object({
        url: Type.String({ minLength: 1 }),
      }),
      execute: async (toolCallId, { url }) =>
        createToolResult("web_fetch", toolCallId, await fetchWebPage(url), entityOptions),
    }),
    defineTool({
      name: "retrieve_knowledge",
      label: "检索知识",
      description:
        "Retrieve Reflecta knowledge for answering the user. Returns relevant Understanding candidates grouped with matched Context evidence. Use this for knowledge lookup instead of choosing a search strategy.",
      promptSnippet: "retrieve_knowledge: find relevant Reflecta knowledge for answering the user.",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: paginationParameters.limit,
      }),
      execute: async (toolCallId, { query, limit }) =>
        createToolResult(
          "retrieve_knowledge",
          toolCallId,
          await searchCliService.retrieveKnowledge({ query, limit }),
          entityOptions,
        ),
    }),
    defineTool({
      name: "graph",
      label: "查看关联图",
      description: "Get the wiki-link graph around one Reflecta Understanding by stable id.",
      promptSnippet:
        "graph: get the wiki-link graph around one Reflecta Understanding by stable id.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        includeContext: Type.Optional(Type.Boolean()),
        depth: Type.Optional(Type.Integer({ minimum: 0, maximum: 6 })),
      }),
      execute: async (toolCallId, { understandingId, ...options }) =>
        createToolResult(
          "graph",
          toolCallId,
          await graphCliService.graph(understandingId, options),
          entityOptions,
        ),
    }),
  ];
  return tools.map(withToolDiagnosticLog);
}
