import type { contexts } from "@main/db/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
