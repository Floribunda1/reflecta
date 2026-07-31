import { Mention } from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ChevronDown, FileText, Paperclip, Send, Square, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "#components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#components/dropdown-menu";
import { Spinner } from "#components/spinner";
import type { ChatComposerEntityOption, ChatComposerEntityReference } from "../entity";
import { entityClassName, entityIcon, entityKey, parseEntityKey } from "../entity-visual";
import {
  createChatComposerDocument,
  getChatComposerEntities,
  getChatComposerText,
  type ChatComposerDocument,
} from "./document";
import {
  ChatContextPicker,
  nextContextPickerIndex,
  type ChatContextPickerState,
} from "./context-picker";
import { shouldApplyInitialEntities } from "./initial-entities";

export type ChatComposerAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size?: number;
  previewUrl?: string;
};

export type ChatComposerAttachmentAdapter = {
  addFiles(files: readonly File[], signal: AbortSignal): Promise<readonly ChatComposerAttachment[]>;
};

export type ChatComposerReasoningOption = {
  id: string;
  label: string;
};

export type ChatComposerModelOption = {
  id: string;
  modelId?: string;
  label: string;
  providerLabel?: string;
  reasoningOptions: readonly ChatComposerReasoningOption[];
};

export type ChatComposerContextUsage = {
  percent?: number;
  label: string;
  description: string;
};

export type ChatComposerValue = {
  text: string;
  document: ChatComposerDocument;
  entities: readonly ChatComposerEntityReference[];
  attachments: readonly ChatComposerAttachment[];
};

export type ChatComposerEntitySearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ChatComposerEntityOption[]>;

export type ChatComposerStatus = "idle" | "running" | "compacting";

export type ChatComposerSubmit = {
  value: ChatComposerValue;
  modelId?: string;
  reasoningId?: string;
  editingMessageId?: string;
};

export type ChatComposerProps = {
  variant?: "default" | "message-edit";
  draftId?: string;
  initialValue?: ChatComposerValue;
  editingMessageId?: string;
  status: ChatComposerStatus;
  canStop?: boolean;
  focusRequest?: number;
  initialEntities?: readonly ChatComposerEntityReference[];
  modelOptions: readonly ChatComposerModelOption[];
  selectedModelId?: string;
  selectedReasoningId?: string;
  contextUsage?: ChatComposerContextUsage;
  searchEntities: ChatComposerEntitySearch;
  attachmentAdapter?: ChatComposerAttachmentAdapter;
  onSubmit: (submission: ChatComposerSubmit) => void | Promise<void>;
  onModelChange?: (modelId: string) => void;
  onReasoningChange?: (reasoningId: string) => void;
  onEntityOpen?: (reference: ChatComposerEntityReference) => void;
  onCancelEdit?: () => void;
  onStop?: () => void;
};

