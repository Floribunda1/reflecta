#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";

const dbPath = process.argv[2];
const contentStorageRoot = process.argv[3];
const appConfigDir = process.argv[4];
const fixturePath = process.argv[5];

if (!dbPath || !contentStorageRoot || !appConfigDir || !fixturePath) {
  throw new Error(
    "Usage: bun run agent-fixture-store.ts <db-path> <content-storage-root> <app-config-dir> <fixture-json-path>",
  );
}

type FixtureMessage = {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  metadata?: unknown;
  createdAt?: string;
};

type FixtureEntityCatalogEntry = {
  key?: string;
  entity: {
    type: "understanding" | "context" | "domain";
    id: string;
    title?: string;
  };
  origin:
    | { kind: "user_context"; messageId: string }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};

type FixtureContextCompaction = {
  summary: string;
  afterMessageId?: string;
  reason?: "manual" | "threshold" | "overflow";
  firstKeptEntryId?: string;
  tokensBefore?: number;
  estimatedTokensAfter?: number;
  contextWindow?: number;
};

type FixtureThread = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  includeRuntimeMessages?: boolean;
  entityCatalog?: FixtureEntityCatalogEntry[];
  contextCompactions?: FixtureContextCompaction[];
  messages?: FixtureMessage[];
};

type Fixture =
  | { type: "reset" }
  | { type: "seedThread"; thread: FixtureThread }
  | {
      type: "seedUnderstanding";
      id: string;
      title: string;
      body: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | { type: "seedContext"; id: string; understandingId: string; title: string; content: string }
  | { type: "seedDomain"; id: string; name: string }
  | { type: "deleteUnderstanding"; id: string }
  | { type: "understandingIdByTitle"; title: string }
  | { type: "understandingExistsByTitle"; title: string }
  | { type: "domainExistsByName"; name: string };

type ReflectaEvent = {
  id: string;
  sessionId: string;
  runId?: string;
  createdAt: string;
  type: string;
  [key: string]: unknown;
};

type FlushableSessionManager = SessionManager & {
  _rewriteFile?: () => void;
  flushed?: boolean;
};

const BASE_TIME = "2026-06-22T08:00:00.000Z";
const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";
const SEEDED_CONTEXTUAL_AGENT_THREAD_ID = "seed_contextual_agent_programming";
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as Fixture;
const db = new Database(dbPath);

function sessionsRoot() {
  return path.join(contentStorageRoot, "Sessions");
}

function resetSessionsToSeedBaseline() {
  const root = sessionsRoot();
  fs.mkdirSync(root, { recursive: true });
  for (const filename of fs.readdirSync(root)) {
    if (filename.endsWith(`_${SEEDED_CONTEXTUAL_AGENT_THREAD_ID}.jsonl`)) continue;
    fs.rmSync(path.join(root, filename), { recursive: true, force: true });
  }
}

function timeAt(base: string, index: number) {
  return new Date(new Date(base).getTime() + index * 1000).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFromParts(parts: unknown[]) {
  return parts
    .map((part) => (isRecord(part) && part.type === "text" ? String(part.text ?? "") : ""))
    .join("");
}

function approvalIdFor(part: Record<string, unknown>, toolCallId: string) {
  const approval = isRecord(part.approval) ? part.approval : {};
  return typeof approval.id === "string" ? approval.id : `approval_${toolCallId}`;
}

function approvedFor(part: Record<string, unknown>, fallback: boolean) {
  const approval = isRecord(part.approval) ? part.approval : {};
  return typeof approval.approved === "boolean" ? approval.approved : fallback;
}

function proposalTitle(toolName: string) {
  if (toolName === "understanding_create") return "候选 Understanding";
  if (toolName === "understanding_update") return "候选修改 Understanding";
  if (toolName === "understanding_delete") return "候选删除 Understanding";
  if (toolName === "domain_create") return "候选 Domain";
  if (toolName === "domain_update") return "候选修改 Domain";
  if (toolName === "domain_delete") return "候选删除 Domain";
  if (toolName === "context_create") return "候选 Context";
  if (toolName === "context_update") return "候选修改 Context";
  if (toolName === "context_delete") return "候选删除 Context";
  if (toolName === "bash") return "执行 Bash";
  return "候选操作";
}

function isProposalPart(part: Record<string, unknown>, toolName: string) {
  const metadata = isRecord(part.toolMetadata) ? part.toolMetadata : {};
  return (
    metadata.kind === "proposal" ||
    [
      "understanding_create",
      "understanding_update",
      "understanding_delete",
      "domain_create",
      "domain_update",
      "domain_delete",
      "context_create",
      "context_update",
      "context_delete",
      "bash",
    ].includes(toolName)
  );
}

function eventFactory(thread: FixtureThread) {
  const createdAt = thread.createdAt ?? thread.updatedAt ?? BASE_TIME;
  let index = 0;
  return (event: Omit<ReflectaEvent, "id" | "sessionId" | "createdAt">): ReflectaEvent => ({
    ...event,
    id: `evt_${thread.id}_${++index}`,
    sessionId: thread.id,
    createdAt: timeAt(createdAt, index),
  });
}

function appendTextBlock(
  blocks: Record<string, unknown>[],
  kind: string,
  text: string,
  createdAt: string,
  parts?: unknown[],
  state?: unknown,
  previewText?: unknown,
  error?: unknown,
) {
  const last = blocks.at(-1);
  if (
    !parts &&
    !state &&
    !previewText &&
    !error &&
    last?.kind === kind &&
    typeof last.text === "string" &&
    !Array.isArray(last.parts)
  ) {
    last.text += text;
    return;
  }
  blocks.push({
    kind,
    text,
    ...(parts ? { parts } : {}),
    ...(typeof state === "string" ? { state } : {}),
    ...(typeof previewText === "string" ? { previewText } : {}),
    ...(typeof error === "string" ? { error } : {}),
    createdAt,
  });
}

function appendToolBlock(
  blocks: Record<string, unknown>[],
  part: Record<string, unknown>,
  toolName: string,
  toolCallId: string,
  createdAt: string,
) {
  if (part.state === "output-error") {
    blocks.push({
      kind: "tool",
      toolCallId,
      toolName,
      input: part.input,
      state: "failed",
      error: String(part.errorText ?? "工具执行失败"),
      createdAt,
    });
    return;
  }
  blocks.push({
    kind: "tool",
    toolCallId,
    toolName,
    input: part.input,
    state: "completed",
    output: part.output,
    createdAt,
  });
}

function appendProposalBlock(
  events: ReflectaEvent[],
  blocks: Record<string, unknown>[],
  createEvent: ReturnType<typeof eventFactory>,
  part: Record<string, unknown>,
  runId: string,
  messageId: string,
  toolName: string,
  toolCallId: string,
  createdAt: string,
) {
  const approvalId = approvalIdFor(part, toolCallId);
  const payload = isRecord(part.input) ? part.input : {};
  const title = proposalTitle(toolName);
  events.push(
    createEvent({
      type: "approval.requested",
      runId,
      messageId,
      approvalId,
      toolCallId,
      toolName,
      title,
      payload,
    }),
  );

  const block: Record<string, unknown> = {
    kind: "approval",
    approvalId,
    toolCallId,
    toolName,
    title,
    payload,
    state: "pending",
    approvalState: "pending",
    executionState: "not_started",
    displayState: "pending_approval",
    createdAt,
  };
  const state = typeof part.state === "string" ? part.state : "";
  if (state === "output-error") {
    const errorMessage = String(part.errorText ?? "工具执行失败");
    events.push(
      createEvent({
        type: "approval.resolved",
        runId,
        messageId,
        approvalId,
        toolCallId,
        toolName,
        approved: true,
      }),
      createEvent({
        type: "tool.execution.started",
        runId,
        messageId,
        toolCallId,
        toolName,
        input: payload,
      }),
      createEvent({
        type: "tool.execution.failed",
        runId,
        messageId,
        toolCallId,
        toolName,
        error: { message: errorMessage },
      }),
    );
    block.approved = true;
    block.state = "failed";
    block.error = errorMessage;
    block.approvalState = "approved";
    block.executionState = "failed";
    block.displayState = "failed";
    block.executionError = { message: errorMessage };
  } else if (state === "approval-responded" || approvedFor(part, false)) {
    const approved = approvedFor(part, true);
    events.push(
      createEvent({
        type: "approval.resolved",
        runId,
        messageId,
        approvalId,
        toolCallId,
        toolName,
        approved,
      }),
    );
    block.approved = approved;
    block.state = approved ? "approved" : "rejected";
    block.approvalState = approved ? "approved" : "rejected";
    block.executionState = "not_started";
    block.displayState = approved ? "running" : "rejected";
  } else if (state === "output-denied") {
    events.push(
      createEvent({
        type: "approval.resolved",
        runId,
        messageId,
        approvalId,
        toolCallId,
        toolName,
        approved: false,
      }),
    );
    block.approved = false;
    block.state = "rejected";
    block.approvalState = "rejected";
    block.executionState = "not_started";
    block.displayState = "rejected";
  } else if (state !== "approval-requested") {
    block.state = "completed";
    block.approved = true;
    block.approvalState = "approved";
    block.executionState = "completed";
    block.displayState = "completed";
    block.output = part.output;
  }
  blocks.push(block);
}

function assistantTurnBlocks(
  events: ReflectaEvent[],
  createEvent: ReturnType<typeof eventFactory>,
  parts: unknown[],
  runId: string,
  messageId: string,
  createdAt: string,
) {
  const blocks: Record<string, unknown>[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (part.type === "text") {
      appendTextBlock(
        blocks,
        "text",
        String(part.text ?? ""),
        createdAt,
        Array.isArray(part.parts) ? part.parts : undefined,
        part.state,
        part.previewText,
        part.error,
      );
      continue;
    }
    if (part.type === "reasoning") {
      appendTextBlock(blocks, "reasoning", String(part.text ?? ""), createdAt);
      continue;
    }
    const type = String(part.type ?? "");
    if (!type.startsWith("tool-")) continue;
    const toolName = type.slice("tool-".length);
    const toolCallId = typeof part.toolCallId === "string" ? part.toolCallId : `${messageId}-tool`;
    if (isProposalPart(part, toolName)) {
      appendProposalBlock(
        events,
        blocks,
        createEvent,
        part,
        runId,
        messageId,
        toolName,
        toolCallId,
        createdAt,
      );
      continue;
    }
    appendToolBlock(blocks, part, toolName, toolCallId, createdAt);
  }
  return blocks;
}

function threadEvents(thread: FixtureThread) {
  const events: ReflectaEvent[] = [];
  const createEvent = eventFactory(thread);
  let activeRunId: string | null = null;

  if (thread.entityCatalog?.length) {
    events.push(
      createEvent({
        type: "entity.catalog.updated",
        entries: thread.entityCatalog.map((entry) => ({
          ...entry,
          key: entry.key ?? `${entry.entity.type}:${entry.entity.id}`,
        })),
      }),
    );
  }

  for (const message of thread.messages ?? []) {
    if (message.role === "user") {
      activeRunId = `run_${message.id}`;
      const metadata = isRecord(message.metadata) ? message.metadata : {};
      events.push(createEvent({ type: "run.started", runId: activeRunId }));
      events.push(
        createEvent({
          type: "user.message",
          runId: activeRunId,
          messageId: message.id,
          text: textFromParts(message.parts),
          contextRefs: metadata.contextRefs,
          composerContent: metadata.composerContent,
        }),
      );
      continue;
    }

    const runId = activeRunId ?? `run_${message.id}`;
    if (!activeRunId) events.push(createEvent({ type: "run.started", runId }));
    for (const part of message.parts) {
      if (!isRecord(part) || part.type !== "text-delta") continue;
      events.push(
        createEvent({
          type: "assistant.text.delta",
          runId,
          messageId: message.id,
          delta: String(part.text ?? ""),
        }),
      );
    }
    const blocks = assistantTurnBlocks(
      events,
      createEvent,
      message.parts,
      runId,
      message.id,
      message.createdAt ?? thread.createdAt ?? thread.updatedAt ?? BASE_TIME,
    );
    events.push(
      createEvent({
        type: "assistant.turn",
        runId,
        messageId: message.id,
        text: blocks
          .flatMap((block) => (block.kind === "text" ? [String(block.text ?? "")] : []))
          .join(""),
        blocks,
      }),
    );
    events.push(createEvent({ type: "run.completed", runId }));
    activeRunId = null;
  }

  for (const compaction of thread.contextCompactions ?? []) {
    events.push(
      createEvent({
        type: "context.compacted",
        reason: compaction.reason ?? "manual",
        summary: compaction.summary,
        firstKeptEntryId: compaction.firstKeptEntryId ?? "fixture-kept-entry",
        tokensBefore: compaction.tokensBefore ?? 120_000,
        estimatedTokensAfter: compaction.estimatedTokensAfter ?? 18_000,
        contextWindow: compaction.contextWindow ?? 128_000,
        afterMessageId: compaction.afterMessageId,
      }),
    );
  }

  return events;
}

function flush(manager: SessionManager) {
  const flushable = manager as FlushableSessionManager;
  if (typeof flushable._rewriteFile !== "function") {
    throw new Error("Pi SessionManager flush hook is unavailable");
  }
  flushable._rewriteFile();
  flushable.flushed = true;
}

function rewriteHeaderTimestamp(manager: SessionManager, timestamp: string) {
  const file = manager.getSessionFile();
  if (!file) return;
  const lines = fs
    .readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (index === 0 && entry.type === "session") {
        entry.timestamp = timestamp;
      }
      return JSON.stringify(entry);
    });
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf-8");
  const time = new Date(timestamp);
  fs.utimesSync(file, time, time);
}

