import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { contexts } from "../../db/schema";

export type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

export type Context = InferSelectModel<typeof contexts>;
export type NewContext = InferInsertModel<typeof contexts>;

export type ContextDTO = {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  createdAt: string;
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
