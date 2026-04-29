export function normalizeFtsQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return query;
  }

  return tokens.map((t) => `${t}*`).join(" AND ");
}