function seedThread(thread: FixtureThread) {
  fs.mkdirSync(sessionsRoot(), { recursive: true });
  const manager = SessionManager.create(contentStorageRoot, sessionsRoot(), { id: thread.id });
  manager.appendSessionInfo(thread.title);
  if (thread.includeRuntimeMessages) {
    for (const message of thread.messages ?? []) {
      const text = textFromParts(message.parts);
      const timestamp = new Date(message.createdAt ?? thread.createdAt ?? BASE_TIME).getTime();
      manager.appendMessage(
        message.role === "user"
          ? { role: "user", content: [{ type: "text", text }], timestamp }
          : {
              role: "assistant",
              content: [{ type: "text", text }],
              api: "openai-completions",
              provider: "deepseek",
              model: "fixture",
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
              },
              stopReason: "stop",
              timestamp,
            },
      );
    }
  }
  for (const event of threadEvents(thread)) {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
  }
  flush(manager);
  rewriteHeaderTimestamp(manager, thread.updatedAt ?? thread.createdAt ?? BASE_TIME);
}

function seedUnderstanding(
  id: string,
  title: string,
  body: string,
  createdAt?: string,
  updatedAt?: string,
) {
  const created = createdAt ?? new Date().toISOString();
  const updated = updatedAt ?? created;
  db.query(
    `INSERT INTO understandings (id, title, body, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = NULL`,
  ).run(id, title, body, created, updated);
}

