import { type ReactNode, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Streamdown } from "streamdown";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Spinner } from "@renderer/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@renderer/components/ui/collapsible";
import type {
  AgentEntitySource,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedMessage,
} from "@shared/agent";
import { referenceMarkdownToLinks, type InspectableContextRef } from "../context/context-reference";
import { findChatTextRanges } from "../session/chat-find";
import {
  type AgentReasoningView,
  type AgentTurnView,
  type BashProposalView,
  type ContextProposalView,
  type GenericProposalView,
  type ProposalView,
  type UnderstandingProposalView,
  type UnderstandingUpdateProposalView,
  type ToolActivityView,
  type ToolActivityDetailsView,
  type ToolActivityDetailRow,
  type ToolApprovalStatus,
} from "./agent-turn-view";
import { wikiMarkdownComponents, wikiUrlTransform } from "../context/wiki-link";
import { captureQueryKeys, useCaptureDomains } from "../../capture/queries";
import { getDomainPath } from "../../capture/domain/util";
import { ipcClient } from "@renderer/utils/ipc";
import {
  createChatFindRehypePlugin,
  renderTextWithChatFindHighlights,
  type ChatFindRenderState,
} from "./chat-find-highlight";
import "../styles/markdown-theme.scss";

export type ApproveToolInput = {
  messageId: string;
  toolCallId: string;
  approvalId: string;
  approved: boolean;
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
};

function statusLabel(status: ToolApprovalStatus | undefined, state?: ProposalView["state"]) {
  if (state === "output-error") return "执行失败";
  if (state === "output-denied") return "已拒绝";
  if (state === "output-available") return "完成";
  if (status === "approved") return "已确认";
  if (status === "rejected") return "已拒绝";
  if (status === "pending") return "待确认";
  if (state === "approval-responded") return "已响应";
  if (state === "approval-requested") return "待确认";
  if (state === "input-streaming") return "运行中";
  return "等待中";
}

function MarkdownBody({
  value,
  className = "",
  onInspectContextRef,
  entitySources = [],
  findState,
}: {
  value: string;
  className?: string;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources?: AgentEntitySource[];
  findState?: ChatFindRenderState;
}) {
  const markdownValue = referenceMarkdownToLinks(value);
  const findKey = findState ? findState.query : "plain";

  return (
    <div className={["reflecta-chat-markdown", className].filter(Boolean).join(" ")}>
      <Streamdown
        key={findKey}
        components={wikiMarkdownComponents(
          onInspectContextRef,
          entitySources,
          findState
            ? (label, _href, node) => {
                const startIndex = chatFindMarkdownLabelStartIndex(
                  markdownValue,
                  findState.query,
                  node,
                );
                if (startIndex === null) return label;
                return renderTextWithChatFindHighlights(
                  label,
                  {
                    messageId: findState.messageId,
                    query: findState.query,
                    nextMatchIndex: startIndex,
                  },
                  `wiki-${findState.messageId}-${startIndex}`,
                );
              }
            : undefined,
        )}
        rehypePlugins={findState ? [createChatFindRehypePlugin(findState)] : undefined}
        urlTransform={wikiUrlTransform}
      >
        {markdownValue}
      </Streamdown>
    </div>
  );
}

function chatFindMarkdownLabelStartIndex(markdownValue: string, query: string, node: unknown) {
  const position =
    typeof node === "object" && node && "position" in node
      ? (node.position as { start?: { offset?: unknown } })
      : undefined;
  const linkStartOffset = position?.start?.offset;
  if (typeof linkStartOffset !== "number") return null;
  return findChatTextRanges(markdownValue.slice(0, linkStartOffset + 1), query).length;
}

function hasToolDetails(details: ToolActivityDetailsView) {
  return details.meta.length > 0 || details.rows.length > 0 || Boolean(details.emptyText);
}

