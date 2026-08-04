// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type {
  AgentReducedMessage,
  AgentSessionFeedFrame,
  AgentSessionProjection,
} from "@shared/agent";
import type { AgentThreadView } from "./thread-view";

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: { chat: { sendAgentCommand: vi.fn() } },
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
  vi.resetModules();
});

function installBrowserStubs() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  return frames;
}

function installFeed() {
  let receive: ((frame: AgentSessionFeedFrame) => void) | undefined;
  vi.stubGlobal("agentSessionFeed", {
    watch: (_sessionId: string, listener: (frame: AgentSessionFeedFrame) => void) => {
      receive = listener;
      return vi.fn();
    },
  });
  return (frame: AgentSessionFeedFrame) => receive?.(frame);
}

function projection(messages: AgentReducedMessage[]): AgentSessionProjection {
  return {
    sessionId: "session-1",
    messages,
    activeRunId: "run-1",
    status: "running",
    error: null,
    entityCatalog: [],
    contextCompactions: [],
    activeCompaction: null,
    compactionError: null,
  };
}

async function renderProbe(render: (view: AgentThreadView) => ReactNode) {
  const { useAgentThreadView } = await import("./agent-thread-view");
  let latestView: AgentThreadView | undefined;
  function Probe() {
    const view = useAgentThreadView("session-1");
    latestView = view;
    return render(view);
  }

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  return () => latestView;
}

test("replaces proposal and text from one authoritative projection frame", async () => {
  installBrowserStubs();
  const sendFrame = installFeed();
  const latestView = await renderProbe(() => null);
  const base = {
    id: "assistant-1",
    role: "assistant" as const,
    runId: "run-1",
    createdAt: "2026-08-01T18:15:47.347Z",
  };
  const approval = {
    kind: "approval" as const,
    approvalId: "approval-1",
    toolCallId: "tool-1",
    toolName: "understanding_update",
    title: "候选修改 Understanding",
    state: "pending" as const,
    approvalState: "pending" as const,
    executionState: "not_started" as const,
    displayState: "pending_approval" as const,
    createdAt: base.createdAt,
  };

  act(() =>
    sendFrame({
      kind: "state",
      sessionId: "session-1",
      revision: 1,
      session: projection([
        {
          ...base,
          text: "",
          blocks: [
            {
              ...approval,
              preview: true,
              payload: { after: { title: "生成中" } },
            },
          ],
        },
      ]),
    }),
  );
  act(() =>
    sendFrame({
      kind: "state",
      sessionId: "session-1",
      revision: 2,
      session: projection([
        {
          ...base,
          text: "正式",
          blocks: [
            {
              ...approval,
              preview: false,
              payload: { before: { title: "旧标题" }, after: { title: "正式标题" } },
            },
            { kind: "text", text: "正式", createdAt: base.createdAt },
          ],
        },
      ]),
    }),
  );

  expect(latestView()?.visibleMessages[0]?.blocks?.[0]).toMatchObject({
    kind: "approval",
    preview: false,
    state: "pending",
    payload: { before: { title: "旧标题" }, after: { title: "正式标题" } },
  });
  expect(latestView()?.visibleMessages[0]?.text).toBe("正式");
}, 10_000);

test("does not present a session waiting for approval as running", async () => {
  installBrowserStubs();
  const sendFrame = installFeed();
  const latestView = await renderProbe(() => null);

  act(() =>
    sendFrame({
      kind: "state",
      sessionId: "session-1",
      revision: 1,
      session: { ...projection([]), status: "waiting", activeRunId: null },
    }),
  );

  expect(latestView()).toMatchObject({ isBusy: false, composerBusy: true, canStop: false });
});

test("keeps the user's scroll position when a new projection arrives", async () => {
  const frames = installBrowserStubs();
  const sendFrame = installFeed();
  const latestView = await renderProbe((view) => (
    <div ref={view.scrollRef} onScroll={view.handleScroll}>
      <div />
    </div>
  ));

  const scroller = container?.firstElementChild as HTMLDivElement;
  let scrollTop = 700;
  Object.defineProperties(scroller, {
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 1_000 },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
  });
  scroller.scrollTo = vi.fn(({ top }: ScrollToOptions) => {
    scrollTop = Math.min(Number(top), 700);
  }) as typeof scroller.scrollTo;

  const flushNextFrame = () => {
    const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!next) return;
    frames.delete(next[0]);
    act(() => next[1](performance.now()));
  };
  while (frames.size > 0) flushNextFrame();

  act(() =>
    sendFrame({
      kind: "state",
      sessionId: "session-1",
      revision: 1,
      session: projection([
        {
          id: "assistant-1",
          role: "assistant",
          text: "new token",
          runId: "run-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          blocks: [
            {
              kind: "text",
              text: "new token",
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      ]),
    }),
  );
  flushNextFrame();

  scrollTop = 652;
  act(() => latestView()?.handleScroll());
  while (frames.size > 0) flushNextFrame();

  expect(scrollTop).toBe(652);
});
