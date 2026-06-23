import type { InferSelectModel } from "drizzle-orm";
import type { domains } from "../../db/schema";
import type { ContextDetail } from "../context/types";
import type { UnderstandingNode } from "../understanding/types";
import type { ReferenceEdge } from "../graph/types";
import type { PageInfo } from "../shared/types";

export type Domain = InferSelectModel<typeof domains>;
export type DomainTreeNode = Omit<Domain, "createdAt" | "updatedAt"> & {
  children: DomainTreeNode[];
};

export type CreateDomainInput = {
  name: string;
  parentId?: string | null;
};

export type UpdateDomainInput = Partial<CreateDomainInput>;

export type ReorderDomainItem = {
  id: string;
  parentId: string | null;
  sortOrder: number;
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
