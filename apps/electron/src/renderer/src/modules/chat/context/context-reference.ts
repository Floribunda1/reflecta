import type { AgentContextRef } from "@shared/agent";

const TYPED_WIKI_LINK_PATTERN = /\[\[(understanding|context|domain):([^#\]\n]+)#([^\]\n]+)\]\]/g;
const WIKI_LINK_PATTERN = /\[\[([^:#\]\n]+)#([^\]\n]+)\]\]/g;
const REF_MARKER_PATTERN = /\[\[ref:([A-Za-z0-9_-]+)\]\]/g;
export const WIKI_LINK_HREF_PREFIX = "#reflecta-wiki/";
export const REF_LINK_HREF_PREFIX = "#reflecta-ref/";

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
  title: string,
  id: string,
  type: AgentContextRef["type"] = "understanding",
) {
  return `${WIKI_LINK_HREF_PREFIX}${type}/${encodeURIComponent(id)}?title=${encodeURIComponent(title)}`;
}

export function wikiMarkdownToLinks(markdown: string) {
  return markdown
    .replace(
      TYPED_WIKI_LINK_PATTERN,
      (_match, type: AgentContextRef["type"], title: string, id: string) =>
        `[${title}](${wikiHref(title, id, type)})`,
    )
    .replace(WIKI_LINK_PATTERN, (_match, title: string, id: string) => {
      return `[${title}](${wikiHref(title, id)})`;
    });
}

export function refHref(sourceId: string) {
  return `${REF_LINK_HREF_PREFIX}${encodeURIComponent(sourceId)}`;
}

export function referenceMarkdownToLinks(markdown: string) {
  return wikiMarkdownToLinks(markdown).replace(REF_MARKER_PATTERN, (_match, sourceId: string) => {
    return `[ref:${sourceId}](${refHref(sourceId)})`;
  });
}

export function parseRefHref(href: string | undefined): string | null {
  if (!href?.startsWith(REF_LINK_HREF_PREFIX)) return null;
  try {
    const sourceId = decodeURIComponent(href.slice(REF_LINK_HREF_PREFIX.length));
    return sourceId || null;
  } catch {
    return null;
  }
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
