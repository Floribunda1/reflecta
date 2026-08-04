import { useCallback, useMemo, useRef } from "react";
import { useRequest } from "ahooks";
import type { AiModelOption } from "@main/config";
import type {
  AgentComposerContentNode,
  AgentContextRef,
  AgentFileAttachment,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedMessage,
} from "@shared/agent";
import {
  ChatComposer,
  createChatComposerDocument,
  type ChatComposerAttachment,
  type ChatComposerAttachmentAdapter,
  type ChatComposerDocument,
  type ChatComposerEntityReference,
  type ChatComposerEntitySearch,
  type ChatComposerModelOption,
  type ChatComposerSubmit,
  type ChatComposerValue,
  type ChatComposerProps,
} from "@reflecta/ui/chat";
import { ipcClient } from "@renderer/utils/ipc";
import { buildContextCandidates, CONTEXT_LOOKUP_LIMIT } from "../context/context-candidates";
import {
  contextUsageFromMessages,
  contextUsageLabel,
  contextUsageMeterLabel,
  contextUsagePercent,
} from "../composer/context-usage";
import type { InspectableContextRef } from "../context/context-reference";

export type EditingMessage = {
  id: string;
  text: string;
  contextRefs: AgentContextRef[];
  files: AgentFileAttachment[];
  composerContent?: AgentComposerContentNode;
};

export type ComposerSendInput = {
  text: string;
  contextRefs: AgentContextRef[];
  files: AgentFileAttachment[];
  composerContent: ChatComposerDocument;
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
  messageId?: string;
};

type AgentChatComposerProps = {
  variant?: ChatComposerProps["variant"];
  threadId: string;
  isBusy: boolean;
  isCompacting?: boolean;
  canStop: boolean;
  editingMessage?: EditingMessage;
  focusRequest: number;
  initialContextKey?: string;
  initialContextRefs?: AgentContextRef[];
  modelOptions: AiModelOption[];
  activeModel: AgentModelSelection | null;
  activeReasoningLevel: AgentReasoningLevel;
  messages: AgentReducedMessage[];
  onSend: (input: ComposerSendInput) => Promise<void> | void;
  onSelectModel: (selection: AgentModelSelection) => void;
  onSelectReasoningLevel: (level: AgentReasoningLevel) => void;
  onCancelEdit?: () => void;
  onStop: () => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

const reasoningLabels: Record<AgentReasoningLevel, string> = {
  off: "关闭推理",
  minimal: "最低推理",
  low: "低推理",
  medium: "中推理",
  high: "高推理",
  xhigh: "超高推理",
  max: "最大推理",
};

function modelId(selection: Pick<AgentModelSelection, "providerId" | "modelId">) {
  return `${encodeURIComponent(selection.providerId)}:${encodeURIComponent(selection.modelId)}`;
}

function toEntity(reference: AgentContextRef): ChatComposerEntityReference {
  return {
    type: reference.type,
    id: reference.id,
    label: reference.title?.trim() || `${reference.type}:${reference.id}`,
  };
}

function attachmentMetadata(file: AgentFileAttachment) {
  const reflecta = file.providerMetadata?.reflecta;
  return reflecta && typeof reflecta === "object" ? (reflecta as Record<string, unknown>) : {};
}

function readFileAsDataUrl(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    reader.onload = () => {
      signal.removeEventListener("abort", abort);
      resolve(String(reader.result ?? ""));
    };
    reader.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(reader.error ?? new Error("读取附件失败"));
    };
    reader.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    reader.readAsDataURL(file);
  });
}

function useAttachmentAdapter() {
  const filesRef = useRef(new Map<string, AgentFileAttachment>());

  const toView = useCallback((file: AgentFileAttachment): ChatComposerAttachment => {
    const metadata = attachmentMetadata(file);
    const id =
      typeof metadata.attachmentId === "string" ? metadata.attachmentId : crypto.randomUUID();
    filesRef.current.set(id, file);
    return {
      id,
      name: file.filename || file.mediaType,
      mediaType: file.mediaType,
      size: typeof metadata.size === "number" ? metadata.size : undefined,
      previewUrl: file.mediaType.startsWith("image/") ? file.url : undefined,
    };
  }, []);

  const adapter = useMemo<ChatComposerAttachmentAdapter>(
    () => ({
      async addFiles(files, signal) {
        return Promise.all(
          files.map(async (file) => {
            const id = crypto.randomUUID();
            const attachment: AgentFileAttachment = {
              type: "file",
              mediaType: file.type || "application/octet-stream",
              filename: file.name,
              url: await readFileAsDataUrl(file, signal),
              providerMetadata: {
                reflecta: {
                  attachmentId: id,
                  size: file.size,
                },
              },
            };
            filesRef.current.set(id, attachment);
            return {
              id,
              name: file.name,
              mediaType: attachment.mediaType,
              size: file.size,
              previewUrl: attachment.mediaType.startsWith("image/") ? attachment.url : undefined,
            };
          }),
        );
      },
    }),
    [],
  );

  return {
    adapter,
    toView,
    resolve(attachments: readonly ChatComposerAttachment[]) {
      return attachments.flatMap((attachment) => {
        const file = filesRef.current.get(attachment.id);
        return file ? [file] : [];
      });
    },
  };
}

