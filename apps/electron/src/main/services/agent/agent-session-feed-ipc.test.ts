import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentSessionFeedFrame } from "@shared/agent";

vi.mock("electron", () => ({ ipcMain: { on: vi.fn() } }));

import { handleAgentSessionFeedRequest } from "./agent-session-feed-ipc";

function createPort() {
  let closeListener: (() => void) | undefined;
  return {
    port: {
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
      on: vi.fn((event: string, listener: () => void) => {
        if (event === "close") closeListener = listener;
      }),
    },
    close: () => closeListener?.(),
  };
}

describe("agent session feed IPC", () => {
  beforeEach(() => vi.clearAllMocks());

  test("transfers the initial frame and unsubscribes when the port closes", async () => {
    const frame: AgentSessionFeedFrame = {
      kind: "state",
      sessionId: "session_1",
      revision: 0,
      session: {
        sessionId: "session_1",
        messages: [],
        activeRunId: null,
        status: "idle",
        error: null,
        entityCatalog: [],
        contextCompactions: [],
        activeCompaction: null,
        compactionError: null,
        cancelledAssistantMessageId: null,
      },
    };
    const stop = vi.fn();
    const host = {
      watchSession: vi.fn(
        async (_sessionId: string, receive: (value: AgentSessionFeedFrame) => void) => {
          receive(frame);
          return stop;
        },
      ),
    };
    const { port, close } = createPort();

    handleAgentSessionFeedRequest(host, { ports: [port] } as never, {
      sessionId: "session_1",
    });
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledWith(frame));
    close();

    expect(port.start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  test("reports projection errors before closing the port", async () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });
    const host = { watchSession: vi.fn(async () => Promise.reject(error)) };
    const { port } = createPort();

    handleAgentSessionFeedRequest(host, { ports: [port] } as never, {
      sessionId: "session_1",
    });

    await vi.waitFor(() =>
      expect(port.postMessage).toHaveBeenCalledWith({
        kind: "error",
        sessionId: "session_1",
        error: { code: "SESSION_NOT_FOUND", message: "missing", retryable: false },
      }),
    );
    expect(port.close).toHaveBeenCalledOnce();
  });
});
