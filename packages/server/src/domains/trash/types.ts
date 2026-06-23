import type { ContextMedium } from "../context/types";

export type TrashedUnderstandingDTO = {
  id: string;
  title: string | null;
  body: string;
  deletedAt: string;
};

export type TrashedContextDTO = {
  id: string;
  understandingId: string;
  understandingTitle: string | null;
  medium: ContextMedium;
  title: string | null;
  content: string;
  deletedAt: string;
};
