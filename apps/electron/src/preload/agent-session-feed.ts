import { ipcRenderer } from "electron";
import type { AgentSessionFeedFrame } from "./typings/agent";
import { isAgentSessionFeedFrame } from "./typings/agent";

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
      receive(event.data);
    };
    channel.port1.start();
    ipcRenderer.postMessage(AGENT_SESSION_FEED_CHANNEL, { sessionId }, [channel.port2]);

    return () => {
      closed = true;
      channel.port1.close();
    };
  },
};
