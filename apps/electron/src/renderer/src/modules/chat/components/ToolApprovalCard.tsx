import { defineComponent, ref, watch } from "vue";
import Button from "primevue/button";
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

type StatusMeta = {
  label: string;
  tone: "neutral" | "warning" | "info" | "success" | "error";
};

const STATUS_META: Record<Exclude<ToolPart["state"], "approval-responded">, StatusMeta> = {
  "input-streaming": { label: "接收参数", tone: "info" },
  "input-available": { label: "准备执行", tone: "info" },
  "approval-requested": { label: "等待确认", tone: "warning" },
  "output-available": { label: "已完成", tone: "success" },
  "output-error": { label: "执行失败", tone: "error" },
  "output-denied": { label: "已拒绝", tone: "neutral" },
};

function getStatusMeta(part: ToolPart): StatusMeta {
  if (part.state === "approval-responded") {
    if (part.approval?.approved === false) {
      return { label: "已拒绝", tone: "neutral" };
    }
    return { label: "执行中", tone: "info" };
  }
  return STATUS_META[part.state];
}

function getToolLabel(toolName: string): string {
  return WRITE_TOOL_LABELS[toolName] ?? READ_TOOL_LABELS[toolName] ?? toolName;
}

function getToolName(part: ToolPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
}

function getToolOutput(part: ToolPart): unknown {
  if (part.state === "output-available" && "output" in part) {
    return part.output;
  }
  return undefined;
}

function getToolErrorText(part: ToolPart): string | undefined {
  if (part.state === "output-error" && "errorText" in part && part.errorText) {
    return part.errorText;
  }
  return undefined;
}

const TONE_CLASS: Record<StatusMeta["tone"], string> = {
  neutral: "bg-surface-100 text-muted-color",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
};

export const ToolApprovalCard = defineComponent({
  name: "ToolApprovalCard",
  props: {
    part: { type: Object as () => ToolPart, required: true },
  },
  setup(props) {
    const ctx = useChatPageContext()!;
    const expanded = ref(false);

    watch(
      () => props.part.state,
      (state) => {
        if (state === "approval-requested") {
          expanded.value = true;
        }
      },
      { immediate: true },
    );

    return () => {
      const part = props.part;
      const toolName = getToolName(part);
      const label = getToolLabel(toolName);
      const status = getStatusMeta(part);
      const needsApproval = part.state === "approval-requested";
      const presentation = presentToolCall({
        toolName,
        toolLabel: label,
        input: part.input,
        output: getToolOutput(part),
        errorText: getToolErrorText(part),
        state: part.state,
      });
      const borderClass = needsApproval
        ? "border-amber-200 bg-amber-50/60"
        : "border-surface-200 bg-surface-50";

      return (
        <div class={["rounded-lg border", borderClass]}>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            onClick={() => {
              expanded.value = !expanded.value;
            }}
          >
            <i
              class={[
                "pi shrink-0 text-xs text-muted-color",
                expanded.value ? "pi-chevron-down" : "pi-chevron-right",
              ]}
            />
            <span class="shrink-0 text-sm font-medium text-color">{label}</span>
            <span
              class={[
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                TONE_CLASS[status.tone],
              ]}
            >
              {status.label}
            </span>
            {!expanded.value && (
              <span class="min-w-0 flex-1 truncate text-xs text-muted-color">
                {presentation.summary}
              </span>
            )}
          </button>

          {expanded.value && (
            <div class="space-y-3 border-t border-surface-200/80 px-3 py-3">
              <div class="text-xs text-muted-color">{presentation.summary}</div>

              {presentation.sections.map((section) => (
                <div key={section.title}>
                  <div class="mb-1.5 text-xs font-medium text-color">{section.title}</div>
                  {section.rows.length > 0 && (
                    <div class="space-y-1.5 rounded bg-surface-0 px-2.5 py-2">
                      {section.rows.map((row) => (
                        <div
                          key={`${section.title}-${row.label}`}
                          class="grid grid-cols-[72px_1fr] gap-2 text-xs"
                        >
                          <span class="text-muted-color">{row.label}</span>
                          <span class="whitespace-pre-wrap text-color">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {section.items && section.items.length > 0 && (
                    <ul class="space-y-1 rounded bg-surface-0 px-2.5 py-2 text-xs text-color">
                      {section.items.map((item, index) => (
                        <li key={`${section.title}-${index}`} class="leading-5">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {needsApproval && (
                <div class="flex gap-2 pt-1">
                  <Button
                    label="确认"
                    size="small"
                    onClick={() => void ctx.confirmToolCall(part.toolCallId, true)}
                  />
                  <Button
                    label="拒绝"
                    size="small"
                    severity="secondary"
                    onClick={() => void ctx.confirmToolCall(part.toolCallId, false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      );
    };
  },
});
