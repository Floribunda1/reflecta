export type ChatFindMarkerMatch = {
  messageId: string;
  matchIndex: number;
};

export function activateChatFindMarker(root: ParentNode | null, match: ChatFindMarkerMatch | null) {
  root
    ?.querySelectorAll<HTMLElement>('[data-chat-find-active="true"]')
    .forEach((element) => element.removeAttribute("data-chat-find-active"));
  if (!root || !match) return null;

  const marker = root.querySelector<HTMLElement>(
    `[data-chat-find-match="true"][data-chat-find-message-id="${CSS.escape(match.messageId)}"][data-chat-find-match-index="${match.matchIndex}"]`,
  );
  marker?.setAttribute("data-chat-find-active", "true");
  return marker ?? null;
}

export function chatFindMarkers(root: ParentNode | null): ChatFindMarkerMatch[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[data-chat-find-match="true"]') ?? [])
    .map((element) => {
      const messageId = element.dataset.chatFindMessageId;
      const matchIndex = Number(element.dataset.chatFindMatchIndex);
      return messageId && Number.isInteger(matchIndex) ? { messageId, matchIndex } : null;
    })
    .filter((match): match is ChatFindMarkerMatch => Boolean(match));
}
