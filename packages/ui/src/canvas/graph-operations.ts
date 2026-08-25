import type { CanvasDocument, CanvasElementDTO } from "@reflecta/shared";

/**
 * 画布图操作（纯函数、引擎无关）。
 *
 * 输入输出都是 `CanvasDocument`（元素 / 连线 DTO），不依赖任何渲染引擎；
 * 组内子元素坐标为「相对父节点」语义（与 document.ts 契约一致）。
 * X6 adapter 在打组 / 解组 / 删组后调用这些纯函数产出新文档，再落回 X6 model。
 */

type GroupSeed = {
  id: string;
  canvasId: string;
  createdAt: string;
};

type ElementIndex = ReadonlyMap<string, CanvasElementDTO>;

export const byId = (elements: readonly CanvasElementDTO[]): ElementIndex =>
  new Map(elements.map((element) => [element.id, element]));

/** 元素的绝对坐标（相对画布左上角）：沿 parentId 链累加相对坐标。 */
export function absolutePositionOf(
  element: CanvasElementDTO,
  index: ElementIndex,
): { x: number; y: number } {
  if (!element.parentId) return { x: element.x, y: element.y };
  const parent = index.get(element.parentId);
  if (!parent) return { x: element.x, y: element.y };
  const parentPosition = absolutePositionOf(parent, index);
  return { x: parentPosition.x + element.x, y: parentPosition.y + element.y };
}

const comparableToRelative = (
  absolute: { x: number; y: number },
  parentPosition: { x: number; y: number },
): { x: number; y: number } => ({
  x: absolute.x - parentPosition.x,
  y: absolute.y - parentPosition.y,
});

/** 同一父节点的引用（用于相对坐标换算），缺省为 {0,0}。 */
const sharedParentPosition = (
  parentId: string | null,
  index: ElementIndex,
): { x: number; y: number } =>
  parentId ? absolutePositionOf(index.get(parentId)!, index) : { x: 0, y: 0 };

export const isSelectedWithAncestor = (
  id: string,
  selected: ReadonlySet<string>,
  index: ElementIndex,
) => {
  let current = index.get(id);
  while (current?.parentId) {
    if (selected.has(current.parentId)) return true;
    current = index.get(current.parentId);
  }
  return false;
};

/**
 * 选中集合中「顶层」（无被选中祖先）的元素 id：置顶/置底/重复/删除的原子分支单位。
 * 带组的选中 → 只返回组本身（组内后代靠组继承）；跨多个分支 → 各分支根都返回。
 */
export function selectionRootIds(
  document: CanvasDocument,
  nodeIds: ReadonlyArray<string>,
): string[] {
  const index = byId(document.elements);
  const selected = new Set(nodeIds);
  return document.elements
    .filter(
      (element) => selected.has(element.id) && !isSelectedWithAncestor(element.id, selected, index),
    )
    .map((element) => element.id);
}

