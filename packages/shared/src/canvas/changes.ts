import { DateTime, Effect, Schema } from "effect";
import ELK, { type ElkNode } from "elkjs";
import { createEntityId } from "./id";
import type { CanvasDocument, CanvasEdgePortId, CanvasElementDTO } from "./document";
import { assertValidDocument, CanvasValidationError } from "./validate";

export type LayoutDirection = "auto" | "horizontal" | "vertical";

export type CanvasAddableElementSpec =
  | { kind: "text"; text: string }
  | { kind: "understanding"; understandingId: string }
  | { kind: "canvas_ref"; canvasRefId: string };

export type CanvasElementSpec = CanvasAddableElementSpec | { kind: "group"; label: string };

export type CanvasGraphChange =
  | { op: "add_element"; ref: string; element: CanvasAddableElementSpec; parentRef?: string | null }
  | { op: "update_element"; ref: string; after: CanvasElementSpec; parentRef?: string | null }
  | { op: "remove_element"; ref: string }
  | { op: "add_edge"; ref: string; sourceRef: string; targetRef: string; label?: string }
  | {
      op: "update_edge";
      ref: string;
      sourceRef?: string;
      targetRef?: string;
      label?: string | null;
    }
  | { op: "remove_edge"; ref: string }
  | { op: "group"; ref: string; label: string; elementRefs: string[]; parentRef?: string | null }
  | { op: "ungroup"; ref: string };

export type CanvasUpdateOnlyChange =
  | { op: "set_title"; title: string }
  | { op: "relayout"; direction: LayoutDirection };

export type CanvasUpdateChange = CanvasGraphChange | CanvasUpdateOnlyChange;

export type NormalizeCanvasChangesInput = {
  base?: CanvasDocument;
  changes: readonly CanvasUpdateChange[];
  layout?: LayoutDirection;
};

export class CanvasChangeError extends Schema.TaggedError<CanvasChangeError>()(
  "CanvasChangeError",
  { message: Schema.String },
) {}

// —— text 卡高度：确定性单逻辑（估算校准版）——
// 服务端不渲染 DOM，尺寸必须由同一确定性函数算出（布局/存储/渲染共用，所见即所存）。
// 常量为离线实测校准：单行卡真实高 ≈57px、真实行高 ≈28px（text 卡正文 p-2 + 14px 字号）。
// 策略：估算**略微偏大**（BREATHING + MIN 地板 + markdown 块余量）——内容永远放得下，
// 不会出现"估矮了 → 正文溢出滚动条"的非预期行为；代价只是卡片略宽松。
const TEXT_CARD_WIDTH = 220;
const TEXT_FONT_SIZE = 14;
const TEXT_LINE_HEIGHT = 28; // 实测校准
const TEXT_H_PADDING = 16; // p-2 × 2
const TEXT_V_PADDING = 16; // p-2 × 2
const TEXT_CARD_BORDER = 2;
const TEXT_MIN_HEIGHT = 64; // 实测单行 57 + 呼吸
const TEXT_MAX_HEIGHT = 300;
/** 全文额外余量，保证算出的高度 ≥ 真实渲染高。 */
const TEXT_BREATHING = 8;
/** markdown 块级行（标题/列表/引用/代码/表格）额外加高（确定性块模型，CSS 变则同步）。 */
const TEXT_BLOCK_EXTRA = 10;

/** understanding 卡：prod 实测正文均值313/中位275/p75=413 字；宽340行数≈23。
 * 480 高让中位卡基本读完整（更长卡走卡内滚动），比旧 260×220 大幅改善。 */
const UNDERSTANDING_CARD_WIDTH = 340;
const UNDERSTANDING_CARD_HEIGHT = 480;

/** 全角字符（中文/全宽标点等）按 1 个字宽，其余按 0.5。 */
const FULL_WIDTH_RE =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u3000-\u303f]/;

