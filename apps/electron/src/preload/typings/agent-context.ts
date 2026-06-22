import type { AgentContextRef } from "./agent";

const MAX_SELECTED_CONTEXT_REFS = 8;

function refTitle(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

export function selectedAgentContextBlockFromRefs(refs: AgentContextRef[]): string {
  if (refs.length === 0) return "";

  const lines = refs
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map((ref) => `- ${ref.type}: ${refTitle(ref)} (id: ${ref.id})`)
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。\n${lines}`;
}
