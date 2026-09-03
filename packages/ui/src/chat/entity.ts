export type ChatEntityType = "understanding" | "context" | "domain" | "canvas" | "conversation";

/** @ 面板类型筛选："all" = 全部类型混合列出（默认）；否则只列该类型。 */
export type ChatEntityTypeFilter = ChatEntityType | "all";

export type ChatEntityReference = {
  type: ChatEntityType;
  id: string;
  labelHint?: string;
};

export type ChatEntityPresentation =
  | {
      state: "ready";
      label: string;
      canOpen: boolean;
    }
  | {
      state: "loading" | "unavailable" | "error";
      label: string;
    };

export type ResolveChatEntity = (
  reference: ChatEntityReference,
) => ChatEntityPresentation | undefined;

/**
 * renderMarkdown render-prop 的 props：组合组件把 Markdown 渲染委派给调用方。
 * App 层（renderer）传入带实体引用解析（请求逻辑）的解析版组件，packages/ui 不感知请求。
 */
export type MarkdownRenderProps = {
  value: string;
  /** SimpleMarkdownPreview：摘要截断行数（卡片按行截断时传入）。 */
  lineClamp?: number;
  zoomImages?: boolean;
  onWikiLinkOpen?: (reference: ChatEntityReference) => void;
  className?: string;
};

export type MarkdownRenderer = import("react").ComponentType<MarkdownRenderProps>;

export type ChatEntityBindings = {
  resolveEntity?: ResolveChatEntity;
  onEntityOpen?: (reference: ChatEntityReference) => void;
};

export type ChatComposerEntityReference = {
  type: ChatEntityType;
  id: string;
  label: string;
};

export type ChatComposerEntityOption = ChatComposerEntityReference & {
  subtitle?: string;
};
