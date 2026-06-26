import type { AgentContextRef, AgentEntitySource } from "./agent";

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

export function selectedAgentContextBlockFromSources(sources: AgentEntitySource[]): string {
  if (sources.length === 0) return "";

  const lines = sources
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map(
      (source) =>
        `- [[ref:${source.sourceId}]] ${contextTypeLabel(source.entity.type)}: ${refTitle(source.entity)}`,
    )
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。聊天正文引用时使用完整 [[ref:Sx]] marker，不要裸写 Sx 短号。\n${lines}`;
}

function contextTypeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}
