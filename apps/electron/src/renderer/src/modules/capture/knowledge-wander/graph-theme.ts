export type KnowledgeGraphTheme = {
  foreground: string;
  mutedForeground: string;
};

function readToken(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function readKnowledgeGraphTheme(): KnowledgeGraphTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    foreground: readToken(styles, "--foreground"),
    mutedForeground: readToken(styles, "--muted-foreground"),
  };
}
