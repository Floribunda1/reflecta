import { type ReactNode, useState } from "react";
import { diffLines } from "diff";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/input-group";
import { MarkdownPreview } from "../../editor/markdown-preview";
import type { ChatEntityBindings } from "../entity";
import { AgentWorkingIndicator } from "../execution/agent-working-indicator";
import { hasToolDetails, ToolDetails } from "../execution/tool-details";
import { ChatMarkdown } from "../markdown/chat-markdown";
import type {
  AgentProposalDecision,
  AgentProposalLifecycle,
  AgentProposalView,
  BashProposalView,
  ContextCreateProposalView,
  ContextUpdateProposalView,
  DomainCreateProposalView,
  DomainUpdateProposalView,
  UnderstandingCreateProposalView,
  UnderstandingUpdateProposalView,
  UnknownProposalView,
} from "./types";

export type AgentProposalCardProps = {
  proposal: AgentProposalView;
  onDecision?: (decision: AgentProposalDecision) => void;
  entityBindings?: ChatEntityBindings;
};

function lifecycleLabel(lifecycle: AgentProposalLifecycle) {
  if (lifecycle === "preview") return "生成中";
  if (lifecycle === "pending") return "待确认";
  if (lifecycle === "running") return "已确认 · 执行中";
  if (lifecycle === "completed") return "完成";
  if (lifecycle === "rejected") return "已拒绝";
  return "执行失败";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function FieldList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-1 text-sm">{children}</dl>;
}

function fallback(value: string | undefined, pending = "正在生成…") {
  return value?.trim() || pending;
}

function proposalTitle(proposal: AgentProposalView) {
  if (proposal.kind === "understanding-create") return "新增 Understanding";
  if (proposal.kind === "understanding-update") return "修改 Understanding";
  if (proposal.kind === "understanding-delete") return "删除 Understanding";
  if (proposal.kind === "domain-create") return "新增 Domain";
  if (proposal.kind === "domain-update") return "修改 Domain";
  if (proposal.kind === "domain-delete") return "删除 Domain";
  if (proposal.kind === "context-create") return "新增 Context";
  if (proposal.kind === "context-update") return "修改 Context";
  if (proposal.kind === "context-delete") return "删除 Context";
  if (proposal.kind === "bash") return "执行 Bash";
  return proposal.title;
}

function proposalReason(proposal: AgentProposalView) {
  if (
    proposal.kind === "understanding-update" ||
    proposal.kind === "understanding-delete" ||
    proposal.kind === "domain-create" ||
    proposal.kind === "domain-update" ||
    proposal.kind === "domain-delete" ||
    proposal.kind === "context-update" ||
    proposal.kind === "context-delete"
  ) {
    return proposal.content.reason;
  }
  return undefined;
}

function Reason({ value }: { value?: string }) {
  return value ? (
    <div className="mt-3 border-t pt-3">
      <div className="mb-1 text-xs text-muted-foreground">建议依据</div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  ) : null;
}

