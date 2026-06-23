import type { ContextDetail } from "../context/types";
import type { UnderstandingNode } from "../understanding/types";
import type { PageInfo } from "../shared/types";

export type ReferenceEdge = {
  from: string;
  to: string;
};

export type GraphNeighborhoodOptions = {
  depth?: number;
  includeContexts?: boolean;
  limit?: number;
  offset?: number;
};

export type GraphNeighborhoodResult = {
  seed: string;
  nodes: UnderstandingNode[];
  edges: ReferenceEdge[];
  contexts?: ContextDetail[];
  page: PageInfo;
};

export type GraphPath = {
  nodes: string[];
  edges: ReferenceEdge[];
};

export type GraphPathResult = {
  from: string;
  to: string;
  paths: GraphPath[];
};
