import { DateTime, Effect, Schema } from "effect";
import ELK, { type ElkNode } from "elkjs";
import { createEntityId } from "../shared/id";
import type { CanvasDocument, CanvasEdgePortId, CanvasElementDTO } from "./types";
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
    width: element.kind === "understanding" ? 260 : element.kind === "canvas_ref" ? 240 : 220,
    height: element.kind === "understanding" ? 220 : element.kind === "canvas_ref" ? 160 : 120,
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

const elk = new ELK();

const layoutDocument = Effect.fn("layoutDocument")(function* (
  document: CanvasDocument,
  direction: LayoutDirection,
) {
  const nodes = new Map<string, ElkNode>(
    document.elements.map((element) => [
      element.id,
      { id: element.id, width: element.width, height: element.height, children: [] },
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
      elk.layout({
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
          "elk.layered.spacing.nodeNodeBetweenLayers": "100",
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
      // 连线呈现默认走 manhattan（正交）路由 + rounded 连接器，与编辑器里
      // 用户手拖新建的边一致（manhattanEdgePath）。agent 的 changes 不携带
      // router/connector——连线样式是呈现层，agent 只描述内容（source/target/label），
      // 不关心呈现。
      router: { name: "manhattan", args: { padding: 16 } },
      connector: { name: "rounded", args: { radius: 8 } },
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
