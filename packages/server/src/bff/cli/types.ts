export type ID = string;
export type ISODateTime = string;

import type {
  ThoughtType,
  SourceType,
  CreateThoughtInput,
  UpdateThoughtInput,
  CreateContextInput,
  UpdateContextInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  SearchOptions,
  ListThoughtsFilter,
} from "../../types";

export type {
  ThoughtType,
  SourceType,
  CreateThoughtInput,
  UpdateThoughtInput,
  CreateContextInput,
  UpdateContextInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  SearchOptions,
};

export type ListThoughtsOptions = ListThoughtsFilter & SearchOptions;

export type PageInfo = {
  limit: number;
  offset?: number;
  nextOffset?: number | null;
  hasMore: boolean;
};

export type CategoryRef = {
  id: ID;
  name: string;
  parentId: ID | null;
};

export type ThoughtSummary = {
  id: ID;
  type: ThoughtType;
  title: string | null;
  body: string;
  categories: CategoryRef[];
};

export type ThoughtDetail = ThoughtSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextDetail[];
  references?: ThoughtSummary[];
  referencedBys?: ThoughtSummary[];
};

export type ContextSummary = {
  id: ID;
  thoughtId: ID;
  sourceType: SourceType;
  sourceName: string | null;
};

export type ContextDetail = ContextSummary & {
  content: string;
};

export type CategorySummary = {
  id: ID;
  name: string;
  parentId: ID | null;
};

export type ReferenceEdge = {
  from: ID;
  to: ID;
};

export type ThoughtNode = ThoughtSummary & {
  contextIds?: ID[];
};

export type ThoughtSearchHit = ThoughtSummary & {
  snippet: string;
  rank: number;
};

export type ContextSearchHit = {
  contextId: ID;
  thoughtId: ID;
  sourceType: SourceType;
  sourceName: string | null;
  snippet: string;
  rank: number;
};

export type SearchAllResult = {
  thoughts: ThoughtSearchHit[];
  contexts: ContextSearchHit[];
};

export type CategoryInspectResult = {
  category: CategorySummary;
  categories: CategorySummary[];
  thoughts: ThoughtNode[];
  contexts?: ContextDetail[];
  edges?: ReferenceEdge[];
  page: PageInfo;
};

export type GraphNeighborhoodResult = {
  seed: ID;
  nodes: ThoughtNode[];
  edges: ReferenceEdge[];
  contexts?: ContextDetail[];
  page: PageInfo;
};

export type GraphPath = {
  nodes: ID[];
  edges: ReferenceEdge[];
};

export type GraphPathResult = {
  from: ID;
  to: ID;
  paths: GraphPath[];
};

export type ProjectSnapshotResult = {
  categories: Array<{
    id: ID;
    name: string;
    thoughtCount: number;
  }>;
  recentThoughts: ThoughtSummary[];
  stats?: {
    totalThoughts: number;
    totalContexts: number;
    totalCategories: number;
    totalReferences: number;
  };
};

// Command options
export type GetThoughtOptions = {
  includeContexts?: boolean;
  includeReferences?: boolean;
  includeReferencedBys?: boolean;
};

export type InspectCategoryOptions = {
  includeContexts?: boolean;
  includeEdges?: boolean;
  limit?: number;
  offset?: number;
};

export type GraphNeighborhoodOptions = {
  depth?: number;
  includeContexts?: boolean;
  limit?: number;
  offset?: number;
};
