/**
 * 理解双链（wiki-link）的规范形态与解析（单一真源）。
 * server（正文解析/归一化）与 UI（渲染/编辑）共用同一语法 `[[u:id]]` 与同一套
 * 解析/抽取/归一化逻辑，不再各自实现。
 */

export type UnderstandingWikiLink = {
  title?: string;
  id: string;
};

export type ExtractedUnderstandingWikiLink = {
  rawText: string;
  title: null;
  target: string;
};

export const understandingWikiLinkPattern = /\[\[u:([A-Za-z0-9_-]+)\]\]/g;
const escapedUnderstandingWikiLinkPattern = /\\\[\\\[u:([A-Za-z0-9_-]+)]]/g;

export function formatUnderstandingWikiLink(link: UnderstandingWikiLink): string {
  return `[[u:${link.id.trim()}]]`;
}

export function parseUnderstandingWikiLink(raw: string): UnderstandingWikiLink | null {
  const match = /^\[\[u:([A-Za-z0-9_-]+)\]\]$/.exec(raw.trim());
  return match ? { id: match[1] } : null;
}

export function normalizeUnderstandingWikiLinkBody(body: string | undefined): string | undefined {
  return body?.replaceAll(escapedUnderstandingWikiLinkPattern, (_match, id: string) => {
    return formatUnderstandingWikiLink({ id });
  });
}

export function extractUnderstandingWikiLinkTargets(body: string): string[] {
  return [...new Set(extractUnderstandingWikiLinks(body).map((link) => link.target))];
}

export function extractUnderstandingWikiLinks(body: string): ExtractedUnderstandingWikiLink[] {
  const links = new Map<string, ExtractedUnderstandingWikiLink>();
  for (const match of body.matchAll(understandingWikiLinkPattern)) {
    const rawText = match[0];
    const target = match[1];
    links.set(target, { rawText, title: null, target });
  }
  return [...links.values()];
}
