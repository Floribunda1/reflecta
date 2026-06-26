// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentEntitySource, AgentReducedMessage } from "@shared/agent";
import { MessageList } from "./message-list";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

function renderMessageList({
  messages,
  entitySources,
  onInspectContextRef = vi.fn(),
}: {
  messages: AgentReducedMessage[];
  entitySources: AgentEntitySource[];
  onInspectContextRef?: (ref: {
    type: "understanding" | "context";
    id: string;
    title?: string;
  }) => void;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MessageList
        messages={messages}
        entitySources={entitySources}
        isBusy={false}
        stoppedMessageId={null}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onApproveTool={vi.fn()}
        onInspectContextRef={onInspectContextRef}
      />,
    );
  });
}

describe("MessageList entity refs", () => {
  test("renders resolved assistant ref markers as clickable context chips", () => {
    const onInspectContextRef = vi.fn();
    renderMessageList({
      messages: [
        {
          id: "assistant_1",
          role: "assistant",
          text: "见 [[ref:S1]]",
          createdAt: "2026-06-26T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "见 [[ref:S1]]",
              createdAt: "2026-06-26T00:00:00.000Z",
            },
          ],
        },
      ],
      entitySources: [
        {
          sourceId: "S1",
          entity: { type: "context", id: "ctx_1", title: "一次复盘" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
        },
      ],
      onInspectContextRef,
    });

    const chip = container?.querySelector<HTMLButtonElement>('[data-slot="wiki-link"]');
    expect(chip?.textContent).toContain("一次复盘");
    expect(container?.textContent).not.toContain("[[ref:S1]]");

    act(() => chip?.click());

    expect(onInspectContextRef).toHaveBeenCalledWith({
      type: "context",
      id: "ctx_1",
      title: "一次复盘",
    });
  });
});
