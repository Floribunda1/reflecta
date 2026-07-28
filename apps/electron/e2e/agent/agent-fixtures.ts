import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readE2eTestEnv } from "../test-env";

export type AgentFixtureMessage = {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  metadata?: unknown;
  createdAt?: string;
};

export type AgentFixtureEntityCatalogEntry = {
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

export type AgentFixtureContextCompaction = {
  summary: string;
  afterMessageId?: string;
  reason?: "manual" | "threshold" | "overflow";
  firstKeptEntryId?: string;
  tokensBefore?: number;
  estimatedTokensAfter?: number;
  contextWindow?: number;
};

export type AgentFixtureThread = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  includeRuntimeMessages?: boolean;
  entityCatalog?: AgentFixtureEntityCatalogEntry[];
  contextCompactions?: AgentFixtureContextCompaction[];
  messages?: AgentFixtureMessage[];
};

let fixtureId = 0;

function runFixture(fixture: unknown) {
  const fixturePath = path.join(
    os.tmpdir(),
    `reflecta-agent-fixture-${process.pid}-${fixtureId++}.json`,
  );
  fs.writeFileSync(fixturePath, JSON.stringify(fixture), "utf-8");
  try {
    const env = readE2eTestEnv();
    return execFileSync(
      "bun",
      [
        "run",
        path.resolve(import.meta.dirname, "agent-fixture-store.ts"),
        env.dbPath,
        env.contentStorageRoot,
        env.appConfigDir,
        fixturePath,
      ],
      { stdio: "pipe" },
    ).toString("utf-8");
  } finally {
    fs.rmSync(fixturePath, { force: true });
  }
}

export function resetAgentFixtures() {
  runFixture({ type: "reset" });
}

export function seedAgentThread(thread: AgentFixtureThread) {
  runFixture({ type: "seedThread", thread });
}

export function seedUnderstanding(input: {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  runFixture({ type: "seedUnderstanding", ...input });
}

export function seedContext(input: {
  id: string;
  understandingId: string;
  title: string;
  content: string;
}) {
  runFixture({ type: "seedContext", ...input });
}

export function seedDomain(input: { id: string; name: string }) {
  runFixture({ type: "seedDomain", ...input });
}

export function deleteUnderstanding(id: string) {
  runFixture({ type: "deleteUnderstanding", id });
}

export function seedUnderstandingIdByTitle(title: string) {
  return runFixture({ type: "understandingIdByTitle", title }).trim();
}

export function understandingExistsByTitle(title: string) {
  return runFixture({ type: "understandingExistsByTitle", title }).trim() === "true";
}

export function domainExistsByName(name: string) {
  return runFixture({ type: "domainExistsByName", name }).trim() === "true";
}

export function seedCompletedThread({
  id,
  title,
  userText,
  assistantText,
}: {
  id: string;
  title: string;
  userText: string;
  assistantText: string;
}) {
  seedAgentThread({
    id,
    title,
    messages: [
      userMessage(`${id}-user`, userText),
      assistantMessage(`${id}-assistant`, [{ type: "text", text: assistantText }]),
    ],
  });
}

export function userMessage(id: string, text: string, metadata?: unknown): AgentFixtureMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
    metadata,
  };
}

export function assistantMessage(id: string, parts: unknown[]): AgentFixtureMessage {
  return { id, role: "assistant", parts };
}

export function toolPart(name: string, toolCallId: string, output: unknown, input: unknown = {}) {
  return {
    type: `tool-${name}`,
    toolCallId,
    state: "output-available",
    input,
    output,
  };
}

export function reasoningPart(text: string) {
  return { type: "reasoning", text, state: "done" };
}

export function proposalPart({
  type = "understanding_create",
  toolCallId,
  title,
  body,
  state,
  approval,
  output,
  errorText,
}: {
  type?: string;
  toolCallId: string;
  title: string;
  body?: string;
  state:
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-denied"
    | "output-error";
  approval?: { id: string; approved?: boolean };
  output?: unknown;
  errorText?: string;
}) {
  return {
    type: `tool-${type}`,
    toolCallId,
    state,
    input: { title, body: body ?? `${title} body`, domainIds: [] },
    ...(output ? { output } : {}),
    ...(errorText ? { errorText } : {}),
    toolMetadata: { kind: "proposal", proposalType: type },
    ...(approval ? { approval } : {}),
  };
}