function ToolDetailDescription({
  detail,
  onInspectContextRef,
  entitySources,
}: {
  detail: ToolActivityDetailRow;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (!detail.description) return null;
  if (detail.format === "markdown") {
    const value = expanded && detail.fullDescription ? detail.fullDescription : detail.description;
    return (
      <div className="grid gap-1">
        <div
          className={`text-muted-foreground/85 ${
            detail.fullDescription
              ? expanded
                ? "max-h-80 overflow-auto"
                : "max-h-32 overflow-hidden"
              : ""
          }`}
        >
          <MarkdownBody
            value={value}
            className="!text-muted-foreground/85 [&_*]:!text-muted-foreground/85"
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        </div>
        {detail.fullDescription ? (
          <button
            type="button"
            className="w-fit rounded-sm px-1 text-xs text-muted-foreground hover:bg-background/70 hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "收起内容" : "展开完整内容"}
          </button>
        ) : null}
      </div>
    );
  }
  if (detail.format !== "pre") {
    return <div className="line-clamp-2 text-muted-foreground/85">{detail.description}</div>;
  }

  const outputClass =
    "whitespace-pre-wrap break-words rounded-sm bg-background/65 px-2 py-1.5 font-mono text-xs leading-5 text-muted-foreground";

  return (
    <div className="grid gap-1">
      {detail.fullDescription ? (
        <>
          <pre
            className={`${outputClass} ${
              expanded ? "max-h-80 overflow-auto" : "max-h-32 overflow-hidden"
            }`}
          >
            {expanded ? detail.fullDescription : detail.description}
          </pre>
          <button
            type="button"
            className="w-fit rounded-sm px-1 text-xs text-muted-foreground hover:bg-background/70 hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "收起输出" : "展开完整输出"}
          </button>
        </>
      ) : (
        <pre className={`${outputClass} max-h-32 overflow-auto`}>{detail.description}</pre>
      )}
    </div>
  );
}

function ToolDetailRows({
  details,
  onInspectContextRef,
  entitySources = [],
}: {
  details: ToolActivityDetailsView;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources?: AgentEntitySource[];
}) {
  return (
    <div className="grid gap-2">
      {details.meta.length ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
          {details.meta.map((detail, index) => (
            <span key={`${detail.label}-${detail.value}-${index}`} className="min-w-0">
              <span>{detail.label}：</span>
              <span className="break-words">{detail.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {details.rows.length ? (
        <ul className="grid gap-1">
          {details.rows.map((detail, index) => {
            return (
              <li
                key={`${detail.label}-${detail.title}-${index}`}
                className="grid gap-0.5 rounded-sm px-1 py-1 hover:bg-background/45"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-xs text-muted-foreground">{detail.label}</span>
                  <span className="min-w-0 break-words font-medium text-foreground/75">
                    {detail.title}
                  </span>
                </div>
                <ToolDetailDescription
                  detail={detail}
                  onInspectContextRef={onInspectContextRef}
                  entitySources={entitySources}
                />
                {detail.meta.length ? (
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground/80">
                    {detail.meta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {details.emptyText ? (
        <div className="break-words px-1 py-1 text-muted-foreground">{details.emptyText}</div>
      ) : null}
    </div>
  );
}

function ToolActivityGroup({
  activity,
  defaultOpen = false,
  onInspectContextRef,
  entitySources,
}: {
  activity: ToolActivityView;
  defaultOpen?: boolean;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  const statusClass =
    activity.status === "failed"
      ? "bg-destructive/10 text-destructive"
      : "bg-background/70 text-muted-foreground";

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      data-testid="agent-tool-activity"
      className="my-1 w-full rounded-md border-l-2 border-border/80 bg-muted/30 py-1.5 pl-3 pr-2 text-sm text-muted-foreground"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-muted/55">
        <span className="min-w-0 truncate">{activity.summary}</span>
        <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] leading-4 ${statusClass}`}>
          {activity.statusLabel}
        </span>
        <ChevronDown className="size-3 shrink-0 -rotate-90 text-muted-foreground opacity-0 transition group-data-[panel-open]:rotate-0 group-data-[panel-open]:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 px-1 pb-1 text-muted-foreground">
        <div className="grid gap-2">
          {activity.items.map((item) => (
            <div key={item.toolCallId} className="grid gap-1">
              {activity.items.length > 1 ? (
                <div className="px-1 text-xs font-medium text-foreground/70">{item.label}</div>
              ) : null}
              {hasToolDetails(item.details) ? (
                <ToolDetailRows
                  details={item.details}
                  onInspectContextRef={onInspectContextRef}
                  entitySources={entitySources}
                />
              ) : null}
              {item.errorText ? (
                <div className="px-1 text-destructive">{item.errorText}</div>
              ) : null}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningBlock({
  reasoning,
  onInspectContextRef,
  entitySources,
}: {
  reasoning: AgentReasoningView;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  const streaming = reasoning.status === "streaming";

  return (
    <Collapsible
      data-slot="agent-reasoning"
      data-testid="agent-reasoning"
      className="my-1 w-full rounded-md border-l-2 border-border/80 bg-muted/30 py-1.5 pl-3 pr-2 text-sm text-muted-foreground"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-muted/55">
        {streaming ? <Spinner className="size-3 shrink-0" /> : null}
        <span>{streaming ? "正在思考" : "思考过程"}</span>
        <ChevronDown className="size-3 shrink-0 -rotate-90 text-muted-foreground opacity-0 transition group-data-[panel-open]:rotate-0 group-data-[panel-open]:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 px-1 pb-1 text-muted-foreground">
        {reasoning.text ? (
          <MarkdownBody
            value={reasoning.text}
            className="!text-muted-foreground [&_*]:!text-muted-foreground"
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        ) : (
          <span>等待模型输出思考内容</span>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RunningResponsePlaceholder() {
  return (
    <div
      data-testid="agent-running-placeholder"
      className="flex max-w-full items-center gap-2 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs text-muted-foreground"
    >
      <Spinner className="size-3 shrink-0" />
      <span>正在思考</span>
    </div>
  );
}

function CandidateShell({
  title,
  proposal,
  children,
  onApprove,
  messageId,
  onInspectContextRef,
  entitySources,
}: {
  title: string;
  proposal: ProposalView;
  children: ReactNode;
  onApprove: (input: ApproveToolInput) => void;
  messageId: string;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  const status = proposal.status;
  const resultRefType = proposal.resultRefType;
  const resultRef = proposal.resultRef || proposal.resultRefId;
  const statusNote = proposalStatusNote(status, proposal.state, resultRefType, resultRef);
  return (
    <div
      data-testid="agent-proposal-card"
      data-proposal-title={title}
      data-proposal-state={proposal.state}
      className="w-full rounded-lg border border-border/70 bg-card px-3 py-3 text-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <Badge
          variant={
            status === "rejected" || proposal.state === "output-error" ? "destructive" : "outline"
          }
        >
          {statusLabel(status, proposal.state)}
        </Badge>
      </div>
      {children}
      {proposal.result && hasToolDetails(proposal.result) ? (
        <div className="mt-3 rounded-md bg-muted/35 p-2 text-sm text-muted-foreground">
          <div className="mb-1 px-1 text-xs font-medium text-foreground/70">执行结果</div>
          <ToolDetailRows
            details={proposal.result}
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        </div>
      ) : null}
      {proposal.state === "output-error" && (
        <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {proposal.errorText}
        </div>
      )}
      {statusNote ? <div className="mt-2 text-xs text-muted-foreground">{statusNote}</div> : null}
      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <Button
            data-testid="agent-proposal-confirm-button"
            type="button"
            size="sm"
            disabled={!proposal.approvalId}
            onClick={() =>
              proposal.approvalId &&
              onApprove({
                messageId,
                toolCallId: proposal.toolCallId,
                approvalId: proposal.approvalId,
                approved: true,
              })
            }
          >
            <Check />
            确认
          </Button>
          <Button
            data-testid="agent-proposal-reject-button"
            type="button"
            size="sm"
            variant="outline"
            disabled={!proposal.approvalId}
            onClick={() =>
              proposal.approvalId &&
              onApprove({
                messageId,
                toolCallId: proposal.toolCallId,
                approvalId: proposal.approvalId,
                approved: false,
              })
            }
          >
            拒绝
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function proposalStatusNote(
  status: ToolApprovalStatus | undefined,
  state?: ProposalView["state"],
  resultRefType?: string,
  resultRef?: string,
) {
  if (state === "output-error") return undefined;
  if (state === "output-available") return undefined;
  if (status === "approved" && resultRef) return `已写入 ${resultRefType} · ${resultRef}`;
  if (status === "approved") return "已确认";
  if (status === "rejected") return "已拒绝，未写入知识库";
  return undefined;
}

function contextMediumLabel(value: string) {
  if (value === "experience") return "实践";
  if (value === "video") return "视频";
  if (value === "book") return "书籍";
  if (value === "article") return "文章";
  if (value === "opinion") return "观点";
  if (value === "ai") return "AI 对话";
  if (value === "other") return "其他";
  return "";
}

function useUnderstandingDisplay(understandingId: string) {
  const query = useQuery({
    queryKey: captureQueryKeys.understandingDetail(understandingId),
    queryFn: () => ipcClient.understanding.getUnderstandingById(understandingId),
    enabled: Boolean(understandingId),
  });
  return query.data?.title?.trim() || understandingId;
}

function useContextDisplay(contextId: string) {
  const query = useQuery({
    queryKey: ["agent.proposal.context", contextId],
    queryFn: () => ipcClient.context.getContextById(contextId),
    enabled: Boolean(contextId),
  });
  return query.data?.title?.trim() || contextMediumLabel(query.data?.medium ?? "") || contextId;
}

function UnderstandingReference({ understandingId }: { understandingId: string }) {
  return <>{useUnderstandingDisplay(understandingId)}</>;
}

function ContextReference({ contextId }: { contextId: string }) {
  return <>{useContextDisplay(contextId)}</>;
}

function DomainPathText({ domainId }: { domainId: string }) {
  const { domains } = useCaptureDomains();
  if (!domainId || domainId === "null") return <>根 Domain</>;
  return <>{getDomainPath(domainId, domains, "/")}</>;
}

function DomainIdsText({ domainIds }: { domainIds: string[] }) {
  const { domains } = useCaptureDomains();
  if (domainIds.length === 0) return <>未归入 Domain</>;
  return <>{domainIds.map((domainId) => getDomainPath(domainId, domains, "/")).join(", ")}</>;
}

function CandidateUnderstandingCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
  entitySources,
}: {
  proposal: UnderstandingProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      onInspectContextRef={onInspectContextRef}
      entitySources={entitySources}
    >
      <div className="space-y-2">
        {proposal.data.title ? <div className="font-medium">{proposal.data.title}</div> : null}
        <div className="rounded-md bg-muted/50 p-3 leading-6">
          <MarkdownBody
            value={proposal.data.body}
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        </div>
        {proposal.data.domainIds.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            Domain: <DomainIdsText domainIds={proposal.data.domainIds} />
          </div>
        ) : null}
      </div>
    </CandidateShell>
  );
}

function CandidateContextCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
  entitySources,
}: {
  proposal: ContextProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      onInspectContextRef={onInspectContextRef}
      entitySources={entitySources}
    >
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Understanding: <UnderstandingReference understandingId={proposal.data.understandingId} />
        </div>
        <div>{proposal.data.contextLabel}</div>
        <div className="rounded-md bg-muted/50 p-3 leading-6">
          <MarkdownBody
            value={proposal.data.content}
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        </div>
      </div>
    </CandidateShell>
  );
}

function formatDurationMs(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return undefined;
  if (ms % 1000 === 0) return `${ms / 1000} 秒`;
  return `${ms} ms`;
}

function BashProposalCard({
  proposal,
  messageId,
  onApprove,
  entitySources,
}: {
  proposal: BashProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  entitySources: AgentEntitySource[];
}) {
  const timeout = formatDurationMs(proposal.data.timeoutMs);
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      entitySources={entitySources}
    >
      <div className="space-y-2">
        <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-foreground/85">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono">
            {proposal.data.command || "未提供命令"}
          </pre>
        </div>
        {proposal.data.cwd || timeout ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {proposal.data.cwd ? <span>目录：{proposal.data.cwd}</span> : null}
            {timeout ? <span>最长等待：{timeout}</span> : null}
          </div>
        ) : null}
      </div>
    </CandidateShell>
  );
}

function proposalEntryLabel(key: string) {
  if (key === "domainId") return "Domain";
  if (key === "parentId") return "上级 Domain";
  if (key === "domainIds") return "Domain";
  if (key === "understandingId") return "Understanding";
  if (key === "contextId") return "Context";
  return key;
}

function GenericProposalValue({
  fieldKey,
  value,
  format,
  onInspectContextRef,
  entitySources,
}: {
  fieldKey: string;
  value: string;
  format?: "markdown";
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  if (fieldKey === "domainId" || fieldKey === "parentId") {
    return <DomainPathText domainId={value} />;
  }
  if (fieldKey === "domainIds") {
    const domainIds = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return <DomainIdsText domainIds={domainIds} />;
  }
  if (fieldKey === "understandingId") {
    return <UnderstandingReference understandingId={value} />;
  }
  if (fieldKey === "contextId") {
    return <ContextReference contextId={value} />;
  }
  if (format === "markdown") {
    return (
      <MarkdownBody
        value={value}
        onInspectContextRef={onInspectContextRef}
        entitySources={entitySources}
      />
    );
  }
  return <>{value}</>;
}

function GenericProposalCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
  entitySources,
}: {
  proposal: GenericProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      onInspectContextRef={onInspectContextRef}
      entitySources={entitySources}
    >
      <dl className="grid gap-1 text-sm">
        {proposal.data.entries.map(({ key, value, format }) => (
          <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">{proposalEntryLabel(key)}</dt>
            <dd className="min-w-0 break-words">
              <GenericProposalValue
                fieldKey={key}
                value={value}
                format={format}
                onInspectContextRef={onInspectContextRef}
                entitySources={entitySources}
              />
            </dd>
          </div>
        ))}
      </dl>
    </CandidateShell>
  );
}

function UpdateUnderstandingDiffCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
  entitySources,
}: {
  proposal: UnderstandingUpdateProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      onInspectContextRef={onInspectContextRef}
      entitySources={entitySources}
    >
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Understanding: <UnderstandingReference understandingId={proposal.data.understandingId} />
        </div>
        {proposal.data.domainIds !== undefined ? (
          <div className="text-xs text-muted-foreground">
            Domain: <DomainIdsText domainIds={proposal.data.domainIds} />
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">Before</div>
            <MarkdownBody
              value={proposal.data.beforeBody}
              onInspectContextRef={onInspectContextRef}
              entitySources={entitySources}
            />
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">After</div>
            <MarkdownBody
              value={proposal.data.afterBody}
              onInspectContextRef={onInspectContextRef}
              entitySources={entitySources}
            />
          </div>
        </div>
        {proposal.data.reason ? (
          <div className="text-xs text-muted-foreground">{proposal.data.reason}</div>
        ) : null}
      </div>
    </CandidateShell>
  );
}

function ToolCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
  entitySources,
}: {
  proposal: ProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  entitySources: AgentEntitySource[];
}) {
  if (proposal.type === "understanding_create") {
    return (
      <CandidateUnderstandingCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        onInspectContextRef={onInspectContextRef}
        entitySources={entitySources}
      />
    );
  }
  if (proposal.type === "understanding_update") {
    return (
      <UpdateUnderstandingDiffCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        onInspectContextRef={onInspectContextRef}
        entitySources={entitySources}
      />
    );
  }
  if (proposal.type === "context_create") {
    return (
      <CandidateContextCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        onInspectContextRef={onInspectContextRef}
        entitySources={entitySources}
      />
    );
  }
  if (proposal.type === "bash") {
    return (
      <BashProposalCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        entitySources={entitySources}
      />
    );
  }
  return (
    <GenericProposalCard
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
      onInspectContextRef={onInspectContextRef}
      entitySources={entitySources}
    />
  );
}

export function AgentMessageContent({
  message,
  entitySources,
  turn,
  isBusy,
  isLastAssistant,
  stopped,
  findState,
  onApproveTool,
  onInspectContextRef,
  expandToolDetails = false,
}: {
  message: AgentReducedMessage;
  entitySources: AgentEntitySource[];
  turn: AgentTurnView;
  isBusy: boolean;
  isLastAssistant: boolean;
  stopped?: boolean;
  findState?: ChatFindRenderState;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  expandToolDetails?: boolean;
}) {
  return (
    <>
      {turn.blocks.map((block, index) => {
        if (block.kind === "text") {
          return (
            <div
              key={`${message.id}-text-${index}`}
              data-testid="agent-assistant-text"
              className="w-full px-1 py-1"
            >
              <MarkdownBody
                value={block.text}
                onInspectContextRef={onInspectContextRef}
                entitySources={entitySources}
                findState={findState}
              />
            </div>
          );
        }
        if (block.kind === "reasoning") {
          return (
            <ReasoningBlock
              key={`${message.id}-reasoning-${index}`}
              reasoning={block.reasoning}
              onInspectContextRef={onInspectContextRef}
              entitySources={entitySources}
            />
          );
        }
        if (block.kind === "tool-activity") {
          return (
            <ToolActivityGroup
              key={`${message.id}-tool-${index}`}
              activity={block.activity}
              defaultOpen={expandToolDetails}
              onInspectContextRef={onInspectContextRef}
              entitySources={entitySources}
            />
          );
        }
        return (
          <ToolCard
            key={block.proposal.toolCallId}
            proposal={block.proposal}
            messageId={message.id}
            onApprove={onApproveTool}
            onInspectContextRef={onInspectContextRef}
            entitySources={entitySources}
          />
        );
      })}
      {stopped ? (
        <div
          data-testid="agent-stopped-state"
          className="max-w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          已停止
        </div>
      ) : null}
      {turn.blocks.length === 0 && isBusy && isLastAssistant ? (
        <RunningResponsePlaceholder />
      ) : null}
      {turn.blocks.length === 0 && !(isBusy && isLastAssistant) ? (
        <div className="max-w-full rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          ...
        </div>
      ) : null}
    </>
  );
}
