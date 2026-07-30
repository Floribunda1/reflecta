import { memo, useMemo } from "react";
import { format } from "date-fns";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChatMessageRow,
  getChatComposerEntities,
  type AgentToolDetailsView,
  type ChatComposerDocument,
  type ChatEntityReference,
  type ChatMessageAction,
  type ChatMessageAttachmentView,
  type ChatMessageEntityView,
  type ChatMessageRowView,
  type ChatMessageView,
  type ChatUserMessageView,
} from "@reflecta/ui/chat";
import type {
  AgentContextRef,
  AgentEntityCatalogEntry,
  AgentFileAttachment,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedAssistantBlock,
  AgentReducedMessage,
} from "@shared/agent";
import { captureQueryKeys, getEntityDisplay, useCaptureDomains } from "../../capture/queries";
import { getDomainPath } from "../../capture/domain/util";
import type { InspectableContextRef } from "../context/context-reference";
import {
  toAgentAssistantMessageView,
  type AgentMessageViewOptions,
  type AgentViewPresentation,
} from "../messages/agent-turn-view";
import { useChatEntityBindings } from "./chat-entity-adapter";

type ApproveToolInputBase = {
  messageId: string;
  toolCallId: string;
  approvalId: string;
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
};

export type ApproveToolInput = ApproveToolInputBase &
  ({ approved: true } | { approved: false; rejectionReason?: string });

type MessageAdapterOptions = AgentMessageViewOptions;

