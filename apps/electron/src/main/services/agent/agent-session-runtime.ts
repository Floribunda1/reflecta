import type {
  AgentAssistantTurn,
  AgentAssistantTurnBlock,
  AgentEvent,
  AgentSessionEvent,
  AgentSessionFeedFrame,
  AgentSessionProjection,
} from "@shared/agent";
import { projectAgentSessionEvents, reduceAgentSessionEvent } from "@shared/agent";

type Subscriber = {
  receive(frame: AgentSessionFeedFrame): void;
  lastRevision: number;
};

type SessionEntry = {
  projection: AgentSessionProjection;
  revision: number;
  subscribers: Set<Subscriber>;
  publishTimer: ReturnType<typeof setTimeout> | null;
};

export class AgentSessionRuntime {
  private readonly entries = new Map<string, SessionEntry>();
  private readonly initializations = new Map<string, Promise<SessionEntry>>();

  constructor(
    private readonly loadEvents: (sessionId: string) => Promise<readonly AgentSessionEvent[]>,
  ) {}

  async projection(sessionId: string): Promise<AgentSessionProjection> {
    return (await this.ensure(sessionId)).projection;
  }

  assistantTurn(
    input: Omit<AgentAssistantTurn, "blocks" | "text">,
    finalText?: string,
  ): AgentAssistantTurn {
    const projection = this.entries.get(input.sessionId)?.projection;
    if (!projection) {
      throw new Error(`Agent Session projection is not initialized: ${input.sessionId}`);
    }
    const message = projection.messages.find(
      (candidate) => candidate.role === "assistant" && candidate.id === input.messageId,
    );
    const blocks = message?.blocks ?? [];
    const textIndex = blocks.findLastIndex((block) => block.kind === "text");
    const finalBlocks: AgentAssistantTurnBlock[] =
      finalText && textIndex < 0
        ? [...blocks, { kind: "text", text: finalText, state: "done", createdAt: input.createdAt }]
        : blocks.map((block, index) =>
            index === textIndex && block.kind === "text" ? { ...block, state: "done" } : block,
          );
    return {
      ...input,
      blocks: finalBlocks,
      text: finalBlocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join(""),
    };
  }

  hasAssistantContent(sessionId: string, messageId: string): boolean {
    return Boolean(
      this.entries
        .get(sessionId)
        ?.projection.messages.find(
          (message) => message.role === "assistant" && message.id === messageId,
        )?.blocks?.length,
    );
  }

  async watch(
    sessionId: string,
    receive: (frame: AgentSessionFeedFrame) => void,
  ): Promise<() => void> {
    const entry = await this.ensure(sessionId);
    const subscriber: Subscriber = { receive, lastRevision: entry.revision };
    entry.subscribers.add(subscriber);
    receive(this.stateFrame(sessionId, entry));
    return () => entry.subscribers.delete(subscriber);
  }

  async replace(
    sessionId: string,
    events: readonly AgentSessionEvent[],
  ): Promise<AgentSessionProjection> {
    const entry = await this.ensure(sessionId);
    entry.projection = projectAgentSessionEvents(sessionId, events);
    entry.revision += 1;
    this.publish(sessionId, entry);
    return entry.projection;
  }

  apply(event: AgentEvent, delivery: "immediate" | "deferred" = "immediate"): void {
    const entry = this.entries.get(event.sessionId);
    if (!entry) throw new Error(`Agent Session projection is not initialized: ${event.sessionId}`);

    entry.projection = {
      ...reduceAgentSessionEvent(entry.projection, event),
      sessionId: event.sessionId,
    };
    entry.revision += 1;
    if (delivery === "deferred") this.publishDeferred(event.sessionId, entry);
    else this.publish(event.sessionId, entry);
  }

  forget(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    if (entry.publishTimer) clearTimeout(entry.publishTimer);
    this.entries.delete(sessionId);
  }

  private async ensure(sessionId: string): Promise<SessionEntry> {
    const existing = this.entries.get(sessionId);
    if (existing) return existing;

    const pending = this.initializations.get(sessionId);
    if (pending) return pending;

    const initialization = this.loadEvents(sessionId).then((events) => {
      const entry: SessionEntry = {
        projection: projectAgentSessionEvents(sessionId, events),
        revision: 0,
        subscribers: new Set(),
        publishTimer: null,
      };
      this.entries.set(sessionId, entry);
      this.initializations.delete(sessionId);
      return entry;
    });
    this.initializations.set(sessionId, initialization);
    try {
      return await initialization;
    } catch (error) {
      this.initializations.delete(sessionId);
      throw error;
    }
  }

  private publishDeferred(sessionId: string, entry: SessionEntry): void {
    if (entry.publishTimer) return;
    entry.publishTimer = setTimeout(() => {
      entry.publishTimer = null;
      this.publish(sessionId, entry);
    }, 16);
  }

  private publish(sessionId: string, entry: SessionEntry): void {
    if (entry.publishTimer) {
      clearTimeout(entry.publishTimer);
      entry.publishTimer = null;
    }
    const frame = this.stateFrame(sessionId, entry);
    for (const subscriber of entry.subscribers) {
      if (subscriber.lastRevision >= entry.revision) continue;
      subscriber.lastRevision = entry.revision;
      subscriber.receive(frame);
    }
  }

  private stateFrame(sessionId: string, entry: SessionEntry): AgentSessionFeedFrame {
    return {
      kind: "state",
      sessionId,
      revision: entry.revision,
      session: entry.projection,
    };
  }
}
