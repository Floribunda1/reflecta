import type { AgentCitationSource, AgentContextRef } from "@shared/agent";

const WIKI_LINK_PATTERN = /\[\[([^:#\]\n]+)#([^\]\n]+)\]\]/g;
export const WIKI_LINK_HREF_PREFIX = "#reflecta-wiki/";

export type InspectableContextRef = AgentContextRef & { type: "understanding" | "context" };

export type MentionAttrs = {
  id: string;
  label: string;
};

export function contextKey(ref: AgentContextRef) {
  return `${ref.type}:${ref.id}`;
}

export function contextTitle(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

export function contextTypeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}

export function parseContextKey(value: unknown): AgentContextRef | null {
  if (typeof value !== "string") return null;
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 1) return null;
  const type = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((type !== "understanding" && type !== "context" && type !== "domain") || !id) return null;
  return { type, id };
}

export function contextTypeFromKey(value: unknown): AgentContextRef["type"] | null {
  return parseContextKey(value)?.type ?? null;
}

export function inspectableContextRef(ref: AgentContextRef): InspectableContextRef | null {
  if (ref.type === "understanding") return { ...ref, type: "understanding" };
  if (ref.type === "context") return { ...ref, type: "context" };
  return null;
}

export function contextMentionClass(type: AgentContextRef["type"] | null) {
  const base =
    "mx-0.5 inline text-[1em] font-medium leading-[inherit] no-underline decoration-transparent";
  if (type === "context") return `${base} text-emerald-700 dark:text-emerald-300`;
  if (type === "domain") return `${base} text-violet-700 dark:text-violet-300`;
  return `${base} text-sky-700 dark:text-sky-300`;
}

export function messageContextMentionClass(type: AgentContextRef["type"] | null) {
  return contextMentionClass(type);
}

export function contextMentionIcon(type: AgentContextRef["type"] | null) {
  if (type === "context") return "↳";
  if (type === "domain") return "#";
  return "✦";
}

export function mentionId(ref: AgentContextRef) {
  return contextKey(ref);
}

export function contextRefFromMention(value: unknown, title: unknown): AgentContextRef | null {
  const ref = parseContextKey(value);
  if (!ref) return null;
  return { ...ref, title: typeof title === "string" ? title : undefined };
}

export function contextRefFromMentionNode(node: {
  type?: string;
  attrs?: Record<string, unknown>;
}): AgentContextRef | null {
  if (node.type !== "mention") return null;
  return contextRefFromMention(node.attrs?.id, node.attrs?.label);
}

export function wikiHref(
  title: string | undefined,
  id: string,
  type: AgentContextRef["type"] = "understanding",
) {
  const href = `${WIKI_LINK_HREF_PREFIX}${type}/${encodeURIComponent(id)}`;
  return title ? `${href}?title=${encodeURIComponent(title)}` : href;
}

export function wikiMarkdownToLinks(markdown: string) {
  return markdown.replace(WIKI_LINK_PATTERN, (_match, title: string, id: string) => {
    return `[${title}](${wikiHref(title, id)})`;
  });
}

function markdownLinkLabel(label: string) {
  return label.replace(/([\\[\]])/g, "\\$1");
}

function citationMarkdownToLinks(markdown: string, citationSources: AgentCitationSource[] = []) {
  if (citationSources.length === 0) return markdown;
  const byIndex = new Map(citationSources.map((source) => [source.index, source]));
  return markdown.replace(/\[(\d+)\]/g, (match, rawIndex: string, offset: number) => {
    const previous = offset > 0 ? markdown[offset - 1] : "";
    const next = markdown[offset + match.length] ?? "";
    if (previous === "!" || next === "(") return match;
    const source = byIndex.get(Number(rawIndex));
    if (!source) return match;
    const title = source.entity.title?.trim() || source.entity.id;
    return `[${markdownLinkLabel(match)}](${wikiHref(title, source.entity.id, source.entity.type)})`;
  });
}

export function referenceMarkdownToLinks(
  markdown: string,
  citationSources: AgentCitationSource[] = [],
) {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part) =>
      part.startsWith("`")
        ? part
        : citationMarkdownToLinks(wikiMarkdownToLinks(part), citationSources),
    )
    .join("");
}

export function parseWikiHref(href: string | undefined): AgentContextRef | null {
  if (!href?.startsWith(WIKI_LINK_HREF_PREFIX)) return null;
  try {
    const paramsIndex = href.indexOf("?");
    const path = href.slice(
      WIKI_LINK_HREF_PREFIX.length,
      paramsIndex === -1 ? href.length : paramsIndex,
    );
    const slashIndex = path.indexOf("/");
    if (slashIndex < 1) return null;
    const type = path.slice(0, slashIndex);
    const encodedId = path.slice(slashIndex + 1);
    if (type !== "understanding" && type !== "context" && type !== "domain") return null;
    const params = new URLSearchParams(paramsIndex === -1 ? "" : href.slice(paramsIndex + 1));
    const id = decodeURIComponent(encodedId);
    const title = params.get("title") ?? undefined;
    if (!id) return null;
    return { type, id, title };
  } catch {
    return null;
  }
}
