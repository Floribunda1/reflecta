import type { UnderstandingSummaryDTO } from "@shared/understanding";

export function getUnderstandingTitle(understanding: UnderstandingSummaryDTO): string {
  const title = understanding.title?.trim();
  if (title) return title;

  const firstLine = understanding.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}
