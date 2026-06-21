import type { AgentContextRef } from "@shared/chat";

const WIKI_LINK_PATTERN = /\[\[([^#\]\n]+)#([^\]\n]+)\]\]/g;
export const WIKI_LINK_HREF_PREFIX = "#reflecta-wiki/thought/";

export type InspectableContextRef = AgentContextRef & { type: "thought" | "context" };

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
  if (type === "thought") return "Thought";
  if (type === "context") return "Context";
  return "Category";
}

export function parseContextKey(value: unknown): AgentContextRef | null {
  if (typeof value !== "string") return null;
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 1) return null;
  const type = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((type !== "thought" && type !== "context" && type !== "category") || !id) return null;
  return { type, id };
}

export function contextTypeFromKey(value: unknown): AgentContextRef["type"] | null {
  return parseContextKey(value)?.type ?? null;
}

export function inspectableContextRef(ref: AgentContextRef): InspectableContextRef | null {
  if (ref.type === "thought") return { ...ref, type: "thought" };
  if (ref.type === "context") return { ...ref, type: "context" };
  return null;
}

export function contextMentionClass(type: AgentContextRef["type"] | null) {
  const base =
    "mx-0.5 inline text-[1em] font-medium leading-[inherit] no-underline decoration-transparent";
  if (type === "context") return `${base} text-emerald-700 dark:text-emerald-300`;
  if (type === "category") return `${base} text-violet-700 dark:text-violet-300`;
  return `${base} text-sky-700 dark:text-sky-300`;
}

export function messageContextMentionClass(type: AgentContextRef["type"] | null) {
  return contextMentionClass(type);
}

export function contextMentionIcon(type: AgentContextRef["type"] | null) {
  if (type === "context") return "↳";
  if (type === "category") return "#";
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

export function wikiHref(title: string, id: string) {
  return `${WIKI_LINK_HREF_PREFIX}${encodeURIComponent(id)}?title=${encodeURIComponent(title)}`;
}

export function wikiMarkdownToLinks(markdown: string) {
  return markdown.replace(WIKI_LINK_PATTERN, (_match, title: string, id: string) => {
    return `[${title}](${wikiHref(title, id)})`;
  });
}

export function parseWikiHref(href: string | undefined): InspectableContextRef | null {
  if (!href?.startsWith(WIKI_LINK_HREF_PREFIX)) return null;
  try {
    const paramsIndex = href.indexOf("?");
    const encodedId = href.slice(
      WIKI_LINK_HREF_PREFIX.length,
      paramsIndex === -1 ? href.length : paramsIndex,
    );
    const params = new URLSearchParams(paramsIndex === -1 ? "" : href.slice(paramsIndex + 1));
    const id = decodeURIComponent(encodedId);
    const title = params.get("title") ?? undefined;
    if (!id) return null;
    return { type: "thought", id, title };
  } catch {
    return null;
  }
}
