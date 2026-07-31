import { escape } from "lodash-es";
import {
  formatChatEntityReference,
  parseChatEntityReference,
} from "../chat/markdown/entity-reference-codec";

export type UnderstandingWikiLink = {
  title?: string;
  id: string;
};

const understandingWikiLinkPattern = /\[\[u:([A-Za-z0-9_-]+)\]\]/g;
const escapedUnderstandingWikiLinkPattern = /\\\[\\\[u:([A-Za-z0-9_-]+)]]/g;

export function formatUnderstandingWikiLink(link: UnderstandingWikiLink): string {
  return formatChatEntityReference({ type: "understanding", id: link.id });
}

export function parseUnderstandingWikiLink(raw: string): UnderstandingWikiLink | null {
  const reference = parseChatEntityReference(raw);
  return reference?.type === "understanding" ? { id: reference.id } : null;
}

export function renderUnderstandingWikiLinksAsHtml(content: string): string {
  return content.replaceAll(understandingWikiLinkPattern, (_match, id: string) => {
    return `<a href="#" data-wiki-link="${escape(id)}" data-entity-type="understanding" class="wiki-link">✦ ${escape(id)}</a>`;
  });
}

export function normalizeUnderstandingWikiLinkBody(body: string): string {
  return body.replaceAll(escapedUnderstandingWikiLinkPattern, (_match, id: string) => {
    return formatUnderstandingWikiLink({ id });
  });
}

export function findUnderstandingWikiLinkAtOffset(
  text: string,
  offset: number,
): UnderstandingWikiLink | null {
  for (const match of text.matchAll(understandingWikiLinkPattern)) {
    const start = match.index ?? -1;
    if (start === -1) continue;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) return { id: match[1] };
  }
  return null;
}
