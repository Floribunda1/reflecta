import { Mention } from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLatest, useMemoizedFn } from "ahooks";
import { ArrowUp, Brain, ChevronDown, FileText, Paperclip, Send, Square, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { cn } from "#lib/utils";
import { attachmentMeta } from "#lib/file-meta";
import { SPRING_SWAP } from "#lib/motion";
import { Button } from "#components/button";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "#components/attachment";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#components/dropdown-menu";
import { Spinner } from "#components/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#components/tooltip";
import type {
  ChatComposerEntityOption,
  ChatComposerEntityReference,
  ChatEntityTypeFilter,
} from "../entity";
import {
  entityClassName,
  CHAT_ENTITY_ICON_FONT_SIZE,
  entityIconDomNode,
  entityKey,
  parseEntityKey,
} from "../entity-visual";
import {
  createChatComposerDocument,
  getChatComposerEntities,
  getChatComposerText,
  type ChatComposerDocument,
} from "./document";
import {
  ChatContextPicker,
  ChatSkillPicker,
  filterChatComposerSkills,
  isLeadingSkillTrigger,
  nextContextPickerIndex,
  type ChatComposerSkill,
  type ChatContextPickerState,
} from "./context-picker";
import { shouldApplyInitialEntities } from "./initial-entities";

export type { ChatComposerSkill } from "./context-picker";

export type ChatComposerAttachmentStatus = "uploading" | "done" | "error";

export type ChatComposerAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size?: number;
  previewUrl?: string;
  /** 上传生命周期状态；缺省 = done（草稿恢复 / adapter 返回的已完成附件）。 */
  status?: ChatComposerAttachmentStatus;
  error?: string;
  /** 本地磁盘路径（用户选择/拖拽的文件；粘贴等来源为空）。用于系统应用打开。 */
  filePath?: string;
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
  type: ChatEntityTypeFilter,
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
  skills?: readonly ChatComposerSkill[];
  searchEntities: ChatComposerEntitySearch;
  attachmentAdapter?: ChatComposerAttachmentAdapter;
  /** 附件打开（有本地路径时用系统应用打开）。 */
  onAttachmentOpen?: (attachment: ChatComposerAttachment) => void;
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
const EMPTY_SKILLS: readonly ChatComposerSkill[] = [];
const EMPTY_INITIAL_ENTITIES: readonly ChatComposerEntityReference[] = [];

/** @ 面板类型 tab 的显示顺序（左右方向键按此循环切换）。 */
const ENTITY_TAB_ORDER: readonly ChatEntityTypeFilter[] = [
  "all",
  "understanding",
  "context",
  "domain",
  "canvas",
];

function nextEntityTypeFilter(current: ChatEntityTypeFilter, step: -1 | 1): ChatEntityTypeFilter {
  const index = ENTITY_TAB_ORDER.indexOf(current);
  const length = ENTITY_TAB_ORDER.length;
  return ENTITY_TAB_ORDER[(index + step + length) % length];
}

function ContextUsageMeter({ usage }: { usage: ChatComposerContextUsage }) {
  const progress = Math.max(0, Math.min(usage.percent ?? 0, 100));
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={usage.description}
              className="shrink-0 gap-2 px-2"
            >
              <span
                // DESIGN: 上下文用量环形进度——组件库 Progress 仅线性，环形为必要自造
                // （recharts RadialBar 对 16px 迷你指示器过重）。conic-gradient 画弧，
                // inset-[3px] 内孔决定环宽（16/2-3=5px），取整 inset-1 会细 1px。
                className="relative size-4 rounded-full"
                style={{
                  background: `conic-gradient(var(--primary) ${progress * 3.6}deg, color-mix(in srgb, var(--muted-foreground), transparent 55%) 0deg)`,
                }}
              >
                <span className="absolute inset-[3px] rounded-full bg-card" />
              </span>
              <span className="tabular-nums">{usage.label}</span>
            </Button>
          }
        />
        <TooltipContent side="top" align="end">
          {usage.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
  onOpen,
}: {
  attachment: ChatComposerAttachment;
  onRemove: () => void;
  onOpen?: (attachment: ChatComposerAttachment) => void;
}) {
  const status = attachment.status ?? "done";
  const isImage = attachment.mediaType.startsWith("image/");
  const isPreviewableImage = status === "done" && isImage && Boolean(attachment.previewUrl);
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <>
      <Attachment
        data-testid="agent-attachment-preview"
        data-attachment-status={status}
        state={status}
        size="sm"
      >
        <AttachmentMedia variant={isImage && attachment.previewUrl ? "image" : "icon"}>
          {isImage && attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt={attachment.name} />
          ) : (
            <FileText />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{attachment.name}</AttachmentTitle>
          <AttachmentDescription>
            {status === "uploading"
              ? "读取中…"
              : status === "error"
                ? (attachment.error ?? "读取失败")
                : attachmentMeta(attachment.name, attachment.size)}
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label={`移除附件 ${attachment.name}`} onClick={onRemove}>
            <X />
          </AttachmentAction>
        </AttachmentActions>
        {attachment.filePath ? (
          // 有本地路径 → 系统默认应用打开（不在应用内预览）。
          <AttachmentTrigger
            aria-label={`打开 ${attachment.name}`}
            onClick={() => onOpen?.(attachment)}
          />
        ) : isPreviewableImage ? (
          // 粘贴等无路径的图片 → 应用内预览兜底。
          <>
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{attachment.name}</DialogTitle>
                </DialogHeader>
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="max-h-[75vh] w-full rounded-md object-contain"
                />
              </DialogContent>
            </Dialog>
            <AttachmentTrigger
              aria-label={`预览图片 ${attachment.name}`}
              onClick={() => setPreviewOpen(true)}
            />
          </>
        ) : null}
      </Attachment>
    </>
  );
}

