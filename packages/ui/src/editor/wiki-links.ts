import { escape } from "lodash-es";

export type UnderstandingWikiLink = {
  title: string;
  id: string;
};

const understandingWikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;
const escapedUnderstandingWikiLinkPattern = /\\\[\\\[([^\]\n]+)]]/g;

export function formatUnderstandingWikiLink(link: UnderstandingWikiLink): string {
  const id = link.id.trim();
  const title = link.title.trim() || id;
  return `[[${title}#${id}]]`;
}

export function parseUnderstandingWikiLink(raw: string): UnderstandingWikiLink | null {
  const match = /^\[\[([^\]\n]+)\]\]$/.exec(raw.trim());
  if (!match) return null;

  const content = unescapeMarkdownText(match[1]?.trim() ?? "");
  const separatorIndex = content.lastIndexOf("#");
  if (separatorIndex <= 0 || separatorIndex === content.length - 1) return null;

  const title = content.slice(0, separatorIndex).trim();
  const id = content.slice(separatorIndex + 1).trim();
  if (!title || !id) return null;

  return { title, id };
}

function unescapeMarkdownText(value: string): string {
  return value.replaceAll(/\\([\\[\]_`*#])/g, "$1");
}

export function renderUnderstandingWikiLinksAsHtml(content: string): string {
  return content.replaceAll(understandingWikiLinkPattern, (match) => {
    const parsed = parseUnderstandingWikiLink(match);
    if (!parsed) return match;
    return `<a href="#" data-wiki-link="${escape(parsed.id)}" class="wiki-link">${escape(parsed.title)}</a>`;
  });
}

export function normalizeUnderstandingWikiLinkBody(body: string): string {
  const unescapedBody = body.replaceAll(
    escapedUnderstandingWikiLinkPattern,
    (_match, rawContent) => {
      const content = unescapeMarkdownText(String(rawContent).trim());
      return `[[${content}]]`;
    },
  );

  return unescapedBody.replaceAll(understandingWikiLinkPattern, (match) => {
    const parsed = parseUnderstandingWikiLink(match);
    return parsed ? formatUnderstandingWikiLink(parsed) : match;
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
    if (offset < start || offset > end) continue;

    const parsed = parseUnderstandingWikiLink(match[0]);
    if (parsed) return parsed;
  }

  return null;
}
