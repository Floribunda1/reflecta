import type { ContextDetail } from "../context/types";
import type { UnderstandingNode } from "../understanding/types";

export type GraphEdge = {
  from: string;
  to: string;
};

export type GraphOptions = {
  depth?: number;
  includeContext?: boolean;
};

export type GraphResult = {
  seed: string;
  nodes: UnderstandingNode[];
  edges: GraphEdge[];
  contexts?: ContextDetail[];
};
