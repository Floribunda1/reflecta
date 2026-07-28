export type ChatEntityType = "understanding" | "context" | "domain";

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
