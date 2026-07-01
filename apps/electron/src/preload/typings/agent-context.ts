import type { AgentContextRef, AgentEntityCatalogEntry } from "./agent";

const MAX_SELECTED_CONTEXT_REFS = 8;

function refTitle(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

export function selectedAgentContextBlockFromRefs(refs: AgentContextRef[]): string {
  if (refs.length === 0) return "";

  const lines = refs
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map((ref) => `- ${contextTypeLabel(ref.type)}: ${refTitle(ref)}; id=${ref.id}`)
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量实体目录，不包含完整内容；需要内容时调用对应只读工具读取。工具参数使用 id。最终回答只要提到这些对象本身，就必须使用 structured final-answer entity_ref；不要用纯标题代替引用，不要手写方括号引用、ref、U1/D1。\n${lines}`;
}

export function selectedAgentContextBlockFromCatalog(entries: AgentEntityCatalogEntry[]): string {
  if (entries.length === 0) return "";

  const lines = entries
    .slice(0, MAX_SELECTED_CONTEXT_REFS)
    .map(
      (entry) =>
        `- ${contextTypeLabel(entry.entity.type)}: ${refTitle(entry.entity)}; id=${entry.entity.id}`,
    )
    .join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量实体目录，不包含完整内容；需要内容时调用对应只读工具读取。工具参数使用 id。最终回答只要提到这些对象本身，就必须使用 structured final-answer entity_ref；不要用纯标题代替引用，不要手写方括号引用、ref、U1/D1。\n${lines}`;
}

function contextTypeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}
