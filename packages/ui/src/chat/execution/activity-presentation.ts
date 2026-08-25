import { formatElapsed } from "#hooks/use-elapsed";
import type { AgentActivityBlockView, AgentToolActivityView } from "./types";

export type AgentToolIconKind =
  | "attachment"
  | "canvas"
  | "command"
  | "context"
  | "domain"
  | "edit"
  | "file"
  | "search"
  | "understanding"
  | "web"
  | "write"
  | "other";

/** 完成态摘要分段：text 普通文本，mono 等宽数字/耗时（供 MonoNumber 渲染）。 */
export type SummaryRun = { type: "text"; text: string } | { type: "mono"; text: string };

export type AgentActivityGroupPresentation = {
  summary: string;
  elapsed: string | null;
  stepCount: number;
  errorCount: number;
  running: boolean;
  completedRuns: SummaryRun[];
};

/** 完成态摘要的语义桶：附件 / 知识（理解·上下文·领域·画布）/ 检索 / 生图 / 兜底。 */
type AgentToolBucket = "attachment" | "knowledge" | "retrieval" | "image" | "other";

const BUCKET_ORDER: readonly AgentToolBucket[] = [
  "attachment",
  "knowledge",
  "retrieval",
  "image",
  "other",
];

const OBJECT_NAME_PATTERN = /「([^」]*)」/;

function textRun(text: string): SummaryRun {
  return { type: "text", text };
}

function monoRun(text: string): SummaryRun {
  return { type: "mono", text };
}

function summaryRunsText(runs: readonly SummaryRun[]): string {
  return runs.map((run) => run.text).join("");
}

/**
 * 按 Reflecta 实际工具面分类（pi-readonly-tools + image_generate）。
 * create/update/delete 等写工具走 proposal UI，不会出现在 activity group 里。
 */
export function toolBucket(toolName?: string): AgentToolBucket {
  switch (toolName) {
    case "attachment_read":
      return "attachment";
    case "retrieve_knowledge":
      return "retrieval";
    case "image_generate":
      return "image";
    case "understanding_get":
    case "understanding_list":
    case "context_get":
    case "context_list":
    case "domain_list":
    case "domain_inspect":
    case "canvas_read":
    case "canvas_list":
    case "canvas_search":
      return "knowledge";
    default:
      return "other";
  }
}

function activityObjectName(activity: AgentToolActivityView): string | undefined {
  const match = activity.summary.match(OBJECT_NAME_PATTERN);
  const name = match?.[1]?.trim();
  return name || undefined;
}

function truncateName(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function bucketRuns(
  bucket: AgentToolBucket,
  count: number,
  names: readonly string[],
): SummaryRun[] {
  const first = names[0];
  if (bucket === "attachment") {
    if (count === 1 && first) return [textRun(`读取了附件「${truncateName(first)}」`)];
    if (count === 1) return [textRun("读取了 1 个附件")];
    if (first) {
      return [
        textRun(`读取了附件「${truncateName(first)}」等 `),
        monoRun(String(count)),
        textRun(" 个附件"),
      ];
    }
    return [textRun("读取了 "), monoRun(String(count)), textRun(" 个附件")];
  }
  if (bucket === "knowledge") {
    if (count === 1 && first) return [textRun(`查看了「${truncateName(first)}」`)];
    if (count === 1) return [textRun("查看了 1 条知识")];
    const shown = names
      .slice(0, 2)
      .map((name) => `「${truncateName(name)}」`)
      .join("");
    if (shown) {
      return [textRun(`查看了${shown}等 `), monoRun(String(count)), textRun(" 条知识")];
    }
    return [textRun("查看了 "), monoRun(String(count)), textRun(" 条知识")];
  }
  if (bucket === "retrieval") {
    return [textRun("检索了 "), monoRun(String(count)), textRun(" 次你的知识")];
  }
  if (bucket === "image") {
    return [textRun("生成了 "), monoRun(String(count)), textRun(" 张图片")];
  }
  return [textRun("调用了 "), monoRun(String(count)), textRun(" 个工具")];
}

export function isAgentActivityBlock(block: { kind: string }): block is AgentActivityBlockView {
  return block.kind === "reasoning" || block.kind === "tool-activity";
}

const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*]\([^)]*\)/g;
const LINK_MARKDOWN_PATTERN = /\[([^\]]+)]\([^)]*\)/g;
const HEADING_MARKDOWN_PATTERN = /^\s{0,3}(?:#{1,6}|[-*+])\s+/gm;
const INLINE_MARKDOWN_PATTERN = /[*_~`]/g;
const WHITESPACE_PATTERN = /\s+/g;

export function reasoningSummary(markdown: string) {
  return (
    markdown
      .replace(IMAGE_MARKDOWN_PATTERN, "")
      .replace(LINK_MARKDOWN_PATTERN, "$1")
      .replace(HEADING_MARKDOWN_PATTERN, "")
      .replace(INLINE_MARKDOWN_PATTERN, "")
      .replace(WHITESPACE_PATTERN, " ")
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

/**
 * 完成态摘要分段：语义动作短语（附件→知识→检索→生图）在前，思考耗时降级到末尾。
 * 单例时展示对象名（取自活动 summary 的「…」），检索永远计数（query 是自然语言）。
 */
export function completedGroupRuns(
  blocks: readonly AgentActivityBlockView[],
  elapsed?: string | null,
): SummaryRun[] {
  const buckets = new Map<AgentToolBucket, { count: number; names: string[] }>();
  for (const block of blocks) {
    if (block.kind !== "tool-activity") continue;
    const bucket = toolBucket(block.activity.toolName);
    const entry = buckets.get(bucket) ?? { count: 0, names: [] };
    entry.count += 1;
    const name = activityObjectName(block.activity);
    if (name) entry.names.push(name);
    buckets.set(bucket, entry);
  }
  const runs: SummaryRun[] = [];
  for (const bucket of BUCKET_ORDER) {
    const entry = buckets.get(bucket);
    if (!entry) continue;
    if (runs.length > 0) runs.push(textRun("，"));
    runs.push(...bucketRuns(bucket, entry.count, entry.names));
  }
  if (blocks.some((block) => block.kind === "reasoning")) {
    if (runs.length > 0) runs.push(textRun("，"));
    if (elapsed && elapsed !== "0.0s") {
      runs.push(textRun("思考了 "), monoRun(elapsed));
    } else {
      runs.push(textRun("完成思考"));
    }
  }
  return runs.length > 0 ? runs : [textRun("已完成")];
}

/** 完成态总结文案（纯文本拼接，供 aria / 断言使用）。 */
export function completedGroupSummary(
  blocks: readonly AgentActivityBlockView[],
  elapsed?: string | null,
): string {
  return summaryRunsText(completedGroupRuns(blocks, elapsed));
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
  const completedRuns = running ? [] : completedGroupRuns(blocks, elapsed);
  return {
    summary: running ? runningGroupSummary(blocks) : summaryRunsText(completedRuns),
    elapsed,
    stepCount: blocks.length,
    errorCount: blocks.filter(
      (block) => block.kind === "tool-activity" && block.activity.status === "failed",
    ).length,
    running,
    completedRuns,
  };
}

export function toolIconKind(activity: AgentToolActivityView): AgentToolIconKind {
  const name = activity.toolName?.toLowerCase() ?? "";
  if (name === "bash") return "command";
  if (name === "edit") return "edit";
  if (name === "write") return "write";
  if (name === "attachment_read") return "attachment";
  if (name === "web_search") return "web";
  if (name.startsWith("canvas_") || name.startsWith("understanding_canvas")) return "canvas";
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
