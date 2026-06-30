import type { AgentContextRef, AgentEntitySource } from "./agent";

const MAX_SELECTED_CONTEXT_REFS = 8;

function refTitle(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

function entityRef(ref: AgentContextRef) {
  return `[[${ref.type}:${ref.id}]]`;
}

export function selectedAgentContextBlockFromRefs(refs: AgentContextRef[]): string {
  if (refs.length === 0) return "";

  const lines = refs
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map(
      (ref) =>
        `- ${entityRef(ref)} ${contextTypeLabel(ref.type)}: ${refTitle(ref)} (id: ${ref.id})`,
    )
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。工具参数使用 id，聊天正文引用使用 ref。\n${lines}`;
}

export function selectedAgentContextBlockFromSources(sources: AgentEntitySource[]): string {
  if (sources.length === 0) return "";

  const lines = sources
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map(
      (source) =>
        `- ${entityRef(source.entity)} ${contextTypeLabel(source.entity.type)}: ${refTitle(source.entity)} (id: ${source.entity.id})`,
    )
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。工具参数使用 id，聊天正文引用使用 ref。\n${lines}`;
}

function contextTypeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}
