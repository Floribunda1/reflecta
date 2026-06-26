import type { ComponentProps } from "react";
import { defaultUrlTransform, type Components, type UrlTransform } from "streamdown";
import type { AgentContextRef, AgentEntitySource } from "@shared/agent";
import {
  contextMentionClass,
  contextMentionIcon,
  inspectableContextRef,
  parseRefHref,
  parseWikiHref,
  REF_LINK_HREF_PREFIX,
  WIKI_LINK_HREF_PREFIX,
  type InspectableContextRef,
} from "./context-reference";

export const wikiUrlTransform: UrlTransform = (url, key, node) => {
  if (url.startsWith(REF_LINK_HREF_PREFIX)) return url;
  if (url.startsWith(WIKI_LINK_HREF_PREFIX)) return url;
  return defaultUrlTransform(url, key, node);
};

export function WikiLinkChip({
  contextRef,
  onInspect,
}: {
  contextRef: AgentContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const inspectableRef = inspectableContextRef(contextRef);
  const content = `${contextMentionIcon(contextRef.type)} ${contextRef.title?.trim() || contextRef.id}`;
  const className = `${contextMentionClass(contextRef.type)} m-0 appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50`;

  if (!inspectableRef || !onInspect) {
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
      onClick={() => onInspect(inspectableRef)}
    >
      {content}
    </button>
  );
}

function WikiAnchor({
  href,
  children,
  onInspect,
  entitySources = [],
  node: _node,
  ...props
}: ComponentProps<"a"> & {
  onInspect?: (ref: InspectableContextRef) => void;
  entitySources?: AgentEntitySource[];
  node?: unknown;
}) {
  const sourceId = parseRefHref(href);
  if (sourceId) {
    const source = entitySources.find((item) => item.sourceId === sourceId);
    if (!source) return <span>{`[[ref:${sourceId}]]`}</span>;
    return <WikiLinkChip contextRef={source.entity} onInspect={onInspect} />;
  }

  const contextRef = parseWikiHref(href);
  if (contextRef) return <WikiLinkChip contextRef={contextRef} onInspect={onInspect} />;
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function wikiMarkdownComponents(
  onInspect?: (ref: InspectableContextRef) => void,
  entitySources: AgentEntitySource[] = [],
): Components {
  return {
    a: (props) => <WikiAnchor {...props} onInspect={onInspect} entitySources={entitySources} />,
  };
}
