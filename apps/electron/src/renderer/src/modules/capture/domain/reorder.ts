import type { DomainTreeNode, ReorderDomainItem } from "@shared/domain";

function findSiblingGroup(nodes: DomainTreeNode[], id: string): DomainTreeNode[] | null {
  if (nodes.some((node) => node.id === id)) return nodes;
  for (const node of nodes) {
    const found = findSiblingGroup(node.children, id);
    if (found) return found;
  }
  return null;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export function buildDomainParentLookup(domains: DomainTreeNode[]): Map<string, string | null> {
  const parentById = new Map<string, string | null>();
  const visit = (nodes: DomainTreeNode[]) => {
    for (const node of nodes) {
      parentById.set(node.id, node.parentId);
      visit(node.children);
    }
  };
  visit(domains);
  return parentById;
}

export function buildSiblingDomainReorderItems(
  domains: DomainTreeNode[],
  activeId: string,
  overId: string,
): ReorderDomainItem[] {
  if (activeId === overId) return [];
  const siblings = findSiblingGroup(domains, activeId);
  if (!siblings?.some((node) => node.id === overId)) return [];

  const activeIndex = siblings.findIndex((node) => node.id === activeId);
  const overIndex = siblings.findIndex((node) => node.id === overId);
  if (activeIndex < 0 || overIndex < 0) return [];

  return moveItem(siblings, activeIndex, overIndex).map((node, sortOrder) => ({
    id: node.id,
    parentId: node.parentId,
    sortOrder,
  }));
}
