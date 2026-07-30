import { isToolCallEventType, type InlineExtension } from "@earendil-works/pi-coding-agent";

type DangerousBashRule = {
  label: string;
  pattern: RegExp;
};

const DANGEROUS_BASH_RULES: DangerousBashRule[] = [
  {
    label: "递归删除",
    pattern: /\brm\b[^\n;&|]*(?:\s-[^\s]*r[^\s]*|\s--recursive)\b/iu,
  },
  { label: "提权执行", pattern: /\bsudo\b/iu },
  { label: "开放全局写权限", pattern: /\b(?:chmod|chown)\b[^\n]*\b777\b/iu },
  { label: "写入原始设备", pattern: />\s*\/dev\/[sh]d[a-z]\b/iu },
  {
    label: "强制推送",
    pattern: /\bgit\s+push\b[^\n]*(?:\s-f\b|--force(?:-with-lease)?\b)/iu,
  },
  { label: "丢弃 Git 修改", pattern: /\bgit\s+reset\s+--hard\b/iu },
  { label: "清理未跟踪文件", pattern: /\bgit\s+clean\s+-[^\s]*f/iu },
  { label: "丢弃工作区修改", pattern: /\bgit\s+checkout\s+\.\s*(?:$|[;&|])/iu },
  { label: "恢复并覆盖文件", pattern: /\bgit\s+restore\b/iu },
  {
    label: "下载后直接执行",
    pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b/iu,
  },
  {
    label: "修改 GitHub 仓库",
    pattern: /\bgh\s+repo\s+(?:create|delete|rename|archive)\b/iu,
  },
  {
    label: "修改 GitHub Release",
    pattern: /\bgh\s+release\s+(?:create|delete|edit)\b/iu,
  },
];

export type DangerousBashApprovalRequest = {
  toolCallId: string;
  command: string;
  matchedRules: string[];
};

export type DangerousBashApprovalDecision =
  | { approved: true }
  | { approved: false; reason?: string };

export type DangerousBashApprovalHandler = (
  request: DangerousBashApprovalRequest,
) => Promise<DangerousBashApprovalDecision>;

export function dangerousBashRuleLabels(command: string): string[] {
  return DANGEROUS_BASH_RULES.filter((rule) => rule.pattern.test(command)).map(
    (rule) => rule.label,
  );
}

export function createPiBashPermissionGate(
  onApproval: DangerousBashApprovalHandler,
): InlineExtension {
  return {
    name: "reflecta-bash-permission-gate",
    factory: (pi) => {
      pi.on("tool_call", async (event) => {
        if (!isToolCallEventType("bash", event)) return undefined;
        const command = event.input.command;
        const matchedRules = dangerousBashRuleLabels(command);
        if (matchedRules.length === 0) return undefined;
        const decision = await onApproval({
          toolCallId: event.toolCallId,
          command,
          matchedRules,
        });
        return decision.approved
          ? undefined
          : {
              block: true,
              reason: decision.reason
                ? `用户拒绝执行危险 Bash 命令（${matchedRules.join("、")}）。原因：${decision.reason}`
                : `用户拒绝执行危险 Bash 命令（${matchedRules.join("、")}）。`,
            };
      });
    },
  };
}
