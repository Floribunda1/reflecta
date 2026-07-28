import type { ChatEntityReference, ChatEntityType } from "../entity";
import { entityKey } from "../entity-visual";

const DIRECT_REFERENCE_PATTERN = /\[\[([ucd]):([A-Za-z0-9_-]+)\]\]/g;

type Range = {
  start: number;
  end: number;
};

function entityTypeFromPrefix(prefix: string): ChatEntityType {
  if (prefix === "u") return "understanding";
  if (prefix === "c") return "context";
  return "domain";
}

function fencedCodeRanges(markdown: string) {
  const ranges: Range[] = [];
  const lines = markdown.matchAll(/^.*(?:\n|$)/gm);
  let fence: { character: "`" | "~"; length: number; start: number } | undefined;

  for (const match of lines) {
    const line = match[0];
    if (!line) continue;
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!marker) continue;

    const sequence = marker[1];
    const character = sequence[0] as "`" | "~";
    if (!fence) {
      fence = { character, length: sequence.length, start: match.index };
      continue;
    }
    if (character !== fence.character || sequence.length < fence.length) continue;

    ranges.push({ start: fence.start, end: match.index + line.length });
    fence = undefined;
  }

  if (fence) ranges.push({ start: fence.start, end: markdown.length });
  return ranges;
}

function codeRanges(markdown: string) {
  const ranges = fencedCodeRanges(markdown);
  let rangeIndex = 0;

  for (let index = 0; index < markdown.length; index += 1) {
    while (ranges[rangeIndex] && index >= ranges[rangeIndex].end) rangeIndex += 1;
    const fencedRange = ranges[rangeIndex];
    if (fencedRange && index >= fencedRange.start) {
      index = fencedRange.end - 1;
      continue;
    }
    if (markdown[index] !== "`") continue;

    let length = 1;
    while (markdown[index + length] === "`") length += 1;
    const delimiter = "`".repeat(length);
    const end = markdown.indexOf(delimiter, index + length);
    ranges.push({
      start: index,
      end: end === -1 ? markdown.length : end + length,
    });
    index = (end === -1 ? markdown.length : end + length) - 1;
  }

  return ranges.sort((left, right) => left.start - right.start);
}

function isEscaped(markdown: string, offset: number) {
  let slashCount = 0;
  for (let index = offset - 1; index >= 0 && markdown[index] === "\\"; index -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function isMarkdownLinkLabel(markdown: string, start: number, end: number) {
  if (markdown[end] === "(") return true;
  const openLabel = markdown.lastIndexOf("[", start - 1);
  const closedLabel = markdown.lastIndexOf("]", start - 1);
  if (openLabel <= closedLabel) return false;

  const linkEnd = markdown.indexOf("](", end);
  const lineEnd = markdown.indexOf("\n", end);
  return linkEnd >= 0 && (lineEnd === -1 || linkEnd < lineEnd);
}

export function replaceChatEntityReferences(
  markdown: string,
  replace: (reference: ChatEntityReference, source: string) => string,
) {
  const protectedRanges = codeRanges(markdown);
  let rangeIndex = 0;

  return markdown.replace(
    DIRECT_REFERENCE_PATTERN,
    (source, prefix: string, id: string, offset: number) => {
      while (protectedRanges[rangeIndex] && offset >= protectedRanges[rangeIndex].end) {
        rangeIndex += 1;
      }
      const range = protectedRanges[rangeIndex];
      if (
        (range && offset >= range.start) ||
        isEscaped(markdown, offset) ||
        isMarkdownLinkLabel(markdown, offset, offset + source.length)
      ) {
        return source;
      }
      return replace({ type: entityTypeFromPrefix(prefix), id }, source);
    },
  );
}

export function collectChatEntityReferences(markdown: string) {
  const references = new Map<string, ChatEntityReference>();
  replaceChatEntityReferences(markdown, (reference, source) => {
    references.set(entityKey(reference), reference);
    return source;
  });
  return [...references.values()];
}
