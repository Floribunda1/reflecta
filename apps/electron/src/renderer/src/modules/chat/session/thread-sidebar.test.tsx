// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentThreadDTO } from "@shared/chat";
import { ThreadSidebar } from "./thread-sidebar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = vi.fn();

function thread(id: string, title: string): AgentThreadDTO {
  return {
    id,
    title,
    status: "active",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

describe("ThreadSidebar", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    noop.mockClear();
  });

  test("marks the running thread", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ThreadSidebar
          threads={[thread("thread-a", "A"), thread("thread-b", "B")]}
          activeThreadId="thread-a"
          runningThreadId="thread-b"
          onSelect={noop}
          onCreate={noop}
          onRename={noop}
          onGenerateTitle={noop}
          onArchive={noop}
          onDelete={noop}
        />,
      );
    });

    expect(container.querySelector('[aria-label="Agent 正在响应"]')).not.toBeNull();
  });
});
