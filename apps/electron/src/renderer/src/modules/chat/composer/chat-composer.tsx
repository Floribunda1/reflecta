import { useEffect, useRef, useState } from "react";
import { Mention } from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLatest } from "ahooks";
import { ChevronDown, FileText, Paperclip, Send, Square, X } from "lucide-react";
import type { FileUIPart } from "ai";
import { Button } from "@renderer/components/ui/button";
import { Spinner } from "@renderer/components/ui/spinner";
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
} from "@renderer/components/ui/dropdown-menu";
import type { AiModelOption } from "@main/config";
import type {
  AgentChatMessage,
  AgentContextRef,
  AgentModelSelection,
  AgentReasoningLevel,
} from "@shared/chat";
import {
  contextMentionClass,
  contextMentionIcon,
  contextRefFromMention,
  contextTitle,
  contextTypeFromKey,
  inspectableContextRef,
  mentionId,
  type InspectableContextRef,
  type MentionAttrs,
} from "../context/context-reference";
import {
  composerContent,
  composerRefsFromJSON,
  composerTextFromJSON,
  type ComposerJSON,
} from "./composer-content";
import { useContextMentionLookup, type ContextCandidate } from "../context/context-mention-lookup";
import { ContextPicker, nextContextPickerIndex } from "../context/context-picker";
import {
  buildContextUsageRequest,
  contextUsageLabel,
  contextUsageMeterLabel,
  contextUsagePercent,
  contextWindowForModel,
  type ContextUsage,
  type ContextUsageWorkerRequest,
  type ContextUsageWorkerResponse,
} from "./context-usage";

export type EditingMessage = {
  id: string;
  text: string;
  contextRefs: AgentContextRef[];
  files: FileUIPart[];
  composerContent?: ComposerJSON;
};

export type ComposerSendInput = {
  text: string;
  contextRefs: AgentContextRef[];
  files: FileUIPart[];
  composerContent: ComposerJSON;
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
  messageId?: string;
};

const REASONING_OPTIONS: { value: AgentReasoningLevel; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "low", label: "低推理" },
  { value: "medium", label: "中推理" },
  { value: "high", label: "高推理" },
  { value: "xhigh", label: "超高推理" },
];

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function reasoningLabel(level: AgentReasoningLevel) {
  return REASONING_OPTIONS.find((option) => option.value === level)?.label ?? "默认";
}

function modelSelectionValue(selection: Pick<AgentModelSelection, "providerId" | "modelId">) {
  return `${encodeURIComponent(selection.providerId)}:${encodeURIComponent(selection.modelId)}`;
}

function ContextUsageMeter({ usage }: { usage: ContextUsage }) {
  const percent = contextUsagePercent(usage);
  const progress = percent === undefined ? 0 : Math.max(0, Math.min(percent, 100));
  const label = contextUsageMeterLabel(usage);
  const detail = contextUsageLabel(usage);

  return (
    <div data-slot="context-usage" className="group relative flex shrink-0 items-center">
      <div
        tabIndex={0}
        aria-label={detail}
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
        <span className="tabular-nums">{label}</span>
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {detail}
      </div>
    </div>
  );
}

