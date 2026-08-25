import { escape } from "lodash-es";
import { understandingWikiLinkPattern, type UnderstandingWikiLink } from "@reflecta/shared";

export type { UnderstandingWikiLink } from "@reflecta/shared";
export {
  formatUnderstandingWikiLink,
  parseUnderstandingWikiLink,
  normalizeUnderstandingWikiLinkBody,
} from "@reflecta/shared";

export function renderUnderstandingWikiLinksAsHtml(content: string): string {
  return content.replaceAll(understandingWikiLinkPattern, (_match, id: string) => {
    return `<a href="#" data-wiki-link="${escape(id)}" data-entity-type="understanding" class="wiki-link">✦ ${escape(id)}</a>`;
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
