import { createContext, Fragment, type ReactNode, useContext } from "react";

export type ChatTextRange = {
  start: number;
  end: number;
};

type ChatSearchRenderState = {
  messageId: string;
  query: string;
  nextMatchIndex: number;
};

const ChatSearchContext = createContext<ChatSearchRenderState | undefined>(undefined);

function normalizedQuery(query: string) {
  return query.trim();
}

export function findChatTextRanges(text: string, query: string): ChatTextRange[] {
  const needle = normalizedQuery(query);
  if (!needle) return [];

  const haystack = text.toLocaleLowerCase();
  const normalizedNeedle = needle.toLocaleLowerCase();
  const ranges: ChatTextRange[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = haystack.indexOf(normalizedNeedle, cursor);
    if (start === -1) break;
    const end = start + normalizedNeedle.length;
    ranges.push({ start, end });
    cursor = end;
  }
  return ranges;
}

function markProps(state: ChatSearchRenderState, matchIndex: number) {
  return {
    "data-chat-find-match": "true",
    "data-chat-find-message-id": state.messageId,
    "data-chat-find-match-index": String(matchIndex),
  };
}

export function renderTextWithChatSearchHighlights(
  text: string,
  state: ChatSearchRenderState | undefined,
  keyPrefix: string,
  matchIndexStart?: number,
): ReactNode {
  if (!state || !normalizedQuery(state.query)) return text;
  const ranges = findChatTextRanges(text, state.query);
  if (!ranges.length) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let nextMatchIndex = matchIndexStart ?? state.nextMatchIndex;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    const matchIndex = nextMatchIndex;
    nextMatchIndex += 1;
    parts.push(
      <mark key={`${keyPrefix}-${index}`} {...markProps(state, matchIndex)}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (matchIndexStart === undefined) state.nextMatchIndex = nextMatchIndex;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <Fragment key={keyPrefix}>{parts}</Fragment>;
}

export function ChatSearchProvider({
  messageId,
  query,
  children,
}: {
  messageId: string;
  query?: string;
  children: ReactNode;
}) {
  const state = query?.trim() ? { messageId, query, nextMatchIndex: 0 } : undefined;
  return <ChatSearchContext value={state}>{children}</ChatSearchContext>;
}

export function useChatSearchState() {
  return useContext(ChatSearchContext);
}
