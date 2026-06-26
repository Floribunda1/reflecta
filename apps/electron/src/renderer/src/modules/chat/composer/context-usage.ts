import type { AgentReducedMessage } from "@shared/agent";

export type ContextUsage = {
  tokens?: number | null;
  contextWindow?: number;
  percent?: number | null;
  selectedContextCount: number;
};

export function contextUsageFromMessages(
  messages: AgentReducedMessage[],
  selectedContextCount: number,
): ContextUsage {
  const message = messages.findLast((item) => item.role === "assistant" && item.contextUsage);
  return { ...message?.contextUsage, selectedContextCount };
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toPrecision(3))}K`;
  return String(value);
}

function percentLabel(percent: number) {
  if (percent > 0 && percent < 0.1) return "<0.1%";
  if (percent < 10) return `${Number(percent.toFixed(1))}%`;
  return `${Math.round(percent)}%`;
}

export function contextUsagePercent(usage: ContextUsage) {
  if (usage.percent !== undefined && usage.percent !== null) return usage.percent;
  if (usage.tokens === undefined || usage.tokens === null || !usage.contextWindow) return undefined;
  return (usage.tokens / usage.contextWindow) * 100;
}

export function contextUsageMeterLabel(usage: ContextUsage) {
  const percent = contextUsagePercent(usage);
  return percent === undefined ? "--" : percentLabel(percent);
}

export function contextUsageLabel(usage: ContextUsage) {
  if (usage.tokens === undefined || usage.tokens === null || !usage.contextWindow) {
    return "等待上次请求 usage";
  }
  return `上次上下文：${compactNumber(usage.tokens)} / ${compactNumber(usage.contextWindow)}`;
}
