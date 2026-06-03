import { defineComponent } from "vue";
import Button from "primevue/button";
import type { ToolCallState } from "../state/types";
import { useChatPageContext } from "../context";

const WRITE_TOOL_LABELS: Record<string, string> = {
  propose_create_insight: "创建 Insight",
  propose_update_thought: "更新 Thought",
  propose_add_context: "添加 Context",
  propose_create_connection: "创建连接",
};

export const ToolApprovalCard = defineComponent({
  name: "ToolApprovalCard",
  props: {
    tool: { type: Object as () => ToolCallState, required: true },
  },
  setup(props) {
    const ctx = useChatPageContext()!;

    return () => {
      const tool = props.tool;
      const label = WRITE_TOOL_LABELS[tool.toolName] ?? tool.toolName;
      const preview = JSON.stringify(tool.input, null, 2);

      if (tool.status !== "pending") {
        return (
          <div class="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-muted-color">
            <div class="font-medium text-color">{label}</div>
            <div class="mt-1 capitalize">{tool.status}</div>
          </div>
        );
      }

      return (
        <div class="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3">
          <div class="text-sm font-medium text-color">Agent 请求执行：{label}</div>
          <pre class="mt-2 max-h-40 overflow-auto rounded bg-surface-0 p-2 text-xs text-muted-color">
            {preview}
          </pre>
          <div class="mt-3 flex gap-2">
            <Button
              label="确认"
              size="small"
              onClick={() => void ctx.confirmToolCall(tool.toolCallId, true)}
            />
            <Button
              label="拒绝"
              size="small"
              severity="secondary"
              onClick={() => void ctx.confirmToolCall(tool.toolCallId, false)}
            />
          </div>
        </div>
      );
    };
  },
});
