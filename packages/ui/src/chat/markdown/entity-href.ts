import type { ChatEntityReference, ChatEntityType } from "../entity";

const ENTITY_HREF_PREFIX = "#reflecta-entity/";
const WIKI_HREF_PREFIX = "#reflecta-wiki/";

function parseHref(href: string | undefined, prefix: string): ChatEntityReference | null {
  if (!href?.startsWith(prefix)) return null;
  try {
    const paramsIndex = href.indexOf("?");
    const path = href.slice(prefix.length, paramsIndex === -1 ? href.length : paramsIndex);
    const slashIndex = path.indexOf("/");
    if (slashIndex < 1) return null;
    const type = path.slice(0, slashIndex) as ChatEntityType;
    if (type !== "understanding" && type !== "context" && type !== "domain") return null;
    const id = decodeURIComponent(path.slice(slashIndex + 1));
    if (!id) return null;
    const params = new URLSearchParams(paramsIndex === -1 ? "" : href.slice(paramsIndex + 1));
    return { type, id, labelHint: params.get("title") ?? undefined };
  } catch {
    return null;
  }
}

export function entityHref(reference: ChatEntityReference) {
  return `${ENTITY_HREF_PREFIX}${reference.type}/${encodeURIComponent(reference.id)}`;
}

export function parseEntityHref(href: string | undefined) {
  return parseHref(href, ENTITY_HREF_PREFIX) ?? parseHref(href, WIKI_HREF_PREFIX);
}

export function isEntityHref(url: string) {
  return url.startsWith(ENTITY_HREF_PREFIX) || url.startsWith(WIKI_HREF_PREFIX);
}
