import { createHash } from "node:crypto";
import type { RetrievalDocument } from "./types";

export type RetrievalProjectionSource = {
  understanding: {
    id: string;
    title: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
  };
  domains: Array<{ id: string; name: string }>;
  contexts: Array<{
    id: string;
    medium: string;
    title: string | null;
    content: string;
    createdAt: string;
  }>;
};

function compactLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function buildRetrievalDocuments(source: RetrievalProjectionSource): RetrievalDocument[] {
  const { understanding } = source;
  const domains = [...source.domains].sort((left, right) => left.id.localeCompare(right.id));
  const contexts = [...source.contexts].sort((left, right) => left.id.localeCompare(right.id));
  const domainIds = domains.map((domain) => domain.id);
  const domainNames = domains.map((domain) => domain.name);
  const domainText = domainNames.length > 0 ? `Domain: ${domainNames.join(" / ")}` : null;
  const title = understanding.title ?? null;
  const understandingLabel = title ?? understanding.id;

  const understandingText = compactLines([
    `Understanding: ${understandingLabel}`,
    domainText,
    understanding.body,
  ]);

  const docs: Array<Omit<RetrievalDocument, "contentHash">> = [
    {
      id: `understanding:${understanding.id}`,
      entityType: "understanding",
      entityId: understanding.id,
      parentUnderstandingId: understanding.id,
      textForEmbedding: understandingText,
      textForLexicalSearch: compactLines([title, domainNames.join(" "), understanding.body]),
      metadata: {
        domainIds,
        domainNames,
        title,
        createdAt: understanding.createdAt,
        updatedAt: understanding.updatedAt,
      },
    },
  ];

  for (const context of contexts) {
    docs.push({
      id: `context:${context.id}`,
      entityType: "context",
      entityId: context.id,
      parentUnderstandingId: understanding.id,
      textForEmbedding: compactLines([
        `Parent Understanding: ${understandingLabel}`,
        domainText,
        `Context medium: ${context.medium}`,
        context.title ? `Context title: ${context.title}` : null,
        context.content,
      ]),
      textForLexicalSearch: compactLines([
        title,
        domainNames.join(" "),
        context.medium,
        context.title,
        context.content,
      ]),
      metadata: {
        domainIds,
        domainNames,
        medium: context.medium,
        title: context.title,
        createdAt: context.createdAt,
        updatedAt: understanding.updatedAt,
      },
    });
  }

  return docs.map((doc) => ({
    ...doc,
    contentHash: createHash("sha256").update(JSON.stringify(doc)).digest("hex"),
  }));
}
