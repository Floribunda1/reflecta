// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { AgentEvent } from "@shared/agent";
import type { AgentThreadView } from "./thread-view";

const ipc = vi.hoisted(() => ({
  readSessionEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: { chat: { readSessionEvents: ipc.readSessionEvents } },
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

test("keeps the user's scroll position when a queued token frame runs", async () => {
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

  let eventListener: ((_event: unknown, payload: unknown) => void) | undefined;
  vi.stubGlobal("ipcRenderer", {
    on: (_channel: string, listener: typeof eventListener) => {
      eventListener = listener;
    },
    removeListener: vi.fn(),
  });

  const { usePiAgentThreadView } = await import("./pi-thread-view");
  let latestView: AgentThreadView | undefined;
  function Probe() {
    const view = usePiAgentThreadView("session-1");
    latestView = view;
    return (
      <div ref={view.scrollRef} onScroll={view.handleScroll}>
        <div />
      </div>
    );
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

  const scroller = container.firstElementChild as HTMLDivElement;
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

  const base = {
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const events: AgentEvent[] = [
    { ...base, id: "run", type: "run.started" },
    {
      ...base,
      id: "token",
      type: "assistant.text.delta",
      messageId: "assistant-1",
      delta: "new token",
    },
  ];
  act(() => events.forEach((event) => eventListener?.({}, event)));
  flushNextFrame();

  scrollTop = 300;
  act(() => latestView?.handleScroll());
  while (frames.size > 0) flushNextFrame();

  expect(scrollTop).toBe(300);
});