function useEntitySearch(
  searchEntities: ChatComposerEntitySearch,
  selectedEntities: readonly ChatComposerEntityReference[],
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ChatEntityTypeFilter>("all");
  const [state, setState] = useState<ChatContextPickerState>("idle");
  const [options, setOptions] = useState<readonly ChatComposerEntityOption[]>([]);
  const selectedKey = selectedEntities.map(entityKey).sort().join("|");
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const selected = new Set(selectedKey.split("|").filter(Boolean));
    setState("loading");

    const timer = window.setTimeout(() => {
      searchEntities(query, type, controller.signal)
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
  }, [open, query, type, searchEntities, selectedKey]);

  return {
    open,
    query,
    type,
    setType,
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

function useSkillSearch(skills: readonly ChatComposerSkill[]) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return {
    open,
    options: filterChatComposerSkills(skills, query),
    start(nextQuery: string) {
      setOpen(true);
      setQuery(nextQuery);
    },
    close() {
      setOpen(false);
      setQuery("");
    },
  };
}

/** 发送按钮模式：stop（可停止）→ waiting（等用户决定）→ compacting/busy → send。 */
function sendButtonMode(
  status: ChatComposerStatus,
  canStop: boolean,
  submitting: boolean,
): "stop" | "waiting" | "compacting" | "busy" | "send" {
  if (status === "running" && canStop) return "stop";
  if (status === "running") return "waiting";
  if (status === "compacting") return "compacting";
  if (status !== "idle" || submitting) return "busy";
  return "send";
}

function ComposerSendButton({
  status,
  canStop,
  canSubmit,
  submitting,
  onSend,
  onStop,
}: {
  status: ChatComposerStatus;
  canStop: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const busy = status !== "idle" || submitting;

  // 按钮状态机：单一 mode 驱动派生，替代多组并列/嵌套三元。
  const mode = sendButtonMode(status, canStop, submitting);
  let testId: string | undefined;
  let ariaLabel: string;
  let handleClick: () => void;
  let iconKey: string;
  let icon: ReactNode;
  switch (mode) {
    case "stop":
      testId = "agent-stop-button";
      ariaLabel = "停止";
      handleClick = onStop;
      iconKey = "stop";
      icon = <Square className="size-3 fill-current" />;
      break;
    case "waiting":
      testId = "agent-send-button";
      ariaLabel = "等待用户决定";
      handleClick = () => {};
      iconKey = "send";
      icon = <ArrowUp className="size-4" />;
      break;
    case "compacting":
      ariaLabel = "正在压缩上下文";
      handleClick = () => {};
      iconKey = "loading";
      icon = <Spinner />;
      break;
    case "busy":
      ariaLabel = "Agent 正在响应";
      handleClick = () => {};
      iconKey = "loading";
      icon = <Spinner />;
      break;
    case "send":
      testId = "agent-send-button";
      ariaLabel = "发送";
      handleClick = onSend;
      iconKey = "send";
      icon = <ArrowUp className="size-4" />;
      break;
  }
  const disabled = mode === "stop" ? false : mode === "send" ? !canSubmit : true;

  return (
    <Button
      data-testid={testId}
      type="button"
      size="icon-sm"
      variant={busy ? "outline" : undefined}
      className={cn(
        "disabled:bg-muted disabled:text-muted-foreground",
        // DESIGN: pressable 按压语言（utilities.css）——与 Button 内置 translate 位移叠加为
        // 位移+缩放双重反馈，动效更丝滑；composer 按钮组统一此语言，刻意设计。
        "pressable",
      )}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={iconKey}
          initial={{ opacity: 0, y: 3, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -3, scale: 0.8 }}
          transition={SPRING_SWAP}
          className="grid place-items-center"
        >
          {icon}
        </m.span>
      </AnimatePresence>
    </Button>
  );
}

type TriggerSearch<T> = {
  options: readonly T[];
  start(query: string): void;
  close(): void;
};

type TriggerRenderHandler = {
  onStart(props: { query: string; command: (attrs: MentionAttrs) => void }): void;
  onUpdate(props: { query: string; command: (attrs: MentionAttrs) => void }): void;
  onExit(): void;
  onKeyDown(props: { event: KeyboardEvent }): boolean;
};

/** @ 实体 / $ Skill 两种触发器共享的建议面板行为（onStart/onUpdate/onExit/onKeyDown）。
 *  差异点（refs、tiptap 命令适配、选项→命令入参）由调用方以 config 注入。 */
function createTriggerSuggestion<TOption, TCommand>(config: {
  activeRef: MutableRefObject<boolean>;
  commandRef: MutableRefObject<((value: TCommand) => void) | null>;
  searchRef: MutableRefObject<TriggerSearch<TOption>>;
  activeIndexRef: MutableRefObject<number>;
  setActiveIndex: (updater: (index: number) => number) => void;
  closeOther: () => void;
  /** 左右方向键：在 @ 面板里切换类型 tab（skill 触发不传即忽略）。 */
  onArrowLeftRight?: (step: -1 | 1) => void;
  wrapCommand: (command: (attrs: MentionAttrs) => void) => (value: TCommand) => void;
  toCommandValue: (option: TOption) => TCommand;
  markKeyHandled: () => void;
}) {
  const runCommand = (option: TOption) => {
    const command = config.commandRef.current;
    if (!command) return;
    command(config.toCommandValue(option));
    config.activeRef.current = false;
    config.searchRef.current.close();
  };

  const selectActive = () => {
    const search = config.searchRef.current;
    const option = search.options[config.activeIndexRef.current] ?? search.options[0];
    const command = config.commandRef.current;
    if (!option || !command) return false;
    config.markKeyHandled();
    runCommand(option);
    return true;
  };

  return {
    run: runCommand,
    selectActive,
    render: (): TriggerRenderHandler => ({
      onStart: (props) => {
        config.activeRef.current = true;
        config.commandRef.current = config.wrapCommand(props.command);
        config.closeOther();
        config.setActiveIndex(() => 0);
        config.searchRef.current.start(props.query);
      },
      onUpdate: (props) => {
        config.activeRef.current = true;
        config.commandRef.current = config.wrapCommand(props.command);
        config.setActiveIndex(() => 0);
        config.searchRef.current.start(props.query);
      },
      onExit: () => {
        config.activeRef.current = false;
        config.commandRef.current = null;
        config.searchRef.current.close();
      },
      onKeyDown: ({ event }) => {
        if (event.key === "Escape") {
          event.preventDefault();
          config.activeRef.current = false;
          config.searchRef.current.close();
          return true;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          if (config.activeRef.current) {
            event.preventDefault();
            config.setActiveIndex(() => 0);
            config.onArrowLeftRight?.(event.key === "ArrowRight" ? 1 : -1);
            return true;
          }
          return false;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          config.setActiveIndex((index) =>
            nextContextPickerIndex(index, config.searchRef.current.options.length, step),
          );
          return true;
        }
        if (event.key !== "Enter" && event.key !== "Tab") return false;
        event.preventDefault();
        return selectActive();
      },
    }),
  };
}

function useChatComposer({
  variant = "default",
  draftId,
  initialValue,
  editingMessageId,
  status,
  canStop,
  focusRequest = 0,
  initialEntities = EMPTY_INITIAL_ENTITIES,
  modelOptions,
  selectedModelId,
  selectedReasoningId,
  contextUsage,
  skills = EMPTY_SKILLS,
  searchEntities,
  attachmentAdapter,
  onSubmit,
  onModelChange,
  onReasoningChange,
  onEntityOpen,
  onAttachmentOpen,
  onCancelEdit,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [entities, setEntities] = useState<ChatComposerEntityReference[]>([]);
  const [attachments, setAttachments] = useState<ChatComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [activeEntityIndex, setActiveEntityIndex] = useState(0);
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useLatest(status !== "idle" || submitting);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionCommandRef = useRef<((attrs: MentionAttrs) => void) | null>(null);
  const skillCommandRef = useRef<((skill: ChatComposerSkill) => void) | null>(null);
  const mentionActiveRef = useRef(false);
  const skillActiveRef = useRef(false);
  const mentionKeyHandledRef = useRef(false);
  const sendRef = useRef<() => void>(() => undefined);
  const initializedDraftRef = useRef<{ ready: boolean; id?: string }>({ ready: false });
  const appliedInitialEntitiesRef = useRef<readonly ChatComposerEntityReference[] | null>(null);
  const attachmentControllerRef = useRef<AbortController | null>(null);
  const entitySearch = useEntitySearch(searchEntities, entities);
  const skillSearch = useSkillSearch(skills);
  const entitySearchRef = useLatest(entitySearch);
  const skillSearchRef = useLatest(skillSearch);
  const skillsRef = useLatest(skills);
  const activeEntityIndexRef = useLatest(activeEntityIndex);
  const activeSkillIndexRef = useLatest(activeSkillIndex);
  const onEntityOpenRef = useLatest(onEntityOpen);
  const initialValueRef = useLatest(initialValue);

  if (!entitySearch.open && activeEntityIndex !== 0) {
    setActiveEntityIndex(0);
  } else if (entitySearch.open) {
    const maxEntityIndex = Math.max(entitySearch.options.length - 1, 0);
    if (activeEntityIndex > maxEntityIndex) setActiveEntityIndex(maxEntityIndex);
  }
  if (!skillSearch.open && activeSkillIndex !== 0) {
    setActiveSkillIndex(0);
  } else if (skillSearch.open) {
    const maxSkillIndex = Math.max(skillSearch.options.length - 1, 0);
    if (activeSkillIndex > maxSkillIndex) setActiveSkillIndex(maxSkillIndex);
  }

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

  const mentionTrigger = createTriggerSuggestion<ChatComposerEntityOption, MentionAttrs>({
    activeRef: mentionActiveRef,
    commandRef: mentionCommandRef,
    searchRef: entitySearchRef,
    activeIndexRef: activeEntityIndexRef,
    setActiveIndex: setActiveEntityIndex,
    closeOther: () => skillSearchRef.current.close(),
    onArrowLeftRight: (step) => entitySearch.setType((prev) => nextEntityTypeFilter(prev, step)),
    wrapCommand: (command) => command,
    toCommandValue: (option) => ({ id: entityKey(option), label: option.label }),
    markKeyHandled: markMentionKeyHandled,
  });
  const skillTrigger = createTriggerSuggestion<ChatComposerSkill, ChatComposerSkill>({
    activeRef: skillActiveRef,
    commandRef: skillCommandRef,
    searchRef: skillSearchRef,
    activeIndexRef: activeSkillIndexRef,
    setActiveIndex: setActiveSkillIndex,
    closeOther: () => entitySearchRef.current.close(),
    wrapCommand: (command) => (skill) => command(skill as unknown as MentionAttrs),
    toCommandValue: (skill) => skill,
    markKeyHandled: markMentionKeyHandled,
  });

  const selectActiveSuggestion = () =>
    skillActiveRef.current || skillSearchRef.current.open
      ? skillTrigger.selectActive()
      : mentionTrigger.selectActive();

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
            const iconNode = entityIconDomNode(reference?.type ?? null, CHAT_ENTITY_ICON_FONT_SIZE);
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
              ...(iconNode ? [iconNode] : []),
              label,
            ];
          },
          suggestions: [
            {
              char: "@",
              allowSpaces: true,
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
              render: mentionTrigger.render,
            },
            {
              char: "$",
              items: () => [],
              allow: ({ state, range }) =>
                skillsRef.current.length > 0 &&
                isLeadingSkillTrigger(state.doc.textBetween(0, range.from, "\n")),
              command: ({ editor, range, props }) => {
                const skill = props as unknown as ChatComposerSkill;
                editor
                  .chain()
                  .focus()
                  .insertContentAt(range, { type: "text", text: `$${skill.name} ` })
                  .run();
              },
              render: skillTrigger.render,
            },
          ],
        }),
      ],
      content: createChatComposerDocument(""),
      editorProps: {
        attributes: {
          class:
            "max-h-64 min-h-24 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 pt-3 pb-2 text-sm leading-6 outline-none",
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
          if (
            mentionActiveRef.current ||
            entitySearchRef.current.open ||
            skillActiveRef.current ||
            skillSearchRef.current.open
          ) {
            event.preventDefault();
            selectActiveSuggestion();
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

  const setComposerValue = useMemoizedFn(
    (
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
      skillSearchRef.current.close();
    },
  );

  useLayoutEffect(() => {
    if (!editor) return;
    const initialized = initializedDraftRef.current;
    if (initialized.ready && initialized.id === draftId) return;
    initializedDraftRef.current = { ready: true, id: draftId };
    appliedInitialEntitiesRef.current = null;
    setComposerValue(initialValueRef.current);
    if (variant === "message-edit") editor.commands.focus("end");
  }, [draftId, editor, initialValueRef, setComposerValue, variant]);

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
  }, [attachments.length, editingMessageId, editor, initialEntities, setComposerValue, text]);

  useEffect(() => {
    if (focusRequest > 0) editor?.commands.focus();
  }, [editor, focusRequest]);

  useEffect(() => () => attachmentControllerRef.current?.abort(), []);

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
    // G2: 先为每个文件创建 uploading 占位（立即可见），adapter 完成后按顺序
    // 替换为 done；整批失败时批量标 error。清理上一批被 abort 的残留占位，
    // 保证顺序匹配安全。
    setAttachments((current) => current.filter((attachment) => attachment.status !== "uploading"));
    const placeholders: ChatComposerAttachment[] = incoming.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      size: file.size,
      status: "uploading",
    }));
    setAttachments((current) => [...current, ...placeholders].slice(0, MAX_ATTACHMENTS));
    setAttachmentError("");
    try {
      const added = await attachmentAdapter.addFiles(incoming, controller.signal);
      if (controller.signal.aborted) return;
      setAttachments((current) => {
        let index = 0;
        return current.map((attachment) => {
          if (attachment.status === "uploading" && index < added.length) {
            const done = added[index];
            index += 1;
            return { ...done, status: "done" };
          }
          return attachment;
        });
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "读取附件失败";
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.status === "uploading"
            ? { ...attachment, status: "error", error: message }
            : attachment,
        ),
      );
    }
  };

  const submit = useMemoizedFn(async () => {
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
  });
  useLayoutEffect(() => {
    sendRef.current = () => void submit();
  });

  const busy = status !== "idle" || submitting;
  const canSubmit =
    Boolean(
      text.trim() || attachments.some((attachment) => (attachment.status ?? "done") === "done"),
    ) && !attachments.some((attachment) => attachment.status === "uploading");
  const activeEntity = entitySearch.options[activeEntityIndex];
  const cancelEdit = () => {
    setComposerValue();
    onCancelEdit?.();
  };

  return {
    variant,
    editingMessageId,
    status,
    canStop,
    modelOptions,
    selectedModelId,
    selectedReasoningId,
    contextUsage,
    onModelChange,
    onReasoningChange,
    onAttachmentOpen,
    onStop,
    attachmentAdapter,
    text,
    entities,
    attachments,
    attachmentError,
    setAttachments,
    activeSkillIndex,
    entitySearch,
    skillSearch,
    skillTrigger,
    mentionTrigger,
    entitySearchRef,
    skillSearchRef,
    mentionActiveRef,
    skillActiveRef,
    onEntityOpenRef,
    fileInputRef,
    editor,
    addFiles,
    submit,
    busy,
    submitting,
    canSubmit,
    activeEntity,
    cancelEdit,
    selectedModel,
    selectedReasoning,
    showReasoningOptions,
    selectActiveSuggestion,
  };
}

