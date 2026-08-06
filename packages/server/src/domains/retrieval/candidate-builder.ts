import type { UnderstandingSummary } from "../understanding/types";
import type {
  CandidateMatch,
  RetrievalSearchHit,
  UnderstandingCandidate,
} from "./types";

export type RankedRetrievalHit = RetrievalSearchHit & { rank: number; snippet: string };

type CandidateWithRank = UnderstandingCandidate & { bestRank: number };

function matchFor(hit: RankedRetrievalHit): CandidateMatch {
  const dense = hit.channels.includes("dense");
  const reason =
    hit.entityType === "context"
      ? dense
        ? "semantic hit on Context"
        : "lexical hit on Context"
      : dense
        ? "semantic hit on Understanding"
        : "lexical hit on Understanding";
  return {
    entityType: hit.entityType,
    id: hit.entityId,
    medium: hit.metadata.medium ?? "",
    title: hit.metadata.title ?? null,
    snippet: hit.snippet,
    channels: hit.channels,
    rank: hit.rank,
    reason,
  };
}

export function buildUnderstandingCandidates({
  hits,
  understandings,
}: {
  hits: RankedRetrievalHit[];
  understandings: UnderstandingSummary[];
}): UnderstandingCandidate[] {
  const summaryById = new Map(
    understandings.map((understanding) => [understanding.id, understanding]),
  );
  const candidates = new Map<string, CandidateWithRank>();

  for (const hit of hits) {
    const summary = summaryById.get(hit.parentUnderstandingId);
    if (!summary) continue;

    let candidate = candidates.get(hit.parentUnderstandingId);
    if (!candidate) {
      candidate = {
        id: summary.id,
        type: "understanding",
        title: summary.title,
        snippet: hit.snippet,
        score: hit.score,
        matches: [],
        suggestedRead: {
          tool: "understanding_get",
          input: { understandingId: summary.id, includeContexts: true },
        },
        bestRank: hit.rank,
      };
      candidates.set(summary.id, candidate);
    }

    candidate.score = Math.max(candidate.score, hit.score);
    candidate.bestRank = Math.min(candidate.bestRank, hit.rank);
    candidate.matches.push(matchFor(hit));
  }

  return [...candidates.values()]
    .sort((left, right) => left.bestRank - right.bestRank)
    .map(({ bestRank: _bestRank, ...candidate }) => candidate);
}
