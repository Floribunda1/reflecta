import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { understandingDomains, understandingMentions, understandings } from "../../db/schema";
import type { DomainRef } from "../domain/types";
import type { ContextDetail } from "../context/types";

export type Understanding = InferSelectModel<typeof understandings>;
export type NewUnderstanding = InferInsertModel<typeof understandings>;
export type UnderstandingDomain = InferSelectModel<typeof understandingDomains>;
export type UnderstandingMention = InferSelectModel<typeof understandingMentions>;

export type UnderstandingSummary = {
  id: string;
  title: string | null;
  body: string;
  domains: DomainRef[];
};

export type UnderstandingListWithContexts = {
  understandings: UnderstandingSummary[];
  contextsByUnderstandingId: Record<string, ContextDetail[]>;
};

export type UnderstandingNode = UnderstandingSummary & {
  contextIds?: string[];
};

export type UnderstandingSearchHit = UnderstandingSummary & {
  snippet: string;
  rank: number;
};

/**
 * 一条 wiki-link 引用（mention）：一个 Understanding 正文中提及另一个 Understanding。
 * 弱引用、无方向语义的引用网（事实/材料层）；与画布的结构连线（强语义、信念/成果层）彻底分离。
 */
export type UnderstandingMentionRef = {
  direction: "outgoing" | "incoming";
  sourceUnderstandingId: string;
  targetUnderstandingId: string | null;
  sourceTitle: string | null;
  targetTitle: string | null;
  rawText: string;
  resolved: boolean;
};

export type UnderstandingDetail = UnderstandingSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextDetail[];
  mentions?: UnderstandingMentionRef[];
  /** TBD-2：该理解出现在哪些画布（canvas_elements.understanding_id 反向 join 画布标题） */
  referencedByCanvases?: Array<{ id: string; title: string }>;
};

export type GetUnderstandingOptions = {
  includeContexts?: boolean;
  includeMentions?: boolean;
};
