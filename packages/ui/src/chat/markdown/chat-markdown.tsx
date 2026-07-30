import {
  LinkNode,
  MarkdownCodeBlockNode,
  TextNode,
  setCustomComponents,
  type NodeComponentProps,
} from "markstream-react";
import MarkdownRender from "markstream-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  getMarkdown,
  parseMarkdownToStructure,
  type CodeBlockNode,
  type LinkNode as MarkdownLinkNode,
  type ParsedNode,
  type TextNode as MarkdownTextNode,
} from "stream-markdown-parser";
import type { ChatEntityBindings, ChatEntityPresentation, ChatEntityReference } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
import {
  findChatTextRanges,
  renderTextWithChatSearchHighlights,
  useChatSearchState,
} from "../message/chat-search";
import { entityHref, parseEntityHref } from "./entity-href";
import { collectChatEntityReferences, replaceChatEntityReferences } from "./entity-reference-codec";
import "katex/dist/katex.min.css";
import "markstream-react/index.css";
import "./markdown-theme.scss";

const CHAT_MARKDOWN_RENDERER_ID = "reflecta-chat-markdown";

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

type SearchTextNode = MarkdownTextNode & {
  chatSearchMatchIndex?: number;
};

function ChatMarkdownText({ node, ...props }: NodeComponentProps<SearchTextNode>) {
  const searchState = useChatSearchState();
  if (!searchState || node.chatSearchMatchIndex === undefined) {
    return <TextNode node={node} {...props} />;
  }
  return (
    <span className="text-node">
      {renderTextWithChatSearchHighlights(
        node.content,
        searchState,
        `${String(props.indexKey)}-text`,
        node.chatSearchMatchIndex,
      )}
    </span>
  );
}

function ChatMarkdownLink(props: NodeComponentProps<MarkdownLinkNode>) {
  const { resolveEntity, onEntityOpen } = useContext(ChatMarkdownEntityContext);
  const reference = parseEntityHref(props.node.href);
  if (reference) {
    return (
      <EntityMention
        reference={reference}
        presentation={resolveEntity?.(reference) ?? fallbackPresentation(reference)}
        onOpen={onEntityOpen}
      />
    );
  }
  return <LinkNode {...props} />;
}

function ChatMarkdownCodeBlock({ node, ctx, isDark }: NodeComponentProps<CodeBlockNode>) {
  return (
    <MarkdownCodeBlockNode
      node={node}
      loading={node.loading}
      stream={ctx?.codeBlockStream}
      isDark={isDark}
      showHeader
      showCopyButton
      showExpandButton={false}
      showCollapseButton={false}
      showFontSizeButtons={false}
      showTooltips={false}
    />
  );
}

setCustomComponents(CHAT_MARKDOWN_RENDERER_ID, {
  text: ChatMarkdownText,
  link: ChatMarkdownLink,
  code_block: ChatMarkdownCodeBlock,
});

function annotateSearchNodes(nodes: ParsedNode[], query: string): ParsedNode[] {
  let nextMatchIndex = 0;

  const visit = (node: ParsedNode): ParsedNode => {
    const copy = { ...node } as ParsedNode & Record<string, unknown>;
    if (node.type === "text" && typeof node.content === "string") {
      copy.chatSearchMatchIndex = nextMatchIndex;
      nextMatchIndex += findChatTextRanges(node.content, query).length;
    }

    for (const [key, value] of Object.entries(copy)) {
      if (!Array.isArray(value)) continue;
      copy[key] = value.map((item) =>
        item && typeof item === "object" && "type" in item ? visit(item as ParsedNode) : item,
      );
    }
    return copy as ParsedNode;
  };

  return nodes.map(visit);
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
  const { forcedTheme, resolvedTheme } = useTheme();
  const bindings = useMemo(() => ({ resolveEntity, onEntityOpen }), [onEntityOpen, resolveEntity]);
  const markdown = replaceChatEntityReferences(value, (reference) => {
    return `[${reference.type}:${reference.id}](${entityHref(reference)})`;
  });
  const searchNodes = useMemo(() => {
    if (!searchState?.query.trim()) return undefined;
    const parser = getMarkdown();
    return annotateSearchNodes(parseMarkdownToStructure(markdown, parser), searchState.query);
  }, [markdown, searchState?.query]);
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
        <MarkdownRender
          key={`${searchState?.query ?? "plain"}:${entityRenderKey}`}
          customId={CHAT_MARKDOWN_RENDERER_ID}
          content={searchNodes ? undefined : markdown}
          nodes={searchNodes}
          final={!streaming}
          fade={false}
          smoothStreaming={streaming}
          maxLiveNodes={0}
          batchRendering
          viewportPriority
          deferNodesUntilVisible
          codeBlockStream={streaming}
          isDark={(forcedTheme ?? resolvedTheme) === "dark"}
          htmlPolicy="safe"
          showTooltips={false}
          mermaidProps={{
            showHeader: true,
            showModeToggle: false,
            showCopyButton: true,
            showExportButton: true,
            showFullscreenButton: true,
            showCollapseButton: false,
            showZoomControls: false,
            enableWheelZoom: false,
          }}
        />
      </div>
    </ChatMarkdownEntityContext>
  );
}