const MARKDOWN_BLOCK_LINE_RE = /^\s*(#{1,6}[ \t]|[-*+][ \t]|\d+\.[ \t]|>[ \t]|```|~~~|\|)/;

/** 按固定宽折行，估算 markdown 正文所需高度（确定性、可 server 端计算）。 */
function estimateTextHeight(markdown: string): number {
  const charsPerLine = Math.max(1, Math.floor((TEXT_CARD_WIDTH - TEXT_H_PADDING) / TEXT_FONT_SIZE));
  let lines = 0;
  let blockLines = 0;
  for (const segment of markdown.split("\n")) {
    if (segment.trim().length === 0) {
      lines += 1;
      continue;
    }
    if (MARKDOWN_BLOCK_LINE_RE.test(segment)) blockLines += 1;
    let units = 0;
    for (const ch of segment) units += FULL_WIDTH_RE.test(ch) ? 1 : 0.5;
    lines += Math.max(1, Math.ceil(units / charsPerLine));
  }
  const raw =
    Math.round(lines * TEXT_LINE_HEIGHT + TEXT_V_PADDING + TEXT_CARD_BORDER) +
    blockLines * TEXT_BLOCK_EXTRA +
    TEXT_BREATHING;
  return Math.min(TEXT_MAX_HEIGHT, Math.max(TEXT_MIN_HEIGHT, raw));
}

const elementContent = (
  element: CanvasElementSpec,
): Pick<CanvasElementDTO, "kind" | "understandingId" | "canvasRefId" | "props"> => {
  switch (element.kind) {
    case "text":
      return {
        kind: "text",
        understandingId: null,
        canvasRefId: null,
        props: { text: element.text },
      };
    case "understanding":
      return {
        kind: "understanding",
        understandingId: element.understandingId,
        canvasRefId: null,
        props: {},
      };
    case "canvas_ref":
      return {
        kind: "canvas_ref",
        understandingId: null,
        canvasRefId: element.canvasRefId,
        props: {},
      };
    case "group":
      return {
        kind: "group",
        understandingId: null,
        canvasRefId: null,
        props: { label: element.label },
      };
  }
};

const elementFrom = (
  id: string,
  element: CanvasElementSpec,
  parentId: string | null,
  timestamp: string,
): CanvasElementDTO =>
  ({
    id,
    canvasId: "",
    parentId,
    x: 0,
    y: 0,
    width:
      element.kind === "understanding"
        ? UNDERSTANDING_CARD_WIDTH
        : element.kind === "canvas_ref"
          ? 240
          : 220,
    height:
      element.kind === "understanding"
        ? UNDERSTANDING_CARD_HEIGHT
        : element.kind === "canvas_ref"
          ? 160
          : element.kind === "text"
            ? estimateTextHeight(element.text)
            : 120,
    zIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...elementContent(element),
  }) as CanvasElementDTO;

const absolutePositionOf = (
  element: CanvasElementDTO,
  elements: readonly CanvasElementDTO[],
): { x: number; y: number } => {
  if (!element.parentId) return { x: element.x, y: element.y };
  const parent = elements.find(({ id }) => id === element.parentId);
  if (!parent) return { x: element.x, y: element.y };
  const position = absolutePositionOf(parent, elements);
  return { x: position.x + element.x, y: position.y + element.y };
};

// 懒创建 ELK 实例：仅在首次布局时构造。避免模块顶层直接 new ELK()——
// 在 Bun/Node 运行时加载 elkjs 会尝试拉起 web worker，导致纯数据工具（如 seed 脚本）导入即崩。
let elk: InstanceType<typeof ELK> | null = null;
function elkInstance(): InstanceType<typeof ELK> {
  if (!elk) elk = new ELK();
  return elk;
}

const layoutDocument = Effect.fn("layoutDocument")(function* (
  document: CanvasDocument,
  direction: LayoutDirection,
) {
  const nodes = new Map<string, ElkNode>(
    document.elements.map((element) => [
      element.id,
      {
        id: element.id,
        width: element.width,
        height: element.height,
        children: [],
        // 组内子节点使用 ELK 默认间距（20），与顶层 layoutOptions 不继承到嵌套布局；
        // 在 group 节点上显式声明，让组内卡片间距与层间间距对齐顶层配置。
        ...(element.kind === "group"
          ? {
              layoutOptions: {
                "elk.spacing.nodeNode": "60",
                "elk.layered.spacing.nodeNodeBetweenLayers": "180",
              },
            }
          : {}),
      },
    ]),
  );
  const roots: ElkNode[] = [];
  for (const element of document.elements) {
    const node = nodes.get(element.id)!;
    const parent = element.parentId ? nodes.get(element.parentId) : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  const graph = yield* Effect.tryPromise({
    try: () =>
      elkInstance().layout({
        id: "root",
        children: roots,
        edges: document.edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source.cell],
          targets: [edge.target.cell],
        })),
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": direction === "vertical" ? "DOWN" : "RIGHT",
          "elk.hierarchyHandling": "INCLUDE_CHILDREN",
          "elk.spacing.nodeNode": "60",
          "elk.layered.spacing.nodeNodeBetweenLayers": "180",
        },
      }),
    catch: (cause) =>
      new CanvasChangeError({
        message: cause instanceof Error ? cause.message : "Canvas layout failed",
      }),
  });
  const positioned = new Map<string, ElkNode>();
  const collect = (node: ElkNode) => {
    positioned.set(node.id, node);
    node.children?.forEach(collect);
  };
  graph.children?.forEach(collect);
  return {
    ...document,
    elements: document.elements.map((element) => {
      const node = positioned.get(element.id);
      return node
        ? {
            ...element,
            x: node.x ?? element.x,
            y: node.y ?? element.y,
            width: node.width ?? element.width,
            height: node.height ?? element.height,
          }
        : element;
    }),
    edges: document.edges.map((edge) => ({
      ...edge,
      source: {
        ...edge.source,
        port: (direction === "vertical" ? "bottom" : "right") as CanvasEdgePortId,
      },
      target: {
        ...edge.target,
        port: (direction === "vertical" ? "top" : "left") as CanvasEdgePortId,
      },
    })),
  };
});