function seedContext(id: string, understandingId: string, title: string, content: string) {
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO contexts (id, understanding_id, medium, title, content, created_at, deleted_at)
     VALUES (?, ?, 'experience', ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET understanding_id = excluded.understanding_id, title = excluded.title, content = excluded.content, deleted_at = NULL`,
  ).run(id, understandingId, title, content, now);
}

function seedDomain(id: string, name: string) {
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO domains (id, name, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, NULL, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
  ).run(id, name, now, now);
}

try {
  if (fixture.type === "reset") {
    resetSessionsToSeedBaseline();
  }

  if (fixture.type === "seedThread") {
    seedThread(fixture.thread);
  }

  if (fixture.type === "seedUnderstanding") {
    seedUnderstanding(
      fixture.id,
      fixture.title,
      fixture.body,
      fixture.createdAt,
      fixture.updatedAt,
    );
  }

  if (fixture.type === "seedContext") {
    seedContext(fixture.id, fixture.understandingId, fixture.title, fixture.content);
  }

  if (fixture.type === "seedDomain") {
    seedDomain(fixture.id, fixture.name);
  }

  if (fixture.type === "deleteUnderstanding") {
    db.query(`UPDATE understandings SET deleted_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      fixture.id,
    );
  }

  if (fixture.type === "understandingIdByTitle") {
    const row = db
      .query(`SELECT id FROM understandings WHERE title = ? AND deleted_at IS NULL LIMIT 1`)
      .get(fixture.title) as { id: string } | null;
    if (!row) throw new Error(`Seed understanding not found: ${fixture.title}`);
    console.log(row.id);
  }

  if (fixture.type === "understandingExistsByTitle") {
    const row = db
      .query(
        `SELECT 1 AS exists_flag FROM understandings WHERE title = ? AND deleted_at IS NULL LIMIT 1`,
      )
      .get(fixture.title) as { exists_flag: number } | null;
    console.log(row ? "true" : "false");
  }

  if (fixture.type === "domainExistsByName") {
    const row = db
      .query(`SELECT 1 AS exists_flag FROM domains WHERE name = ? LIMIT 1`)
      .get(fixture.name) as { exists_flag: number } | null;
    console.log(row ? "true" : "false");
  }
} finally {
  db.close();
}
