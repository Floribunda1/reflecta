import { createContext, Fragment, type ReactNode, useContext } from "react";
import { parseEntityHref } from "../markdown/entity-href";

export type ChatTextRange = {
  start: number;
  end: number;
};

type ChatSearchRenderState = {
  messageId: string;
  query: string;
  nextMatchIndex: number;
};

type HastNode = {
  type?: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const ChatSearchContext = createContext<ChatSearchRenderState | undefined>(undefined);
const SKIPPED_HAST_TAGS = new Set(["script", "style"]);
let pluginId = 0;

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
): ReactNode {
  if (!state || !normalizedQuery(state.query)) return text;
  const ranges = findChatTextRanges(text, state.query);
  if (!ranges.length) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    const matchIndex = state.nextMatchIndex;
    state.nextMatchIndex += 1;
    parts.push(
      <mark key={`${keyPrefix}-${index}`} {...markProps(state, matchIndex)}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
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

export function createChatSearchRehypePlugin(state: ChatSearchRenderState | undefined) {
  const plugin = () => (tree: HastNode) => {
    if (state && normalizedQuery(state.query)) transformChildren(tree, state);
  };
  Object.defineProperty(plugin, "name", { value: `rehypeChatSearch${pluginId++}` });
  return plugin;
}

function transformChildren(parent: HastNode, state: ChatSearchRenderState) {
  if (!Array.isArray(parent.children)) return;
  const children: HastNode[] = [];
  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      children.push(...highlightTextNode(child.value, state));
      continue;
    }
    if (child.type === "element" && child.tagName === "a" && reserveEntityLabel(child, state)) {
      children.push(child);
      continue;
    }
    if (child.type === "element" && child.tagName && !SKIPPED_HAST_TAGS.has(child.tagName)) {
      transformChildren(child, state);
    }
    children.push(child);
  }
  parent.children = children;
}

function reserveEntityLabel(node: HastNode, state: ChatSearchRenderState) {
  const href = typeof node.properties?.href === "string" ? node.properties.href : undefined;
  const reference = parseEntityHref(href);
  if (!reference) return false;
  const sourceLabel = reference.labelHint;
  if (sourceLabel) state.nextMatchIndex += findChatTextRanges(sourceLabel, state.query).length;
  return true;
}

function highlightTextNode(text: string, state: ChatSearchRenderState): HastNode[] {
  const ranges = findChatTextRanges(text, state.query);
  if (!ranges.length) return [{ type: "text", value: text }];

  const nodes: HastNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) nodes.push({ type: "text", value: text.slice(cursor, range.start) });
    const matchIndex = state.nextMatchIndex;
    state.nextMatchIndex += 1;
    nodes.push({
      type: "element",
      tagName: "mark",
      properties: markProps(state, matchIndex),
      children: [{ type: "text", value: text.slice(range.start, range.end) }],
    });
    cursor = range.end;
  }
  if (cursor < text.length) nodes.push({ type: "text", value: text.slice(cursor) });
  return nodes;
}