export function ChatComposer(props: ChatComposerProps) {
  return <ComposerSurface {...useChatComposer(props)} />;
}

function ComposerToolbar(props: ReturnType<typeof useChatComposer>) {
  const {
    variant,
    busy,
    attachmentAdapter,
    attachments,
    fileInputRef,
    addFiles,
    modelOptions,
    selectedModelId,
    selectedModel,
    selectedReasoningId,
    selectedReasoning,
    showReasoningOptions,
    onModelChange,
    onReasoningChange,
    contextUsage,
    status,
    canStop,
    canSubmit,
    submitting,
    submit,
    onStop,
    cancelEdit,
  } = props;
  return (
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
          size="sm"
          variant="ghost"
          title="上传附件"
          disabled={busy || !attachmentAdapter || attachments.length >= MAX_ATTACHMENTS}
          className="pressable"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip />
        </Button>
        {variant !== "message-edit" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    data-testid="agent-model-menu-button"
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || modelOptions.length === 0}
                    className="min-w-0 max-w-60 shrink gap-1.5 px-2 pressable"
                  />
                }
              >
                <span className="truncate text-foreground">{selectedModel?.label ?? "Model"}</span>
                <ChevronDown size={16} className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-64">
                <DropdownMenuRadioGroup
                  value={selectedModelId}
                  onValueChange={(value) => onModelChange?.(value)}
                >
                  <DropdownMenuLabel>模型</DropdownMenuLabel>
                  {modelOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.id}
                      value={option.id}
                      closeOnClick
                      data-testid="agent-model-option"
                      data-model-id={option.modelId ?? option.id}
                      data-reasoning-levels={option.reasoningOptions
                        .map((reasoning) => reasoning.id)
                        .join(" ")}
                    >
                      <span className="truncate">{option.label}</span>
                      {option.providerLabel ? (
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {option.providerLabel}
                        </span>
                      ) : null}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedModel && showReasoningOptions ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      data-testid="agent-reasoning-menu-button"
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="min-w-0 gap-1.5 px-2 pressable"
                    />
                  }
                >
                  <Brain size={16} />
                  <span className="truncate text-foreground">
                    {selectedReasoning?.label ?? "Reasoning"}
                  </span>
                  <ChevronDown size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-44">
                  <DropdownMenuRadioGroup
                    value={selectedReasoningId}
                    onValueChange={(value) => onReasoningChange?.(value)}
                  >
                    <DropdownMenuLabel>Reasoning Effort</DropdownMenuLabel>
                    {selectedModel.reasoningOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        closeOnClick
                        data-testid="agent-reasoning-option"
                        data-reasoning-level={option.id}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
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
              className="pressable"
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
              className="pressable"
              onClick={() => void submit()}
            >
              <Send />
              发送
            </Button>
          </>
        ) : (
          <>
            {contextUsage ? <ContextUsageMeter usage={contextUsage} /> : null}
            <ComposerSendButton
              status={status}
              canStop={Boolean(canStop)}
              canSubmit={canSubmit}
              submitting={submitting}
              onSend={() => void submit()}
              onStop={onStop ?? (() => {})}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ComposerSurface(props: ReturnType<typeof useChatComposer>) {
  const {
    variant,
    editingMessageId,
    cancelEdit,
    text,
    entities,
    attachments,
    attachmentError,
    setAttachments,
    activeSkillIndex,
    entitySearch,
    skillSearch,
    skillTrigger,
    mentionTrigger,
    entitySearchRef,
    skillSearchRef,
    mentionActiveRef,
    skillActiveRef,
    onEntityOpenRef,
    editor,
    addFiles,
    busy,
    activeEntity,
    selectActiveSuggestion,
    onAttachmentOpen,
  } = props;

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
        {skillSearch.open ? (
          <ChatSkillPicker
            options={skillSearch.options}
            activeName={skillSearch.options[activeSkillIndex]?.name}
            onSelect={skillTrigger.run}
            onCancel={() => {
              skillActiveRef.current = false;
              skillSearchRef.current.close();
            }}
          />
        ) : entitySearch.open ? (
          <ChatContextPicker
            state={entitySearch.state}
            options={entitySearch.options}
            activeId={activeEntity ? entityKey(activeEntity) : undefined}
            activeType={entitySearch.type}
            onTypeChange={entitySearch.setType}
            onSelect={mentionTrigger.run}
            onCancel={() => {
              mentionActiveRef.current = false;
              entitySearchRef.current.close();
            }}
          />
        ) : null}
        {attachments.length ? (
          <AttachmentGroup className="max-w-full">
            {attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                onRemove={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
                onOpen={onAttachmentOpen}
              />
            ))}
          </AttachmentGroup>
        ) : null}
        {attachmentError ? (
          <div className="px-1 text-xs text-destructive">{attachmentError}</div>
        ) : null}
        <div
          className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors focus-within:border-ring ${
            editingMessageId ? "border-primary" : "border-border"
          }`}
        >
          <div className="relative min-w-0">
            {!text.trim() && entities.length === 0 && attachments.length === 0 ? (
              <span className="pointer-events-none absolute top-3 left-4 text-sm text-muted-foreground">
                {busy
                  ? "可以先整理下一轮想法，回复完成后发送..."
                  : "询问、比较，@ 引用内容，或 $ 使用 Skill..."}
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
                  !mentionActiveRef.current &&
                  !skillSearchRef.current.open &&
                  !skillActiveRef.current
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEdit();
                  return;
                }
                if (event.key !== "Enter" || event.shiftKey) return;
                if (
                  !entitySearchRef.current.open &&
                  !mentionActiveRef.current &&
                  !skillSearchRef.current.open &&
                  !skillActiveRef.current
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation();
                selectActiveSuggestion();
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
          <ComposerToolbar {...props} />
        </div>
      </div>
    </div>
  );
}
