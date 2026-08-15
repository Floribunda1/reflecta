import { ipcRenderer } from "electron";
import type { AgentSessionFeedFrame } from "./typings/agent";
import { isAgentSessionFeedFrame } from "./typings/agent";
import { rendererErrorPayload, sendRendererError } from "./diagnostic-reporter";

export const AGENT_SESSION_FEED_CHANNEL = "agent:session-feed";

export type AgentSessionFeedApi = {
  watch(sessionId: string, receive: (frame: AgentSessionFeedFrame) => void): () => void;
};

export const agentSessionFeedApi: AgentSessionFeedApi = {
  watch(sessionId, receive) {
    const channel = new MessageChannel();
    let closed = false;
    let lastRevision = -1;
    channel.port1.onmessage = (event) => {
      if (closed || !isAgentSessionFeedFrame(event.data)) return;
      if (event.data.kind === "state") {
        if (event.data.revision <= lastRevision) return;
        lastRevision = event.data.revision;
      }
      try {
        receive(event.data);
      } catch (error) {
        // Errors thrown from the feed receive path (e.g. React's synchronous
        // re-render hitting "Maximum update depth exceeded") escape through
        // this port handler, so window.onerror only ever sees the preload
        // frame. Report with the frame context instead of a useless stack.
        sendRendererError(
          rendererErrorPayload("feed.receive", error, {
            "feed.kind": event.data.kind,
            "feed.sessionId": event.data.sessionId,
            "feed.revision": event.data.kind === "state" ? event.data.revision : undefined,
          }),
        );
      }
    };
    channel.port1.start();
    ipcRenderer.postMessage(AGENT_SESSION_FEED_CHANNEL, { sessionId }, [channel.port2]);

    return () => {
      closed = true;
      channel.port1.close();
    };
  },
};
