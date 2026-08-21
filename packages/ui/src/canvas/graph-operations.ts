import type { Edge, Node } from "@xyflow/react";
import type { CanvasElementDTO } from "./document";

type GroupSeed = {
  id: string;
  canvasId: string;
  createdAt: string;
};

function absolutePosition(node: Node, byId: ReadonlyMap<string, Node>): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = byId.get(node.parentId);
  if (!parent) return node.position;
  const parentPosition = absolutePosition(parent, byId);
  return {
    x: parentPosition.x + node.position.x,
    y: parentPosition.y + node.position.y,
  };
}

export function groupSelectedNodes(nodes: Node[], nodeIds: string[], seed: GroupSeed): Node[] {
  const selected = new Set(nodeIds);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const candidates = nodes.filter((node) => {
    if (!selected.has(node.id)) return false;
    let parentId = node.parentId;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId;
    }
    return true;
  });
  if (candidates.length < 2) return nodes;

  const candidateIds = new Set(candidates.map((node) => node.id));
  const boxes = candidates.map((node) => ({
    node,
    position: absolutePosition(node, byId),
    width: node.measured?.width ?? node.width ?? 160,
    height: node.measured?.height ?? node.height ?? 100,
  }));
  const minX = Math.min(...boxes.map((box) => box.position.x));
  const minY = Math.min(...boxes.map((box) => box.position.y));
  const maxX = Math.max(...boxes.map((box) => box.position.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.position.y + box.height));
  const groupAbsolutePosition = { x: minX - 24, y: minY - 44 };
  const sharedParentId = candidates.every((node) => node.parentId === candidates[0].parentId)
    ? (candidates[0].parentId ?? null)
    : null;
  const sharedParent = sharedParentId ? byId.get(sharedParentId) : undefined;
  const sharedParentPosition = sharedParent ? absolutePosition(sharedParent, byId) : { x: 0, y: 0 };
  const groupPosition = {
    x: groupAbsolutePosition.x - sharedParentPosition.x,
    y: groupAbsolutePosition.y - sharedParentPosition.y,
  };
  const groupElement: CanvasElementDTO = {
    id: seed.id,
    canvasId: seed.canvasId,
    parentId: sharedParentId,
    x: groupPosition.x,
    y: groupPosition.y,
    width: maxX - minX + 48,
    height: maxY - minY + 68,
    zIndex: 0,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "" },
  };
  const group: Node = {
    id: seed.id,
    type: "group",
    position: groupPosition,
    width: groupElement.width,
    height: groupElement.height,
    selected: true,
    parentId: sharedParentId ?? undefined,
    extent: sharedParentId ? "parent" : undefined,
    expandParent: sharedParentId ? true : undefined,
    data: { element: groupElement },
  };

  const updated = nodes.map((node) => {
    const box = boxes.find((candidate) => candidate.node.id === node.id);
    if (!box) return selected.has(node.id) ? { ...node, selected: false } : node;
    return {
      ...node,
      selected: false,
      parentId: seed.id,
      extent: "parent" as const,
      expandParent: true,
      position: {
        x: box.position.x - groupAbsolutePosition.x,
        y: box.position.y - groupAbsolutePosition.y,
      },
      data: {
        element: {
          ...(node.data as { element: CanvasElementDTO }).element,
          parentId: seed.id,
        },
      },
    };
  });
  const firstCandidateIndex = nodes.findIndex((node) => candidateIds.has(node.id));
  return [...updated.slice(0, firstCandidateIndex), group, ...updated.slice(firstCandidateIndex)];
}

export function ungroupNodes(nodes: Node[], groupIds: string[]): Node[] {
  const groupIdSet = new Set(groupIds);
  const groups = new Set<string>();
  for (const node of nodes) {
    if (groupIdSet.has(node.id) && node.type === "group") groups.add(node.id);
  }
  if (!groups.size) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const next: Node[] = [];
  for (const node of nodes) {
    if (groups.has(node.id)) continue;
    if (!node.parentId || !groups.has(node.parentId)) {
      next.push(node);
      continue;
    }

    let parentId: string | undefined = node.parentId;
    while (parentId && groups.has(parentId)) parentId = byId.get(parentId)?.parentId;
    const position = absolutePosition(node, byId);
    const parent = parentId ? byId.get(parentId) : undefined;
    const parentPosition = parent ? absolutePosition(parent, byId) : { x: 0, y: 0 };
    next.push({
      ...node,
      parentId,
      extent: parentId ? ("parent" as const) : undefined,
      expandParent: parentId ? true : undefined,
      position: {
        x: position.x - parentPosition.x,
        y: position.y - parentPosition.y,
      },
      data: {
        element: {
          ...(node.data as { element: CanvasElementDTO }).element,
          parentId: parentId ?? null,
        },
      },
    });
  }
  return next;
}

export function deleteGroupBranch(
  nodes: Node[],
  edges: Edge[],
  groupId: string,
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.some((node) => node.id === groupId && node.type === "group")) return { nodes, edges };

  const removed = new Set([groupId]);
  let previousSize = 0;
  while (removed.size !== previousSize) {
    previousSize = removed.size;
    for (const node of nodes) {
      if (node.parentId && removed.has(node.parentId)) removed.add(node.id);
    }
  }
  return {
    nodes: nodes.filter((node) => !removed.has(node.id)),
    edges: edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
  };
}
