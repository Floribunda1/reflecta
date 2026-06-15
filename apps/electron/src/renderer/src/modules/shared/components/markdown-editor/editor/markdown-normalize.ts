export function normalizeMilkdownMarkdown(markdown: string): string {
  return markdown.replaceAll(/\\\[\\\[([^\]\n]+)]]/g, "[[$1]]").replace(/\n+$/g, "");
}

export function milkdownMarkdownEquals(left: string, right: string): boolean {
  return normalizeMilkdownMarkdown(left) === normalizeMilkdownMarkdown(right);
}
