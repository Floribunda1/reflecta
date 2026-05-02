const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

export function normalizeThoughtBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;

  return body.replaceAll(wikiLinkPattern, (match, rawContent: string) => {
    const content = rawContent.trim();
    if (!content) return match;

    const separatorIndex = content.indexOf("|");
    const target = (separatorIndex === -1 ? content : content.slice(0, separatorIndex)).trim();
    const label = (separatorIndex === -1 ? content : content.slice(separatorIndex + 1)).trim();

    if (!target || !label) return match;
    return `[${label}](/wiki/${target})`;
  });
}
