export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replaceAll(/\\\[\\\[([^\]\n]+)]]/g, "[[$1]]")
    .replaceAll(/\[\[([ucd]):((?:[A-Za-z0-9-]|\\?_)+)]]/g, (_match, type, id: string) => {
      return `[[${type}:${id.replaceAll("\\_", "_")}]]`;
    })
    .replace(/\n+$/g, "");
}

export function markdownEquals(left: string, right: string): boolean {
  return normalizeMarkdown(left) === normalizeMarkdown(right);
}
