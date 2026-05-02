import type { contexts } from "../../db/schema";

export type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

export type ContextDTO = Omit<typeof contexts.$inferSelect, "sourceType"> & {
  sourceType: SourceType;
};

export type CreateContextInput = {
  thoughtId: string;
  sourceType: SourceType;
  sourceName?: string;
  content: string;
};

export type UpdateContextInput = Partial<
  Pick<CreateContextInput, "sourceType" | "sourceName" | "content">
>;