export function AgentChatComposer({
  variant,
  threadId,
  isBusy,
  isCompacting = false,
  canStop,
  editingMessage,
  focusRequest,
  initialContextKey,
  initialContextRefs = [],
  modelOptions,
  activeModel,
  activeReasoningLevel,
  messages,
  onSend,
  onSelectModel,
  onSelectReasoningLevel,
  onCancelEdit,
  onStop,
  onInspectContextRef,
}: AgentChatComposerProps) {
  const attachments = useAttachmentAdapter();
  const { data: skills } = useRequest(() => ipcClient.chat.listSkills());
  const uiModels = useMemo<ChatComposerModelOption[]>(
    () =>
      modelOptions.map((option) => ({
        id: modelId(option),
        modelId: option.modelId,
        label: option.modelName || option.modelId,
        providerLabel: option.providerName,
        reasoningOptions: option.supportedReasoningLevels.map((id) => ({
          id,
          label: reasoningLabels[id],
        })),
      })),
    [modelOptions],
  );
  const modelById = useMemo(
    () => new Map(modelOptions.map((option) => [modelId(option), option])),
    [modelOptions],
  );
  const initialEntities = useMemo(
    () => initialContextRefs.map(toEntity),
    [initialContextKey, initialContextRefs],
  );
  const initialValue = useMemo<ChatComposerValue | undefined>(() => {
    if (!editingMessage) return undefined;
    const entities = editingMessage.contextRefs.map(toEntity);
    const document =
      (editingMessage.composerContent as ChatComposerDocument | undefined) ??
      createChatComposerDocument(editingMessage.text, entities);
    return {
      text: editingMessage.text,
      document,
      entities,
      attachments: editingMessage.files.map(attachments.toView),
    };
  }, [attachments.toView, editingMessage?.id]);
  const usage = contextUsageFromMessages(messages, 0);
  const contextUsage = {
    percent: contextUsagePercent(usage),
    label: contextUsageMeterLabel(usage),
    description: contextUsageLabel(usage),
  };

  const searchEntities = useCallback<ChatComposerEntitySearch>(async (query, signal) => {
    const normalizedQuery = query.trim();
    const [understandings, contexts, domains] = await Promise.all([
      normalizedQuery
        ? ipcClient.search.searchUnderstandings(normalizedQuery, { limit: CONTEXT_LOOKUP_LIMIT })
        : ipcClient.understanding.listUnderstandings({ limit: CONTEXT_LOOKUP_LIMIT }),
      normalizedQuery
        ? ipcClient.search.searchContexts(normalizedQuery, { limit: CONTEXT_LOOKUP_LIMIT })
        : Promise.resolve([]),
      ipcClient.domain.listDomains(),
    ]);
    if (signal.aborted) return [];
    return buildContextCandidates({
      query: normalizedQuery,
      understandings,
      contexts,
      domains,
      selected: [],
    }).map((candidate) => ({
      type: candidate.type,
      id: candidate.id,
      label: candidate.title?.trim() || `${candidate.type}:${candidate.id}`,
      subtitle: candidate.subtitle,
    }));
  }, []);

  const submit = useCallback(
    async ({ value, modelId: selectedId, reasoningId, editingMessageId }: ChatComposerSubmit) => {
      const selectedModel = selectedId ? modelById.get(selectedId) : undefined;
      await onSend({
        text: value.text,
        contextRefs: value.entities.map((reference) => ({
          type: reference.type,
          id: reference.id,
          title: reference.label,
        })),
        files: attachments.resolve(value.attachments),
        composerContent: value.document,
        modelSelection: selectedModel
          ? { providerId: selectedModel.providerId, modelId: selectedModel.modelId }
          : undefined,
        reasoningLevel: reasoningId as AgentReasoningLevel | undefined,
        messageId: editingMessageId,
      });
    },
    [attachments, modelById, onSend],
  );

  return (
    <ChatComposer
      variant={variant}
      draftId={editingMessage ? `edit:${editingMessage.id}` : `thread:${threadId}`}
      initialValue={initialValue}
      editingMessageId={editingMessage?.id}
      status={isCompacting ? "compacting" : isBusy ? "running" : "idle"}
      canStop={canStop}
      focusRequest={focusRequest}
      initialEntities={initialEntities}
      modelOptions={uiModels}
      selectedModelId={activeModel ? modelId(activeModel) : undefined}
      selectedReasoningId={activeReasoningLevel}
      contextUsage={contextUsage}
      skills={skills}
      searchEntities={searchEntities}
      attachmentAdapter={attachments.adapter}
      onSubmit={submit}
      onModelChange={(id) => {
        const option = modelById.get(id);
        if (option) onSelectModel({ providerId: option.providerId, modelId: option.modelId });
      }}
      onReasoningChange={(id) => onSelectReasoningLevel(id as AgentReasoningLevel)}
      onEntityOpen={(reference) => {
        if (reference.type === "domain") return;
        onInspectContextRef?.({
          type: reference.type,
          id: reference.id,
          title: reference.label,
        });
      }}
      onCancelEdit={onCancelEdit}
      onStop={onStop}
    />
  );
}
