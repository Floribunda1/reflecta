import type { ComponentProps, ReactNode } from "react";
import { useEntityDisplay } from "../../capture/queries";
import { defaultUrlTransform, type Components, type UrlTransform } from "streamdown";
import type { AgentContextRef, AgentEntityCatalogEntry } from "@shared/agent";
import {
  contextMentionClass,
  contextMentionIcon,
  contextTypeLabel,
  ENTITY_CITATION_HREF_PREFIX,
  inspectableContextRef,
  parseWikiHref,
  parseEntityCitationHref,
  WIKI_LINK_HREF_PREFIX,
  type InspectableContextRef,
} from "./context-reference";

type WikiLabelRenderer = (label: string, href: string | undefined, node: unknown) => ReactNode;

export const wikiUrlTransform: UrlTransform = (url, key, node) => {
  if (url.startsWith(WIKI_LINK_HREF_PREFIX) || url.startsWith(ENTITY_CITATION_HREF_PREFIX)) {
    return url;
  }
  return defaultUrlTransform(url, key, node);
};

export function WikiLinkChip({
  contextRef,
  onInspect,
  children,
}: {
  contextRef: AgentContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
  children?: ReactNode;
}) {
  const inspectableRef = inspectableContextRef(contextRef);
  const label = children ?? contextRef.title?.trim() ?? contextRef.id;
  const content = (
    <>
      {contextMentionIcon(contextRef.type)} {label}
    </>
  );
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

function EntityCitationAnchor({
  contextRef,
  onInspect,
}: {
  contextRef: AgentContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
  const query = useEntityDisplay(contextRef);
  const title = query.data?.title;
  const label = query.isPending
    ? contextTypeLabel(contextRef.type)
    : query.isError
      ? "引用加载失败"
      : query.data === null
        ? "引用不可用"
        : title || `未命名 ${contextTypeLabel(contextRef.type)}`;
  const enabledRef =
    query.data && !query.isError ? { ...contextRef, title: title ?? undefined } : null;

  return (
    <WikiLinkChip
      contextRef={enabledRef ?? contextRef}
      onInspect={enabledRef ? onInspect : undefined}
    >
      {label}
    </WikiLinkChip>
  );
}

function WikiAnchor({
  href,
  children,
  onInspect,
  renderWikiLabel,
  node: _node,
  ...props
}: ComponentProps<"a"> & {
  onInspect?: (ref: InspectableContextRef) => void;
  renderWikiLabel?: WikiLabelRenderer;
  node?: unknown;
}) {
  const entityRef = parseEntityCitationHref(href);
  if (entityRef) return <EntityCitationAnchor contextRef={entityRef} onInspect={onInspect} />;
  const contextRef = parseWikiHref(href);
  if (contextRef) {
    const label = renderWikiLabel
      ? renderWikiLabel(contextRef.title?.trim() || contextRef.id, href, _node)
      : children;
    return (
      <WikiLinkChip contextRef={contextRef} onInspect={onInspect}>
        {label}
      </WikiLinkChip>
    );
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function wikiMarkdownComponents(
  onInspect?: (ref: InspectableContextRef) => void,
  _entityCatalog: AgentEntityCatalogEntry[] = [],
  renderWikiLabel?: WikiLabelRenderer,
): Components {
  return {
    a: (props) => <WikiAnchor {...props} onInspect={onInspect} renderWikiLabel={renderWikiLabel} />,
  };
}
