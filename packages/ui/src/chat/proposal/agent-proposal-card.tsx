import { type ReactNode, useState } from "react";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { Button } from "../../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/input-group";
import { MarkdownPreview } from "../../editor/markdown-preview";
import type { ChatEntityBindings, ChatEntityType } from "../entity";
import { entityClassName, entityIcon } from "../entity-visual";
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

function ProposalStatus({
  lifecycle,
  rejectionReason,
}: {
  lifecycle: AgentProposalLifecycle;
  rejectionReason?: string;
}) {
  if (lifecycle === "preview") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <AgentWorkingIndicator className="size-3" aria-hidden="true" />
        生成中
      </span>
    );
  }
  if (lifecycle === "pending") {
    return (
      <span className="shrink-0 text-xs">
        <span className="text-muted-foreground">审批</span>
        <span className="text-muted-foreground/50"> · </span>
        <span className="text-foreground/80">待确认</span>
      </span>
    );
  }
  if (lifecycle === "rejected") {
    return (
      <div className="flex min-w-0 max-w-72 shrink items-center gap-2 text-xs">
        <span className="shrink-0">
          <span className="text-muted-foreground">审批</span>
          <span className="text-muted-foreground/50"> · </span>
          <span className="text-destructive">已拒绝</span>
        </span>
        {rejectionReason ? (
          <span className="min-w-0 truncate text-muted-foreground" title={rejectionReason}>
            · {rejectionReason}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span className="text-muted-foreground">审批 · 已确认</span>
      <span className="h-3 border-l border-border" aria-hidden="true" />
      <span
        className={
          lifecycle === "running"
            ? "flex items-center gap-1.5 text-foreground/80"
            : lifecycle === "failed"
              ? "text-destructive"
              : "text-muted-foreground"
        }
      >
        {lifecycle === "running" ? (
          <AgentWorkingIndicator className="size-3" aria-hidden="true" />
        ) : null}
        运行 ·{" "}
        {lifecycle === "running" ? "执行中" : lifecycle === "completed" ? "执行完成" : "执行失败"}
      </span>
    </div>
  );
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
    <div className="mt-5">
      <div className="mb-1 text-xs text-muted-foreground">建议依据</div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  ) : null;
}

function MetaItem({
  label,
  children,
  entityType,
}: {
  label: string;
  children: ReactNode;
  entityType?: ChatEntityType;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0 text-muted-foreground/70">{label}</dt>
      <dd
        className={
          entityType
            ? `${entityClassName(entityType)} min-w-0 break-words`
            : "min-w-0 break-words font-medium text-foreground/80"
        }
      >
        {entityType ? <span className="mr-1">{entityIcon(entityType)}</span> : null}
        {children}
      </dd>
    </div>
  );
}

function KnowledgeComparison({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="min-w-0">
        <div className="mb-2 text-xs font-medium text-muted-foreground">修改前</div>
        <div className="text-foreground/65">{before}</div>
      </section>
      <section className="min-w-0">
        <div className="mb-2 text-xs font-medium text-foreground/80">修改后</div>
        <div>{after}</div>
      </section>
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

function EntityTitle({
  type,
  children,
}: {
  type: Extract<ChatEntityType, "understanding" | "context">;
  children: ReactNode;
}) {
  return (
    <div>
      <span className={entityClassName(type)}>
        {entityIcon(type)} {children}
      </span>
    </div>
  );
}

function ProposalMeta({ proposal }: { proposal: AgentProposalView }) {
  let content: ReactNode = null;
  if (proposal.kind === "understanding-create") {
    const domains = domainPaths(proposal.content.domainPaths);
    content = domains ? (
      <MetaItem label="Domain" entityType="domain">
        {domains}
      </MetaItem>
    ) : null;
  } else if (proposal.kind === "understanding-update") {
    const domains = domainPaths(proposal.content.domainPaths ?? proposal.content.beforeDomainPaths);
    content = (
      <>
        <MetaItem label="Understanding" entityType="understanding">
          {fallback(proposal.content.targetLabel)}
        </MetaItem>
        {domains ? (
          <MetaItem label="Domain" entityType="domain">
            {domains}
          </MetaItem>
        ) : null}
      </>
    );
  } else if (proposal.kind === "understanding-delete") {
    content = (
      <MetaItem label="Understanding" entityType="understanding">
        {fallback(proposal.content.targetLabel)}
      </MetaItem>
    );
  } else if (proposal.kind === "domain-create") {
    content =
      proposal.content.parentPath !== undefined ? (
        <MetaItem label="上级 Domain" entityType="domain">
          {proposal.content.parentPath ?? "根 Domain"}
        </MetaItem>
      ) : null;
  } else if (proposal.kind === "domain-update") {
    content = (
      <MetaItem label="Domain" entityType="domain">
        {fallback(proposal.content.targetPath)}
      </MetaItem>
    );
  } else if (proposal.kind === "domain-delete") {
    content = (
      <MetaItem label="Domain" entityType="domain">
        {fallback(proposal.content.targetPath)}
      </MetaItem>
    );
  } else if (proposal.kind === "context-create") {
    content = (
      <>
        <MetaItem label="Understanding" entityType="understanding">
          {fallback(proposal.content.understandingLabel)}
        </MetaItem>
        {proposal.content.mediumLabel ? (
          <MetaItem label="类型">{proposal.content.mediumLabel}</MetaItem>
        ) : null}
      </>
    );
  } else if (proposal.kind === "context-update") {
    content = (
      <>
        <MetaItem label="Context" entityType="context">
          {fallback(proposal.content.targetLabel)}
        </MetaItem>
        {proposal.content.understandingLabel || proposal.content.beforeUnderstandingLabel ? (
          <MetaItem label="Understanding" entityType="understanding">
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
    content = (
      <MetaItem label="Context" entityType="context">
        {fallback(proposal.content.targetLabel)}
      </MetaItem>
    );
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
    <dl className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs">{content}</dl>
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
      <EntityTitle type="understanding">
        {fallback(proposal.content.heading, "正在生成标题…")}
      </EntityTitle>
      {proposal.content.body ? (
        <MarkdownPreview
          value={proposal.content.body}
          zoomImages={false}
          resolveWikiLink={entityBindings?.resolveEntity}
          onWikiLinkOpen={entityBindings?.onEntityOpen}
        />
      ) : (
        <span className="text-muted-foreground">正在生成内容…</span>
      )}
    </div>
  );
}

function KnowledgeDocument({
  type,
  title,
  body,
  entityBindings,
}: {
  type: Extract<ChatEntityType, "understanding" | "context">;
  title?: string;
  body?: string;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="space-y-2">
      {title ? <EntityTitle type={type}>{title}</EntityTitle> : null}
      {body ? (
        <ChatMarkdown value={body} {...entityBindings} />
      ) : (
        <span className="text-muted-foreground">暂无内容</span>
      )}
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
  const hasAfter =
    proposal.content.afterHeading !== undefined || proposal.content.afterBody !== undefined;
  return (
    <KnowledgeComparison
      before={
        <KnowledgeDocument
          type="understanding"
          title={proposal.content.beforeHeading}
          body={proposal.content.beforeBody}
          entityBindings={entityBindings}
        />
      }
      after={
        hasAfter ? (
          <KnowledgeDocument
            type="understanding"
            title={proposal.content.afterHeading ?? proposal.content.beforeHeading}
            body={proposal.content.afterBody ?? proposal.content.beforeBody}
            entityBindings={entityBindings}
          />
        ) : (
          <span className="text-muted-foreground">正在生成修改…</span>
        )
      }
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
  const hasAfter =
    proposal.content.nextName !== undefined || proposal.content.nextParentPath !== undefined;
  return (
    <KnowledgeComparison
      before={
        <FieldList>
          <Field label="名称">{fallback(proposal.content.beforeName, "未读取")}</Field>
          <Field label="上级 Domain">{proposal.content.beforeParentPath ?? "根 Domain"}</Field>
        </FieldList>
      }
      after={
        hasAfter ? (
          <FieldList>
            <Field label="名称">
              {proposal.content.nextName ?? proposal.content.beforeName ?? "未读取"}
            </Field>
            <Field label="上级 Domain">
              {proposal.content.nextParentPath !== undefined
                ? (proposal.content.nextParentPath ?? "根 Domain")
                : (proposal.content.beforeParentPath ?? "根 Domain")}
            </Field>
          </FieldList>
        ) : (
          <span className="text-muted-foreground">正在生成修改…</span>
        )
      }
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
      <EntityTitle type="context">
        {fallback(proposal.content.contextLabel, "正在生成标题…")}
      </EntityTitle>
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
  const hasAfter =
    proposal.content.nextTitle !== undefined || proposal.content.nextBody !== undefined;
  return (
    <KnowledgeComparison
      before={
        <KnowledgeDocument
          type="context"
          title={proposal.content.beforeTitle}
          body={proposal.content.beforeBody}
          entityBindings={entityBindings}
        />
      }
      after={
        hasAfter ? (
          <KnowledgeDocument
            type="context"
            title={proposal.content.nextTitle ?? proposal.content.beforeTitle}
            body={proposal.content.nextBody ?? proposal.content.beforeBody}
            entityBindings={entityBindings}
          />
        ) : (
          <span className="text-muted-foreground">正在生成修改…</span>
        )
      }
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
  if (proposal.kind === "understanding-update")
    return <UnderstandingUpdate proposal={proposal} entityBindings={entityBindings} />;
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
  if (proposal.kind === "context-update")
    return <ContextUpdate proposal={proposal} entityBindings={entityBindings} />;
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
  const showDecision =
    proposal.lifecycle === "pending" && proposal.decisionEnabled && Boolean(onDecision);
  const rejectionReason =
    rejectionDraft?.proposalId === proposal.id ? rejectionDraft.value.trim() : "";
  const headerNote = proposal.note;

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
        <ProposalStatus lifecycle={proposal.lifecycle} rejectionReason={proposal.rejectionReason} />
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pt-1">
          <ProposalMeta proposal={proposal} />
        </div>
        <div className="max-h-[34rem] overflow-y-auto px-3 pb-3">
          <ProposalContent proposal={proposal} entityBindings={entityBindings} />
          <Reason value={proposalReason(proposal)} />
          {hasToolDetails(proposal.result) ? (
            <div className="mt-5 text-sm text-muted-foreground">
              <ToolDetails details={proposal.result!} />
            </div>
          ) : null}
          {proposal.lifecycle === "failed" && proposal.error ? (
            <div className="mt-3 rounded-md border border-destructive/30 p-2 text-sm text-destructive">
              {proposal.error}
            </div>
          ) : null}
        </div>
        {showDecision ? (
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-3 pt-1">
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
