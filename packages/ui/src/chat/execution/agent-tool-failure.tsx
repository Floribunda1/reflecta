import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "#lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../../components/alert";

export type AgentToolFailureProps = {
  toolLabel: string;
  reason?: string;
  testId?: string;
};

/**
 * 工具执行失败的统一展示：整行宽，标题「调用 {tool} 失败」，
 * reason 默认单行省略（devtools 风格），点击展开看全文。
 */
export function AgentToolFailure({ toolLabel, reason, testId }: AgentToolFailureProps) {
  const text = reason?.trim() || "未知错误";
  const [expanded, setExpanded] = useState(false);

  return (
    <Alert variant="destructive" className="w-full min-w-0" data-testid={testId}>
      <CircleAlert aria-hidden="true" />
      <AlertTitle>调用{toolLabel}失败</AlertTitle>
      <AlertDescription className="min-w-0">
        <button
          type="button"
          className="block w-full min-w-0 cursor-pointer text-left"
          aria-expanded={expanded}
          title={expanded ? "收起" : "展开完整原因"}
          onClick={() => setExpanded((open) => !open)}
        >
          <span
            className={cn(
              "block min-w-0",
              expanded ? "max-h-48 overflow-auto whitespace-pre-wrap break-all" : "truncate",
            )}
          >
            {text}
          </span>
        </button>
      </AlertDescription>
    </Alert>
  );
}
