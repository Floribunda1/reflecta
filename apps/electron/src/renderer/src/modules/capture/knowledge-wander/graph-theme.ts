export type KnowledgeGraphTheme = {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  primary: string;
};

function readToken(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function readKnowledgeGraphTheme(): KnowledgeGraphTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: readToken(styles, "--background"),
    card: readToken(styles, "--card"),
    foreground: readToken(styles, "--foreground"),
    mutedForeground: readToken(styles, "--muted-foreground"),
    border: readToken(styles, "--border"),
    primary: readToken(styles, "--primary"),
  };
}
