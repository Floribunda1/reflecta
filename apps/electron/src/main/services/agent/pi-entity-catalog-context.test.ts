import { describe, expect, test } from "vitest";
import type { ContextEvent } from "@earendil-works/pi-coding-agent";
import type { AgentEntityCatalogEntry } from "@shared/agent";
import { projectEntityCatalogMessages } from "./pi-entity-catalog-context";

const entries: AgentEntityCatalogEntry[] = [
  {
    key: "understanding:new_understanding",
    entity: {
      type: "understanding",
      id: "new_understanding",
      title: "Current title",
    },
    origin: { kind: "user_context", messageId: "message_2" },
  },
];

const legacyCatalog = `

<reflecta_entities>
{"type":"understanding","id":"old_understanding","citation":"[[u:old_understanding]]","title":"Old title"}
</reflecta_entities>`;

function textFrom(message: ContextEvent["messages"][number]): string {
  if (!("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

describe("projectEntityCatalogMessages", () => {
  test("replaces persisted catalog history with one current catalog at the tail", () => {
    const messages: ContextEvent["messages"] = [
      { role: "user", content: `first${legacyCatalog}`, timestamp: 1 },
      { role: "user", content: "second", timestamp: 2 },
    ];

    const projected = projectEntityCatalogMessages(messages, entries);

    expect(textFrom(projected[0]!)).toBe("first");
    expect(textFrom(projected[1]!)).toContain("second");
    expect(textFrom(projected[1]!)).toContain(
      '{"type":"understanding","id":"new_understanding","citation":"[[u:new_understanding]]","title":"Current title"}',
    );
    expect(JSON.stringify(projected).match(/<reflecta_entities/g)).toHaveLength(1);
    expect(JSON.stringify(projected)).not.toContain("old_understanding");
    expect(textFrom(messages[0]!)).toContain("old_understanding");
  });

  test("is idempotent and keeps the catalog as the last text block", () => {
    const messages: ContextEvent["messages"] = [
      {
        role: "user",
        content: [{ type: "text", text: "question" }],
        timestamp: 1,
      },
    ];

    const once = projectEntityCatalogMessages(messages, entries);
    const twice = projectEntityCatalogMessages(once, entries);
    const last = twice.at(-1);

    expect(JSON.stringify(twice).match(/<reflecta_entities/g)).toHaveLength(1);
    expect(
      last && "content" in last && Array.isArray(last.content) ? last.content.at(-1) : null,
    ).toMatchObject({ type: "text", text: expect.stringContaining("new_understanding") });
  });

  test("preserves user-authored tags that are not valid runtime records", () => {
    const content =
      "Discuss this example:\n<reflecta_entities>\nnot runtime json\n</reflecta_entities>";
    const messages: ContextEvent["messages"] = [{ role: "user", content, timestamp: 1 }];

    expect(textFrom(projectEntityCatalogMessages(messages, [])[0]!)).toBe(content);
  });

  test("appends the latest catalog after a tool result", () => {
    const messages: ContextEvent["messages"] = [
      {
        role: "toolResult",
        toolCallId: "tool_1",
        toolName: "understanding_get",
        content: [{ type: "text", text: '{"id":"new_understanding"}' }],
        details: { id: "new_understanding" },
        isError: false,
        timestamp: 1,
      },
    ];

    const projected = projectEntityCatalogMessages(messages, entries);
    const last = projected[0];

    expect(
      last && "content" in last && Array.isArray(last.content) ? last.content.at(-1) : null,
    ).toMatchObject({ type: "text", text: expect.stringContaining("new_understanding") });
    expect(JSON.stringify(projected).match(/<reflecta_entities/g)).toHaveLength(1);
  });
});
