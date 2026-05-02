import type { ThoughtSummary } from "../thought/types";

export type ProjectSnapshotResult = {
  categories: Array<{
    id: string;
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
