import type { Domain } from "@shared/domain";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

export const UNASSIGNED_DOMAIN_ID = "__unassigned__";

export type DomainReviewSummary = {
  id: string;
  name: string;
  understandings: UnderstandingSummaryDTO[];
};

export function buildDomainReviewSummaries(
  domains: Domain[],
  understandings: UnderstandingSummaryDTO[],
): DomainReviewSummary[] {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  const childrenByParent = new Map<string, string[]>();

  for (const domain of domains) {
    if (!domain.parentId || !domainById.has(domain.parentId)) continue;
    childrenByParent.set(domain.parentId, [
      ...(childrenByParent.get(domain.parentId) ?? []),
      domain.id,
    ]);
  }

  const collectDomainIds = (rootId: string) => {
    const result = new Set<string>();
    const pending = [rootId];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (result.has(current)) continue;
      result.add(current);
      pending.push(...(childrenByParent.get(current) ?? []));
    }
    return result;
  };

  const roots = domains
    .filter((domain) => !domain.parentId || !domainById.has(domain.parentId))
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const summaries = roots.map((domain) => {
    const domainIds = collectDomainIds(domain.id);
    return {
      id: domain.id,
      name: domain.name,
      understandings: understandings
        .filter((understanding) => understanding.domainIds.some((id) => domainIds.has(id)))
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  });

  const unassigned = understandings.filter((understanding) => understanding.domainIds.length === 0);
  if (unassigned.length > 0) {
    summaries.push({
      id: UNASSIGNED_DOMAIN_ID,
      name: "未归入 Domain",
      understandings: unassigned.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    });
  }

  return summaries.filter((summary) => summary.understandings.length > 0);
}

export function getDomainPath(domainId: string | undefined, domains: Domain[]) {
  if (!domainId) return "未归入 Domain";
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = domainById.get(domainId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? domainById.get(current.parentId) : undefined;
  }

  return names.join(" / ") || "未归入 Domain";
}

export function understandingTitle(understanding: UnderstandingSummaryDTO) {
  return (
    understanding.title?.trim() ||
    understanding.body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ||
    "未命名理解"
  );
}

export function pickWanderUnderstandingId({
  retrievedIds,
  fallbackIds,
  currentId,
  visitedIds,
}: {
  retrievedIds: string[];
  fallbackIds: string[];
  currentId: string;
  visitedIds: string[];
}) {
  const visited = new Set([...visitedIds, currentId]);
  const candidates = [...new Set([...retrievedIds, ...fallbackIds])];

  return (
    candidates.find((id) => !visited.has(id)) ?? candidates.find((id) => id !== currentId) ?? null
  );
}
