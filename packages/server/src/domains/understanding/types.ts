import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  understandingDomains,
  understandingConnections,
  understandings,
} from "../../db/schema";
import type { DomainRef } from "../domain/types";
import type { ContextDTO, ContextDetail } from "../context/types";

export type Understanding = InferSelectModel<typeof understandings>;
export type NewUnderstanding = InferInsertModel<typeof understandings>;
export type UnderstandingDomain = InferSelectModel<typeof understandingDomains>;
export type UnderstandingConnection = InferSelectModel<typeof understandingConnections>;

export type UnderstandingSummaryDTO = {
  id: string;
  title: string | null;
  body: string;
  domainIds: string[];
  contextCount: number;
  connectionCount: number;
  connectionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type UnderstandingDTO = {
  id: string;
  title: string | null;
  body: string;
  domainIds: string[];
  contexts: ContextDTO[];
  connections: UnderstandingSummaryDTO[];
  referencedBy: UnderstandingSummaryDTO[];
  createdAt: string;
  updatedAt: string;
};

export type CreateUnderstandingInput = {
  title?: string;
  body?: string;
  domainIds?: string[];
};

export type UpdateUnderstandingInput = {
  title?: string | null;
  body?: string;
  domainIds?: string[];
};

export type ListUnderstandingsFilter = {
  domainIds?: string[];
  includeDescendants?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
};

export type UnderstandingSummary = {
  id: string;
  title: string | null;
  body: string;
  domains: DomainRef[];
};

export type UnderstandingListWithContexts = {
  understandings: UnderstandingSummary[];
  contextsByUnderstandingId: Record<string, ContextDetail[]>;
};

export type UnderstandingNode = UnderstandingSummary & {
  contextIds?: string[];
};

export type UnderstandingSearchHit = UnderstandingSummary & {
  snippet: string;
  rank: number;
};

export type UnderstandingRelation = {
  direction: "outgoing" | "incoming";
  sourceUnderstandingId: string;
  targetUnderstandingId: string | null;
  sourceTitle: string | null;
  targetTitle: string | null;
  rawText: string;
  resolved: boolean;
};

export type UnderstandingDetail = UnderstandingSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextDetail[];
  relations?: UnderstandingRelation[];
};

export type GetUnderstandingOptions = {
  includeContexts?: boolean;
  includeRelations?: boolean;
};
