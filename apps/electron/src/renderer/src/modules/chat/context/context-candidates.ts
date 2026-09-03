import type { Domain } from "@shared/domain";
import type { AgentContextRef, AgentSessionSummary } from "@shared/agent";
import type { SearchContextResult } from "@shared/search";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { CanvasDTO } from "@reflecta/shared";
import type { ChatEntityType, ChatEntityTypeFilter } from "@reflecta/ui/chat";
import { truncate } from "../shared/text";
import { contextKey } from "./context-reference";

export const CONTEXT_LOOKUP_LIMIT = 8;

const MARK_TAG_PATTERN = /<\/?mark>/g;

export type ContextCandidate = AgentContextRef & { subtitle?: string };

function understandingCandidate(understanding: UnderstandingSummaryDTO): ContextCandidate {
  return {
    type: "understanding",
    id: understanding.id,
    title: (understanding.title ?? truncate(understanding.body, 48)) || "Untitled Understanding",
    subtitle: truncate(understanding.body, 96),
  };
}

function contextCandidate(context: SearchContextResult): ContextCandidate {
  return {
    type: "context",
    id: context.contextId,
    title: context.title ?? context.contextId,
    subtitle: truncate(context.snippet.replace(MARK_TAG_PATTERN, ""), 96),
  };
}

function canvasCandidate(canvas: CanvasDTO): ContextCandidate {
  return {
    type: "canvas",
    id: canvas.id,
    title: canvas.title?.trim() || "Untitled Canvas",
  };
}

function domainCandidate(domain: Domain): ContextCandidate {
  return {
    type: "domain",
    id: domain.id,
    title: domain.name,
    subtitle: domain.parentId ? `parent: ${domain.parentId}` : "root domain",
  };
}

function conversationCandidate(session: AgentSessionSummary): ContextCandidate {
  return {
    type: "conversation",
    id: session.id,
    title: session.title?.trim() || "Untitled Conversation",
    subtitle: `updated ${session.updatedAt}`,
  };
}

export function buildContextCandidates({
  query,
  understandings,
  contexts,
  domains,
  canvases,
  conversations,
  selected,
  type = "all",
}: {
  query: string;
  understandings: UnderstandingSummaryDTO[];
  contexts: SearchContextResult[];
  domains: Domain[];
  canvases: CanvasDTO[];
  conversations: AgentSessionSummary[];
  selected: AgentContextRef[];
  /** @ 面板类型筛选；"all" = 混合列表（按命中质量排序）。 */
  type?: ChatEntityTypeFilter;
}): ContextCandidate[] {
  const selectedKeys = new Set(selected.map(contextKey));
  const withoutSelected = (candidates: ContextCandidate[]) =>
    candidates.filter((candidate) => !selectedKeys.has(contextKey(candidate)));
  const normalizedQuery = query.toLowerCase();

  const byType: Record<ChatEntityType, ContextCandidate[]> = {
    understanding: withoutSelected(
      understandings.slice(0, CONTEXT_LOOKUP_LIMIT).map(understandingCandidate),
    ),
    context: withoutSelected(contexts.slice(0, CONTEXT_LOOKUP_LIMIT).map(contextCandidate)),
    canvas: withoutSelected(
      canvases
        .filter(
          (canvas) => !normalizedQuery || canvas.title?.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, CONTEXT_LOOKUP_LIMIT)
        .map(canvasCandidate),
    ),
    domain: withoutSelected(
      domains
        .filter((domain) => !normalizedQuery || domain.name.toLowerCase().includes(normalizedQuery))
        .slice(0, CONTEXT_LOOKUP_LIMIT)
        .map(domainCandidate),
    ),
    conversation: withoutSelected(
      conversations
        .filter((s) => !normalizedQuery || s.title.toLowerCase().includes(normalizedQuery))
        .slice(0, CONTEXT_LOOKUP_LIMIT)
        .map(conversationCandidate),
    ),
  };

  if (type !== "all") return byType[type];

  // 混合列表：按命中质量排序，让精确命中的 domain/canvas 浮到最前，
  // 避免被 understanding/context 的正文命中淹没（stable sort 保序）。
  return [
    ...byType.understanding,
    ...byType.context,
    ...byType.canvas,
    ...byType.domain,
    ...byType.conversation,
  ].sort(
    (a, b) =>
      matchScore(a.title ?? "", a.subtitle, normalizedQuery) -
      matchScore(b.title ?? "", b.subtitle, normalizedQuery),
  );
}

/** 命中质量分：越低越靠前。无查询时全 0（保持输入顺序）。 */
function matchScore(label: string, subtitle: string | undefined, query: string): number {
  if (!query) return 0;
  const l = label.toLowerCase();
  if (l === query) return 0;
  if (l.startsWith(query)) return 10;
  if (l.includes(query)) return 20;
  if (subtitle && subtitle.toLowerCase().includes(query)) return 100;
  return 200;
}
