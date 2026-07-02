import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { migrateAgentSessionFileInlineReferences } from "./agent-session-migration";

const roots: string[] = [];

function tempSessionFile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-agent-session-migration-"));
  roots.push(root);
  return path.join(root, "session.jsonl");
}

function customEvent(data: Record<string, unknown>) {
  return { type: "custom", customType: "reflecta.agent.event", data };
}

function writeJsonl(file: string, entries: unknown[]) {
  fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf-8");
}

function readJsonl(file: string) {
  return fs
    .readFileSync(file, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { data?: Record<string, unknown> });
}

describe("migrateAgentSessionFileInlineReferences", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  test("converts legacy entity_ref parts into numbered citations", () => {
    const file = tempSessionFile();
    writeJsonl(file, [
      customEvent({
        id: "evt_catalog",
        type: "entity.catalog.updated",
        entries: [
          {
            key: "domain:domain_1",
            entity: { type: "domain", id: "domain_1", title: "三观" },
            origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
          },
        ],
      }),
      customEvent({
        id: "evt_turn",
        type: "assistant.turn",
        text: "legacy text",
        blocks: [
          {
            kind: "text",
            text: "legacy text",
            parts: [
              { type: "text", text: "放在" },
              { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
              { type: "text", text: "下面，还是" },
              { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
              { type: "text", text: "。" },
            ],
            previewText: "<entity_ref />",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(migrateAgentSessionFileInlineReferences(file)).toBe(true);

    const [, turnEntry] = readJsonl(file);
    const turn = turnEntry?.data;
    expect(turn?.text).toBe("放在三观 [1]下面，还是三观 [1]。");
    expect(turn?.citationSources).toEqual([
      {
        index: 1,
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ]);
    expect(turn?.blocks).toBeDefined();
    const block = (turn!.blocks as Record<string, unknown>[])[0];
    expect(block).toMatchObject({ kind: "text", text: "放在三观 [1]下面，还是三观 [1]。" });
    expect(block).not.toHaveProperty("parts");
    expect(block).not.toHaveProperty("previewText");
  });

  test("preserves plain text assistant turns unchanged", () => {
    const file = tempSessionFile();
    const entries = [
      customEvent({
        id: "evt_turn",
        type: "assistant.turn",
        text: "plain text",
        blocks: [{ kind: "text", text: "plain text", createdAt: "2026-07-01T00:00:00.000Z" }],
      }),
    ];
    writeJsonl(file, entries);
    const before = fs.readFileSync(file, "utf-8");

    expect(migrateAgentSessionFileInlineReferences(file)).toBe(false);
    expect(fs.readFileSync(file, "utf-8")).toBe(before);
  });

  test("works when origin is missing", () => {
    const file = tempSessionFile();
    writeJsonl(file, [
      customEvent({
        id: "evt_turn",
        type: "assistant.turn",
        text: "legacy text",
        blocks: [
          {
            kind: "text",
            text: "legacy text",
            parts: [
              { type: "text", text: "参考" },
              {
                type: "entity_ref",
                entityType: "understanding",
                entityId: "u_1",
                fallbackText: "用户需求",
              },
            ],
            previewText: "",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(migrateAgentSessionFileInlineReferences(file)).toBe(true);

    const [turnEntry] = readJsonl(file);
    expect(turnEntry?.data?.citationSources).toEqual([
      {
        index: 1,
        entity: { type: "understanding", id: "u_1", title: "用户需求" },
      },
    ]);
    expect(turnEntry?.data?.text).toBe("参考用户需求 [1]");
  });
});
