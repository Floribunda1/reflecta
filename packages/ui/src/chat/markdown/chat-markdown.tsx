import { createMathPlugin } from "@streamdown/math";
import type { ComponentProps, ReactNode } from "react";
import {
  defaultUrlTransform,
  Streamdown,
  type Components,
  type ControlsConfig,
  type DiagramPlugin,
  type UrlTransform,
} from "streamdown";
import { renderMermaid } from "#lib/mermaid";
import type { ChatEntityBindings, ChatEntityPresentation, ChatEntityReference } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
import { entityHref, isEntityHref, parseEntityHref } from "./entity-href";
import { collectChatEntityReferences, replaceChatEntityReferences } from "./entity-reference-codec";
import { createChatSearchRehypePlugin, useChatSearchState } from "../message/chat-search";
import "katex/dist/katex.min.css";
import "./markdown-theme.scss";

const mermaidPlugin: DiagramPlugin = {
  name: "mermaid",
  type: "diagram",
  language: "mermaid",
  getMermaid: (config) => ({
    initialize: () => undefined,
    render: (id, source) => renderMermaid(id, source, config),
  }),
};

const chatMarkdownPlugins = {
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid: mermaidPlugin,
};

const chatMarkdownControls = {
  code: { copy: true, download: true },
  table: { copy: true, download: true, fullscreen: true },
  mermaid: { copy: true, download: true, fullscreen: true, panZoom: false },
} satisfies ControlsConfig;

export type ChatMarkdownProps = ChatEntityBindings & {
  value: string;
  tone?: "default" | "muted";
  className?: string;
  streaming?: boolean;
};

function fallbackPresentation(reference: ChatEntityReference): ChatEntityPresentation {
  return {
    state: "unavailable",
    label: reference.labelHint?.trim() || `${reference.type}:${reference.id}`,
  };
}

function EntityMention({
  reference,
  presentation,
  onOpen,
}: {
  reference: ChatEntityReference;
  presentation: ChatEntityPresentation;
  onOpen?: (reference: ChatEntityReference) => void;
}) {
  const content = (
    <>
      {entityIcon(reference.type)} {presentation.label}
    </>
  );
  const className = `${entityClassName(reference.type)} m-0 appearance-none rounded-sm border-0 bg-transparent p-0 text-left align-baseline outline-none focus-visible:ring-2 focus-visible:ring-ring/50`;
  const interactive = presentation.state === "ready" && presentation.canOpen && onOpen;

  return interactive ? (
    <button
      type="button"
      data-slot="wiki-link"
      className={`${className} cursor-pointer hover:opacity-80`}
      onClick={() => onOpen(reference)}
    >
      {content}
    </button>
  ) : (
    <span data-slot="wiki-link" data-state={presentation.state} className={className}>
      {content}
    </span>
  );
}

function ChatMarkdownAnchor({
  href,
  children,
  node: _node,
  resolveEntity,
  onEntityOpen,
  ...props
}: ComponentProps<"a"> &
  ChatEntityBindings & {
    node?: unknown;
  }) {
  const reference = parseEntityHref(href);
  if (reference) {
    return (
      <EntityMention
        reference={reference}
        presentation={resolveEntity?.(reference) ?? fallbackPresentation(reference)}
        onOpen={onEntityOpen}
      />
    );
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

const entityUrlTransform: UrlTransform = (url, key, node) =>
  isEntityHref(url) ? url : defaultUrlTransform(url, key, node);

function markdownComponents(bindings: ChatEntityBindings): Components {
  return {
    a: (props) => <ChatMarkdownAnchor {...props} {...bindings} />,
  };
}

export function ChatMarkdown({
  value,
  tone = "default",
  className,
  streaming = false,
  resolveEntity,
  onEntityOpen,
}: ChatMarkdownProps): ReactNode {
  const searchState = useChatSearchState();
  const markdown = replaceChatEntityReferences(value, (reference) => {
    return `[${reference.type}:${reference.id}](${entityHref(reference)})`;
  });
  const entityRenderKey = collectChatEntityReferences(value)
    .map((reference) => {
      const presentation = resolveEntity?.(reference);
      return presentation
        ? `${reference.type}:${reference.id}:${presentation.state}:${presentation.label}:${presentation.state === "ready" && presentation.canOpen ? "open" : "closed"}`
        : `${reference.type}:${reference.id}:fallback`;
    })
    .join("|");

  return (
    <div
      data-slot="chat-markdown"
      data-tone={tone}
      className={["reflecta-chat-markdown", className].filter(Boolean).join(" ")}
    >
      <Streamdown
        key={`${searchState?.query ?? "plain"}:${entityRenderKey}`}
        animated={streaming}
        caret="circle"
        components={markdownComponents({ resolveEntity, onEntityOpen })}
        controls={chatMarkdownControls}
        isAnimating={streaming}
        plugins={chatMarkdownPlugins}
        rehypePlugins={searchState ? [createChatSearchRehypePlugin(searchState)] : undefined}
        urlTransform={entityUrlTransform}
      >
        {markdown}
      </Streamdown>
    </div>
  );
}
