import { formatElapsed } from "#hooks/use-elapsed";
import type { AgentActivityBlockView, AgentToolActivityView } from "./types";

export type AgentToolIconKind =
  | "attachment"
  | "command"
  | "context"
  | "domain"
  | "edit"
  | "file"
  | "graph"
  | "search"
  | "understanding"
  | "web"
  | "write"
  | "other";

export type AgentActivityGroupPresentation = {
  summary: string;
  elapsed: string | null;
  toolCount: number;
  hasReasoning: boolean;
  stepCount: number;
  errorCount: number;
  running: boolean;
};

export function isAgentActivityBlock(block: { kind: string }): block is AgentActivityBlockView {
  return block.kind === "reasoning" || block.kind === "tool-activity";
}

export function reasoningSummary(markdown: string) {
  return (
    markdown
      .replace(/!\[[^\]]*]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}(?:#{1,6}|[-*+])\s+/gm, "")
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "思考过程"
  );
}

/** 运行中状态文案（对齐 Beautiful UI thinking-state header 的 active 文案） */
function runningGroupSummary(blocks: readonly AgentActivityBlockView[]): string {
  const hasRunningTool = blocks.some(
    (block) => block.kind === "tool-activity" && block.activity.status === "running",
  );
  const hasStreamingReasoning = blocks.some(
    (block) => block.kind === "reasoning" && block.reasoning.status === "streaming",
  );
  // running 摘要用「X中」简式（去省略号）——进行时细节（文案+动画+时间）由 thinking 行承载，
  // activity group 只给静态概览，避免同消息里双份「正在思考... + 三点动画」。
  if (hasRunningTool) return "执行工具中";
  if (hasStreamingReasoning) return "思考中";
  return "处理中";
}

function activityCreatedAt(block: AgentActivityBlockView) {
  return block.kind === "reasoning" ? block.reasoning.createdAt : block.activity.createdAt;
}

/** 组内最早一块的起点，供运行中秒表使用。 */
export function activityStartedAt(blocks: readonly AgentActivityBlockView[]): string | null {
  for (const block of blocks) {
    const createdAt = activityCreatedAt(block);
    if (createdAt) return createdAt;
  }
  return null;
}

/** 两段 ISO 时间戳之间的耗时；无效或不足 0.1s 时返回 null。 */
export function elapsedBetween(startAt?: string, endAt?: string | null): string | null {
  if (!startAt || !endAt) return null;
  const elapsedMs = Date.parse(endAt) - Date.parse(startAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const label = formatElapsed(elapsedMs);
  return label === "0.0s" ? null : label;
}

/** 用 session 块时间戳把每一段 thinking 的时长加总（不是只取首/尾一块）。 */
export function activityElapsedLabel(
  blocks: readonly AgentActivityBlockView[],
  endedAt?: string | null,
): string | null {
  let totalMs = 0;
  let counted = false;
  for (const [index, block] of blocks.entries()) {
    if (block.kind !== "reasoning" || !block.reasoning.createdAt) continue;
    const next = blocks[index + 1];
    const end = next ? activityCreatedAt(next) : endedAt;
    if (!end) continue;
    const elapsedMs = Date.parse(end) - Date.parse(block.reasoning.createdAt);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) continue;
    totalMs += elapsedMs;
    counted = true;
  }
  if (!counted) return null;
  const label = formatElapsed(totalMs);
  return label === "0.0s" ? null : label;
}

/** 完成态总结文案。elapsed 有值时写成「思考了 3.2s」，否则回退「完成思考」。 */
export function completedGroupSummary(
  blocks: readonly AgentActivityBlockView[],
  elapsed?: string | null,
): string {
  const parts: string[] = [];
  if (blocks.some((block) => block.kind === "reasoning")) {
    parts.push(elapsed && elapsed !== "0.0s" ? `思考了 ${elapsed}` : "完成思考");
  }
  const toolCount = blocks.filter((block) => block.kind === "tool-activity").length;
  if (toolCount > 0) parts.push(`运行了 ${toolCount} 个工具`);
  return parts.length > 0 ? parts.join("，") : "已完成";
}

export function activityGroupPresentation(
  blocks: readonly AgentActivityBlockView[],
  active = false,
  endedAt?: string | null,
): AgentActivityGroupPresentation {
  const running =
    active ||
    blocks.some(
      (block) =>
        (block.kind === "reasoning" && block.reasoning.status === "streaming") ||
        (block.kind === "tool-activity" && block.activity.status === "running"),
    );
  const elapsed = running ? null : activityElapsedLabel(blocks, endedAt);
  const toolCount = blocks.filter((block) => block.kind === "tool-activity").length;
  const hasReasoning = blocks.some((block) => block.kind === "reasoning");
  return {
    summary: running ? runningGroupSummary(blocks) : completedGroupSummary(blocks, elapsed),
    elapsed,
    toolCount,
    hasReasoning,
    stepCount: blocks.length,
    errorCount: blocks.filter(
      (block) => block.kind === "tool-activity" && block.activity.status === "failed",
    ).length,
    running,
  };
}

export function toolIconKind(activity: AgentToolActivityView): AgentToolIconKind {
  const name = activity.toolName?.toLowerCase() ?? "";
  if (name === "bash") return "command";
  if (name === "edit") return "edit";
  if (name === "write") return "write";
  if (name === "attachment_read") return "attachment";
  if (name === "web_search") return "web";
  if (name === "graph") return "graph";
  if (name.startsWith("domain_")) return "domain";
  if (name.startsWith("understanding_")) return "understanding";
  if (name.startsWith("context_")) return "context";
  if (
    name === "read" ||
    name === "file_read" ||
    name === "fetch_content" ||
    name === "get_search_content"
  ) {
    return "file";
  }
  if (name.includes("search") || name === "retrieve_knowledge") return "search";
  return "other";
}
