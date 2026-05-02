export type ThoughtWikiLink = {
  title: string;
  id: string;
};

const thoughtWikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;
const legacyMarkdownWikiLinkPattern = /\[([^\]\n]*)\]\(\/wiki\/([^)]+)\)/g;
const legacyAliasWikiLinkPattern = /\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g;

export function formatThoughtWikiLink(link: ThoughtWikiLink): string {
  const id = link.id.trim();
  const title = link.title.trim() || id;
  return `[[${title}#${id}]]`;
}

export function parseThoughtWikiLink(raw: string): ThoughtWikiLink | null {
  const match = /^\[\[([^\]\n]+)\]\]$/.exec(raw.trim());
  if (!match) return null;

  const content = match[1]?.trim() ?? "";
  const separatorIndex = content.lastIndexOf("#");
  if (separatorIndex <= 0 || separatorIndex === content.length - 1) return null;

  const title = content.slice(0, separatorIndex).trim();
  const id = content.slice(separatorIndex + 1).trim();
  if (!title || !id) return null;

  return { title, id };
}

export function renderThoughtWikiLinksAsMarkdown(content: string): string {
  return content.replaceAll(thoughtWikiLinkPattern, (match) => {
    const parsed = parseThoughtWikiLink(match);
    return parsed ? `[${parsed.title}](/wiki/${parsed.id})` : match;
  });
}

export function normalizeThoughtWikiLinkBody(body: string): string {
  const normalizedLegacyMarkdown = body.replaceAll(
    legacyMarkdownWikiLinkPattern,
    (match, rawLabel: string, rawId: string) => {
      const id = rawId.trim();
      const title = rawLabel.trim() || id;
      return id ? formatThoughtWikiLink({ title, id }) : match;
    },
  );

  const normalizedLegacyAliases = normalizedLegacyMarkdown.replaceAll(
    legacyAliasWikiLinkPattern,
    (match, rawTarget: string, rawLabel: string) => {
      const id = rawTarget.trim();
      const title = rawLabel.trim() || id;
      return id ? formatThoughtWikiLink({ title, id }) : match;
    },
  );

  return normalizedLegacyAliases.replaceAll(thoughtWikiLinkPattern, (match) => {
    const parsed = parseThoughtWikiLink(match);
    return parsed ? formatThoughtWikiLink(parsed) : match;
  });
}

export function findThoughtWikiLinkAtOffset(text: string, offset: number): ThoughtWikiLink | null {
  for (const match of text.matchAll(thoughtWikiLinkPattern)) {
    const start = match.index ?? -1;
    if (start === -1) continue;

    const end = start + match[0].length;
    if (offset < start || offset > end) continue;

    const parsed = parseThoughtWikiLink(match[0]);
    if (parsed) return parsed;
  }

  return null;
}
