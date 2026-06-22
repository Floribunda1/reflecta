export const chatQueryKeys = {
  threads: ["agent.threads"] as const,
  threadMessages: (threadId: string) => ["agent.messages", threadId] as const,
  sessionEvents: (sessionId: string) => ["agent.session-events", sessionId] as const,
  modelOptions: ["ai.model-options"] as const,
};
