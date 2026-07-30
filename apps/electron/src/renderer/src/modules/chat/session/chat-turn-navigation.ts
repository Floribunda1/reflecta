import type { AgentReducedMessage } from "@shared/agent";

/**
 * A chat turn starts with a user message and owns everything until the next
 * user message. The initiating message ID is also the stable turn ID.
 */
export type ChatTurnNavigationItem = {
  turnId: string;
  label: string;
};

function normalizedSnippet(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function fallbackTurnLabel(message: AgentReducedMessage) {
  const fileNames = message.files
    ?.map((file) => file.filename || file.mediaType)
    .filter(Boolean)
    .join("、");
  if (fileNames) return `附件：${fileNames}`;

  const actionBlock = message.blocks?.find(
    (block) => block.kind === "tool" || block.kind === "approval",
  );
  if (!actionBlock) return "用户消息";
  if (actionBlock.kind === "approval") return actionBlock.title;
  return `工具：${actionBlock.toolName}`;
}

export function buildChatTurnNavigationItems(
  messages: readonly AgentReducedMessage[],
): ChatTurnNavigationItem[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => ({
      turnId: message.id,
      label: normalizedSnippet(message.text) || fallbackTurnLabel(message),
    }));
}

const CHAT_READING_LINE_RATIO = 0.75;
const CHAT_READING_LINE_BOTTOM_MARGIN = 96;

export function activeChatTurnIdAtViewport({
  turnAnchors,
  viewportTop,
  viewportHeight,
}: {
  turnAnchors: readonly { turnId: string; top: number }[];
  viewportTop: number;
  viewportHeight: number;
}): string | null {
  const firstTurn = turnAnchors[0];
  if (!firstTurn) return null;

  const readingLine =
    viewportTop +
    Math.max(
      viewportHeight * CHAT_READING_LINE_RATIO,
      viewportHeight - CHAT_READING_LINE_BOTTOM_MARGIN,
    );
  let activeTurnId = firstTurn.turnId;

  for (const turn of turnAnchors) {
    if (turn.top > readingLine) break;
    activeTurnId = turn.turnId;
  }

  return activeTurnId;
}