/** 把被选中元素打成一个组（外壳复用现有几何约定：左/上留 24/44 内边距）。 */
export function groupElements(
  document: CanvasDocument,
  nodeIds: ReadonlyArray<string>,
  seed: GroupSeed,
): CanvasDocument {
  const index = byId(document.elements);
  const selected = new Set(nodeIds);
  const candidates = document.elements.filter((element) => {
    if (!selected.has(element.id)) return false;
    return !isSelectedWithAncestor(element.id, selected, index);
  });
  if (candidates.length < 2) return document;

  const candidateIds = new Set(candidates.map((element) => element.id));
  const boxes = candidates.map((element) => ({
    element,
    position: absolutePositionOf(element, index),
  }));
  const minX = Math.min(...boxes.map((box) => box.position.x));
  const minY = Math.min(...boxes.map((box) => box.position.y));
  const maxX = Math.max(...boxes.map((box) => box.position.x + box.element.width));
  const maxY = Math.max(...boxes.map((box) => box.position.y + box.element.height));
  const groupAbsolute = { x: minX - 24, y: minY - 44 };

  const sharedParentId = candidates.every((element) => element.parentId === candidates[0].parentId)
    ? candidates[0].parentId
    : null;
  const parentPosition = sharedParentPosition(sharedParentId, index);
  const groupPosition = comparableToRelative(groupAbsolute, parentPosition);

  const group: CanvasElementDTO = {
    id: seed.id,
    canvasId: seed.canvasId,
    parentId: sharedParentId,
    x: groupPosition.x,
    y: groupPosition.y,
    width: maxX - minX + 48,
    height: maxY - minY + 68,
    zIndex: -1,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "" },
  };

  const groupIndex = document.elements.findIndex((element) => candidateIds.has(element.id));
  const elements = document.elements.map((element) => {
    if (!candidateIds.has(element.id)) return element;
    const position = absolutePositionOf(element, index);
    return {
      ...element,
      parentId: seed.id,
      x: position.x - groupAbsolute.x,
      y: position.y - groupAbsolute.y,
    };
  });
  return {
    ...document,
    elements: [...elements.slice(0, groupIndex), group, ...elements.slice(groupIndex)],
  };
}

/** 解组：被选组内的成员回到组的父级，坐标换算为相对新的父节点。 */
export function ungroupGroups(
  document: CanvasDocument,
  groupIds: ReadonlyArray<string>,
): CanvasDocument {
  const index = byId(document.elements);
  const groups = new Set(
    groupIds.filter((id) => {
      const element = index.get(id);
      return element?.kind === "group";
    }),
  );
  if (groups.size === 0) return document;

  const elements = document.elements.flatMap((element) => {
    if (groups.has(element.id)) return [];
    if (!element.parentId || !groups.has(element.parentId)) return [element];

    // 逐层向上跳过被解组的祖先，得到新的父
    let parentId: string | null = element.parentId;
    while (parentId != null && groups.has(parentId)) {
      parentId = index.get(parentId)?.parentId ?? null;
    }
    const position = absolutePositionOf(element, index);
    const parentPosition = sharedParentPosition(parentId, index);
    return [
      {
        ...element,
        parentId,
        x: position.x - parentPosition.x,
        y: position.y - parentPosition.y,
      },
    ];
  });
  return { ...document, elements };
}

/**
 * 级联删除集合（起点 + 全部后代）的唯一实现：删组 / 删元素 / 多选删除共用。
 * 纯函数、定点展开；命令层拿它直接 removeCells（X6 移除时自动断开关联边）。
 */
export function cascadeIdsOf(document: CanvasDocument, startIds: ReadonlyArray<string>): string[] {
  const removed = new Set(startIds);
  let previousSize = 0;
  while (removed.size !== previousSize) {
    previousSize = removed.size;
    for (const element of document.elements) {
      if (element.parentId && removed.has(element.parentId)) removed.add(element.id);
    }
  }
  return [...removed];
}

/** 删除一个组（含其全部后代与相连的边）。 */
export function deleteGroupBranch(document: CanvasDocument, groupId: string): CanvasDocument {
  const index = byId(document.elements);
  if (index.get(groupId)?.kind !== "group") return document;

  const removed = new Set(cascadeIdsOf(document, [groupId]));
  return {
    elements: document.elements.filter((element) => !removed.has(element.id)),
    edges: document.edges.filter(
      (edge) => !removed.has(edge.source.cell) && !removed.has(edge.target.cell),
    ),
  };
}

/** 删除选中集合（含被选组的全部后代 + 关联边）：供选区删除与元素删除共用。 */
export function deleteElements(
  document: CanvasDocument,
  elementIds: ReadonlyArray<string>,
): CanvasDocument {
  const removed = new Set(cascadeIdsOf(document, elementIds));
  return {
    elements: document.elements.filter((element) => !removed.has(element.id)),
    edges: document.edges.filter(
      (edge) => !removed.has(edge.source.cell) && !removed.has(edge.target.cell),
    ),
  };
}
