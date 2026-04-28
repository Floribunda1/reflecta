import type { ThoughtType } from "./thought";
import type { SourceType } from "./context";

/** A thought that has been moved to the trash. */
export type TrashedThoughtDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  deletedAt: string;
};

/** A context that has been independently moved to the trash (parent thought is still active). */
export type TrashedContextDTO = {
  id: string;
  thoughtId: string;
  /** The parent thought's title, for display in the trash UI. */
  thoughtTitle: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  deletedAt: string;
};
