import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify, TextDecoder } from "node:util";
import { stepCountIs, tool, type StopCondition, type ToolSet } from "ai";
import { isBinaryFile } from "isbinaryfile";
import { extractText } from "unpdf";
import { z } from "zod";
import {
  categoryCliService,
  categoryService,
  contextCliService,
  contextService,
  graphService,
  searchCliService,
  snapshotService,
  thoughtCliService,
  thoughtService,
} from "../core";
import type { AgentChatMessage, AgentProposalType } from "@shared/chat";
import { findAttachment } from "./attachments";
import type { AgentRepository } from "./repository";

export const AGENT_MAX_STEPS = 20;
const execFileAsync = promisify(execFile);
const DEFAULT_FILE_READ_MAX_BYTES = 200_000;
const HARD_FILE_READ_MAX_BYTES = 1_000_000;
const DEFAULT_ATTACHMENT_READ_MAX_CHARS = 120_000;
const HARD_ATTACHMENT_READ_MAX_CHARS = 500_000;
const MAX_BASH_OUTPUT_CHARS = 120_000;
const DEFAULT_BASH_TIMEOUT_MS = 10_000;
const MAX_BASH_TIMEOUT_MS = 30_000;

const persistentThoughtMarkdown =
  "Persistent editor Markdown links existing Thoughts with [[title#thoughtId]]. " +
  "Context and Category provenance belongs in structured tool fields such as sourceRefs, sourceType, sourceName, and content.";

const sourceTypes = ["experience", "video", "book", "article", "opinion", "ai"] as const;

const categoryIdsSchema = z.array(z.string()).optional();
const pageSchema = {
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
};

const sourceRefsSchema = z
  .array(
    z.object({
      type: z.enum(["thought", "context", "category"]),
      id: z.string().min(1),
      title: z.string().optional(),
    }),
  )
  .optional();

const mutationOutputSchema = z.object({
  resultRefType: z.enum(["thought", "context", "category"]),
  resultRefId: z.string().min(1),
});

type MutationOutput = z.infer<typeof mutationOutputSchema>;
type ToolExecutionOptions = {
  toolCallId: string;
};

type BashToolInput = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
};

type AttachmentReadToolInput = {
  attachmentId: string;
  maxChars?: number;
};

function proposalMetadata(proposalType: AgentProposalType) {
  return { kind: "proposal", proposalType } as const;
}

function localPath(value: string) {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return resolve(value);
}

function clampInt(value: number | undefined, fallback: number, max: number) {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 1), max);
}

function truncateText(value: string) {
  if (value.length <= MAX_BASH_OUTPUT_CHARS) return { value, truncated: false };
  return { value: value.slice(0, MAX_BASH_OUTPUT_CHARS), truncated: true };
}

function looksBinary(buffer: Buffer) {
  return buffer.includes(0);
}

function truncateChars(value: string, limit: number) {
  if (value.length <= limit) return { value, truncated: false };
  return { value: value.slice(0, limit), truncated: true };
}

function parseDataUrl(url: string, fallbackMediaType: string) {
  const match = /^data:([^,]*),([\s\S]*)$/i.exec(url);
  if (!match) return null;
  const header = match[1] ?? "";
  const mediaType = header.split(";")[0] || fallbackMediaType;
  try {
    const buffer = /(?:^|;)base64(?:;|$)/i.test(header)
      ? Buffer.from(match[2] ?? "", "base64")
      : Buffer.from(decodeURIComponent(match[2] ?? ""), "utf8");
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

function isPdf(mediaType: string, buffer: Buffer) {
  return (
    mediaType.toLowerCase() === "application/pdf" ||
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  );
}

function decodeWithBom(buffer: Buffer) {
  try {
    if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
      return {
        encoding: "utf8-bom",
        content: new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(3)),
      };
    }
    if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) {
      return {
        encoding: "utf16le-bom",
        content: new TextDecoder("utf-16le", { fatal: true }).decode(buffer.subarray(2)),
      };
    }
    if (buffer.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
      return {
        encoding: "utf16be-bom",
        content: new TextDecoder("utf-16be", { fatal: true }).decode(buffer.subarray(2)),
      };
    }
  } catch {
    return { error: "附件带有文本 BOM，但内容无法可靠解码。" };
  }
  return null;
}

