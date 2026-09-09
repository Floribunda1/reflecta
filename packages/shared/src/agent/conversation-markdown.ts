/**
 * 会话 → Markdown 的**唯一渲染实现**：chat 导出（renderer）与 session_read 工具
 * （main）共用，保证「导出看到的」与「agent 读到的」同形。
 *
 * 两种实体引用姿势由 mode 区分：
 * - "keep-references"：保留 `[[u:id]]` 原文，agent 可回链调用只读工具深读（session_read）。
 * - "replace-references"：替换为标题（需要调用方提供 labels），面向人读（导出）。
 *
 * 截断沿用 attachment_read 惯例：可选 maxChars（agent 决定预算）+ 硬顶；
 * 超限时按消息序保留**尾部**（最近的消息），并带 truncated 标记。
 */
import type { AgentMessageProjection } from "./session";
import { replaceEntityReferences } from "../app/entity-reference-codec";

export const DEFAULT_CONVERSATION_READ_MAX_CHARS = 40_000;
export const HARD_CONVERSATION_READ_MAX_CHARS = 200_000;

export type ConversationMarkdownMode = "keep-references" | "replace-references";

export type ConversationMarkdownOptions = {
  title: string;
  messages: readonly Pick<AgentMessageProjection, "role" | "text">[];
  mode: ConversationMarkdownMode;
  /** replace-references 模式的标题查表：`type:id` → 显示标题；缺失时保留原文。 */
  labels?: ReadonlyMap<string, string>;
  maxChars?: number;
};

export type ConversationMarkdownResult = {
  title: string;
  markdown: string;
  messageCount: number;
  /** 渲染进 markdown 的消息条数（截断后）。 */
  keptMessageCount: number;
  truncated: boolean;
};

const DEFAULT_TITLE = "Agent 对话";

export function roleLabel(role: AgentMessageProjection["role"]): string {
  return role === "user" ? "用户" : "Agent";
}

function renderMessageText(
  text: string,
  mode: ConversationMarkdownMode,
  labels: ReadonlyMap<string, string> | undefined,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (mode === "replace-references") {
    return replaceEntityReferences(
      trimmed,
      (reference, source) => labels?.get(`${reference.type}:${reference.id}`) ?? source,
    );
  }
  return trimmed;
}

export function conversationMessagesToMarkdown({
  title,
  messages,
  mode,
  labels,
  maxChars,
}: ConversationMarkdownOptions): ConversationMarkdownResult {
  const heading = `# ${title.trim() || DEFAULT_TITLE}`;
  const kept: string[] = [];

  // 从最新往前累计，保留尾部；放不下的整条丢弃（比中间截断更可读）。
  let accumulated = heading.length;
  let truncated = false;
  const hasBudget = maxChars !== undefined && Number.isFinite(maxChars);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const body = renderMessageText(message.text, mode, labels);
    if (!body) continue;
    const block = `## ${roleLabel(message.role)}\n\n${body}`;
    if (hasBudget && accumulated + block.length > (maxChars as number)) {
      truncated = true;
      break;
    }
    kept.unshift(block);
    accumulated += block.length;
  }

  const messageCount = messages.length;
  const keptMessageCount = kept.length;
  const markdown = [
    heading,
    truncated ? `> 对话较长，仅显示最近 ${keptMessageCount} / ${messageCount} 条消息。` : "",
    ...kept,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { title, markdown, messageCount, keptMessageCount, truncated };
}

/** attachment_read 同款 clamp：agent 传 maxChars 时收进 [1, HARD]；不传用默认。 */
export function clampConversationReadMaxChars(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_CONVERSATION_READ_MAX_CHARS;
  return Math.min(Math.max(Math.floor(value), 1), HARD_CONVERSATION_READ_MAX_CHARS);
}
