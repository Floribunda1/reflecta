import { type ReactNode, useState } from "react";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
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

function Reason({ value }: { value?: string }) {
  return value ? <div className="text-xs text-muted-foreground">{value}</div> : null;
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
    <div className="rounded-md bg-muted/50 p-3 leading-6">
      {value ? (
        <ChatMarkdown value={value} {...entityBindings} />
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </div>
  );
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
      {proposal.content.domainPaths !== undefined ? (
        <div className="text-xs text-muted-foreground">
          Domain：
          {proposal.content.domainPaths.length
            ? proposal.content.domainPaths.join("、")
            : "未归入 Domain"}
        </div>
      ) : null}
    </div>
  );
}

function UnderstandingUpdate({
  proposal,
  entityBindings,
}: {
  proposal: UnderstandingUpdateProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Understanding：{fallback(proposal.content.targetLabel)}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-muted/50 p-3">
          <div className="mb-1 font-medium">
            {fallback(proposal.content.beforeHeading, "Before")}
          </div>
          {proposal.content.beforeBody ? (
            <ChatMarkdown value={proposal.content.beforeBody} {...entityBindings} />
          ) : (
            <span className="text-muted-foreground">等待原内容…</span>
          )}
        </div>
        <div className="rounded-md bg-muted/50 p-3">
          <div className="mb-1 font-medium">{fallback(proposal.content.afterHeading, "After")}</div>
          {proposal.content.afterBody ? (
            <ChatMarkdown value={proposal.content.afterBody} {...entityBindings} />
          ) : (
            <span className="text-muted-foreground">正在生成修改…</span>
          )}
        </div>
      </div>
      {proposal.content.domainPaths !== undefined ? (
        <div className="text-xs text-muted-foreground">
          Domain：
          {proposal.content.domainPaths.length
            ? proposal.content.domainPaths.join("、")
            : "未归入 Domain"}
        </div>
      ) : null}
      <Reason value={proposal.content.reason} />
    </div>
  );
}

function DeleteProposal({
  target,
  reason,
  warning,
}: {
  target?: string;
  reason?: string;
  warning: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium">{warning}</div>
          <div className="mt-1 break-words text-sm">{fallback(target, "正在读取目标…")}</div>
        </div>
      </div>
      <Reason value={reason} />
    </div>
  );
}

function DomainCreate({ proposal }: { proposal: DomainCreateProposalView }) {
  return (
    <div className="space-y-2">
      <FieldList>
        <Field label="名称">{fallback(proposal.content.name)}</Field>
        {proposal.content.parentPath !== undefined ? (
          <Field label="上级 Domain">{proposal.content.parentPath ?? "根 Domain"}</Field>
        ) : null}
      </FieldList>
      <Reason value={proposal.content.reason} />
    </div>
  );
}

function DomainUpdate({ proposal }: { proposal: DomainUpdateProposalView }) {
  return (
    <div className="space-y-2">
      <FieldList>
        <Field label="目标">{fallback(proposal.content.targetPath)}</Field>
        {proposal.content.nextName !== undefined ? (
          <Field label="新名称">{fallback(proposal.content.nextName)}</Field>
        ) : null}
        {proposal.content.nextParentPath !== undefined ? (
          <Field label="新上级">{proposal.content.nextParentPath ?? "根 Domain"}</Field>
        ) : null}
      </FieldList>
      <Reason value={proposal.content.reason} />
    </div>
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
      <FieldList>
        <Field label="Understanding">{fallback(proposal.content.understandingLabel)}</Field>
        {proposal.content.mediumLabel ? (
          <Field label="类型">{proposal.content.mediumLabel}</Field>
        ) : null}
        <Field label="标题">{fallback(proposal.content.contextLabel, "正在生成标题…")}</Field>
      </FieldList>
      <MarkdownPanel
        value={proposal.content.body}
        placeholder="正在生成内容…"
        entityBindings={entityBindings}
      />
    </div>
  );
}

function ContextUpdate({
  proposal,
  entityBindings,
}: {
  proposal: ContextUpdateProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-2">
      <FieldList>
        <Field label="目标">{fallback(proposal.content.targetLabel)}</Field>
        {proposal.content.understandingLabel !== undefined ? (
          <Field label="Understanding">{proposal.content.understandingLabel}</Field>
        ) : null}
        {proposal.content.mediumLabel !== undefined ? (
          <Field label="类型">{proposal.content.mediumLabel}</Field>
        ) : null}
        {proposal.content.nextTitle !== undefined ? (
          <Field label="新标题">{proposal.content.nextTitle}</Field>
        ) : null}
      </FieldList>
      {proposal.content.nextBody !== undefined ? (
        <MarkdownPanel
          value={proposal.content.nextBody}
          placeholder="正在生成内容…"
          entityBindings={entityBindings}
        />
      ) : null}
      <Reason value={proposal.content.reason} />
    </div>
  );
}

