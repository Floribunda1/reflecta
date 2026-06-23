export type UnderstandingWikiLink = {
  title: string;
  id: string;
};

const understandingWikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;
const escapedUnderstandingWikiLinkPattern = /\\\[\\\[([^\]\n]+)]]/g;

function unescapeMarkdownText(value: string): string {
  return value.replaceAll(/\\([\\[\]_`*#])/g, "$1");
}

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

export function normalizeUnderstandingWikiLinkBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;

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

export function extractUnderstandingWikiLinkTargets(body: string): string[] {
  const targets = new Set<string>();
  for (const match of body.matchAll(understandingWikiLinkPattern)) {
    const raw = unescapeMarkdownText(match[1]?.trim() ?? "");
    if (!raw) continue;

    const parsed = parseUnderstandingWikiLink(match[0]);
    targets.add(parsed?.id ?? raw);
  }
  return [...targets];
}
