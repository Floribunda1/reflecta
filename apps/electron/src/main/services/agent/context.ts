import type { AgentChatMessage } from "@shared/chat";
import { selectedContextBlockFromRefs } from "@shared/chat-context";

export async function buildSelectedContextBlock(messages: AgentChatMessage[]): Promise<string> {
  const lastUser = messages.findLast((message) => message.role === "user");
  const refs = lastUser?.metadata?.contextRefs ?? [];
  return selectedContextBlockFromRefs(refs);
}