function decodeUtf8(buffer: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

export async function readLocalFileForTool(input: { path: string; maxBytes?: number }) {
  const path = localPath(input.path);
  const limit = clampInt(input.maxBytes, DEFAULT_FILE_READ_MAX_BYTES, HARD_FILE_READ_MAX_BYTES);
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("路径不是文件");
    const readBytes = Math.min(stats.size, limit + 1);
    const buffer = Buffer.alloc(readBytes);
    const result = await handle.read(buffer, 0, readBytes, 0);
    const data = buffer.subarray(0, Math.min(result.bytesRead, limit));
    const truncated = stats.size > limit || result.bytesRead > limit;
    const base = { path, bytes: stats.size, truncated };
    if (looksBinary(data)) return { ...base, encoding: "base64", content: data.toString("base64") };
    return { ...base, encoding: "utf8", content: data.toString("utf8") };
  } finally {
    await handle.close();
  }
}

export async function readAttachmentForTool(
  messages: AgentChatMessage[],
  input: AttachmentReadToolInput,
) {
  const found = findAttachment(messages, input.attachmentId);
  if (!found) return { attachmentId: input.attachmentId, error: "找不到这个附件。" };

  const parsed = parseDataUrl(found.part.url, found.part.mediaType);
  const base = {
    attachmentId: input.attachmentId,
    filename: found.part.filename,
    mediaType: parsed?.mediaType ?? found.part.mediaType,
    bytes: parsed?.buffer.length ?? 0,
  };
  if (!parsed) return { ...base, error: "附件不是可读取的 data URL。" };

  const limit = clampInt(
    input.maxChars,
    DEFAULT_ATTACHMENT_READ_MAX_CHARS,
    HARD_ATTACHMENT_READ_MAX_CHARS,
  );

  if (isPdf(parsed.mediaType, parsed.buffer)) {
    try {
      const extracted = await extractText(new Uint8Array(parsed.buffer), { mergePages: true });
      const content = truncateChars(extracted.text, limit);
      return {
        ...base,
        kind: "pdf",
        encoding: "pdf-text",
        totalPages: extracted.totalPages,
        content: content.value,
        truncated: content.truncated,
      };
    } catch (error) {
      return { ...base, kind: "pdf", error: `PDF 文本提取失败：${String(error)}` };
    }
  }

  const bom = decodeWithBom(parsed.buffer);
  if (bom) {
    if ("error" in bom) return { ...base, kind: "text", error: bom.error };
    const content = truncateChars(bom.content, limit);
    return {
      ...base,
      kind: "text",
      encoding: bom.encoding,
      content: content.value,
      truncated: content.truncated,
    };
  }

  if (await isBinaryFile(parsed.buffer, { size: parsed.buffer.length })) {
    return { ...base, kind: "binary", error: "附件看起来是二进制文件，当前工具不会返回 base64。" };
  }

  const decoded = decodeUtf8(parsed.buffer);
  if (decoded === null) {
    return {
      ...base,
      kind: "text",
      error: "附件看起来像文本，但不是有效 UTF-8/BOM 编码，暂时无法可靠解码。",
    };
  }
  const content = truncateChars(decoded, limit);
  return {
    ...base,
    kind: "text",
    encoding: "utf8",
    content: content.value,
    truncated: content.truncated,
  };
}

export async function runBashForTool(input: BashToolInput) {
  const timeoutMs = clampInt(input.timeoutMs, DEFAULT_BASH_TIMEOUT_MS, MAX_BASH_TIMEOUT_MS);
  const cwd = input.cwd ? localPath(input.cwd) : undefined;
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-lc", input.command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: MAX_BASH_OUTPUT_CHARS * 4,
    });
    const out = truncateText(stdout);
    const err = truncateText(stderr);
    return {
      command: input.command,
      cwd,
      exitCode: 0,
      stdout: out.value,
      stderr: err.value,
      truncated: out.truncated || err.truncated,
    };
  } catch (error) {
    const record = error as {
      code?: unknown;
      stdout?: unknown;
      stderr?: unknown;
      killed?: boolean;
    };
    const out = truncateText(typeof record.stdout === "string" ? record.stdout : "");
    const err = truncateText(typeof record.stderr === "string" ? record.stderr : String(error));
    return {
      command: input.command,
      cwd,
      exitCode: typeof record.code === "number" ? record.code : null,
      stdout: out.value,
      stderr: err.value,
      timedOut: record.killed || undefined,
      truncated: out.truncated || err.truncated,
    };
  }
}

async function recordApprovalRequest(
  repository: AgentRepository,
  threadId: string,
  toolName: string,
  toolCallId: string,
  input: unknown,
) {
  await repository.recordToolInvocation({
    threadId,
    toolCallId,
    toolName,
    state: "approval_requested",
    input,
    approvalStatus: "pending",
  });
}

