export type ChatEntityType = "understanding" | "context" | "domain" | "canvas";

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
