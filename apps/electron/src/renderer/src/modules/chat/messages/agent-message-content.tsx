import type { ReactNode } from "react";
import { Check, CheckCircle2, ChevronDown, CircleAlert } from "lucide-react";
import { Streamdown } from "streamdown";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Spinner } from "@renderer/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@renderer/components/ui/collapsible";
import type { AgentChatMessage } from "@shared/chat";
import type { AgentModelSelection, AgentReasoningLevel } from "@shared/chat";
import { wikiMarkdownToLinks, type InspectableContextRef } from "../context/context-reference";
import {
  type AgentReasoningView,
  type AgentTurnView,
  type ContextProposalView,
  type GenericProposalView,
  type ProposalView,
  type ThoughtProposalView,
  type ThoughtUpdateProposalView,
  type ToolActivityView,
  type ToolApprovalStatus,
} from "./agent-turn-view";
import { wikiMarkdownComponents, wikiUrlTransform } from "../context/wiki-link";
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
  if (status === "approved") return "已确认";
  if (status === "rejected") return "已拒绝";
  if (status === "pending") return "待确认";
  if (state === "output-denied") return "已拒绝";
  if (state === "output-available") return "完成";
  if (state === "output-error") return "出错";
  if (state === "approval-responded") return "已响应";
  if (state === "approval-requested") return "待确认";
  if (state === "input-streaming") return "运行中";
  return "等待中";
}