function formatDurationMs(ms: number | undefined) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return undefined;
  return ms % 1000 === 0 ? `${ms / 1000} 秒` : `${ms} ms`;
}

function BashProposal({ proposal }: { proposal: BashProposalView }) {
  const timeout = formatDurationMs(proposal.content.timeoutMs);
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-foreground/85">
        <pre className="m-0 whitespace-pre-wrap break-words font-mono">
          {fallback(
            proposal.content.command,
            proposal.lifecycle === "preview" ? "正在生成命令…" : "未提供命令",
          )}
        </pre>
      </div>
      {proposal.content.cwd || timeout ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {proposal.content.cwd ? <span>目录：{proposal.content.cwd}</span> : null}
          {timeout ? <span>最长等待：{timeout}</span> : null}
        </div>
      ) : null}
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
  if (proposal.kind === "understanding-update")
    return <UnderstandingUpdate proposal={proposal} entityBindings={entityBindings} />;
  if (proposal.kind === "understanding-delete")
    return (
      <DeleteProposal
        target={proposal.content.targetLabel}
        reason={proposal.content.reason}
        warning="将删除这条 Understanding"
      />
    );
  if (proposal.kind === "domain-create") return <DomainCreate proposal={proposal} />;
  if (proposal.kind === "domain-update") return <DomainUpdate proposal={proposal} />;
  if (proposal.kind === "domain-delete")
    return (
      <DeleteProposal
        target={proposal.content.targetPath}
        reason={proposal.content.reason}
        warning={
          proposal.content.deleteUnderstandings
            ? "将删除 Domain 及其中的 Understanding"
            : "将删除这个 Domain"
        }
      />
    );
  if (proposal.kind === "context-create")
    return <ContextCreate proposal={proposal} entityBindings={entityBindings} />;
  if (proposal.kind === "context-update")
    return <ContextUpdate proposal={proposal} entityBindings={entityBindings} />;
  if (proposal.kind === "context-delete")
    return (
      <DeleteProposal
        target={proposal.content.targetLabel}
        reason={proposal.content.reason}
        warning="将删除这条 Context"
      />
    );
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
  const open =
    manualOpen?.id === proposal.id && manualOpen.lifecycle === proposal.lifecycle
      ? manualOpen.open
      : shouldOpenByDefault(proposal);
  const destructive = proposal.lifecycle === "failed" || proposal.lifecycle === "rejected";
  const working = proposal.lifecycle === "preview" || proposal.lifecycle === "running";
  const showDecision =
    proposal.lifecycle === "pending" && proposal.decisionEnabled && Boolean(onDecision);

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) =>
        setManualOpen({ id: proposal.id, lifecycle: proposal.lifecycle, open: nextOpen })
      }
      data-testid="agent-proposal-card"
      data-proposal-id={proposal.id}
      data-proposal-kind={proposal.kind}
      data-proposal-state={proposal.lifecycle}
      data-proposal-open={open ? "true" : "false"}
      className="w-full rounded-lg border border-border/70 bg-card px-3 py-3 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{proposal.title}</div>
          {proposal.note ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{proposal.note}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={destructive ? "destructive" : "outline"}>
            {working ? <AgentWorkingIndicator className="size-3" aria-hidden="true" /> : null}
            {lifecycleLabel(proposal.lifecycle)}
          </Badge>
          <CollapsibleTrigger
            className="group flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={open ? "折叠候选卡片" : "展开候选卡片"}
          >
            <ChevronDown className="size-4 -rotate-90 transition group-data-[panel-open]:rotate-0" />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent className="mt-2">
        <ProposalContent proposal={proposal} entityBindings={entityBindings} />
        {hasToolDetails(proposal.result) ? (
          <div className="mt-3 rounded-md bg-muted/35 p-2 text-sm text-muted-foreground">
            <div className="mb-1 px-1 text-xs font-medium text-foreground/70">执行结果</div>
            <ToolDetails details={proposal.result!} />
          </div>
        ) : null}
        {proposal.lifecycle === "failed" && proposal.error ? (
          <div className="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {proposal.error}
          </div>
        ) : null}
        {showDecision ? (
          <div className="mt-3 flex gap-2">
            <Button
              data-testid="agent-proposal-confirm-button"
              type="button"
              size="sm"
              onClick={() => onDecision?.({ proposalId: proposal.id, decision: "approve" })}
            >
              <Check />
              确认
            </Button>
            <Button
              data-testid="agent-proposal-reject-button"
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDecision?.({ proposalId: proposal.id, decision: "reject" })}
            >
              拒绝
            </Button>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
