import type { ThoughtDTO } from "@reflecta/server";

type ThoughtReader = {
  getThoughtById(id: string): Promise<ThoughtDTO | null>;
};

export async function buildSystemPrompt(
  thoughtService: ThoughtReader,
  referenceThoughtIds: string[],
): Promise<string> {
  const basePrompt = `你是 Reflecta 的认知伙伴。你的角色是催化剂，而不是替代者。

你的目标是帮助用户深化对自己知识网的理解：
- 还原 thought 背后被遗忘的 context 细节
- 引入外部参照、概念对比和场景例子
- 帮助用户发现隐藏的组织维度
- 在用户确认后，通过工具提议更新知识库（创建 thought、补充 context、修改 thought、创建连线）

原则：
- 深度 > 广度，每个观点都应有明确的 context provenance
- 不要替用户下结论，提供催化剂让用户自己形成理解
- 优先使用工具读取用户知识库中的完整结构（正文、context、连线、category），而不是仅凭摘要猜测`;

  if (referenceThoughtIds.length === 0) {
    return basePrompt;
  }

  const sections: string[] = [];
  for (const thoughtId of referenceThoughtIds) {
    const thought = await thoughtService.getThoughtById(thoughtId);
    if (!thought) continue;
    sections.push(formatThoughtContext(thought));
  }

  if (sections.length === 0) {
    return basePrompt;
  }

  return `${basePrompt}

---

用户在本轮对话中 @ 引用了以下 thought，请优先基于这些完整上下文展开讨论：

${sections.join("\n\n---\n\n")}`;
}

function formatThoughtContext(thought: ThoughtDTO): string {
  const contextBlocks =
    thought.contexts.length > 0
      ? thought.contexts
          .map((ctx) => {
            const source = ctx.sourceName ? `《${ctx.sourceName}》` : "";
            return `- [${ctx.sourceType}]${source}\n${ctx.content}`;
          })
          .join("\n\n")
      : "（无 context）";

  const connections =
    thought.connections.length > 0
      ? thought.connections.map((c) => `- → ${c.title ?? c.id} (${c.id})`).join("\n")
      : "（无连线）";

  const categories = thought.categoryIds.length > 0 ? thought.categoryIds.join(", ") : "（未分类）";

  return `### Thought: ${thought.title ?? thought.id}
- ID: ${thought.id}
- Categories: ${categories}

**正文**
${thought.body}

**Contexts**
${contextBlocks}

**Connections**
${connections}`;
}

export function previewText(text: string, maxLen = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}
