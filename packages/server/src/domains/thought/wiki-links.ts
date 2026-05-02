export type ThoughtWikiLink = {
  title: string;
  id: string;
};

const thoughtWikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;
const escapedThoughtWikiLinkPattern = /\\\[\\\[([^\]\n]+)]]/g;

function unescapeMarkdownText(value: string): string {
  return value.replaceAll(/\\([\\[\]_`*#])/g, "$1");
}

export function formatThoughtWikiLink(link: ThoughtWikiLink): string {
  const id = link.id.trim();
  const title = link.title.trim() || id;
  return `[[${title}#${id}]]`;
}

export function parseThoughtWikiLink(raw: string): ThoughtWikiLink | null {
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

export function normalizeThoughtWikiLinkBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;

  const unescapedBody = body.replaceAll(escapedThoughtWikiLinkPattern, (_match, rawContent) => {
    const content = unescapeMarkdownText(String(rawContent).trim());
    return `[[${content}]]`;
  });

  return unescapedBody.replaceAll(thoughtWikiLinkPattern, (match) => {
    const parsed = parseThoughtWikiLink(match);
    return parsed ? formatThoughtWikiLink(parsed) : match;
  });
}

export function extractThoughtWikiLinkTargets(body: string): string[] {
  const targets = new Set<string>();
  for (const match of body.matchAll(thoughtWikiLinkPattern)) {
    const parsed = parseThoughtWikiLink(match[0]);
    if (parsed) targets.add(parsed.id);
  }
  return [...targets];
}
