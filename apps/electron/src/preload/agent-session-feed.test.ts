import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentSessionFeedFrame, AgentSessionProjection } from "./typings/agent";

const { mockIpcRenderer } = vi.hoisted(() => ({
  mockIpcRenderer: {
    postMessage: vi.fn(),
    send: vi.fn(),
  },
}));

vi.mock("electron", () => ({ ipcRenderer: mockIpcRenderer }));

const { mockSendRendererError, mockRendererErrorPayload } = vi.hoisted(() => ({
  mockSendRendererError: vi.fn(),
  mockRendererErrorPayload: vi.fn(
    (source: string, error: unknown, attrs: Record<string, unknown> = {}) => ({
      source,
      message: error instanceof Error ? error.message : String(error),
      ...attrs,
    }),
  ),
}));

vi.mock("./diagnostic-reporter", () => ({
  sendRendererError: mockSendRendererError,
  rendererErrorPayload: mockRendererErrorPayload,
}));

import { agentSessionFeedApi } from "./agent-session-feed";

const projection: AgentSessionProjection = {
  sessionId: "session_1",
  messages: [],
  activeRunId: null,
  status: "running",
  error: null,
  entityCatalog: [],
  contextCompactions: [],
  activeCompaction: null,
  compactionError: null,
  cancelledAssistantMessageId: null,
};

function stateFrame(revision: number): AgentSessionFeedFrame {
  return { kind: "state", sessionId: "session_1", revision, session: projection };
}

function transferredPort(): MessagePort {
  const call = mockIpcRenderer.postMessage.mock.calls[0];
  const transfer = call?.[2] as MessagePort[] | undefined;
  const port = transfer?.[0];
  if (!port) throw new Error("watch() did not transfer a MessagePort");
  return port;
}

describe("agentSessionFeedApi.watch", () => {
  beforeEach(() => {
    mockIpcRenderer.postMessage.mockClear();
    mockIpcRenderer.send.mockClear();
    mockSendRendererError.mockClear();
    mockRendererErrorPayload.mockClear();
  });

  test("reports receive errors with the frame context", async () => {
    const receive = vi.fn(() => {
      throw new Error("Maximum update depth exceeded");
    });
    agentSessionFeedApi.watch("session_1", receive);

    transferredPort().postMessage(stateFrame(7));
    await vi.waitFor(() => expect(mockSendRendererError).toHaveBeenCalledTimes(1));

    expect(mockRendererErrorPayload).toHaveBeenCalledWith(
      "feed.receive",
      expect.any(Error),
      expect.objectContaining({
        "feed.kind": "state",
        "feed.sessionId": "session_1",
        "feed.revision": 7,
      }),
    );
  });

  test("does not report when receive succeeds", async () => {
    const receive = vi.fn();
    agentSessionFeedApi.watch("session_1", receive);

    transferredPort().postMessage(stateFrame(1));
    await vi.waitFor(() => expect(receive).toHaveBeenCalledTimes(1));

    expect(mockSendRendererError).not.toHaveBeenCalled();
  });
});
