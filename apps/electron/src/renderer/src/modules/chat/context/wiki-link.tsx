import type { ComponentProps } from "react";
import { defaultUrlTransform, type Components, type UrlTransform } from "streamdown";
import {
  contextMentionClass,
  contextMentionIcon,
  parseWikiHref,
  WIKI_LINK_HREF_PREFIX,
  type InspectableContextRef,
} from "./context-reference";

export const wikiUrlTransform: UrlTransform = (url, key, node) => {
  if (url.startsWith(WIKI_LINK_HREF_PREFIX)) return url;
  return defaultUrlTransform(url, key, node);
};

export function WikiLinkChip({
  ref,
  onInspect,
}: {
  ref: InspectableContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const content = `${contextMentionIcon(ref.type)} ${ref.title?.trim() || ref.id}`;
  const className = `${contextMentionClass(ref.type)} m-0 appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50`;

  if (!onInspect) {
    return (
      <span data-slot="wiki-link" className={className}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="wiki-link"
      className={`${className} cursor-pointer`}
      onClick={() => onInspect(ref)}
    >
      {content}
    </button>
  );
}

function WikiAnchor({
  href,
  children,
  onInspect,
  node: _node,
  ...props
}: ComponentProps<"a"> & {
  onInspect?: (ref: InspectableContextRef) => void;
  node?: unknown;
}) {
  const ref = parseWikiHref(href);
  if (ref) return <WikiLinkChip ref={ref} onInspect={onInspect} />;
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function wikiMarkdownComponents(
  onInspect?: (ref: InspectableContextRef) => void,
): Components {
  return {
    a: (props) => <WikiAnchor {...props} onInspect={onInspect} />,
  };
}
