/**
 * 实体双链（`[[u:id]]` / `[[c:id]]` / `[[d:id]]` / `[[cv:id]]`）的**唯一解析实现**。
 *
 * 所有解析入口（chat 消息渲染、编辑器 remark 插件、紧凑预览、server 正文归一化、
 * 引用收集/导出）都必须消费这里的 scanner；消费方只允许按自己的策略过滤或
 * 调整选项，不允许再写一份正则。
 *
 * 保护规则（默认全部开启，见 src/app/entity-reference-codec.test.ts 的历史断言）：
 * - 围栏代码块 / 行内代码（含流式输入时未闭合的代码段）
 * - 被反斜杠转义的 `\[[`（`protectEscapes`）
 * - Markdown 链接 label 内的 `[[u:id]]`（`[label [[u:id]]](url)`，`protectLinkLabels`）
 *
 * 渲染管线（编辑器、紧凑预览）传 `{ protectEscapes: false }`：这些内容域
 * （理解正文 / 上下文正文）的语义是转义引用**是**链接——remark 解析时反斜杠
 * 已被剥掉、且 server 保存时 `normalizeEntityReferenceEscapes` 会把历史转义
 * 数据归一化为真链接，与 chat 内容（agent 产出文本，转义=字面量）策略不同。
 */

export type EntityReferenceType =
  | "understanding"
  | "context"
  | "domain"
  | "canvas"
  | "conversation";

export type EntityReference = {
  type: EntityReferenceType;
  id: string;
};

export type EntityReferenceHit = {
  reference: EntityReference;
  /** 命中在原文中的 [start, end) 区间。 */
  start: number;
  end: number;
  /** 命中的原始文本（`[[u:id]]`）。 */
  source: string;
};

export type ScanEntityReferenceOptions = {
  /** 跳过被反斜杠转义的引用（chat 默认 true；编辑器/紧凑预览传 false）。 */
  protectEscapes?: boolean;
  /** 跳过 Markdown 链接 label 内的引用（默认 true）。 */
  protectLinkLabels?: boolean;
};

export const entityTypeByPrefix = {
  cv: "canvas",
  u: "understanding",
  c: "context",
  d: "domain",
  s: "conversation",
} as const satisfies Record<string, EntityReferenceType>;

export const prefixByEntityType = {
  understanding: "u",
  context: "c",
  domain: "d",
  canvas: "cv",
  conversation: "s",
} as const satisfies Record<EntityReferenceType, string>;

const ENTITY_REFERENCE_PATTERN = /\[\[((?:cv|u|c|d|s)):([A-Za-z0-9_-]+)\]\]/g;
const ENTITY_REFERENCE_SOURCE_PATTERN = /^\[\[((?:cv|u|c|d|s)):([A-Za-z0-9_-]+)\]\]$/;
const ESCAPED_ENTITY_REFERENCE_PATTERN = /\\\[\\\[((?:cv|u|c|d|s)):([A-Za-z0-9_-]+)\]\]/g;

type Range = {
  start: number;
  end: number;
};

function entityTypeFromPrefix(prefix: string): EntityReferenceType {
  return entityTypeByPrefix[prefix as keyof typeof entityTypeByPrefix] ?? "domain";
}

export function formatEntityReference(reference: EntityReference): string {
  return `[[${prefixByEntityType[reference.type]}:${reference.id}]]`;
}

export function parseEntityReference(source: string): EntityReference | null {
  const match = ENTITY_REFERENCE_SOURCE_PATTERN.exec(source.trim());
  return match ? { type: entityTypeFromPrefix(match[1]), id: match[2] } : null;
}

/** 把历史/导入数据里被转义的引用（`\[\[u:id]]`）归一化为规范形态（全部 4 种前缀，
 *  旧实现只处理 u；理解正文保存时走这里，转义引用=真链接是内容域既定语义）。 */
export function normalizeEntityReferenceEscapes(body: string | undefined): string | undefined {
  return body?.replaceAll(
    ESCAPED_ENTITY_REFERENCE_PATTERN,
    (_match, prefix: string, id: string) => {
      return formatEntityReference({ type: entityTypeFromPrefix(prefix), id });
    },
  );
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

/** 扫描 markdown 中所有未受保护的实体引用，按原文位置顺序返回（不去重）。 */
export function scanEntityReferences(
  markdown: string,
  options: ScanEntityReferenceOptions = {},
): EntityReferenceHit[] {
  const { protectEscapes = true, protectLinkLabels = true } = options;
  const hits: EntityReferenceHit[] = [];
  const protectedRanges = codeRanges(markdown);
  let rangeIndex = 0;

  for (const match of markdown.matchAll(ENTITY_REFERENCE_PATTERN)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const end = start + match[0].length;

    while (protectedRanges[rangeIndex] && start >= protectedRanges[rangeIndex].end) {
      rangeIndex += 1;
    }
    const range = protectedRanges[rangeIndex];
    if (range && start >= range.start) continue;
    if (protectEscapes && isEscaped(markdown, start)) continue;
    if (protectLinkLabels && isMarkdownLinkLabel(markdown, start, end)) continue;

    hits.push({
      reference: { type: entityTypeFromPrefix(match[1]), id: match[2] },
      start,
      end,
      source: match[0],
    });
  }

  return hits;
}

/** 收集去重后的实体引用（按首次出现顺序）。 */
export function collectEntityReferences(
  markdown: string,
  options: ScanEntityReferenceOptions = {},
): EntityReference[] {
  const seen = new Map<string, EntityReference>();
  for (const hit of scanEntityReferences(markdown, options)) {
    const key = `${hit.reference.type}:${hit.reference.id}`;
    if (!seen.has(key)) seen.set(key, hit.reference);
  }
  return [...seen.values()];
}

/** 替换所有未受保护的引用；`replace` 返回每处命中的替换文本。 */
export function replaceEntityReferences(
  markdown: string,
  replace: (reference: EntityReference, source: string) => string,
  options: ScanEntityReferenceOptions = {},
): string {
  const hits = scanEntityReferences(markdown, options);
  if (hits.length === 0) return markdown;

  let result = "";
  let cursor = 0;
  for (const hit of hits) {
    result += markdown.slice(cursor, hit.start);
    result += replace(hit.reference, hit.source);
    cursor = hit.end;
  }
  return result + markdown.slice(cursor);
}
