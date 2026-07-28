export function normalizeMarkdown(markdown: string): string {
  return markdown.replaceAll(/\\\[\\\[([^\]\n]+)]]/g, "[[$1]]").replace(/\n+$/g, "");
}

export function markdownEquals(left: string, right: string): boolean {
  return normalizeMarkdown(left) === normalizeMarkdown(right);
}
