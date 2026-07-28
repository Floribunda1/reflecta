import { useMemo } from "react";
import { format } from "date-fns";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChatMessageRow,
  getChatComposerEntities,
  type AgentMessageBlockView,
  type AgentProposalLifecycle,
  type AgentProposalView,
  type AgentToolDetailsView,
  type ChatAssistantMessageView,
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
  buildAgentTurnView,
  type AgentTurnBlock,
  type ProposalView,
  type ToolActivityDetailsView,
} from "../messages/agent-turn-view";
import { useChatEntityBindings } from "./chat-entity-adapter";

type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

export type ApproveToolInput = {
  messageId: string;
  toolCallId: string;
  approvalId: string;
  approved: boolean;
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
};

type MessageAdapterPresentation = {
  entityLabels: ReadonlyMap<string, string>;
  domainPath: (id: string) => string;
};

type MessageAdapterOptions = {
  assistantRunning: boolean;
  stopped: boolean;
  presentation: MessageAdapterPresentation;
};

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

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
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

function toToolDetails(
  details: ToolActivityDetailsView | undefined,
  ownerId: string,
): AgentToolDetailsView | undefined {
  if (!details) return undefined;
  return {
    ...(details.meta.length ? { meta: details.meta } : {}),
    ...(details.rows.length
      ? {
          rows: details.rows.map((row, index) => {
            const format = row.format ?? "text";
            const content = row.description
              ? format === "text"
                ? { format: "text" as const, value: row.description }
                : {
                    format,
                    preview: row.description,
                    ...(row.fullDescription ? { full: row.fullDescription } : {}),
                  }
              : undefined;
            return {
              id: `${ownerId}:row:${index}`,
              label: row.label,
              title: row.title,
              ...(content ? { content } : {}),
              ...(row.meta.length ? { meta: row.meta } : {}),
            };
          }),
        }
      : {}),
    ...(details.emptyText ? { emptyText: details.emptyText } : {}),
  };
}

function lifecycleFor(block: ApprovalBlock): AgentProposalLifecycle {
  if (block.preview) return "preview";
  if (block.displayState === "pending_approval") return "pending";
  if (block.displayState === "running") return "running";
  if (block.displayState === "completed") return "completed";
  if (block.displayState === "rejected") return "rejected";
  if (block.displayState === "failed") return "failed";
  return "preview";
}

function proposalNote(proposal: ProposalView, lifecycle: AgentProposalLifecycle) {
  if (lifecycle === "completed" && proposal.resultRefType && proposal.resultRefId) {
    return `已写入 ${proposal.resultRefType} · ${proposal.resultRefId}`;
  }
  if (lifecycle === "rejected") {
    return proposal.type === "bash" ? "已拒绝，命令未执行" : "已拒绝，未写入知识库";
  }
  return undefined;
}

function mediumLabel(value: string | undefined) {
  if (value === "experience") return "实践";
  if (value === "video") return "视频";
  if (value === "book") return "书籍";
  if (value === "article") return "文章";
  if (value === "opinion") return "观点";
  if (value === "ai") return "AI 对话";
  if (value === "other") return "其他";
  return value;
}

function proposalBase(proposal: ProposalView, raw: ApprovalBlock) {
  const lifecycle = lifecycleFor(raw);
  return {
    id: raw.approvalId || raw.toolCallId,
    title: raw.title || proposal.title,
    lifecycle,
    ...(proposalNote(proposal, lifecycle) ? { note: proposalNote(proposal, lifecycle) } : {}),
    ...(raw.error ? { error: raw.error } : {}),
    ...(proposal.result
      ? { result: toToolDetails(proposal.result, raw.approvalId || raw.toolCallId) }
      : {}),
    ...(lifecycle === "pending" ? { decisionEnabled: true } : {}),
  };
}

function entityLabel(
  type: "understanding" | "context",
  id: string | undefined,
  presentation: MessageAdapterPresentation,
) {
  if (!id) return undefined;
  return presentation.entityLabels.get(`${type}:${id}`) ?? id;
}

