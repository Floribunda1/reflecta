import type { ContextDetail } from "../context/types";
import type { UnderstandingNode } from "../understanding/types";
import type { PageInfo } from "../shared/types";
import type { Domain } from "@reflecta/shared";

export type {
  Domain,
  CreateDomainInput,
  UpdateDomainInput,
  ReorderDomainItem,
} from "@reflecta/shared";

export type DomainTreeNode = Omit<Domain, "createdAt" | "updatedAt"> & {
  children: DomainTreeNode[];
};

export type DomainRef = {
  id: string;
  name: string;
  parentId: string | null;
};

export type DomainSummary = {
  id: string;
  name: string;
  parentId: string | null;
};

export type ReferenceEdge = {
  from: string;
  to: string;
};

export type DomainInspectResult = {
  domain: DomainSummary;
  domains: DomainSummary[];
  understandings: UnderstandingNode[];
  contexts?: ContextDetail[];
  edges?: ReferenceEdge[];
  page: PageInfo;
};

export type InspectDomainOptions = {
  includeContexts?: boolean;
  includeEdges?: boolean;
  limit?: number;
  offset?: number;
};
