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

export type AgentFixtureThread = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
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

export function seedThoughtIdByTitle(title: string) {
  return runFixture({ type: "thoughtIdByTitle", title }).trim();
}

export function thoughtExistsByTitle(title: string) {
  return runFixture({ type: "thoughtExistsByTitle", title }).trim() === "true";
}

export function categoryExistsByName(name: string) {
  return runFixture({ type: "categoryExistsByName", name }).trim() === "true";
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

export function toolPart(name: string, toolCallId: string, output: unknown) {
  return {
    type: `tool-${name}`,
    toolCallId,
    state: "output-available",
    input: {},
    output,
  };
}

export function reasoningPart(text: string) {
  return { type: "reasoning", text, state: "done" };
}

export function proposalPart({
  type = "thought_create",
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
    input: { title, body: body ?? `${title} body`, categoryIds: [] },
    ...(output ? { output } : {}),
    ...(errorText ? { errorText } : {}),
    toolMetadata: { kind: "proposal", proposalType: type },
    ...(approval ? { approval } : {}),
  };
}
