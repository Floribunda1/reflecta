// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentChatMessage } from "@shared/chat";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  agentContentRender: vi.fn(),
}));

vi.mock("./agent-message-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./agent-message-content")>();
  return {
    ...actual,
    AgentMessageContent: ({ message }: { message: AgentChatMessage }) => {
      mocks.agentContentRender(message.id);
      return <div data-slot="agent-message-content">{message.id}</div>;
    },
  };
});

const { MessageList } = await import("./message-list");

const noop = () => {};

function assistantMessage(id: string): AgentChatMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text: id }],
  };
}

function render(root: Root, messages: AgentChatMessage[]) {
  act(() => {
    root.render(
      <MessageList
        messages={messages}
        isBusy={false}
        stoppedMessageId={null}
        onRetry={noop}
        onEdit={noop}
        onRegenerate={noop}
        onApproveTool={noop}
      />,
    );
  });
}

describe("MessageRow rendering", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    mocks.agentContentRender.mockClear();
  });

  test("does not rerender rows for unchanged message objects", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const messages = [assistantMessage("assistant-1"), assistantMessage("assistant-2")];

    render(root, messages);
    expect(mocks.agentContentRender).toHaveBeenCalledTimes(2);

    render(root, messages);

    expect(mocks.agentContentRender).toHaveBeenCalledTimes(2);
  });
});
