import type { UnderstandingSummary } from "../understanding/types";

export type ProjectSnapshotResult = {
  domains: Array<{
    id: string;
    name: string;
    understandingCount: number;
  }>;
  recentUnderstandings: UnderstandingSummary[];
  stats?: {
    totalUnderstandings: number;
    totalContexts: number;
    totalDomains: number;
    totalReferences: number;
  };
};