function fileToUIPart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        type: "file",
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
        url: String(reader.result ?? ""),
        providerMetadata: {
          reflecta: {
            attachmentId: crypto.randomUUID(),
            size: file.size,
          },
        },
      });
    reader.onerror = () => reject(reader.error ?? new Error("读取附件失败"));
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({ file, onRemove }: { file: FileUIPart; onRemove: () => void }) {
  const isImage = file.mediaType.startsWith("image/");
  const name = file.filename || file.mediaType;

  return (
    <div className="flex max-w-60 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
      {isImage ? (
        <img src={file.url} alt={name} className="size-8 rounded-sm object-cover" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Button type="button" size="icon-xs" variant="ghost" title="移除附件" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

export function ChatComposer({
  isBusy,
  canStop,
  editingMessage,
  focusRequest,
  modelOptions,
  activeModel,
  messages,
  modelSelectorDisabled,
  onSend,
  onSelectModel,
  onCancelEdit,
  onStop,
  onInspectContextRef,
}: {
  isBusy: boolean;
  canStop: boolean;
  editingMessage?: EditingMessage;
  focusRequest: number;
  modelOptions: AiModelOption[];
  activeModel: AgentModelSelection | null;
  messages: AgentChatMessage[];
  modelSelectorDisabled: boolean;
  onSend: (input: ComposerSendInput) => Promise<void> | void;
  onSelectModel: (selection: AgentModelSelection) => void;
  onCancelEdit: () => void;
  onStop: () => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  const [draft, setDraft] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<AgentContextRef[]>([]);
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [reasoningLevel, setReasoningLevel] = useState<AgentReasoningLevel>("default");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionCommandRef = useRef<((attrs: MentionAttrs) => void) | null>(null);
  const mentionActiveRef = useRef(false);
  const mentionKeyHandledRef = useRef(false);
  const contextLookup = useContextMentionLookup({ disabled: isBusy, selected: selectedContexts });
  const [activeContextIndex, setActiveContextIndex] = useState(0);
  const activeModelOption = activeModel
    ? modelOptions.find(
        (option) =>
          option.providerId === activeModel.providerId && option.modelId === activeModel.modelId,
      )
    : undefined;
  const activeModelLabel = activeModelOption?.modelName ?? activeModelOption?.modelId ?? "Model";
  const contextCandidatesRef = useLatest(contextLookup.candidates);
  const activeContextIndexRef = useLatest(activeContextIndex);
  const [contextUsage, setContextUsage] = useState<ContextUsage>(() => ({
    contextWindow: contextWindowForModel(activeModel),
    selectedContextCount: selectedContexts.length,
  }));
  const contextUsageWorkerRef = useRef<Worker | null>(null);
  const contextUsageRequestIdRef = useRef(0);

  useEffect(
    () => () => {
      contextUsageWorkerRef.current?.terminate();
      contextUsageWorkerRef.current = null;
    },
    [],
  );

  const markMentionKeyHandled = () => {
    mentionKeyHandledRef.current = true;
    window.setTimeout(() => {
      mentionKeyHandledRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (!contextLookup.isOpen) {
      setActiveContextIndex(0);
      return;
    }
    setActiveContextIndex((index) =>
      Math.min(index, Math.max(contextLookup.candidates.length - 1, 0)),
    );
  }, [contextLookup.candidates.length, contextLookup.isOpen]);

  useEffect(() => {
    const contextWindow = contextWindowForModel(activeModel);
    const selectedContextCount = selectedContexts.length;
    setContextUsage({ contextWindow, selectedContextCount });

    let cancelled = false;
    let idleHandle: number | undefined;
    const timeoutHandle = window.setTimeout(() => {
      const run = () => {
        const request = buildContextUsageRequest({
          messages,
          draft,
          selectedContexts,
          modelSelection: activeModel,
          editingMessageId: editingMessage?.id,
        });

        const worker =
          contextUsageWorkerRef.current ??
          new Worker(new URL("./context-usage.worker.ts", import.meta.url), { type: "module" });
        contextUsageWorkerRef.current = worker;

        const id = contextUsageRequestIdRef.current + 1;
        contextUsageRequestIdRef.current = id;

        worker.onmessage = (event: MessageEvent<ContextUsageWorkerResponse>) => {
          if (cancelled) return;
          if (event.data.id !== contextUsageRequestIdRef.current) return;
          setContextUsage(event.data.usage);
        };
        worker.onerror = () => {
          if (!cancelled) setContextUsage({ contextWindow, selectedContextCount });
        };
        worker.postMessage({ id, ...request } satisfies ContextUsageWorkerRequest);
      };

      if (window.requestIdleCallback) {
        idleHandle = window.requestIdleCallback(run, { timeout: 1_000 });
        return;
      }
      run();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
    };
  }, [activeModel, draft, editingMessage?.id, messages, selectedContexts]);

  const editor = useEditor({
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
          const type = contextTypeFromKey(node.attrs.id);
          const isInspectable = type === "thought" || type === "context";
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
                contextMentionClass(type),
                isInspectable ? "cursor-pointer hover:opacity-80" : "",
              ].join(" "),
            },
            `${contextMentionIcon(type)} `,
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
              setActiveContextIndex(0);
              contextLookup.open(props.query);
            },
            onUpdate: (props) => {
              mentionActiveRef.current = true;
              mentionCommandRef.current = props.command;
              setActiveContextIndex(0);
              contextLookup.open(props.query);
            },
            onExit: () => {
              mentionActiveRef.current = false;
              mentionCommandRef.current = null;
              contextLookup.close();
            },
            onKeyDown: ({ event }) => {
              if (event.key === "Escape") {
                event.preventDefault();
                mentionActiveRef.current = false;
                contextLookup.close();
                return true;
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                const count = contextCandidatesRef.current.length;
                setActiveContextIndex((index) => nextContextPickerIndex(index, count, step));
                return true;
              }
              if (event.key !== "Enter" && event.key !== "Tab") return false;
              event.preventDefault();
              markMentionKeyHandled();
              const candidates = contextCandidatesRef.current;
              const candidate = candidates[activeContextIndexRef.current] ?? candidates[0];
              if (!candidate) return true;
              mentionCommandRef.current?.({
                id: mentionId(candidate),
                label: contextTitle(candidate),
              });
              mentionActiveRef.current = false;
              contextLookup.close();
              return true;
            },
          }),
        },
      }),
    ],
    content: composerContent(""),
    editorProps: {
      attributes: {
        class:
          "min-h-24 flex-1 whitespace-pre-wrap break-words px-4 pt-3 pb-12 text-sm leading-6 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as ComposerJSON;
      setDraft(composerTextFromJSON(json));
      setSelectedContexts(composerRefsFromJSON(json));
    },
  });

  const setComposerContent = (
    text: string,
    refs: AgentContextRef[] = [],
    existingContent?: ComposerJSON,
    nextFiles: FileUIPart[] = [],
  ) => {
    const content = existingContent ?? composerContent(text, refs);
    editor?.commands.setContent(content);
    setDraft(composerTextFromJSON(content));
    setSelectedContexts(composerRefsFromJSON(content));
    setFiles(nextFiles);
    setAttachmentError("");
    contextLookup.close();
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).slice(0, MAX_ATTACHMENTS - files.length);
    const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setAttachmentError(`附件不能超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB：${oversized.name}`);
      return;
    }
    const parts = await Promise.all(incoming.map(fileToUIPart));
    setFiles((current) => [...current, ...parts].slice(0, MAX_ATTACHMENTS));
    setAttachmentError("");
  };

  useEffect(() => {
    if (!editingMessage) return;
    setComposerContent(
      editingMessage.text,
      editingMessage.contextRefs,
      editingMessage.composerContent,
      editingMessage.files,
    );
  }, [editingMessage?.id]);

  useEffect(() => {
    editor?.setEditable(!isBusy);
  }, [editor, isBusy]);

  useEffect(() => {
    if (focusRequest > 0) editor?.commands.focus();
  }, [editor, focusRequest]);

  const send = async () => {
    const json = (editor?.getJSON() as ComposerJSON | undefined) ?? composerContent(draft);
    const text = composerTextFromJSON(json).trim();
    if ((!text && files.length === 0) || isBusy) return;
    const contextRefs = composerRefsFromJSON(json);
    const messageId = editingMessage?.id;
    const filesToSend = files;
    setComposerContent("");
    await onSend({
      text,
      contextRefs,
      files: filesToSend,
      composerContent: json,
      modelSelection: activeModel ?? undefined,
      reasoningLevel,
      messageId,
    });
  };

  const selectContext = (candidate: ContextCandidate) => {
    const ref = { type: candidate.type, id: candidate.id, title: candidate.title };
    mentionCommandRef.current?.({ id: mentionId(ref), label: contextTitle(ref) });
    mentionActiveRef.current = false;
    contextLookup.close();
  };

  const cancelContextPicker = () => {
    mentionActiveRef.current = false;
    contextLookup.close();
  };

  return (
    <div data-testid="agent-composer" className="px-6 py-4">
      <div className="flex w-full flex-col gap-2">
        {editingMessage ? (
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            正在编辑上一条消息
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="取消编辑"
              onClick={() => {
                setComposerContent("");
                onCancelEdit();
              }}
            >
              <X />
            </Button>
          </div>
        ) : null}
        {contextLookup.isOpen ? (
          <ContextPicker
            query={contextLookup.query}
            candidates={contextLookup.candidates}
            loading={contextLookup.loading}
            onQueryChange={contextLookup.setQuery}
            onSelect={selectContext}
            showInput={false}
            activeIndex={activeContextIndex}
            onCancel={cancelContextPicker}
          />
        ) : null}
        {files.length > 0 ? (
          <div className="flex max-w-full flex-wrap gap-2">
            {files.map((file, index) => (
              <AttachmentPreview
                key={`${file.filename ?? file.mediaType}-${index}`}
                file={file}
                onRemove={() => setFiles((current) => current.filter((_, item) => item !== index))}
              />
            ))}
          </div>
        ) : null}
        {attachmentError ? (
          <div className="px-1 text-xs text-destructive">{attachmentError}</div>
        ) : null}
        <div className="relative flex min-w-0 rounded-lg border border-border/80 bg-card/90 shadow-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          {!draft.trim() && selectedContexts.length === 0 && files.length === 0 ? (
            <span className="pointer-events-none absolute top-3 left-4 text-sm text-muted-foreground">
              询问、比较，或 @ 引用知识库内容...
            </span>
          ) : null}
          <EditorContent
            editor={editor}
            data-testid="agent-composer-editor"
            className={["flex min-w-0 flex-1", isBusy ? "pointer-events-none opacity-50" : ""].join(
              " ",
            )}
            onClick={(event) => {
              if (!onInspectContextRef) return;
              const target = event.target;
              if (!(target instanceof Element)) return;
              const mention = target.closest('[data-slot="composer-context-mention"]');
              if (!mention || !event.currentTarget.contains(mention)) return;
              const ref = contextRefFromMention(
                mention.getAttribute("data-context-ref-id"),
                mention.getAttribute("data-context-ref-label"),
              );
              const inspectableRef = ref ? inspectableContextRef(ref) : null;
              if (!inspectableRef) return;
              event.preventDefault();
              onInspectContextRef(inspectableRef);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (mentionKeyHandledRef.current) {
                  mentionKeyHandledRef.current = false;
                  return;
                }
                if (contextLookup.isOpen || mentionActiveRef.current) return;
                void send();
              }
            }}
            onPaste={(event) => {
              if (event.clipboardData.files.length === 0) return;
              event.preventDefault();
              void addFiles(event.clipboardData.files);
            }}
          />
          <div className="absolute right-3 bottom-2 left-3 flex h-8 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <input
                ref={fileInputRef}
                data-testid="agent-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                data-testid="agent-attachment-button"
                type="button"
                size="icon-sm"
                variant="ghost"
                title="上传附件"
                disabled={isBusy || files.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      data-testid="agent-model-menu-button"
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={modelSelectorDisabled || isBusy || modelOptions.length === 0}
                      className="h-8 min-w-0 max-w-[320px] gap-1.5 px-2 text-muted-foreground hover:bg-muted"
                    />
                  }
                >
                  <span className="truncate text-foreground">{activeModelLabel}</span>
                  <span className="truncate text-muted-foreground">
                    {reasoningLabel(reasoningLevel)}
                  </span>
                  <ChevronDown size={16} className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-64">
                  <DropdownMenuRadioGroup
                    value={reasoningLevel}
                    onValueChange={(value) => setReasoningLevel(value as AgentReasoningLevel)}
                  >
                    <DropdownMenuLabel>推理等级</DropdownMenuLabel>
                    {REASONING_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                        data-testid="agent-reasoning-option"
                        data-reasoning-level={option.value}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>模型</DropdownMenuLabel>
                    {modelOptions.map((option) => (
                      <DropdownMenuItem
                        key={modelSelectionValue(option)}
                        data-testid="agent-model-option"
                        data-provider-id={option.providerId}
                        data-model-id={option.modelId}
                        onClick={() =>
                          onSelectModel({
                            providerId: option.providerId,
                            modelId: option.modelId,
                          })
                        }
                      >
                        <span className="truncate">{option.modelName}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {option.providerName}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ContextUsageMeter usage={contextUsage} />
              {isBusy && canStop ? (
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
              ) : isBusy ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="bg-background/70"
                  aria-label="Agent 正在其他对话响应"
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
                  disabled={!draft.trim() && files.length === 0}
                  onClick={() => void send()}
                >
                  <Send />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
