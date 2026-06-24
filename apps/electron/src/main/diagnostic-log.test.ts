import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { DiagnosticLog, getDiagnosticLogFilePath } from "./diagnostic-log";

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-diagnostic-log-"));
  roots.push(root);
  return root;
}

function readJsonl(filePath: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("DiagnosticLog", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  test("writes one JSON event per line to the local-date log file", () => {
    const root = tempRoot();
    const now = new Date(2026, 5, 24, 15, 30, 0);
    const log = new DiagnosticLog({ contentStorageRoot: root, now: () => now });

    log.write({
      level: "info",
      event: "app.logging.initialized",
      scope: "app",
      context: { requestId: "req_1" },
      attrs: { profile: "dev" },
    });

    const filePath = getDiagnosticLogFilePath(root, now);
    expect(filePath).toBe(path.join(root, "logs", "reflecta-2026-06-24.jsonl"));
    expect(readJsonl(filePath)).toEqual([
      {
        ts: now.toISOString(),
        level: "info",
        event: "app.logging.initialized",
        scope: "app",
        context: { requestId: "req_1" },
        attrs: { profile: "dev" },
      },
    ]);
  });

  test("redacts configured secrets before writing", () => {
    const root = tempRoot();
    const log = new DiagnosticLog({
      contentStorageRoot: root,
      now: () => new Date(2026, 5, 24),
    });

    log.write({
      level: "error",
      event: "app.db.failed",
      scope: "db",
      attrs: {
        apiKey: "plain-key",
        nested: {
          accessToken: "plain-token",
          encrypted: "safe:v1:ciphertext",
        },
      },
    });

    expect(readJsonl(getDiagnosticLogFilePath(root, new Date(2026, 5, 24)))[0].attrs).toEqual({
      apiKey: "[redacted]",
      nested: {
        accessToken: "[redacted]",
        encrypted: "[redacted]",
      },
    });
  });

  test("rolls oversized same-day logs to a numbered file", () => {
    const root = tempRoot();
    const now = new Date(2026, 5, 24);
    const log = new DiagnosticLog({
      contentStorageRoot: root,
      maxFileBytes: 200,
      now: () => now,
    });

    log.write({ level: "info", event: "app.one", scope: "app", attrs: { text: "x".repeat(80) } });
    log.write({ level: "info", event: "app.two", scope: "app", attrs: { text: "x".repeat(80) } });

    expect(fs.existsSync(path.join(root, "logs", "reflecta-2026-06-24.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(root, "logs", "reflecta-2026-06-24.1.jsonl"))).toBe(true);
  });

  test("keeps only the configured local-date retention window", () => {
    const root = tempRoot();
    const logsDir = path.join(root, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, "reflecta-2026-05-25.jsonl"), "{}\n");
    fs.writeFileSync(path.join(logsDir, "reflecta-2026-05-26.jsonl"), "{}\n");
    const log = new DiagnosticLog({
      contentStorageRoot: root,
      retentionDays: 30,
      now: () => new Date(2026, 5, 24),
    });

    log.write({ level: "info", event: "app.logging.initialized", scope: "app" });

    expect(fs.existsSync(path.join(logsDir, "reflecta-2026-05-25.jsonl"))).toBe(false);
    expect(fs.existsSync(path.join(logsDir, "reflecta-2026-05-26.jsonl"))).toBe(true);
  });
});
