export type ChatFindRange = {
  start: number;
  end: number;
};

export function normalizedChatFindQuery(query: string) {
  return query.trim();
}

export function findChatTextRanges(text: string, query: string): ChatFindRange[] {
  const needle = normalizedChatFindQuery(query);
  if (!needle) return [];

  const haystack = text.toLocaleLowerCase();
  const normalizedNeedle = needle.toLocaleLowerCase();
  const ranges: ChatFindRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = haystack.indexOf(normalizedNeedle, cursor);
    if (start === -1) break;
    const end = start + normalizedNeedle.length;
    ranges.push({ start, end });
    cursor = end;
  }

  return ranges;
}
