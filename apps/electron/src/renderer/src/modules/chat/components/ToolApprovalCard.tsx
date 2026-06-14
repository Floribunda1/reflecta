import { Badge } from "@renderer/components/ui/badge";
import { semanticBadgeClass, type SemanticBadgeTone } from "@renderer/lib/badge-colors";
import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { useChatPageContext } from "../context";
import { presentToolCall } from "./tool-presenters";

const WRITE_TOOL_LABELS: Record<string, string> = {
  propose_create_insight: "创建 Insight",
  propose_update_thought: "更新 Thought",
  propose_add_context: "添加 Context",
  propose_create_connection: "创建连接",
};

const READ_TOOL_LABELS: Record<string, string> = {
  search_knowledge_base: "搜索知识库",
  get_thought_detail: "查看 Thought",
  get_graph_neighborhood: "查看图谱邻域",
};

type ToolPart = ToolUIPart | DynamicToolUIPart;
type StatusMeta = { label: string; tone: "neutral" | "warning" | "info" | "success" | "error" };

const STATUS_META: Record<Exclude<ToolPart["state"], "approval-responded">, StatusMeta> = {
  "input-streaming": { label: "接收参数", tone: "info" },
  "input-available": { label: "准备执行", tone: "info" },
  "approval-requested": { label: "等待确认", tone: "warning" },
  "output-available": { label: "已完成", tone: "success" },
  "output-error": { label: "执行失败", tone: "error" },
  "output-denied": { label: "已拒绝", tone: "neutral" },
};

function getStatusMeta(part: ToolPart): StatusMeta {
  if (part.state === "approval-responded")
    return part.approval?.approved === false
      ? { label: "已拒绝", tone: "neutral" }
      : { label: "执行中", tone: "info" };
  return STATUS_META[part.state];
}

function getToolLabel(toolName: string): string {
  return WRITE_TOOL_LABELS[toolName] ?? READ_TOOL_LABELS[toolName] ?? toolName;
}

function getToolName(part: ToolPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
}

function getToolOutput(part: ToolPart): unknown {
  return part.state === "output-available" && "output" in part ? part.output : undefined;
}

function getToolErrorText(part: ToolPart): string | undefined {
  return part.state === "output-error" && "errorText" in part && part.errorText
    ? part.errorText
    : undefined;
}

const TONE_COLOR: Record<StatusMeta["tone"], SemanticBadgeTone | "error"> = {
  neutral: "default",
  warning: "warning",
  info: "accent",
  success: "success",
  error: "error",
};

export function ToolApprovalCard({ part }: { part: ToolPart }) {
  const ctx = useChatPageContext();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (part.state === "approval-requested") setExpanded(true);
  }, [part.state]);

  const toolName = getToolName(part);
  const label = getToolLabel(toolName);
  const status = getStatusMeta(part);
  const statusTone = TONE_COLOR[status.tone];
  const needsApproval = part.state === "approval-requested";
  const presentation = presentToolCall({
    toolName,
    toolLabel: label,
    input: part.input,
    output: getToolOutput(part),
    errorText: getToolErrorText(part),
    state: part.state,
  });
  const borderClass = needsApproval ? "border-amber-200 bg-amber-50/60" : "border-border bg-muted";

  return (
    <div className={["rounded-lg border", borderClass].join(" ")}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <span className="shrink-0 text-sm font-medium text-foreground">{label}</span>
        <Badge
          variant={statusTone === "error" ? "destructive" : "secondary"}
          className={statusTone === "error" ? undefined : semanticBadgeClass[statusTone]}
        >
          {status.label}
        </Badge>
        {!expanded && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {presentation.summary}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="text-xs text-muted-foreground">{presentation.summary}</div>
          {presentation.sections.map((section) => (
            <div key={section.title}>
              <div className="mb-1.5 text-xs font-medium text-foreground">{section.title}</div>
              {section.rows.length > 0 && (
                <div className="space-y-1.5 rounded bg-background px-2.5 py-2">
                  {section.rows.map((row) => (
                    <div
                      key={`${section.title}-${row.label}`}
                      className="grid grid-cols-[72px_1fr] gap-2 text-xs"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="whitespace-pre-wrap text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {section.items && section.items.length > 0 && (
                <ul className="space-y-1 rounded bg-background px-2.5 py-2 text-xs text-foreground">
                  {section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`} className="leading-5">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {needsApproval && (
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => void ctx.confirmToolCall(part.toolCallId, true)}
              >
                确认
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void ctx.confirmToolCall(part.toolCallId, false)}
              >
                拒绝
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