type MentionAttrs = {
  id: string;
  label: string;
};

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function ContextUsageMeter({ usage }: { usage: ChatComposerContextUsage }) {
  const progress = Math.max(0, Math.min(usage.percent ?? 0, 100));
  return (
    <div data-slot="context-usage" className="group relative flex shrink-0 items-center">
      <div
        tabIndex={0}
        aria-label={usage.description}
        className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className="relative size-4 rounded-full"
          style={{
            background: `conic-gradient(var(--primary) ${progress * 3.6}deg, color-mix(in srgb, var(--muted-foreground), transparent 55%) 0deg)`,
          }}
        >
          <span className="absolute inset-[3px] rounded-full bg-card" />
        </span>
        <span className="tabular-nums">{usage.label}</span>
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {usage.description}
      </div>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatComposerAttachment;
  onRemove: () => void;
}) {
  return (
    <div
      data-testid="agent-attachment-preview"
      className="flex max-w-60 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
    >
      {attachment.mediaType.startsWith("image/") && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="size-8 rounded-sm object-cover"
        />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
      <Button type="button" size="icon-xs" variant="ghost" title="移除附件" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

function useEntitySearch(
  searchEntities: ChatComposerEntitySearch,
  selectedEntities: readonly ChatComposerEntityReference[],
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ChatContextPickerState>("idle");
  const [options, setOptions] = useState<readonly ChatComposerEntityOption[]>([]);
  const selectedKey = selectedEntities.map(entityKey).sort().join("|");
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const selected = new Set(selectedEntities.map(entityKey));
    setState("loading");

    const timer = window.setTimeout(() => {
      searchEntities(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          const next = results.filter((option) => !selected.has(entityKey(option)));
          setOptions(next);
          setState(next.length ? "ready" : "empty");
        })
        .catch(() => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setOptions([]);
          setState("error");
        });
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, searchEntities, selectedKey]);

  return {
    open,
    query,
    state,
    options,
    start(nextQuery: string) {
      setOpen(true);
      setQuery(nextQuery);
    },
    close() {
      setOpen(false);
      setQuery("");
      setOptions([]);
      setState("idle");
    },
  };
}

export function ChatComposer({
  variant = "default",
  draftId,
  initialValue,
  editingMessageId,
  status,
  canStop,
  focusRequest = 0,
  initialEntities = [],
  modelOptions,
  selectedModelId,
  selectedReasoningId,
  contextUsage,
  searchEntities,
  attachmentAdapter,
  onSubmit,
  onModelChange,
  onReasoningChange,
  onEntityOpen,
  onCancelEdit,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [entities, setEntities] = useState<ChatComposerEntityReference[]>([]);
  const [attachments, setAttachments] = useState<ChatComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [activeEntityIndex, setActiveEntityIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(status !== "idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionCommandRef = useRef<((attrs: MentionAttrs) => void) | null>(null);
  const mentionActiveRef = useRef(false);
  const mentionKeyHandledRef = useRef(false);
  const sendRef = useRef<() => void>(() => undefined);
  const initializedDraftRef = useRef<{ ready: boolean; id?: string }>({ ready: false });
  const appliedInitialEntitiesRef = useRef<readonly ChatComposerEntityReference[] | null>(null);
  const attachmentControllerRef = useRef<AbortController | null>(null);
  const entitySearch = useEntitySearch(searchEntities, entities);
  const entitySearchRef = useRef(entitySearch);
  const activeEntityIndexRef = useRef(activeEntityIndex);
  const onEntityOpenRef = useRef(onEntityOpen);
  entitySearchRef.current = entitySearch;
  activeEntityIndexRef.current = activeEntityIndex;
  onEntityOpenRef.current = onEntityOpen;
  busyRef.current = status !== "idle" || submitting;

  const selectedModel = modelOptions.find((model) => model.id === selectedModelId);
  const selectedReasoning = selectedModel?.reasoningOptions.find(
    (option) => option.id === selectedReasoningId,
  );
  const showReasoningOptions =
    selectedModel?.reasoningOptions.some((option) => option.id !== "off") ?? false;

  const markMentionKeyHandled = () => {
    mentionKeyHandledRef.current = true;
    window.setTimeout(() => {
      mentionKeyHandledRef.current = false;
    }, 0);
  };

  const selectActiveEntity = () => {
    const search = entitySearchRef.current;
    const option = search.options[activeEntityIndexRef.current] ?? search.options[0];
    const command = mentionCommandRef.current;
    if (!option || !command) return false;
    markMentionKeyHandled();
    command({ id: entityKey(option), label: option.label });
    mentionActiveRef.current = false;
    search.close();
    return true;
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          blockquote: false,
          bulletList: false,
          codeBlock: false,
          heading: false,
          horizontalRule: false,
          orderedList: false,
        }),
        Mention.configure({
          HTMLAttributes: {},
          renderText: ({ node }) =>
            typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? ""),
          renderHTML: ({ node, options }) => {
            const reference = parseEntityKey(node.attrs.id);
            const id =
              typeof node.attrs.id === "string" ? node.attrs.id : String(node.attrs.id ?? "");
            const label =
              typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? "");
            return [
              "span",
              {
                ...options.HTMLAttributes,
                "data-slot": "composer-context-mention",
                "data-context-ref-id": id,
                "data-context-ref-label": label,
                class: [
                  entityClassName(reference?.type ?? null),
                  onEntityOpenRef.current ? "cursor-pointer hover:opacity-80" : "",
                ].join(" "),
              },
              `${entityIcon(reference?.type ?? null)} `,
              label,
            ];
          },
          suggestion: {
            char: "@",
            items: () => [],
            command: ({ editor, range, props }) => {
              const attrs = props as MentionAttrs;
              editor
                .chain()
                .focus()
                .insertContentAt(range, [
                  { type: "mention", attrs },
                  { type: "text", text: " " },
                ])
                .run();
            },
            render: () => ({
              onStart: (props) => {
                mentionActiveRef.current = true;
                mentionCommandRef.current = props.command;
                setActiveEntityIndex(0);
                entitySearchRef.current.start(props.query);
              },
              onUpdate: (props) => {
                mentionActiveRef.current = true;
                mentionCommandRef.current = props.command;
                setActiveEntityIndex(0);
                entitySearchRef.current.start(props.query);
              },
              onExit: () => {
                mentionActiveRef.current = false;
                mentionCommandRef.current = null;
                entitySearchRef.current.close();
              },
              onKeyDown: ({ event }) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  mentionActiveRef.current = false;
                  entitySearchRef.current.close();
                  return true;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActiveEntityIndex((index) =>
                    nextContextPickerIndex(index, entitySearchRef.current.options.length, step),
                  );
                  return true;
                }
                if (event.key !== "Enter" && event.key !== "Tab") return false;
                event.preventDefault();
                return selectActiveEntity();
              },
            }),
          },
        }),
      ],
      content: createChatComposerDocument(""),
      editorProps: {
        attributes: {
          class:
            "max-h-64 min-h-24 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 pt-3 pb-2 text-base leading-6 outline-none",
        },
        handlePaste: (view, event) => {
          if (event.clipboardData?.files.length) return false;
          const pastedText = event.clipboardData?.getData("text/plain");
          if (!pastedText) return false;
          const transaction = view.state.tr
            .replaceSelectionWith(view.state.schema.text(pastedText), false)
            .setStoredMarks([])
            .scrollIntoView();
          view.dispatch(transaction);
          return true;
        },
        handleKeyDown: (_view, event) => {
          if (event.isComposing || event.key !== "Enter" || event.shiftKey) return false;
          if (mentionActiveRef.current || entitySearchRef.current.open) {
            event.preventDefault();
            selectActiveEntity();
            return true;
          }
          if (busyRef.current) return false;
          event.preventDefault();
          if (mentionKeyHandledRef.current) {
            mentionKeyHandledRef.current = false;
            return true;
          }
          sendRef.current();
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        const document = editor.getJSON() as ChatComposerDocument;
        setText(getChatComposerText(document));
        setEntities(getChatComposerEntities(document));
      },
    },
    [],
  );

  const setComposerValue = (
    value: Pick<ChatComposerValue, "document" | "attachments"> = {
      document: createChatComposerDocument(""),
      attachments: [],
    },
  ) => {
    editor?.commands.setContent(value.document);
    setText(getChatComposerText(value.document));
    setEntities(getChatComposerEntities(value.document));
    setAttachments([...value.attachments]);
    setAttachmentError("");
    entitySearchRef.current.close();
  };

  useLayoutEffect(() => {
    if (!editor) return;
    const initialized = initializedDraftRef.current;
    if (initialized.ready && initialized.id === draftId) return;
    initializedDraftRef.current = { ready: true, id: draftId };
    appliedInitialEntitiesRef.current = null;
    setComposerValue(initialValue);
    if (variant === "message-edit") editor.commands.focus("end");
  }, [draftId, editor, variant]);

  useEffect(() => {
    const requestChanged = appliedInitialEntitiesRef.current !== initialEntities;
    appliedInitialEntitiesRef.current = initialEntities;
    if (
      !editor ||
      initialEntities.length === 0 ||
      !shouldApplyInitialEntities({
        requestChanged,
        editing: Boolean(editingMessageId),
        text,
        attachmentCount: attachments.length,
      })
    ) {
      return;
    }
    setComposerValue({
      document: createChatComposerDocument("", initialEntities),
      attachments: [],
    });
    editor.commands.focus();
  }, [attachments.length, editingMessageId, editor, initialEntities, text]);

  useEffect(() => {
    if (focusRequest > 0) editor?.commands.focus();
  }, [editor, focusRequest]);

  useEffect(() => () => attachmentControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!entitySearch.open) {
      setActiveEntityIndex(0);
      return;
    }
    setActiveEntityIndex((index) => Math.min(index, Math.max(entitySearch.options.length - 1, 0)));
  }, [entitySearch.open, entitySearch.options.length]);

  const addFiles = async (files: readonly File[]) => {
    if (!files.length || !attachmentAdapter) return;
    const incoming = files.slice(0, MAX_ATTACHMENTS - attachments.length);
    const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setAttachmentError(`附件不能超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB：${oversized.name}`);
      return;
    }

    attachmentControllerRef.current?.abort();
    const controller = new AbortController();
    attachmentControllerRef.current = controller;
    try {
      const added = await attachmentAdapter.addFiles(incoming, controller.signal);
      if (controller.signal.aborted) return;
      setAttachments((current) => [...current, ...added].slice(0, MAX_ATTACHMENTS));
      setAttachmentError("");
    } catch (error) {
      if (controller.signal.aborted) return;
      setAttachmentError(error instanceof Error ? error.message : "读取附件失败");
    }
  };

  const submit = async () => {
    const document =
      (editor?.getJSON() as ChatComposerDocument | undefined) ?? createChatComposerDocument(text);
    const value: ChatComposerValue = {
      text: getChatComposerText(document).trim(),
      document,
      entities: getChatComposerEntities(document),
      attachments,
    };
    if ((!value.text && attachments.length === 0) || status !== "idle" || submitting) return;

    setSubmitting(true);
    setComposerValue();
    try {
      await onSubmit({
        value,
        modelId: selectedModelId,
        reasoningId: selectedReasoningId,
        editingMessageId,
      });
    } catch (error) {
      setComposerValue(value);
      setAttachmentError(error instanceof Error ? error.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  };
  sendRef.current = () => void submit();

  const selectEntity = (option: ChatComposerEntityOption) => {
    mentionCommandRef.current?.({ id: entityKey(option), label: option.label });
    mentionActiveRef.current = false;
    entitySearchRef.current.close();
  };

  const busy = status !== "idle" || submitting;
  const canSubmit = Boolean(text.trim() || attachments.length);
  const activeEntity = entitySearch.options[activeEntityIndex];
  const cancelEdit = () => {
    setComposerValue();
    onCancelEdit?.();
  };

  return (
    <div
      data-testid={variant === "message-edit" ? "agent-message-editor" : "agent-composer"}
      className={variant === "message-edit" ? "w-full" : "px-6 py-4"}
    >
      <div
        className={
          variant === "message-edit"
            ? "flex w-full flex-col gap-2"
            : "mx-auto flex w-full max-w-4xl flex-col gap-2"
        }
      >
        {entitySearch.open ? (
          <ChatContextPicker
            state={entitySearch.state}
            options={entitySearch.options}
            activeId={activeEntity ? entityKey(activeEntity) : undefined}
            onSelect={selectEntity}
            onCancel={() => {
              mentionActiveRef.current = false;
              entitySearchRef.current.close();
            }}
          />
        ) : null}
        {attachments.length ? (
          <div className="flex max-w-full flex-wrap gap-2">
            {attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                onRemove={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
              />
            ))}
          </div>
        ) : null}
        {attachmentError ? (
          <div className="px-1 text-xs text-destructive">{attachmentError}</div>
        ) : null}
        <div
          className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors focus-within:border-ring ${
            editingMessageId ? "border-primary/30" : "border-border/80"
          }`}
        >
          <div className="relative min-w-0">
            {!text.trim() && entities.length === 0 && attachments.length === 0 ? (
              <span className="pointer-events-none absolute top-3 left-4 text-base text-muted-foreground">
                {busy
                  ? "可以先整理下一轮想法，回复完成后发送..."
                  : "询问、比较，或 @ 引用知识库内容..."}
              </span>
            ) : null}
            <EditorContent
              editor={editor}
              data-testid={
                variant === "message-edit" ? "agent-message-edit-editor" : "agent-composer-editor"
              }
              className={`flex min-w-0 ${variant === "message-edit" ? "[&_.tiptap]:min-h-20" : ""}`}
              onKeyDownCapture={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (
                  event.key === "Escape" &&
                  editingMessageId &&
                  !entitySearchRef.current.open &&
                  !mentionActiveRef.current
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEdit();
                  return;
                }
                if (event.key !== "Enter" || event.shiftKey) return;
                if (!entitySearchRef.current.open && !mentionActiveRef.current) return;
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation();
                selectActiveEntity();
              }}
              onClick={(event) => {
                const target = event.target;
                if (!(target instanceof Element) || !onEntityOpenRef.current) return;
                const mention = target.closest('[data-slot="composer-context-mention"]');
                if (!mention || !event.currentTarget.contains(mention)) return;
                const reference = parseEntityKey(mention.getAttribute("data-context-ref-id"));
                const label = mention.getAttribute("data-context-ref-label");
                if (!reference || !label) return;
                event.preventDefault();
                onEntityOpenRef.current({ ...reference, label });
              }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files);
                if (!files.length) return;
                event.preventDefault();
                void addFiles(files);
              }}
            />
          </div>
          <div
            className={`flex shrink-0 items-center justify-between gap-3 px-3 pb-2 ${
              variant === "message-edit" ? "min-h-11" : "h-10"
            }`}
          >
            <div className="flex min-w-0 items-center gap-1">
              <input
                ref={fileInputRef}
                data-testid="agent-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addFiles(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
              <Button
                data-testid="agent-attachment-button"
                type="button"
                size="icon-sm"
                variant="ghost"
                title="上传附件"
                disabled={busy || !attachmentAdapter || attachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </Button>
              {variant !== "message-edit" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        data-testid="agent-model-menu-button"
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || modelOptions.length === 0}
                        className="h-8 min-w-0 max-w-[320px] gap-1.5 px-2 text-muted-foreground hover:bg-muted"
                      />
                    }
                  >
                    <span className="truncate text-foreground">
                      {selectedModel?.label ?? "Model"}
                    </span>
                    {selectedReasoning ? (
                      <span className="truncate text-muted-foreground">
                        {selectedReasoning.label}
                      </span>
                    ) : null}
                    <ChevronDown size={16} className="text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="w-64">
                    {selectedModel && showReasoningOptions ? (
                      <>
                        <DropdownMenuRadioGroup
                          value={selectedReasoningId}
                          onValueChange={(value) => onReasoningChange?.(value)}
                        >
                          <DropdownMenuLabel>推理等级</DropdownMenuLabel>
                          {selectedModel.reasoningOptions.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.id}
                              value={option.id}
                              data-testid="agent-reasoning-option"
                              data-reasoning-level={option.id}
                            >
                              {option.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>模型</DropdownMenuLabel>
                      {modelOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          data-testid="agent-model-option"
                          data-model-id={option.modelId ?? option.id}
                          data-reasoning-levels={option.reasoningOptions
                            .map((reasoning) => reasoning.id)
                            .join(" ")}
                          onClick={() => onModelChange?.(option.id)}
                        >
                          <span className="truncate">{option.label}</span>
                          {option.providerLabel ? (
                            <span className="ml-auto truncate text-xs text-muted-foreground">
                              {option.providerLabel}
                            </span>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {variant === "message-edit" ? (
                <>
                  <Button
                    data-testid="agent-message-edit-cancel"
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={cancelEdit}
                  >
                    取消
                  </Button>
                  <Button
                    data-testid="agent-message-edit-submit"
                    type="button"
                    size="sm"
                    aria-label="发送"
                    disabled={!canSubmit}
                    onClick={() => void submit()}
                  >
                    <Send />
                    发送
                  </Button>
                </>
              ) : (
                <>
                  {contextUsage ? <ContextUsageMeter usage={contextUsage} /> : null}
                  {status === "running" && canStop ? (
                    <Button
                      data-testid="agent-stop-button"
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="bg-background/70"
                      aria-label="停止"
                      onClick={onStop}
                    >
                      <Square />
                    </Button>
                  ) : busy ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="bg-background/70"
                      aria-label={status === "compacting" ? "正在压缩上下文" : "Agent 正在响应"}
                      disabled
                    >
                      <Spinner />
                    </Button>
                  ) : (
                    <Button
                      data-testid="agent-send-button"
                      type="button"
                      size="icon-sm"
                      className="disabled:bg-muted disabled:text-muted-foreground"
                      aria-label="发送"
                      disabled={!canSubmit}
                      onClick={() => void submit()}
                    >
                      <Send />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
