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
  latestSummary: string;
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

export function activitySummary(block: AgentActivityBlockView) {
  if (block.kind === "tool-activity") return block.activity.summary;
  return block.reasoning.status === "streaming"
    ? "正在思考"
    : reasoningSummary(block.reasoning.markdown);
}

export function activityGroupPresentation(
  blocks: readonly AgentActivityBlockView[],
  active = false,
): AgentActivityGroupPresentation {
  const latest = blocks.at(-1);
  return {
    latestSummary: latest ? activitySummary(latest) : "",
    stepCount: blocks.length,
    errorCount: blocks.filter(
      (block) => block.kind === "tool-activity" && block.activity.status === "failed",
    ).length,
    running:
      active ||
      blocks.some(
        (block) =>
          (block.kind === "reasoning" && block.reasoning.status === "streaming") ||
          (block.kind === "tool-activity" && block.activity.status === "running"),
      ),
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
