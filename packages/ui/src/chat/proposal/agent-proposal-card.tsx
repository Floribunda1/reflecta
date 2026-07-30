import { type ReactNode, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  FolderTree,
  Lightbulb,
  Terminal,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "../../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import { cn } from "../../lib/utils";
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

function isDecision(proposal: AgentProposalView) {
  return proposal.kind === "bash" || proposal.kind.endsWith("-delete");
}

function lifecycleLabel(proposal: AgentProposalView) {
  const decision = isDecision(proposal);
  if (proposal.lifecycle === "preview") return decision ? "正在准备" : "正在起草";
  if (proposal.lifecycle === "pending") return "等待你确认";
  if (proposal.lifecycle === "running") return decision ? "正在执行" : "正在写入";
  if (proposal.lifecycle === "completed") return decision ? "已完成" : "已写入";
  if (proposal.lifecycle === "rejected") return "已取消";
  return decision ? "执行失败" : "写入失败";
}

function proposalEyebrow(proposal: AgentProposalView) {
  if (proposal.kind === "understanding-create") return "新的 Understanding";
  if (proposal.kind === "understanding-update") return "修改 Understanding";
  if (proposal.kind === "understanding-delete") return "删除 Understanding";
  if (proposal.kind === "context-create") return "新的 Context";
  if (proposal.kind === "context-update") return "修改 Context";
  if (proposal.kind === "context-delete") return "删除 Context";
  if (proposal.kind === "domain-create") return "新的 Domain";
  if (proposal.kind === "domain-update") return "修改 Domain";
  if (proposal.kind === "domain-delete") return "删除 Domain";
  if (proposal.kind === "bash") return "执行 Bash";
  return proposal.title;
}

function proposalHeading(proposal: AgentProposalView) {
  if (proposal.kind === "understanding-create") return proposal.content.heading;
  if (proposal.kind === "understanding-update")
    return proposal.content.afterHeading || proposal.content.targetLabel;
  if (proposal.kind === "understanding-delete") return proposal.content.targetLabel;
  if (proposal.kind === "context-create") return proposal.content.contextLabel;
  if (proposal.kind === "context-update")
    return proposal.content.nextTitle || proposal.content.targetLabel;
  if (proposal.kind === "context-delete") return proposal.content.targetLabel;
  if (proposal.kind === "domain-create") return proposal.content.name;
  if (proposal.kind === "domain-update")
    return proposal.content.nextName || proposal.content.targetPath;
  if (proposal.kind === "domain-delete") return proposal.content.targetPath;
  return proposal.title;
}

function ProposalIcon({
  proposal,
  className,
}: {
  proposal: AgentProposalView;
  className?: string;
}) {
  const Icon =
    proposal.kind === "bash"
      ? Terminal
      : proposal.kind.endsWith("-delete")
        ? Trash2
        : proposal.kind.startsWith("understanding")
          ? Lightbulb
          : proposal.kind.startsWith("context")
            ? FileText
            : FolderTree;
  return <Icon className={className} />;
}

function decisionLabels(proposal: AgentProposalView) {
  if (proposal.kind === "bash") return { approve: "允许执行", reject: "不允许" };
  if (proposal.kind.endsWith("-delete")) return { approve: "确认删除", reject: "取消删除" };
  if (proposal.kind.startsWith("understanding"))
    return {
      approve: proposal.kind === "understanding-create" ? "确认是我的理解" : "确认更新",
      reject: proposal.kind === "understanding-create" ? "暂不沉淀" : "暂不修改",
    };
  if (proposal.kind.startsWith("context"))
    return {
      approve: proposal.kind === "context-create" ? "确认添加 Context" : "确认更新",
      reject: proposal.kind === "context-create" ? "暂不添加" : "暂不修改",
    };
  if (proposal.kind.startsWith("domain"))
    return {
      approve: proposal.kind === "domain-create" ? "确认创建" : "确认更新",
      reject: "暂不修改",
    };
  return { approve: "确认", reject: "取消" };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
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
  return value ? (
    <div className="border-t pt-3">
      <div className="mb-1 text-xs text-muted-foreground">Reflecta 的依据</div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  ) : null;
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

function UnderstandingCreate({
  proposal,
  entityBindings,
}: {
  proposal: UnderstandingCreateProposalView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-4">
      <MarkdownPanel
        value={proposal.content.body}
        placeholder="正在生成内容…"
        entityBindings={entityBindings}
      />
      {proposal.content.domainPaths !== undefined ? (
        <div className="border-t pt-3 text-xs text-muted-foreground">
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
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Understanding：{fallback(proposal.content.targetLabel)}
      </div>
      <div className="space-y-4">
        <div className="border-l-2 border-border pl-4 text-foreground/70">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {fallback(proposal.content.beforeHeading, "Before")}
          </div>
          {proposal.content.beforeBody ? (
            <ChatMarkdown value={proposal.content.beforeBody} {...entityBindings} />
          ) : (
            <span className="text-muted-foreground">等待原内容…</span>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">修改后</div>
          {proposal.content.afterBody ? (
            <ChatMarkdown value={proposal.content.afterBody} {...entityBindings} />
          ) : (
            <span className="text-muted-foreground">正在生成修改…</span>
          )}
        </div>
      </div>
      {proposal.content.domainPaths !== undefined ? (
        <div className="border-t pt-3 text-xs text-muted-foreground">
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
      <div className="flex items-start gap-3 rounded-lg border border-destructive/25 p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium text-destructive">{warning}</div>
          <div className="mt-1 break-words text-sm">{fallback(target, "正在读取目标…")}</div>
        </div>
      </div>
      <Reason value={reason} />
    </div>
  );
}

function DomainCreate({ proposal }: { proposal: DomainCreateProposalView }) {
  return (
    <div className="space-y-4">
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
    <div className="space-y-4">
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
    <div className="space-y-4">
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
    <div className="space-y-4">
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
      <div className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs leading-5 text-foreground/85">
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
  const working = proposal.lifecycle === "preview" || proposal.lifecycle === "running";
  const terminal = proposal.lifecycle === "completed" || proposal.lifecycle === "rejected";
  const failed = proposal.lifecycle === "failed";
  const destructiveAction = proposal.kind.endsWith("-delete");
  const showDecision =
    proposal.lifecycle === "pending" && proposal.decisionEnabled && Boolean(onDecision);
  const labels = decisionLabels(proposal);
  const heading = fallback(proposalHeading(proposal), proposal.title);

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
      className={cn(
        "w-full overflow-hidden border bg-card text-sm",
        terminal ? "rounded-lg border-border/60" : "rounded-xl border-border/80 shadow-xs",
        failed && "border-destructive/30",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          terminal ? "px-3 py-2.5" : "px-4 py-3",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <ProposalIcon
            proposal={proposal}
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground",
              failed && "text-destructive",
            )}
          />
          <div className="min-w-0">
            {terminal ? null : (
              <div className="text-xs leading-5 text-muted-foreground">
                {proposalEyebrow(proposal)}
              </div>
            )}
            <div className={cn("truncate font-medium", !terminal && "text-base leading-6")}>
              {heading}
            </div>
            {proposal.lifecycle === "rejected" && proposal.note ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{proposal.note}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground",
              failed && "text-destructive",
            )}
          >
            {working ? (
              <AgentWorkingIndicator className="size-3.5" aria-hidden="true" />
            ) : failed ? (
              <CircleAlert className="size-3.5" />
            ) : proposal.lifecycle === "completed" ? (
              <Check className="size-3.5" />
            ) : proposal.lifecycle === "rejected" ? (
              <X className="size-3.5" />
            ) : null}
            {lifecycleLabel(proposal)}
          </div>
          <CollapsibleTrigger
            className="group flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={open ? "折叠候选卡片" : "展开候选卡片"}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="max-h-[34rem] overflow-y-auto border-t px-4 py-4">
          <ProposalContent proposal={proposal} entityBindings={entityBindings} />
          {proposal.kind === "bash" && hasToolDetails(proposal.result) ? (
            <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
              <ToolDetails details={proposal.result!} />
            </div>
          ) : null}
          {proposal.lifecycle === "failed" && proposal.error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{proposal.error}</span>
            </div>
          ) : null}
        </div>
        {showDecision ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-background/60 px-4 py-3">
            <Button
              data-testid="agent-proposal-reject-button"
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDecision?.({ proposalId: proposal.id, decision: "reject" })}
            >
              {labels.reject}
            </Button>
            <Button
              data-testid="agent-proposal-confirm-button"
              type="button"
              size="sm"
              variant={destructiveAction ? "destructive" : "default"}
              onClick={() => onDecision?.({ proposalId: proposal.id, decision: "approve" })}
            >
              {labels.approve}
            </Button>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
