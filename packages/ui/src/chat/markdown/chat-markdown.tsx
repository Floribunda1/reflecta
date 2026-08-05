import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { useTheme } from "next-themes";
import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react";
import {
  defaultUrlTransform,
  Streamdown,
  type AnimateOptions,
  type Components,
  type ControlsConfig,
  type DiagramPlugin,
  type UrlTransform,
} from "streamdown";
import { renderMermaid } from "#lib/mermaid";
import type { ChatEntityBindings, ChatEntityPresentation, ChatEntityReference } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
import { createChatSearchRehypePlugin, useChatSearchState } from "../message/chat-search";
import { entityHref, isEntityHref, parseEntityHref } from "./entity-href";
import { collectChatEntityReferences, replaceChatEntityReferences } from "./entity-reference-codec";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
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
  code,
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid: mermaidPlugin,
};

const chatMarkdownControls = {
  code: { copy: true, download: true },
  table: { copy: true, download: true, fullscreen: true },
  mermaid: { copy: true, download: true, fullscreen: true },
} satisfies ControlsConfig;

const chatMarkdownAnimation = {
  animation: "fadeIn",
  duration: 120,
  easing: "ease-out",
  sep: "char",
  stagger: 4,
} satisfies AnimateOptions;

export type ChatMarkdownProps = ChatEntityBindings & {
  value: string;
  tone?: "default" | "muted";
  className?: string;
  streaming?: boolean;
};

function fallbackPresentation(reference: ChatEntityReference): ChatEntityPresentation {
  return {
    state: "unavailable",
    label: reference.labelHint?.trim() || `未找到 ${reference.type}:${reference.id}`,
  };
}

const ChatMarkdownEntityContext = createContext<ChatEntityBindings>({});

function EntityMention({
  reference,
  presentation,
  onOpen,
}: {
  reference: ChatEntityReference;
  presentation: ChatEntityPresentation;
  onOpen?: (reference: ChatEntityReference) => void;
}) {
  const available = presentation.state === "ready" || presentation.state === "loading";
  const statusIcon =
    presentation.state === "error"
      ? "!"
      : presentation.state === "unavailable"
        ? "○"
        : entityIcon(reference.type);
  const content = (
    <>
      {statusIcon} {presentation.label}
    </>
  );
  const visualClassName = available
    ? entityClassName(reference.type)
    : "mx-0.5 inline text-[1em] font-medium leading-[inherit] text-(--reflecta-chat-muted-foreground) no-underline decoration-transparent";
  const className = `${visualClassName} m-0 appearance-none text-left align-baseline outline-none focus-visible:ring-2 focus-visible:ring-ring/50`;
  const interactive = presentation.state === "ready" && presentation.canOpen && onOpen;

  return interactive ? (
    <button
      type="button"
      data-slot="wiki-link"
      data-entity-type={reference.type}
      data-state={presentation.state}
      className={`${className} cursor-pointer hover:opacity-80`}
      onClick={() => onOpen(reference)}
    >
      {content}
    </button>
  ) : (
    <span
      data-slot="wiki-link"
      data-entity-type={reference.type}
      data-state={presentation.state}
      className={className}
    >
      {content}
    </span>
  );
}

function ChatMarkdownAnchor({
  href,
  children,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) {
  const { resolveEntity, onEntityOpen } = useContext(ChatMarkdownEntityContext);
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

function ChatMarkdownStrong({
  children,
  node: _node,
  ...props
}: ComponentProps<"strong"> & { node?: unknown }) {
  return <strong {...props}>{children}</strong>;
}

const entityUrlTransform: UrlTransform = (url, key, node) =>
  isEntityHref(url) ? url : defaultUrlTransform(url, key, node);

const chatMarkdownComponents = {
  a: ChatMarkdownAnchor,
  strong: ChatMarkdownStrong,
} satisfies Components;

export function ChatMarkdown({
  value,
  tone = "default",
  className,
  streaming = false,
  resolveEntity,
  onEntityOpen,
}: ChatMarkdownProps): ReactNode {
  const searchState = useChatSearchState();
  const { forcedTheme, resolvedTheme } = useTheme();
  const bindings = useMemo(() => ({ resolveEntity, onEntityOpen }), [onEntityOpen, resolveEntity]);
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
    <ChatMarkdownEntityContext value={bindings}>
      <div
        data-slot="chat-markdown"
        data-tone={tone}
        className={["reflecta-chat-markdown", className].filter(Boolean).join(" ")}
      >
        <Streamdown
          key={`${forcedTheme ?? resolvedTheme}:${searchState?.query ?? "plain"}:${entityRenderKey}`}
          mode={streaming ? "streaming" : "static"}
          animated={streaming ? chatMarkdownAnimation : false}
          caret="circle"
          components={chatMarkdownComponents}
          controls={chatMarkdownControls}
          isAnimating={streaming}
          mermaid={{ config: { htmlLabels: false } }}
          plugins={chatMarkdownPlugins}
          rehypePlugins={searchState ? [createChatSearchRehypePlugin(searchState)] : undefined}
          urlTransform={entityUrlTransform}
        >
          {markdown}
        </Streamdown>
      </div>
    </ChatMarkdownEntityContext>
  );
}