export const normalizeCanvasChanges = Effect.fn("normalizeCanvasChanges")(function* (
  input: NormalizeCanvasChangesInput,
) {
  const timestamp = DateTime.formatIso(yield* DateTime.now);
  let document: CanvasDocument = structuredClone(input.base ?? { elements: [], edges: [] });
  const refs = new Map<string, string>();
  const removedRefs = new Set<string>();
  const addedElementIds = new Set<string>();
  let title: string | undefined;
  let layoutDirection = input.layout ?? (input.base === undefined ? "auto" : undefined);

  for (const change of input.changes) {
    if (change.op === "set_title") {
      if (!change.title.trim()) {
        return yield* new CanvasChangeError({ message: "Canvas title cannot be empty" });
      }
      title = change.title.trim();
      continue;
    }
    if (change.op === "relayout") {
      layoutDirection = change.direction;
      continue;
    }
    if (change.op === "add_element") {
      if (
        removedRefs.has(change.ref) ||
        refs.has(change.ref) ||
        document.elements.some(({ id }) => id === change.ref) ||
        document.edges.some(({ id }) => id === change.ref)
      ) {
        return yield* new CanvasChangeError({ message: `Duplicate ref: ${change.ref}` });
      }
      const resolvedParentId = change.parentRef
        ? (refs.get(change.parentRef) ??
          document.elements.find(({ id }) => id === change.parentRef)?.id)
        : null;
      if (change.parentRef && !resolvedParentId) {
        return yield* new CanvasChangeError({ message: `Unknown ref: ${change.parentRef}` });
      }
      const parentId = resolvedParentId ?? null;
      const id = createEntityId();
      refs.set(change.ref, id);
      addedElementIds.add(id);
      document.elements.push(elementFrom(id, change.element, parentId, timestamp));
      continue;
    }
    if (change.op === "update_element") {
      const index = document.elements.findIndex(
        ({ id }) => id === (refs.get(change.ref) ?? change.ref),
      );
      const current = document.elements[index];
      if (!current) return yield* new CanvasChangeError({ message: `Unknown ref: ${change.ref}` });
      if (current.kind !== change.after.kind) {
        return yield* new CanvasChangeError({
          message: `Cannot change element kind: ${change.ref}`,
        });
      }
      const parentId =
        change.parentRef === undefined
          ? current.parentId
          : change.parentRef === null
            ? null
            : (refs.get(change.parentRef) ?? change.parentRef);
      document.elements[index] = {
        ...current,
        ...elementContent(change.after),
        parentId,
        updatedAt: timestamp,
        ...(change.after.kind === "text" ? { height: estimateTextHeight(change.after.text) } : {}),
      } as CanvasElementDTO;
      continue;
    }
    if (change.op === "remove_element") {
      const id = refs.get(change.ref) ?? change.ref;
      if (!document.elements.some((element) => element.id === id)) {
        return yield* new CanvasChangeError({ message: `Unknown ref: ${change.ref}` });
      }
      const removedIds = new Set([id]);
      let size = 0;
      while (size !== removedIds.size) {
        size = removedIds.size;
        for (const element of document.elements) {
          if (element.parentId && removedIds.has(element.parentId)) removedIds.add(element.id);
        }
      }
      document.elements = document.elements.filter((element) => !removedIds.has(element.id));
      document.edges = document.edges.filter(
        (edge) => !removedIds.has(edge.source.cell) && !removedIds.has(edge.target.cell),
      );
      removedRefs.add(change.ref);
      continue;
    }
    if (change.op === "group") {
      if (new Set(change.elementRefs).size < 2) {
        return yield* new CanvasChangeError({ message: "A group needs at least two elements" });
      }
      if (
        removedRefs.has(change.ref) ||
        refs.has(change.ref) ||
        document.elements.some(({ id }) => id === change.ref) ||
        document.edges.some(({ id }) => id === change.ref)
      ) {
        return yield* new CanvasChangeError({ message: `Duplicate ref: ${change.ref}` });
      }
      const ids = change.elementRefs.map((ref) => refs.get(ref) ?? ref);
      const candidates = ids.map((id) => document.elements.find((element) => element.id === id));
      if (candidates.some((element) => !element)) {
        const missing = change.elementRefs[candidates.findIndex((element) => !element)];
        return yield* new CanvasChangeError({ message: `Unknown ref: ${missing}` });
      }
      const selected = candidates as CanvasElementDTO[];
      const boxes = selected.map((element) => ({
        element,
        position: absolutePositionOf(element, document.elements),
      }));
      const minX = Math.min(...boxes.map(({ position }) => position.x));
      const minY = Math.min(...boxes.map(({ position }) => position.y));
      const maxX = Math.max(...boxes.map(({ element, position }) => position.x + element.width));
      const maxY = Math.max(...boxes.map(({ element, position }) => position.y + element.height));
      const parentId =
        change.parentRef === undefined
          ? selected.every((element) => element.parentId === selected[0].parentId)
            ? selected[0].parentId
            : null
          : change.parentRef === null
            ? null
            : (refs.get(change.parentRef) ?? change.parentRef);
      const parent = parentId
        ? document.elements.find((element) => element.id === parentId)
        : undefined;
      if (parentId && !parent) {
        return yield* new CanvasChangeError({ message: `Unknown ref: ${change.parentRef}` });
      }
      const parentPosition = parent
        ? absolutePositionOf(parent, document.elements)
        : { x: 0, y: 0 };
      const groupPosition = { x: minX - 24, y: minY - 44 };
      const id = createEntityId();
      const group = elementFrom(id, { kind: "group", label: change.label }, parentId, timestamp);
      group.x = groupPosition.x - parentPosition.x;
      group.y = groupPosition.y - parentPosition.y;
      group.width = maxX - minX + 48;
      group.height = maxY - minY + 68;
      group.zIndex = -1;
      const selectedIds = new Set(ids);
      document.elements = document.elements.map((element) => {
        if (!selectedIds.has(element.id)) return element;
        const position = absolutePositionOf(element, document.elements);
        return {
          ...element,
          parentId: id,
          x: position.x - groupPosition.x,
          y: position.y - groupPosition.y,
        };
      });
      const insertAt = document.elements.findIndex((element) => selectedIds.has(element.id));
      document.elements.splice(insertAt, 0, group);
      refs.set(change.ref, id);
      addedElementIds.add(id);
      continue;
    }
    if (change.op === "ungroup") {
      const id = refs.get(change.ref) ?? change.ref;
      const group = document.elements.find((element) => element.id === id);
      if (group?.kind !== "group") {
        return yield* new CanvasChangeError({ message: `Unknown group ref: ${change.ref}` });
      }
      const groupPosition = absolutePositionOf(group, document.elements);
      const parent = group.parentId
        ? document.elements.find((element) => element.id === group.parentId)
        : undefined;
      const parentPosition = parent
        ? absolutePositionOf(parent, document.elements)
        : { x: 0, y: 0 };
      document.elements = document.elements.flatMap((element) => {
        if (element.id === id) return [];
        if (element.parentId !== id) return [element];
        return [
          {
            ...element,
            parentId: group.parentId,
            x: groupPosition.x + element.x - parentPosition.x,
            y: groupPosition.y + element.y - parentPosition.y,
          },
        ];
      });
      removedRefs.add(change.ref);
      continue;
    }
    if (change.op === "remove_edge") {
      const id = refs.get(change.ref) ?? change.ref;
      const index = document.edges.findIndex((edge) => edge.id === id);
      if (index < 0) return yield* new CanvasChangeError({ message: `Unknown ref: ${change.ref}` });
      document.edges.splice(index, 1);
      removedRefs.add(change.ref);
      continue;
    }
    if (change.op === "update_edge") {
      if (
        change.sourceRef === undefined &&
        change.targetRef === undefined &&
        change.label === undefined
      ) {
        return yield* new CanvasChangeError({ message: `Empty edge update: ${change.ref}` });
      }
      const id = refs.get(change.ref) ?? change.ref;
      const index = document.edges.findIndex((edge) => edge.id === id);
      const current = document.edges[index];
      if (!current) return yield* new CanvasChangeError({ message: `Unknown ref: ${change.ref}` });
      const elementIds = new Set(document.elements.map((element) => element.id));
      const resolveElement = (ref: string | undefined) =>
        ref === undefined ? undefined : (refs.get(ref) ?? (elementIds.has(ref) ? ref : undefined));
      const sourceId = resolveElement(change.sourceRef);
      const targetId = resolveElement(change.targetRef);
      if (change.sourceRef !== undefined && !sourceId) {
        return yield* new CanvasChangeError({ message: `Unknown ref: ${change.sourceRef}` });
      }
      if (change.targetRef !== undefined && !targetId) {
        return yield* new CanvasChangeError({ message: `Unknown ref: ${change.targetRef}` });
      }
      document.edges[index] = {
        ...current,
        source: sourceId ? { ...current.source, cell: sourceId } : current.source,
        target: targetId ? { ...current.target, cell: targetId } : current.target,
        label: change.label === undefined ? current.label : change.label,
      };
      continue;
    }

    if (
      removedRefs.has(change.ref) ||
      refs.has(change.ref) ||
      document.elements.some(({ id }) => id === change.ref) ||
      document.edges.some(({ id }) => id === change.ref)
    ) {
      return yield* new CanvasChangeError({ message: `Duplicate ref: ${change.ref}` });
    }
    const elementIds = new Set(document.elements.map(({ id }) => id));
    const sourceId =
      refs.get(change.sourceRef) ??
      (elementIds.has(change.sourceRef) ? change.sourceRef : undefined);
    const targetId =
      refs.get(change.targetRef) ??
      (elementIds.has(change.targetRef) ? change.targetRef : undefined);
    if (!sourceId || !targetId) {
      return yield* new CanvasChangeError({
        message: `Unknown edge ref: ${!sourceId ? change.sourceRef : change.targetRef}`,
      });
    }
    const id = createEntityId();
    refs.set(change.ref, id);
    document.edges.push({
      id,
      canvasId: "",
      source: { cell: sourceId, port: "right" },
      target: { cell: targetId, port: "left" },
      // 连线呈现默认走 reflecta-curve（曲线），与编辑器里用户手拖新建的边一致
      // （curveEdgePath）。agent 的 changes 不携带 router/connector——连线样式是
      // 呈现层，agent 只描述内容（source/target/label），不关心呈现。正交/直线是
      // 用户在画布里可选的其他样式，不作为生成默认。
      router: { name: "reflecta-curve" },
      connector: { name: "reflecta-curve" },
      attrs: {
        line: {
          stroke: "var(--muted-foreground)",
          strokeWidth: 2,
          targetMarker: { name: "classic", width: 10, height: 8 },
        },
        lines: { connection: true, strokeLinejoin: "round" },
        wrap: { strokeWidth: 10 },
      },
      label: change.label ?? null,
      createdAt: timestamp,
    });
  }

  try {
    assertValidDocument(document);
  } catch (error) {
    return yield* new CanvasChangeError({
      message: error instanceof CanvasValidationError ? error.message : "Invalid canvas changes",
    });
  }
  if (layoutDirection) {
    document = yield* layoutDocument(document, layoutDirection);
  } else if (addedElementIds.size > 0) {
    // ponytail: anchor ELK to one existing root; use fixed-node constraints if dense updates overlap.
    const proposed = yield* layoutDocument(document, "auto");
    const anchor =
      document.elements.find(
        (element) => element.parentId === null && !addedElementIds.has(element.id),
      ) ?? document.elements.find((element) => !addedElementIds.has(element.id));
    const proposedAnchor = anchor
      ? proposed.elements.find((element) => element.id === anchor.id)
      : undefined;
    const offset =
      anchor && proposedAnchor
        ? { x: anchor.x - proposedAnchor.x, y: anchor.y - proposedAnchor.y }
        : { x: 0, y: 0 };
    const proposedById = new Map(proposed.elements.map((element) => [element.id, element]));
    document = {
      ...document,
      elements: document.elements.map((element) => {
        if (!addedElementIds.has(element.id)) return element;
        const position = proposedById.get(element.id);
        if (!position) return element;
        const nested = element.parentId !== null && addedElementIds.has(element.parentId);
        return {
          ...element,
          x: position.x + (nested ? 0 : offset.x),
          y: position.y + (nested ? 0 : offset.y),
          width: position.width,
          height: position.height,
        };
      }),
    };
  }
  return { document, ...(title === undefined ? {} : { title }) };
});
