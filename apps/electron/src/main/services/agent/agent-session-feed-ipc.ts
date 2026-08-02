import { ipcMain, type IpcMainEvent, type MessagePortMain } from "electron";
import type { AgentSessionFeedError, AgentSessionFeedFrame } from "@shared/agent";
import { formatAgentError } from "./error";
import type { PiAgentHost } from "./pi-agent-host";

export const AGENT_SESSION_FEED_CHANNEL = "agent:session-feed";

function feedError(error: unknown): AgentSessionFeedError {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  return {
    code: code === "ENOENT" ? "SESSION_NOT_FOUND" : "PROJECTION_FAILED",
    message: formatAgentError(error),
    retryable: code !== "ENOENT",
  };
}

function post(port: MessagePortMain, frame: AgentSessionFeedFrame): boolean {
  try {
    port.postMessage(frame);
    return true;
  } catch {
    return false;
  }
}

export function handleAgentSessionFeedRequest(
  host: Pick<PiAgentHost, "watchSession">,
  event: Pick<IpcMainEvent, "ports">,
  payload: unknown,
): void {
  const port = event.ports[0];
  if (!port) return;
  const sessionId =
    typeof payload === "object" &&
    payload !== null &&
    "sessionId" in payload &&
    typeof payload.sessionId === "string"
      ? payload.sessionId
      : "";
  if (!sessionId) {
    port.close();
    return;
  }

  let closed = false;
  let unsubscribe: (() => void) | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
  };
  port.on("close", close);
  port.start();

  void host
    .watchSession(sessionId, (frame) => {
      if (!closed && !post(port, frame)) close();
    })
    .then((stop) => {
      if (closed) stop();
      else unsubscribe = stop;
    })
    .catch((error) => {
      if (!closed) {
        post(port, { kind: "error", sessionId, error: feedError(error) });
        port.close();
      }
      close();
    });
}

export function registerAgentSessionFeed(host: Pick<PiAgentHost, "watchSession">): void {
  ipcMain.on(AGENT_SESSION_FEED_CHANNEL, (event, payload) =>
    handleAgentSessionFeedRequest(host, event, payload),
  );
}
