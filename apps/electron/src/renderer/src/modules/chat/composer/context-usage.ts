import agentSystemPrompt from "../../../../../main/services/agent/agent-system-prompt.md?raw";
import type { AgentContextRef, AgentModelSelection, AgentReducedMessage } from "@shared/agent";
import { selectedAgentContextBlockFromRefs } from "@shared/agent-context";

const MAX_MODEL_HISTORY_MESSAGES = 24;

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  o3: 200_000,
  "o4-mini": 200_000,
  "gpt-5.3-codex-spark": 128_000,
  "gpt-5.5": 272_000,
  "gpt-5.4": 272_000,
  "gpt-5.4-mini": 272_000,
  "deepseek-chat": 1_000_000,
  "deepseek-reasoner": 1_000_000,
  "deepseek-v4-flash": 1_000_000,
  "deepseek-v4-pro": 1_000_000,
  "gemini-2.5-pro": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-2.0-flash": 1_000_000,
  "grok-4": 256_000,
  "grok-3": 131_072,
  "grok-3-mini": 131_072,
  "kimi-k2-0711-preview": 131_072,
  "kimi-k2.5": 256_000,
  "kimi-k2.6": 256_000,
  "kimi-k2.7": 256_000,
  "moonshot-v1-8k": 8_192,
  "moonshot-v1-32k": 32_768,
  "moonshot-v1-128k": 131_072,
  "qwen-plus": 1_000_000,
  "qwen-max": 262_144,
  "qwen-turbo": 1_000_000,
  "glm-5": 131_072,
  "glm-5.1": 131_072,
  "glm-5.2": 131_072,
  "glm-z1-air": 131_072,
  "glm-4-plus": 131_072,
  "glm-4-flash": 131_072,
  "minimax-m2.5": 1_000_000,
  "minimax-m2.7": 1_000_000,
  "mimo-v2.5": 1_000_000,
  "mimo-v2.5-pro": 1_000_000,
};

export type ContextUsage = {
  tokens?: number;
  contextWindow?: number;
  selectedContextCount: number;
};

export type ContextUsageRequest = {
  input: string;
  contextWindow?: number;
  selectedContextCount: number;
};

export type ContextUsageWorkerRequest = ContextUsageRequest & { id: number };

export type ContextUsageWorkerResponse = {
  id: number;
  usage: ContextUsage;
};

function usageMessageText(message: AgentReducedMessage) {
  const text =
    message.role === "user"
      ? [message.text, ...(message.contextRefs ?? []).map((ref) => ref.title ?? ref.id)]
          .filter(Boolean)
          .join(" ")
      : (message.blocks ?? [])
          .map((block) => {
            if (block.kind === "text" || block.kind === "reasoning") return block.text;
            if (block.kind === "tool") {
              return JSON.stringify({
                type: block.toolName,
                input: block.input,
                output: block.output,
                errorText: block.error,
              });
            }
            return JSON.stringify({
              type: block.toolName,
              input: block.payload,
              output: block.output,
              errorText: block.error,
            });
          })
          .filter(Boolean)
          .join("\n");
  return `${message.role}:\n${text}`;
}

function nextMessages({
  messages,
  draft,
  selectedContexts,
  editingMessageId,
}: {
  messages: AgentReducedMessage[];
  draft: string;
  selectedContexts: AgentContextRef[];
  editingMessageId?: string;
}) {
  const text = draft.trim();
  if (!text) return messages;
  const nextMessage: AgentReducedMessage = {
    id: editingMessageId ?? "draft",
    role: "user",
    text,
    createdAt: new Date(0).toISOString(),
    contextRefs: selectedContexts,
  };
  if (!editingMessageId) return [...messages, nextMessage];
  return messages.map((message) => (message.id === editingMessageId ? nextMessage : message));
}

export function contextWindowForModel(selection: AgentModelSelection | null | undefined) {
  if (!selection) return undefined;
  return (
    MODEL_CONTEXT_WINDOWS[`${selection.providerId}:${selection.modelId}`] ??
    MODEL_CONTEXT_WINDOWS[selection.modelId]
  );
}

export function buildContextUsageRequest({
  messages,
  draft,
  selectedContexts,
  modelSelection,
  editingMessageId,
}: {
  messages: AgentReducedMessage[];
  draft: string;
  selectedContexts: AgentContextRef[];
  modelSelection: AgentModelSelection | null | undefined;
  editingMessageId?: string;
}): ContextUsageRequest {
  const effectiveMessages = nextMessages({
    messages,
    draft,
    selectedContexts,
    editingMessageId,
  }).slice(-MAX_MODEL_HISTORY_MESSAGES);
  const input = [
    agentSystemPrompt,
    selectedAgentContextBlockFromRefs(selectedContexts),
    ...effectiveMessages.map(usageMessageText),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    input,
    contextWindow: contextWindowForModel(modelSelection),
    selectedContextCount: selectedContexts.length,
  };
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
  if (usage.tokens === undefined || !usage.contextWindow) return undefined;
  return (usage.tokens / usage.contextWindow) * 100;
}

export function contextUsageMeterLabel(usage: ContextUsage) {
  const percent = contextUsagePercent(usage);
  if (percent !== undefined) return percentLabel(percent);
  if (usage.tokens !== undefined) return compactNumber(usage.tokens);
  return "--";
}

export function contextUsageLabel(usage: ContextUsage) {
  if (usage.tokens === undefined) {
    if (!usage.contextWindow) return "正在估算上下文";
    return `-- / ${compactNumber(usage.contextWindow)} 已使用上下文`;
  }
  const used = compactNumber(usage.tokens);
  if (!usage.contextWindow) return `${used} tokens 已使用上下文`;
  return `${contextUsageMeterLabel(usage)} · ${used} / ${compactNumber(
    usage.contextWindow,
  )} 已使用上下文`;
}
