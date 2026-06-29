import { Fragment, type ReactNode } from "react";
import { parseWikiHref } from "../context/context-reference";
import { findChatTextRanges, normalizedChatFindQuery } from "../session/chat-find";

export type ChatFindRenderState = {
  messageId: string;
  query: string;
  activeMatchIndex?: number;
  nextMatchIndex: number;
};

function markProps(state: ChatFindRenderState, matchIndex: number) {
  const active = state.activeMatchIndex === matchIndex;
  const props: Record<string, unknown> = {
    "data-chat-find-match": "true",
    "data-chat-find-message-id": state.messageId,
    "data-chat-find-match-index": String(matchIndex),
  };
  if (active) props["data-chat-find-active"] = "true";
  return props;
}

export function renderTextWithChatFindHighlights(
  text: string,
  state: ChatFindRenderState | undefined,
  keyPrefix: string,
): ReactNode {
  if (!state || !normalizedChatFindQuery(state.query)) return text;

  const ranges = findChatTextRanges(text, state.query);
  if (ranges.length === 0) return text;

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

type HastNode = {
  type?: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const SKIPPED_HAST_TAGS = new Set(["script", "style"]);
let chatFindPluginId = 0;

export function createChatFindRehypePlugin(state: ChatFindRenderState | undefined) {
  const plugin = () => (tree: HastNode) => {
    if (!state || !normalizedChatFindQuery(state.query)) return;
    transformHastChildren(tree, state);
  };
  Object.defineProperty(plugin, "name", { value: `rehypeChatFind${chatFindPluginId++}` });
  return plugin;
}

function transformHastChildren(parent: HastNode, state: ChatFindRenderState) {
  if (!Array.isArray(parent.children)) return;

  const children: HastNode[] = [];
  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      children.push(...highlightHastText(child.value, state));
      continue;
    }

    if (child.type === "element" && child.tagName === "a" && reserveWikiLinkMatches(child, state)) {
      children.push(child);
      continue;
    }

    if (child.type === "element" && child.tagName && !SKIPPED_HAST_TAGS.has(child.tagName)) {
      transformHastChildren(child, state);
    }
    children.push(child);
  }

  parent.children = children;
}

function reserveWikiLinkMatches(node: HastNode, state: ChatFindRenderState) {
  const href = typeof node.properties?.href === "string" ? node.properties.href : undefined;
  const contextRef = parseWikiHref(href);
  const label = contextRef?.title?.trim();
  if (!label) return false;

  const ranges = findChatTextRanges(label, state.query);
  if (ranges.length === 0) return true;

  state.nextMatchIndex += ranges.length;
  return true;
}

function highlightHastText(text: string, state: ChatFindRenderState): HastNode[] {
  const ranges = findChatTextRanges(text, state.query);
  if (ranges.length === 0) return [{ type: "text", value: text }];

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