function domainPath(
  value: unknown,
  presentation: MessageAdapterPresentation,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value ? presentation.domainPath(value) : null;
}

function toProposal(
  proposal: ProposalView,
  raw: ApprovalBlock,
  presentation: MessageAdapterPresentation,
): AgentProposalView {
  const input = isRecord(raw.payload) ? raw.payload : {};
  const base = proposalBase(proposal, raw);

  if (raw.toolName === "understanding_create") {
    const domainIds = optionalStringArray(input.domainIds);
    return {
      ...base,
      kind: "understanding-create",
      content: {
        heading: optionalString(input.title) ?? undefined,
        body: optionalString(input.body),
        ...(domainIds ? { domainPaths: domainIds.map(presentation.domainPath) } : {}),
      },
    };
  }
  if (raw.toolName === "understanding_update") {
    const before = isRecord(input.before) ? input.before : {};
    const after = isRecord(input.after) ? input.after : input;
    const id = optionalString(input.understandingId);
    const domainIds = optionalStringArray(after.domainIds) ?? optionalStringArray(input.domainIds);
    return {
      ...base,
      kind: "understanding-update",
      content: {
        targetLabel: entityLabel("understanding", id, presentation),
        beforeHeading: optionalString(before.title),
        afterHeading: optionalString(after.title),
        beforeBody: optionalString(before.body),
        afterBody: optionalString(after.body),
        ...(domainIds ? { domainPaths: domainIds.map(presentation.domainPath) } : {}),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "understanding_delete") {
    const id = optionalString(input.understandingId);
    return {
      ...base,
      kind: "understanding-delete",
      content: {
        targetLabel: entityLabel("understanding", id, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_create") {
    return {
      ...base,
      kind: "domain-create",
      content: {
        name: optionalString(input.name),
        parentPath: domainPath(input.parentId, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_update") {
    const id = optionalString(input.domainId);
    return {
      ...base,
      kind: "domain-update",
      content: {
        targetPath: id ? presentation.domainPath(id) : undefined,
        nextName: optionalString(input.name),
        nextParentPath: domainPath(input.parentId, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_delete") {
    const id = optionalString(input.domainId);
    return {
      ...base,
      kind: "domain-delete",
      content: {
        targetPath: id ? presentation.domainPath(id) : undefined,
        deleteUnderstandings:
          typeof input.deleteUnderstandings === "boolean" ? input.deleteUnderstandings : undefined,
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "context_create") {
    const understandingId = optionalString(input.understandingId);
    return {
      ...base,
      kind: "context-create",
      content: {
        understandingLabel: entityLabel("understanding", understandingId, presentation),
        mediumLabel: mediumLabel(optionalString(input.medium)),
        contextLabel: optionalString(input.title),
        body: optionalString(input.content),
      },
    };
  }
  if (raw.toolName === "context_update") {
    const contextId = optionalString(input.contextId);
    const understandingId = optionalString(input.understandingId);
    return {
      ...base,
      kind: "context-update",
      content: {
        targetLabel: entityLabel("context", contextId, presentation),
        understandingLabel: entityLabel("understanding", understandingId, presentation),
        mediumLabel: mediumLabel(optionalString(input.medium)),
        nextTitle: optionalString(input.title),
        nextBody: optionalString(input.content),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "context_delete") {
    const id = optionalString(input.contextId);
    return {
      ...base,
      kind: "context-delete",
      content: {
        targetLabel: entityLabel("context", id, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "bash") {
    return {
      ...base,
      kind: "bash",
      content: {
        command: optionalString(input.command),
        cwd: optionalString(input.cwd),
        timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
      },
    };
  }
  return {
    ...base,
    kind: "unknown",
    content: {
      fields: Object.entries(input)
        .filter(([key, value]) => key !== "proposalType" && value !== undefined)
        .map(([key, value]) => ({
          id: `${raw.approvalId}:${key}`,
          label: key,
          value: {
            format: key === "body" || key === "content" ? ("markdown" as const) : ("text" as const),
            value:
              value === null
                ? "null"
                : Array.isArray(value)
                  ? value.join(", ")
                  : isRecord(value)
                    ? JSON.stringify(value)
                    : String(value),
          },
        })),
    },
  };
}

function approvalMap(blocks: readonly AgentReducedAssistantBlock[]) {
  return new Map(
    blocks.flatMap((block) =>
      block.kind === "approval" ? [[block.toolCallId, block] as const] : [],
    ),
  );
}

function toMessageBlocks(
  messageId: string,
  turnBlocks: readonly AgentTurnBlock[],
  rawBlocks: readonly AgentReducedAssistantBlock[],
  presentation: MessageAdapterPresentation,
): AgentMessageBlockView[] {
  const approvals = approvalMap(rawBlocks);
  const result: AgentMessageBlockView[] = [];
  let textIndex = 0;
  let reasoningIndex = 0;

  for (const block of turnBlocks) {
    if (block.kind === "text") {
      const id = `${messageId}:text:${textIndex}`;
      textIndex += 1;
      if (!block.text && !block.error) continue;
      result.push({
        kind: "text",
        id,
        markdown: block.text,
        status: block.state ?? "done",
        ...(block.error ? { error: block.error } : {}),
      });
      continue;
    }
    if (block.kind === "reasoning") {
      const id = `${messageId}:reasoning:${reasoningIndex}`;
      reasoningIndex += 1;
      result.push({
        kind: "reasoning",
        reasoning: {
          id,
          status: block.reasoning.status,
          markdown: block.reasoning.text,
        },
      });
      continue;
    }
    if (block.kind === "context-compaction") {
      result.push({
        kind: "context-compaction",
        compaction: {
          id: block.compaction.id,
          summary: block.compaction.summary,
          tokensBefore: block.compaction.tokensBefore,
          estimatedTokensAfter: block.compaction.estimatedTokensAfter,
        },
      });
      continue;
    }
    if (block.kind === "tool-activity") {
      const id = block.activity.items[0]?.toolCallId ?? `${messageId}:tool`;
      result.push({
        kind: "tool-activity",
        activity: {
          id,
          status: block.activity.status,
          summary: block.activity.summary,
          items: block.activity.items.map((item) => ({
            id: item.toolCallId,
            label: item.label,
            ...(item.details ? { details: toToolDetails(item.details, item.toolCallId) } : {}),
            ...(item.errorText ? { error: item.errorText } : {}),
          })),
        },
      });
      continue;
    }
    const raw = approvals.get(block.proposal.toolCallId);
    if (!raw) continue;
    result.push({
      kind: "proposal",
      proposal: toProposal(block.proposal, raw, presentation),
    });
  }
  return result;
}

export function toChatMessageView(
  message: AgentReducedMessage,
  options: MessageAdapterOptions,
): ChatMessageView {
  if (message.role === "user") return toUserMessage(message);
  const rawBlocks = message.blocks ?? [];
  const turn = buildAgentTurnView(rawBlocks, options.assistantRunning);
  const blocks = toMessageBlocks(message.id, turn.blocks, rawBlocks, options.presentation);
  const status: ChatAssistantMessageView["status"] = options.stopped
    ? "stopped"
    : options.assistantRunning
      ? "streaming"
      : "done";
  return { kind: "assistant", id: message.id, status, blocks };
}

function markdownValues(message: ChatMessageView) {
  if (message.kind === "user") return message.text ? [message.text] : [];
  const values: string[] = [];
  const addDetails = (details: AgentToolDetailsView | undefined) => {
    details?.rows?.forEach((row) => {
      if (row.content?.format === "markdown") {
        values.push(row.content.preview);
        if (row.content.full) values.push(row.content.full);
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

  return useMemo<MessageAdapterPresentation>(
    () => ({
      entityLabels,
      domainPath: (id) => getDomainPath(id, domains, " / "),
    }),
    [domains, entityLabels],
  );
}

export function ConnectedChatMessageRow({
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
        onApproveTool({
          messageId: message.id,
          toolCallId: block.toolCallId,
          approvalId: block.approvalId,
          approved: decision.decision === "approve",
        });
      }}
    />
  );
}
