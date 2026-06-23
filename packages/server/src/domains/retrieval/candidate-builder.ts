import type { UnderstandingSummary } from "../understanding/types";
import type {
  CandidateEvidence,
  MatchedContext,
  RetrievalSearchHit,
  UnderstandingCandidate,
} from "./types";

export type RankedRetrievalHit = RetrievalSearchHit & { rank: number; snippet: string };

type CandidateWithRank = UnderstandingCandidate & { bestRank: number };

function evidenceFor(hit: RankedRetrievalHit): CandidateEvidence[] {
  return hit.channels.map((channel) => ({
    channel,
    documentId: hit.id,
    entityType: hit.entityType,
    score: hit.score,
    rank: hit.rank,
    reason:
      channel === "dense"
        ? "semantic similarity on RetrievalDocument"
        : "lexical hit on RetrievalDocument",
  }));
}

function matchedContextFor(hit: RankedRetrievalHit): MatchedContext {
  const reason = hit.channels.includes("dense")
    ? "semantic hit on Context"
    : "lexical hit on Context";
  return {
    contextId: hit.entityId,
    medium: hit.metadata.medium ?? "",
    title: hit.metadata.title ?? null,
    snippet: hit.snippet,
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
        matchedContexts: [],
        suggestedRead: {
          tool: "understanding_get",
          input: { understandingId: summary.id, includeContexts: true },
        },
        evidence: [],
        bestRank: hit.rank,
      };
      candidates.set(summary.id, candidate);
    }

    candidate.score = Math.max(candidate.score, hit.score);
    candidate.bestRank = Math.min(candidate.bestRank, hit.rank);
    candidate.evidence.push(...evidenceFor(hit));
    if (hit.entityType === "context") {
      candidate.matchedContexts.push(matchedContextFor(hit));
    }
  }

  return [...candidates.values()]
    .sort((left, right) => left.bestRank - right.bestRank)
    .map(({ bestRank: _bestRank, ...candidate }) => candidate);
}
