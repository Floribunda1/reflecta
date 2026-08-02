export const chatQueryKeys = {
  threads: ["agent.threads"] as const,
  threadMessages: (threadId: string) => ["agent.messages", threadId] as const,
  modelOptions: ["ai.model-options"] as const,
};