type ConnectedChatMessageRowProps = {
  message: AgentReducedMessage;
  entityCatalog: AgentEntityCatalogEntry[];
  isBusy: boolean;
  isLastAssistant: boolean;
  highlighted: boolean;
  findQuery?: string;
  stopped: boolean;
  onEdit: (message: AgentReducedMessage) => void;
  onRegenerate: (messageId: string) => void;
  onForkAssistant?: (messageId: string) => void;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

function referenceKey(reference: Pick<ChatEntityReference, "type" | "id">) {
  return `${reference.type}:${reference.id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function messageTimeLabel(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? undefined : format(date, "M月d日 HH:mm:ss");
}

function attachmentId(file: AgentFileAttachment, messageId: string, index: number) {
  const reflecta = file.providerMetadata?.reflecta;
  if (reflecta && typeof reflecta === "object" && "attachmentId" in reflecta) {
    const id = reflecta.attachmentId;
    if (typeof id === "string") return id;
  }
  return `${messageId}:attachment:${index}`;
}

function toAttachment(
  file: AgentFileAttachment,
  messageId: string,
  index: number,
): ChatMessageAttachmentView {
  return {
    id: attachmentId(file, messageId, index),
    name: file.filename || file.mediaType,
    mediaType: file.mediaType,
    ...(file.mediaType.startsWith("image/") ? { previewUrl: file.url } : {}),
  };
}

function documentTextWithoutMentions(node: ChatComposerDocument): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") return "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? [])
    .map(documentTextWithoutMentions)
    .join(node.type === "doc" ? "\n" : "")
    .trim();
}

function toEntity(reference: AgentContextRef): ChatMessageEntityView {
  return {
    id: reference.id,
    type: reference.type,
    label: reference.title?.trim() || `${reference.type}:${reference.id}`,
  };
}

function toUserMessage(message: AgentReducedMessage): ChatUserMessageView {
  const document = message.composerContent as ChatComposerDocument | undefined;
  const documentEntities = document ? getChatComposerEntities(document) : [];
  const entities = documentEntities.length
    ? documentEntities.map((reference) => ({
        id: reference.id,
        type: reference.type,
        label: reference.label,
      }))
    : (message.contextRefs ?? []).map(toEntity);
  const text = document ? documentTextWithoutMentions(document) : message.text;
  return {
    kind: "user",
    id: message.id,
    ...(text ? { text } : {}),
    ...(entities.length ? { entities } : {}),
    ...(message.files?.length
      ? {
          attachments: message.files.map((file, index) => toAttachment(file, message.id, index)),
        }
      : {}),
  };
}

export function toChatMessageView(
  message: AgentReducedMessage,
  options: MessageAdapterOptions,
): ChatMessageView {
  if (message.role === "user") return toUserMessage(message);
  return toAgentAssistantMessageView(message, options);
}

function markdownValues(message: ChatMessageView) {
  if (message.kind === "user") return message.text ? [message.text] : [];
  const values: string[] = [];
  const addDetails = (details: AgentToolDetailsView | undefined) => {
    details?.rows?.forEach((row) => {
      if (row.content?.format === "markdown") {
        values.push(row.content.value);
      }
    });
  };
  for (const block of message.blocks) {
    if (block.kind === "text") values.push(block.markdown);
    else if (block.kind === "reasoning") values.push(block.reasoning.markdown);
    else if (block.kind === "tool-activity")
      block.activity.items.forEach((item) => addDetails(item.details));
    else if (block.kind === "proposal") {
      const content = block.proposal.content;
      if ("body" in content && content.body) values.push(content.body);
      if ("beforeBody" in content && content.beforeBody) values.push(content.beforeBody);
      if ("afterBody" in content && content.afterBody) values.push(content.afterBody);
      if ("nextBody" in content && content.nextBody) values.push(content.nextBody);
      if ("fields" in content)
        content.fields.forEach((field) => {
          if (field.value.format === "markdown") values.push(field.value.value);
        });
      addDetails(block.proposal.result);
    }
  }
  return values;
}

function proposalEntityReferences(blocks: readonly AgentReducedAssistantBlock[]) {
  const references = new Map<string, ChatEntityReference>();
  for (const block of blocks) {
    if (block.kind !== "approval" || !isRecord(block.payload)) continue;
    const input = block.payload;
    const add = (type: "understanding" | "context", id: unknown) => {
      if (typeof id !== "string" || !id) return;
      const reference = { type, id } as const;
      references.set(referenceKey(reference), reference);
    };
    if (block.toolName.startsWith("understanding_")) {
      add("understanding", input.understandingId);
    }
    if (block.toolName === "context_create" || block.toolName === "context_update") {
      add("understanding", input.understandingId);
    }
    if (block.toolName === "context_update" || block.toolName === "context_delete") {
      add("context", input.contextId);
    }
  }
  return [...references.values()];
}

function useMessagePresentation(
  blocks: readonly AgentReducedAssistantBlock[],
  entityCatalog: readonly AgentEntityCatalogEntry[],
) {
  const needsDomainPaths = blocks.some(
    (block) =>
      block.kind === "approval" &&
      (block.toolName.startsWith("domain_") ||
        block.toolName === "understanding_create" ||
        block.toolName === "understanding_update"),
  );
  const { domains } = useCaptureDomains(needsDomainPaths);
  const catalogLabels = useMemo(
    () =>
      new Map(
        entityCatalog.map(({ entity }) => [
          referenceKey(entity),
          entity.title?.trim() || `${entity.type}:${entity.id}`,
        ]),
      ),
    [entityCatalog],
  );
  const references = useMemo(() => proposalEntityReferences(blocks), [blocks]);
  const queries = useQueries({
    queries: references.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
      enabled: !catalogLabels.has(referenceKey(reference)),
    })),
  });
  const entityLabels = new Map(catalogLabels);
  references.forEach((reference, index) => {
    const title = queries[index]?.data?.title?.trim();
    if (title) entityLabels.set(referenceKey(reference), title);
  });

  return useMemo<AgentViewPresentation>(
    () => ({
      entityLabels,
      domainPath: (id) => getDomainPath(id, domains, " / "),
    }),
    [domains, entityLabels],
  );
}

export const ConnectedChatMessageRow = memo(function ConnectedChatMessageRow({
  message,
  entityCatalog,
  isBusy,
  isLastAssistant,
  highlighted,
  findQuery,
  stopped,
  onEdit,
  onRegenerate,
  onForkAssistant,
  onApproveTool,
  onInspectContextRef,
}: ConnectedChatMessageRowProps) {
  const rawBlocks = message.blocks ?? [];
  const presentation = useMessagePresentation(rawBlocks, entityCatalog);
  const view = useMemo(
    () =>
      toChatMessageView(message, {
        assistantRunning: isBusy && isLastAssistant,
        stopped,
        presentation,
      }),
    [isBusy, isLastAssistant, message, presentation, stopped],
  );
  const values = useMemo(() => markdownValues(view), [view]);
  const entityBindings = useChatEntityBindings(values, onInspectContextRef);
  const enabledActions = [
    "copy" as const,
    ...(message.role === "user" ? (["edit"] as const) : []),
    ...(message.role === "assistant" && onForkAssistant ? (["fork"] as const) : []),
    ...(isLastAssistant ? (["regenerate"] as const) : []),
  ];
  const row: ChatMessageRowView = {
    message: view,
    timestampLabel: messageTimeLabel(message.createdAt),
    highlighted,
    enabledActions,
    actionsDisabled: isBusy,
  };
  const handleAction = async (action: ChatMessageAction) => {
    if (action.type === "edit") return onEdit(message);
    if (action.type === "fork") return onForkAssistant?.(message.id);
    if (action.type === "regenerate") return onRegenerate(message.id);
    try {
      if (!navigator.clipboard) throw new Error("当前环境不支持剪贴板");
      await navigator.clipboard.writeText(message.text);
      toast.success("已复制消息");
    } catch (error) {
      toast.error("复制失败", { description: errorMessage(error) });
    }
  };
  const approvalById = new Map(
    rawBlocks.flatMap((block) =>
      block.kind === "approval" ? [[block.approvalId, block] as const] : [],
    ),
  );

  return (
    <ChatMessageRow
      row={row}
      search={findQuery?.trim() ? { query: findQuery } : undefined}
      entityBindings={entityBindings}
      onAction={(action) => void handleAction(action)}
      onEntityOpen={(entity) => {
        if (entity.type === "domain") return;
        onInspectContextRef?.({
          type: entity.type,
          id: entity.id,
          title: entity.label,
        });
      }}
      onProposalDecision={(decision) => {
        const block = approvalById.get(decision.proposalId);
        if (!block) return;
        onApproveTool(
          decision.decision === "approve"
            ? {
                messageId: message.id,
                toolCallId: block.toolCallId,
                approvalId: block.approvalId,
                approved: true,
              }
            : {
                messageId: message.id,
                toolCallId: block.toolCallId,
                approvalId: block.approvalId,
                approved: false,
                ...(decision.reason ? { rejectionReason: decision.reason } : {}),
              },
        );
      }}
    />
  );
});