function MarkdownBody({
  value,
  className = "",
  onInspectContextRef,
}: {
  value: string;
  className?: string;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  return (
    <div className={["reflecta-chat-markdown", className].filter(Boolean).join(" ")}>
      <Streamdown
        components={wikiMarkdownComponents(onInspectContextRef)}
        urlTransform={wikiUrlTransform}
      >
        {wikiMarkdownToLinks(value)}
      </Streamdown>
    </div>
  );
}

function ToolActivityGroup({ activity }: { activity: ToolActivityView }) {
  return (
    <Collapsible className="w-full rounded-md bg-muted/35 text-xs text-muted-foreground">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown className="size-3 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0" />
          {activity.status === "running" ? <Spinner className="size-3 shrink-0" /> : null}
          <span className="truncate">{activity.summary}</span>
        </span>
        <Badge variant={activity.status === "failed" ? "destructive" : "outline"}>
          {activity.statusLabel}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-2.5 py-2">
        <div className="mb-1 text-muted-foreground">{activity.title}</div>
        <ul className="space-y-1.5">
          {activity.items.map((item) => (
            <li key={item.toolCallId} className="grid gap-1">
              <div className="flex min-w-0 items-center gap-2">
                {item.status === "running" ? <Spinner className="size-3 shrink-0" /> : null}
                {item.status === "failed" ? (
                  <CircleAlert className="size-3 shrink-0 text-destructive" />
                ) : null}
                {item.status === "done" ? (
                  <CheckCircle2 className="size-3 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </div>
              {item.errorText ? (
                <div className="ml-5 rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                  {item.errorText}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningBlock({
  reasoning,
  onInspectContextRef,
}: {
  reasoning: AgentReasoningView;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  const streaming = reasoning.status === "streaming";

  return (
    <Collapsible
      data-slot="agent-reasoning"
      className="w-full rounded-md border border-border/60 bg-muted/25 text-xs text-muted-foreground"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left">
        <ChevronDown className="size-3 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0" />
        {streaming ? <Spinner className="size-3 shrink-0" /> : null}
        <span>{streaming ? "正在思考" : "思考过程"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-2.5 py-2">
        {reasoning.text ? (
          <MarkdownBody
            value={reasoning.text}
            className="!text-[13px] !leading-5 !text-muted-foreground [&_*]:!text-muted-foreground"
            onInspectContextRef={onInspectContextRef}
          />
        ) : (
          <span>等待模型输出思考内容</span>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RunningResponsePlaceholder() {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs text-muted-foreground">
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
}: {
  title: string;
  proposal: ProposalView;
  children: ReactNode;
  onApprove: (input: ApproveToolInput) => void;
  messageId: string;
}) {
  const status = proposal.status;
  const resultRefType = proposal.resultRefType;
  const resultRefId = proposal.resultRefId;
  const statusNote = proposalStatusNote(status, resultRefType, resultRefId);
  return (
    <div className="w-full rounded-lg border border-border/70 bg-card px-3 py-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <Badge variant={status === "rejected" ? "destructive" : "outline"}>
          {statusLabel(status, proposal.state)}
        </Badge>
      </div>
      {proposal.state === "output-error" ? (
        <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {proposal.errorText}
        </div>
      ) : (
        children
      )}
      {statusNote ? <div className="mt-2 text-xs text-muted-foreground">{statusNote}</div> : null}
      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <Button
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
  resultRefType?: string,
  resultRefId?: string,
) {
  if (status === "approved" && resultRefId) return `已写入 ${resultRefType} · ${resultRefId}`;
  if (status === "approved") return "已确认";
  if (status === "rejected") return "已拒绝，未写入知识库";
  return undefined;
}

function CandidateThoughtCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
}: {
  proposal: ThoughtProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
    >
      <div className="space-y-2">
        {proposal.data.title ? <div className="font-medium">{proposal.data.title}</div> : null}
        <div className="rounded-md bg-muted/50 p-3 leading-6">
          <MarkdownBody value={proposal.data.body} onInspectContextRef={onInspectContextRef} />
        </div>
        {proposal.data.categoryIds.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            Category: {proposal.data.categoryIds.join(", ")}
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
}: {
  proposal: ContextProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
    >
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Thought: {proposal.data.thoughtId}</div>
        <div>{proposal.data.sourceLabel}</div>
        <div className="rounded-md bg-muted/50 p-3 leading-6">
          <MarkdownBody value={proposal.data.content} onInspectContextRef={onInspectContextRef} />
        </div>
      </div>
    </CandidateShell>
  );
}

function GenericProposalCard({
  proposal,
  messageId,
  onApprove,
}: {
  proposal: GenericProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
    >
      <dl className="grid gap-1 text-sm">
        {proposal.data.entries.map(({ key, value }) => (
          <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </CandidateShell>
  );
}

function UpdateThoughtDiffCard({
  proposal,
  messageId,
  onApprove,
  onInspectContextRef,
}: {
  proposal: ThoughtUpdateProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  return (
    <CandidateShell
      title={proposal.title}
      proposal={proposal}
      messageId={messageId}
      onApprove={onApprove}
    >
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Thought: {proposal.data.thoughtId}</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">Before</div>
            <MarkdownBody
              value={proposal.data.beforeBody}
              onInspectContextRef={onInspectContextRef}
            />
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">After</div>
            <MarkdownBody
              value={proposal.data.afterBody}
              onInspectContextRef={onInspectContextRef}
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
}: {
  proposal: ProposalView;
  messageId: string;
  onApprove: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  if (proposal.type === "thought_create") {
    return (
      <CandidateThoughtCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        onInspectContextRef={onInspectContextRef}
      />
    );
  }
  if (proposal.type === "thought_update") {
    return (
      <UpdateThoughtDiffCard
        proposal={proposal}
        messageId={messageId}
        onApprove={onApprove}
        onInspectContextRef={onInspectContextRef}
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
      />
    );
  }
  return <GenericProposalCard proposal={proposal} messageId={messageId} onApprove={onApprove} />;
}

export function AgentMessageContent({
  message,
  turn,
  isBusy,
  isLastAssistant,
  stopped,
  onApproveTool,
  onInspectContextRef,
}: {
  message: AgentChatMessage;
  turn: AgentTurnView;
  isBusy: boolean;
  isLastAssistant: boolean;
  stopped?: boolean;
  onApproveTool: (input: ApproveToolInput) => void;
  onInspectContextRef?: (ref: InspectableContextRef) => void;
}) {
  return (
    <>
      {turn.blocks.map((block, index) => {
        if (block.kind === "text") {
          return (
            <div key={`${message.id}-text-${index}`} className="w-full px-1 py-1">
              <MarkdownBody value={block.text} onInspectContextRef={onInspectContextRef} />
            </div>
          );
        }
        if (block.kind === "reasoning") {
          return (
            <ReasoningBlock
              key={`${message.id}-reasoning-${index}`}
              reasoning={block.reasoning}
              onInspectContextRef={onInspectContextRef}
            />
          );
        }
        if (block.kind === "tool-activity") {
          return (
            <ToolActivityGroup key={`${message.id}-tool-${index}`} activity={block.activity} />
          );
        }
        return (
          <ToolCard
            key={block.proposal.toolCallId}
            proposal={block.proposal}
            messageId={message.id}
            onApprove={onApproveTool}
            onInspectContextRef={onInspectContextRef}
          />
        );
      })}
      {stopped ? (
        <div className="max-w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
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