async function executeMutation<TInput>(
  repository: AgentRepository,
  threadId: string,
  toolName: string,
  input: TInput,
  { toolCallId }: ToolExecutionOptions,
  execute: (input: TInput) => Promise<MutationOutput>,
) {
  try {
    const output = await execute(input);
    await repository.recordToolInvocation({
      threadId,
      toolCallId,
      toolName,
      state: "output_available",
      input,
      output,
      approvalStatus: "approved",
    });
    await repository.finishToolInvocation(toolCallId, {
      approvalStatus: "approved",
      resultRefType: output.resultRefType,
      resultRefId: output.resultRefId,
      output,
    });
    return output;
  } catch (error) {
    await repository.recordToolInvocation({
      threadId,
      toolCallId,
      toolName,
      state: "output_error",
      input,
      errorText: error instanceof Error ? error.message : String(error),
      approvalStatus: "approved",
    });
    throw error;
  }
}

export function agentStopWhen<TOOLS extends ToolSet>(): StopCondition<TOOLS> {
  return stepCountIs(AGENT_MAX_STEPS);
}

export function createAgentTools(repository: AgentRepository, threadId: string) {
  return {
    snapshot_project: tool({
      title: "项目概览",
      description:
        "Get a compact project snapshot: categories, recent Thoughts, and knowledge-base stats. Use this to orient yourself before broad exploration.",
      inputSchema: z.object({}),
      execute: async () => snapshotService.projectSnapshot(),
    }),
    category_list: tool({
      title: "列出 Category",
      description: "List Reflecta categories.",
      inputSchema: z.object({}),
      execute: async () => categoryCliService.listCategories(),
    }),
    category_inspect: tool({
      title: "查看 Category",
      description:
        "Inspect a category and optionally include its Thoughts, Contexts, and graph edges.",
      inputSchema: z.object({
        categoryId: z.string().min(1),
        includeContexts: z.boolean().optional(),
        includeEdges: z.boolean().optional(),
        ...pageSchema,
      }),
      execute: async ({ categoryId, ...options }) =>
        categoryCliService.inspectCategory(categoryId, options),
    }),
    thought_list: tool({
      title: "列出 Thought",
      description: "List Reflecta Thoughts, optionally filtered by categories.",
      inputSchema: z.object({
        categoryIds: categoryIdsSchema,
        includeDescendants: z.boolean().optional(),
        ...pageSchema,
      }),
      execute: async (input) => thoughtCliService.listThoughts(input),
    }),
    thought_get: tool({
      title: "读取 Thought",
      description:
        "Get a Thought by id. Set includeContexts/includeReferences/includeReferencedBys when you need the full surrounding material.",
      inputSchema: z.object({
        thoughtId: z.string().min(1),
        includeContexts: z.boolean().optional(),
        includeReferences: z.boolean().optional(),
        includeReferencedBys: z.boolean().optional(),
      }),
      execute: async ({ thoughtId, ...options }) =>
        thoughtCliService.getThought(thoughtId, options),
    }),
    context_list: tool({
      title: "列出 Context",
      description: "List Contexts attached to a Thought.",
      inputSchema: z.object({
        thoughtId: z.string().min(1),
      }),
      execute: async ({ thoughtId }) => contextCliService.listContexts(thoughtId),
    }),
    context_get: tool({
      title: "读取 Context",
      description: "Get one Context by id.",
      inputSchema: z.object({
        contextId: z.string().min(1),
      }),
      execute: async ({ contextId }) => contextCliService.getContext(contextId),
    }),
    search_all: tool({
      title: "搜索知识库",
      description: "Search Reflecta Thoughts and Contexts with a plain text query.",
      inputSchema: z.object({
        query: z.string().min(1),
        ...pageSchema,
      }),
      execute: async ({ query, ...options }) => searchCliService.searchAll(query, options),
    }),
    search_thoughts: tool({
      title: "搜索 Thought",
      description: "Search only Reflecta Thoughts with a plain text query.",
      inputSchema: z.object({
        query: z.string().min(1),
        ...pageSchema,
      }),
      execute: async ({ query, ...options }) => searchCliService.searchThoughts(query, options),
    }),
    search_contexts: tool({
      title: "搜索 Context",
      description: "Search only Reflecta Contexts with a plain text query.",
      inputSchema: z.object({
        query: z.string().min(1),
        ...pageSchema,
      }),
      execute: async ({ query, ...options }) => searchCliService.searchContexts(query, options),
    }),
    graph_neighborhood: tool({
      title: "查看关联",
      description: "Get nearby Thoughts connected to a seed Thought.",
      inputSchema: z.object({
        thoughtId: z.string().min(1),
        depth: z.number().int().min(1).max(3).optional(),
        includeContexts: z.boolean().optional(),
        ...pageSchema,
      }),
      execute: async ({ thoughtId, ...options }) =>
        graphService.graphNeighborhood(thoughtId, options),
    }),
    graph_path: tool({
      title: "查找路径",
      description: "Find directed graph paths between two Thoughts.",
      inputSchema: z.object({
        fromId: z.string().min(1),
        toId: z.string().min(1),
      }),
      execute: async ({ fromId, toId }) => graphService.graphPath(fromId, toId),
    }),
    attachment_read: tool({
      title: "读取附件",
      description:
        "Read an uploaded chat attachment by attachmentId. Use this when the user attached a file and the message includes attachment metadata. Returns extracted PDF text or decoded UTF-8/BOM text; binary files are rejected.",
      inputSchema: z.object({
        attachmentId: z.string().min(1),
        maxChars: z.number().int().min(1).max(HARD_ATTACHMENT_READ_MAX_CHARS).optional(),
      }),
      execute: async (input) =>
        readAttachmentForTool(await repository.getMessages(threadId), input),
    }),
    file_read: tool({
      title: "读取本地文件",
      description:
        "Read a local file by absolute path, relative path, or ~/ path. Use this when the user types a local file path in chat and asks you to inspect it. Returns UTF-8 text or base64 for binary files.",
      inputSchema: z.object({
        path: z.string().min(1),
        maxBytes: z.number().int().min(1).max(HARD_FILE_READ_MAX_BYTES).optional(),
      }),
      execute: async (input) => readLocalFileForTool(input),
    }),
    bash: tool({
      title: "执行 Bash",
      description:
        "Run a Bash command after user approval. Use for local shell tasks that cannot be answered by file_read or knowledge-base tools. Prefer read-only commands unless the user explicitly asks for changes.",
      metadata: proposalMetadata("bash"),
      needsApproval: true,
      inputSchema: z.object({
        command: z.string().min(1),
        cwd: z.string().optional(),
        timeoutMs: z.number().int().min(1).max(MAX_BASH_TIMEOUT_MS).optional(),
      }),
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "bash", toolCallId, input),
      execute: async (input, { toolCallId }) => {
        const output = await runBashForTool(input);
        await repository.recordToolInvocation({
          threadId,
          toolCallId,
          toolName: "bash",
          state: "output_available",
          input,
          output,
          approvalStatus: "approved",
        });
        await repository.finishToolInvocation(toolCallId, {
          approvalStatus: "approved",
          output,
        });
        return output;
      },
    }),
    thought_create: tool({
      title: "候选 Thought",
      description:
        "Create a new Reflecta Thought after user approval. " +
        `The body uses ${persistentThoughtMarkdown}`,
      metadata: proposalMetadata("thought_create"),
      needsApproval: true,
      inputSchema: z.object({
        title: z.string().optional(),
        body: z.string().min(1),
        categoryIds: categoryIdsSchema,
        sourceRefs: sourceRefsSchema,
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "thought_create", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "thought_create",
          input,
          options,
          async (proposal) => {
            const thought = await thoughtService.createThought({
              title: proposal.title,
              body: proposal.body,
              categoryIds: proposal.categoryIds,
            });
            return { resultRefType: "thought", resultRefId: thought.id };
          },
        ),
    }),
    thought_update: tool({
      title: "候选修改 Thought",
      description:
        "Update an existing Reflecta Thought after user approval. " +
        `body and after.body use ${persistentThoughtMarkdown}`,
      metadata: proposalMetadata("thought_update"),
      needsApproval: true,
      inputSchema: z.object({
        thoughtId: z.string().min(1),
        before: z
          .object({
            title: z.string().nullable().optional(),
            body: z.string().optional(),
          })
          .optional(),
        after: z
          .object({
            title: z.string().nullable().optional(),
            body: z.string().optional(),
            categoryIds: categoryIdsSchema,
          })
          .optional(),
        title: z.string().nullable().optional(),
        body: z.string().optional(),
        categoryIds: categoryIdsSchema,
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "thought_update", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "thought_update",
          input,
          options,
          async (proposal) => {
            const thought = await thoughtService.updateThought(proposal.thoughtId, {
              title: proposal.after?.title ?? proposal.title,
              body: proposal.after?.body ?? proposal.body,
              categoryIds: proposal.after?.categoryIds ?? proposal.categoryIds,
            });
            return { resultRefType: "thought", resultRefId: thought.id };
          },
        ),
    }),
    thought_delete: tool({
      title: "候选删除 Thought",
      description: "Delete an existing Reflecta Thought after user approval.",
      metadata: proposalMetadata("thought_delete"),
      needsApproval: true,
      inputSchema: z.object({
        thoughtId: z.string().min(1),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "thought_delete", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "thought_delete",
          input,
          options,
          async (proposal) => {
            await thoughtService.deleteThought(proposal.thoughtId);
            return { resultRefType: "thought", resultRefId: proposal.thoughtId };
          },
        ),
    }),
    category_create: tool({
      title: "候选 Category",
      description: "Create a new Reflecta Category after user approval.",
      metadata: proposalMetadata("category_create"),
      needsApproval: true,
      inputSchema: z.object({
        name: z.string().min(1),
        parentId: z.string().nullable().optional(),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "category_create", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "category_create",
          input,
          options,
          async (proposal) => {
            const category = await categoryService.createCategory({
              name: proposal.name,
              parentId: proposal.parentId,
            });
            return { resultRefType: "category", resultRefId: category.id };
          },
        ),
    }),
    category_update: tool({
      title: "候选修改 Category",
      description: "Update or move an existing Reflecta Category after user approval.",
      metadata: proposalMetadata("category_update"),
      needsApproval: true,
      inputSchema: z.object({
        categoryId: z.string().min(1),
        name: z.string().optional(),
        parentId: z.string().nullable().optional(),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "category_update", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "category_update",
          input,
          options,
          async (proposal) => {
            const category = await categoryService.updateCategory(proposal.categoryId, {
              name: proposal.name,
              parentId: proposal.parentId,
            });
            return { resultRefType: "category", resultRefId: category.id };
          },
        ),
    }),
    category_delete: tool({
      title: "候选删除 Category",
      description: "Delete an existing Reflecta Category after user approval.",
      metadata: proposalMetadata("category_delete"),
      needsApproval: true,
      inputSchema: z.object({
        categoryId: z.string().min(1),
        deleteThoughts: z.boolean().optional(),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "category_delete", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "category_delete",
          input,
          options,
          async (proposal) => {
            await categoryService.deleteCategory(proposal.categoryId, proposal.deleteThoughts);
            return { resultRefType: "category", resultRefId: proposal.categoryId };
          },
        ),
    }),
    context_create: tool({
      title: "候选 Context",
      description: "Add source Context to an existing Thought after user approval.",
      metadata: proposalMetadata("context_create"),
      needsApproval: true,
      inputSchema: z.object({
        thoughtId: z.string().min(1),
        sourceType: z.enum(sourceTypes),
        sourceName: z.string().optional(),
        content: z.string().min(1),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "context_create", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "context_create",
          input,
          options,
          async (proposal) => {
            const context = await contextService.createContext({
              thoughtId: proposal.thoughtId,
              sourceType: proposal.sourceType,
              sourceName: proposal.sourceName,
              content: proposal.content,
            });
            return { resultRefType: "context", resultRefId: context.id };
          },
        ),
    }),
    context_update: tool({
      title: "候选修改 Context",
      description: "Update an existing Reflecta Context after user approval.",
      metadata: proposalMetadata("context_update"),
      needsApproval: true,
      inputSchema: z.object({
        contextId: z.string().min(1),
        sourceType: z.enum(sourceTypes).optional(),
        sourceName: z.string().optional(),
        content: z.string().optional(),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "context_update", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "context_update",
          input,
          options,
          async (proposal) => {
            const context = await contextService.updateContext(proposal.contextId, {
              sourceType: proposal.sourceType,
              sourceName: proposal.sourceName,
              content: proposal.content,
            });
            return { resultRefType: "context", resultRefId: context.id };
          },
        ),
    }),
    context_delete: tool({
      title: "候选删除 Context",
      description: "Delete an existing Reflecta Context after user approval.",
      metadata: proposalMetadata("context_delete"),
      needsApproval: true,
      inputSchema: z.object({
        contextId: z.string().min(1),
        reason: z.string().optional(),
      }),
      outputSchema: mutationOutputSchema,
      onInputAvailable: ({ input, toolCallId }) =>
        recordApprovalRequest(repository, threadId, "context_delete", toolCallId, input),
      execute: async (input, options) =>
        executeMutation(
          repository,
          threadId,
          "context_delete",
          input,
          options,
          async (proposal) => {
            await contextService.deleteContext(proposal.contextId);
            return { resultRefType: "context", resultRefId: proposal.contextId };
          },
        ),
    }),
  };
}
