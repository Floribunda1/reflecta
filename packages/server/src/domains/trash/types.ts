import type { ThoughtType } from "../thought/types";
import type { SourceType } from "../context/types";

export type TrashedThoughtDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  deletedAt: string;
};

export type TrashedContextDTO = {
  id: string;
  thoughtId: string;
  thoughtTitle: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  deletedAt: string;
};