function fencedCodeBlock(value: string, language: string) {
  let fenceLength = 3;
  for (const match of value.matchAll(/`+/g)) {
    fenceLength = Math.max(fenceLength, match[0].length + 1);
  }
  const fence = "`".repeat(fenceLength);
  return `${fence}${language}\n${value}\n${fence}`;
}

function ProposalDiff({
  before,
  after,
  pending,
}: {
  before?: string;
  after?: string;
  pending: string;
}) {
  if (after === undefined) return <span className="text-muted-foreground">{pending}</span>;
  const value = diffLines(before ?? "", after)
    .flatMap((part) => {
      const prefix = part.added ? "+" : part.removed ? "-" : " ";
      return part.value
        .replace(/\n$/, "")
        .split("\n")
        .map((line) => `${prefix}${line}`);
    })
    .join("\n");
  return (
    <MarkdownPreview
      value={fencedCodeBlock(value, "diff")}
      zoomImages={false}
      className="markdown-preview-tool-detail"
    />
  );
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground/80">{children}</dd>
    </div>
  );
}

function domainPaths(paths: readonly string[] | undefined) {
  if (paths === undefined) return undefined;
  return paths.length ? paths.join("、") : "未归入 Domain";
}

function MarkdownPanel({
  value,
  placeholder,
  entityBindings,
}: {
  value?: string;
  placeholder: string;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="min-w-0 leading-6">
      {value ? (
        <ChatMarkdown value={value} {...entityBindings} />
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </div>
  );
}

function ProposalMeta({ proposal }: { proposal: AgentProposalView }) {
  let content: ReactNode = null;
  if (proposal.kind === "understanding-create") {
    const domains = domainPaths(proposal.content.domainPaths);
    content = domains ? <MetaItem label="Domain">{domains}</MetaItem> : null;
  } else if (proposal.kind === "understanding-update") {
    const domains = domainPaths(proposal.content.domainPaths ?? proposal.content.beforeDomainPaths);
    content = (
      <>
        <MetaItem label="Understanding">{fallback(proposal.content.targetLabel)}</MetaItem>
        {domains ? <MetaItem label="Domain">{domains}</MetaItem> : null}
      </>
    );
  } else if (proposal.kind === "understanding-delete") {
    content = <MetaItem label="Understanding">{fallback(proposal.content.targetLabel)}</MetaItem>;
  } else if (proposal.kind === "domain-create") {
    content =
      proposal.content.parentPath !== undefined ? (
        <MetaItem label="上级 Domain">{proposal.content.parentPath ?? "根 Domain"}</MetaItem>
      ) : null;
  } else if (proposal.kind === "domain-update") {
    content = <MetaItem label="Domain">{fallback(proposal.content.targetPath)}</MetaItem>;
  } else if (proposal.kind === "domain-delete") {
    content = <MetaItem label="Domain">{fallback(proposal.content.targetPath)}</MetaItem>;
  } else if (proposal.kind === "context-create") {
    content = (
      <>
        <MetaItem label="Understanding">{fallback(proposal.content.understandingLabel)}</MetaItem>
        {proposal.content.mediumLabel ? (
          <MetaItem label="类型">{proposal.content.mediumLabel}</MetaItem>
        ) : null}
      </>
    );
  } else if (proposal.kind === "context-update") {
    content = (
      <>
        <MetaItem label="Context">{fallback(proposal.content.targetLabel)}</MetaItem>
        {proposal.content.understandingLabel || proposal.content.beforeUnderstandingLabel ? (
          <MetaItem label="Understanding">
            {proposal.content.understandingLabel ?? proposal.content.beforeUnderstandingLabel}
          </MetaItem>
        ) : null}
        {proposal.content.mediumLabel || proposal.content.beforeMediumLabel ? (
          <MetaItem label="类型">
            {proposal.content.mediumLabel ?? proposal.content.beforeMediumLabel}
          </MetaItem>
        ) : null}
      </>
    );
  } else if (proposal.kind === "context-delete") {
    content = <MetaItem label="Context">{fallback(proposal.content.targetLabel)}</MetaItem>;
  } else if (proposal.kind === "bash") {
    const timeout = formatDurationMs(proposal.content.timeoutMs);
    content = (
      <>
        {proposal.content.cwd ? <MetaItem label="目录">{proposal.content.cwd}</MetaItem> : null}
        {timeout ? <MetaItem label="最长等待">{timeout}</MetaItem> : null}
      </>
    );
  }
  return content ? (
    <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 border-b pb-3 text-xs">{content}</dl>
  ) : null;
}

function UnderstandingCreate({
  proposal,
  entityBindings,
}: {
  proposal: UnderstandingCreateProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-2">
      <div className="font-medium">{fallback(proposal.content.heading, "正在生成标题…")}</div>
      <MarkdownPanel
        value={proposal.content.body}
        placeholder="正在生成内容…"
        entityBindings={entityBindings}
      />
    </div>
  );
}

function UnderstandingUpdate({ proposal }: { proposal: UnderstandingUpdateProposalView }) {
  const before = [proposal.content.beforeHeading, proposal.content.beforeBody]
    .filter(Boolean)
    .join("\n\n");
  const after = [
    proposal.content.afterHeading ?? proposal.content.beforeHeading,
    proposal.content.afterBody ?? proposal.content.beforeBody,
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <ProposalDiff
      before={before || undefined}
      after={
        proposal.content.afterHeading !== undefined || proposal.content.afterBody !== undefined
          ? after
          : undefined
      }
      pending="正在生成修改…"
    />
  );
}

function DeleteProposal({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-foreground/80">
      <Trash2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="leading-6">{children}</div>
    </div>
  );
}

function DomainCreate({ proposal }: { proposal: DomainCreateProposalView }) {
  return <div className="font-medium">{fallback(proposal.content.name)}</div>;
}

function DomainUpdate({ proposal }: { proposal: DomainUpdateProposalView }) {
  const before = [
    `名称：${fallback(proposal.content.beforeName, "未读取")}`,
    `上级 Domain：${proposal.content.beforeParentPath ?? "根 Domain"}`,
  ].join("\n");
  const after = [
    `名称：${proposal.content.nextName ?? proposal.content.beforeName ?? "未读取"}`,
    `上级 Domain：${
      proposal.content.nextParentPath !== undefined
        ? (proposal.content.nextParentPath ?? "根 Domain")
        : (proposal.content.beforeParentPath ?? "根 Domain")
    }`,
  ].join("\n");
  return (
    <ProposalDiff
      before={before}
      after={
        proposal.content.nextName !== undefined || proposal.content.nextParentPath !== undefined
          ? after
          : undefined
      }
      pending="正在生成修改…"
    />
  );
}

function ContextCreate({
  proposal,
  entityBindings,
}: {
  proposal: ContextCreateProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-2">
      <div className="font-medium">{fallback(proposal.content.contextLabel, "正在生成标题…")}</div>
      <MarkdownPanel
        value={proposal.content.body}
        placeholder="正在生成内容…"
        entityBindings={entityBindings}
      />
    </div>
  );
}

function ContextUpdate({ proposal }: { proposal: ContextUpdateProposalView }) {
  const before = [proposal.content.beforeTitle, proposal.content.beforeBody]
    .filter(Boolean)
    .join("\n\n");
  const after = [
    proposal.content.nextTitle ?? proposal.content.beforeTitle,
    proposal.content.nextBody ?? proposal.content.beforeBody,
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <ProposalDiff
      before={before || undefined}
      after={
        proposal.content.nextTitle !== undefined || proposal.content.nextBody !== undefined
          ? after
          : undefined
      }
      pending="正在生成修改…"
    />
  );
}

function formatDurationMs(ms: number | undefined) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return undefined;
  return ms % 1000 === 0 ? `${ms / 1000} 秒` : `${ms} ms`;
}

function BashProposal({ proposal }: { proposal: BashProposalView }) {
  return (
    <div className="rounded-md border px-3 py-2 font-mono text-xs leading-5 text-foreground/85">
      <pre className="m-0 whitespace-pre-wrap break-words font-mono">
        {fallback(
          proposal.content.command,
          proposal.lifecycle === "preview" ? "正在生成命令…" : "未提供命令",
        )}
      </pre>
    </div>
  );
}

function UnknownProposal({
  proposal,
  entityBindings,
}: {
  proposal: UnknownProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <FieldList>
      {proposal.content.fields.map((field) => (
        <Field key={field.id} label={field.label}>
          {field.value.format === "markdown" ? (
            <ChatMarkdown value={field.value.value} {...entityBindings} />
          ) : field.value.format === "pre" ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
              {field.value.value}
            </pre>
          ) : (
            field.value.value
          )}
        </Field>
      ))}
    </FieldList>
  );
}

function ProposalContent({
  proposal,
  entityBindings,
}: {
  proposal: AgentProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  if (proposal.kind === "understanding-create")
    return <UnderstandingCreate proposal={proposal} entityBindings={entityBindings} />;
  if (proposal.kind === "understanding-update") return <UnderstandingUpdate proposal={proposal} />;
  if (proposal.kind === "understanding-delete")
    return <DeleteProposal>确认后，这条 Understanding 将移入回收站。</DeleteProposal>;
  if (proposal.kind === "domain-create") return <DomainCreate proposal={proposal} />;
  if (proposal.kind === "domain-update") return <DomainUpdate proposal={proposal} />;
  if (proposal.kind === "domain-delete")
    return (
      <DeleteProposal>
        {proposal.content.deleteUnderstandings
          ? "确认后，这个 Domain 及其中的 Understanding 将移入回收站。"
          : "确认后，这个 Domain 将移入回收站，其中的 Understanding 会被保留。"}
      </DeleteProposal>
    );
  if (proposal.kind === "context-create")
    return <ContextCreate proposal={proposal} entityBindings={entityBindings} />;
  if (proposal.kind === "context-update") return <ContextUpdate proposal={proposal} />;
  if (proposal.kind === "context-delete")
    return <DeleteProposal>确认后，这条 Context 将移入回收站。</DeleteProposal>;
  if (proposal.kind === "bash") return <BashProposal proposal={proposal} />;
  return <UnknownProposal proposal={proposal} entityBindings={entityBindings} />;
}

function shouldOpenByDefault(proposal: AgentProposalView) {
  return proposal.lifecycle !== "completed" && proposal.lifecycle !== "rejected";
}

export function AgentProposalCard({
  proposal,
  onDecision,
  entityBindings,
}: AgentProposalCardProps) {
  const [manualOpen, setManualOpen] = useState<{
    id: string;
    lifecycle: AgentProposalLifecycle;
    open: boolean;
  }>();
  const [rejectionDraft, setRejectionDraft] = useState<{
    proposalId: string;
    value: string;
  }>();
  const open =
    manualOpen?.id === proposal.id && manualOpen.lifecycle === proposal.lifecycle
      ? manualOpen.open
      : shouldOpenByDefault(proposal);
  const destructive = proposal.lifecycle === "failed";
  const working = proposal.lifecycle === "preview" || proposal.lifecycle === "running";
  const showDecision =
    proposal.lifecycle === "pending" && proposal.decisionEnabled && Boolean(onDecision);
  const rejectionReason =
    rejectionDraft?.proposalId === proposal.id ? rejectionDraft.value.trim() : "";
  const headerNote =
    proposal.lifecycle === "rejected" && proposal.rejectionReason
      ? proposal.rejectionReason
      : proposal.note;

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) =>
        setManualOpen({
          id: proposal.id,
          lifecycle: proposal.lifecycle,
          open: nextOpen,
        })
      }
      data-testid="agent-proposal-card"
      data-proposal-id={proposal.id}
      data-proposal-kind={proposal.kind}
      data-proposal-state={proposal.lifecycle}
      data-proposal-open={open ? "true" : "false"}
      className="w-full overflow-hidden rounded-lg border border-border/70 bg-card text-sm"
    >
      <CollapsibleTrigger
        className="group flex min-h-12 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        aria-label={open ? "折叠 Proposal" : "展开 Proposal"}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{proposalTitle(proposal)}</div>
          {headerNote ? (
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{headerNote}</div>
          ) : null}
        </div>
        <Badge variant={destructive ? "destructive" : "outline"} className="shrink-0">
          {working ? <AgentWorkingIndicator className="size-3" aria-hidden="true" /> : null}
          {lifecycleLabel(proposal.lifecycle)}
        </Badge>
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-[34rem] overflow-y-auto border-t px-3 py-3">
          <ProposalMeta proposal={proposal} />
          <ProposalContent proposal={proposal} entityBindings={entityBindings} />
          <Reason value={proposalReason(proposal)} />
          {hasToolDetails(proposal.result) ? (
            <div className="mt-3 border-t pt-3 text-sm text-muted-foreground">
              <div className="mb-1 px-1 text-xs font-medium text-foreground/70">执行结果</div>
              <ToolDetails details={proposal.result!} />
            </div>
          ) : null}
          {proposal.lifecycle === "failed" && proposal.error ? (
            <div className="mt-3 rounded-md border border-destructive/30 p-2 text-sm text-destructive">
              {proposal.error}
            </div>
          ) : null}
          {proposal.lifecycle === "rejected" && proposal.rejectionReason ? (
            <div className="mt-3 border-t pt-3">
              <div className="mb-1 text-xs text-muted-foreground">拒绝原因</div>
              <div className="text-sm leading-6">{proposal.rejectionReason}</div>
            </div>
          ) : null}
        </div>
        {showDecision ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-2.5">
            <InputGroup className="w-[28rem] max-w-full">
              <InputGroupInput
                data-testid="agent-proposal-rejection-reason"
                value={rejectionDraft?.proposalId === proposal.id ? rejectionDraft.value : ""}
                placeholder="拒绝原因…"
                aria-label="拒绝原因"
                onChange={(event) =>
                  setRejectionDraft({
                    proposalId: proposal.id,
                    value: event.target.value,
                  })
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  data-testid="agent-proposal-reject-button"
                  size="xs"
                  className="px-2.5"
                  onClick={() =>
                    onDecision?.({
                      proposalId: proposal.id,
                      decision: "reject",
                      ...(rejectionReason ? { reason: rejectionReason } : {}),
                    })
                  }
                >
                  拒绝
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <Button
              data-testid="agent-proposal-confirm-button"
              type="button"
              size="sm"
              className="h-9 px-4"
              onClick={() => onDecision?.({ proposalId: proposal.id, decision: "approve" })}
            >
              确认
            </Button>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
