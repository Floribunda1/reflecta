import type { AgentToolDetailsView } from "../execution/types";

export type AgentProposalLifecycle =
  | "preview"
  | "pending"
  | "running"
  | "completed"
  | "rejected"
  | "failed";

export type AgentProposalBaseView = {
  id: string;
  title: string;
  lifecycle: AgentProposalLifecycle;
  note?: string;
  rejectionReason?: string;
  error?: string;
  result?: AgentToolDetailsView;
  decisionEnabled?: boolean;
};

export type UnderstandingCreateProposalView = AgentProposalBaseView & {
  kind: "understanding-create";
  content: {
    heading?: string;
    body?: string;
    domainPaths?: readonly string[];
  };
};

export type UnderstandingUpdateProposalView = AgentProposalBaseView & {
  kind: "understanding-update";
  content: {
    targetLabel?: string;
    beforeHeading?: string;
    afterHeading?: string;
    beforeBody?: string;
    afterBody?: string;
    beforeDomainPaths?: readonly string[];
    domainPaths?: readonly string[];
    reason?: string;
  };
};

export type UnderstandingDeleteProposalView = AgentProposalBaseView & {
  kind: "understanding-delete";
  content: {
    targetLabel?: string;
    reason?: string;
  };
};

export type DomainCreateProposalView = AgentProposalBaseView & {
  kind: "domain-create";
  content: {
    name?: string;
    parentPath?: string | null;
    reason?: string;
  };
};

export type DomainUpdateProposalView = AgentProposalBaseView & {
  kind: "domain-update";
  content: {
    targetPath?: string;
    beforeName?: string;
    beforeParentPath?: string | null;
    nextName?: string;
    nextParentPath?: string | null;
    reason?: string;
  };
};

export type DomainDeleteProposalView = AgentProposalBaseView & {
  kind: "domain-delete";
  content: {
    targetPath?: string;
    deleteUnderstandings?: boolean;
    reason?: string;
  };
};

export type ContextCreateProposalView = AgentProposalBaseView & {
  kind: "context-create";
  content: {
    understandingLabel?: string;
    mediumLabel?: string;
    contextLabel?: string;
    body?: string;
  };
};

export type ContextUpdateProposalView = AgentProposalBaseView & {
  kind: "context-update";
  content: {
    targetLabel?: string;
    beforeUnderstandingLabel?: string;
    beforeMediumLabel?: string;
    beforeTitle?: string;
    beforeBody?: string;
    understandingLabel?: string;
    mediumLabel?: string;
    nextTitle?: string;
    nextBody?: string;
    reason?: string;
  };
};

export type ContextDeleteProposalView = AgentProposalBaseView & {
  kind: "context-delete";
  content: {
    targetLabel?: string;
    reason?: string;
  };
};

export type BashProposalView = AgentProposalBaseView & {
  kind: "bash";
  content: {
    command?: string;
    cwd?: string;
    timeoutMs?: number;
  };
};

export type UnknownProposalFieldView = {
  id: string;
  label: string;
  value: {
    format: "text" | "markdown" | "pre";
    value: string;
  };
};

export type UnknownProposalView = AgentProposalBaseView & {
  kind: "unknown";
  content: {
    fields: readonly UnknownProposalFieldView[];
  };
};

export type AgentProposalView =
  | UnderstandingCreateProposalView
  | UnderstandingUpdateProposalView
  | UnderstandingDeleteProposalView
  | DomainCreateProposalView
  | DomainUpdateProposalView
  | DomainDeleteProposalView
  | ContextCreateProposalView
  | ContextUpdateProposalView
  | ContextDeleteProposalView
  | BashProposalView
  | UnknownProposalView;

export type AgentProposalDecision =
  | { proposalId: string; decision: "approve" }
  | { proposalId: string; decision: "reject"; reason?: string };
