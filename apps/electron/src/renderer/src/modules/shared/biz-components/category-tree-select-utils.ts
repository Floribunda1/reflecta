import type { CategoryTreeNode } from "@shared/category";

export interface TreeSelectNode {
  key: string;
  label: string;
  pathLabel: string;
  children: TreeSelectNode[];
}

export function convertToTreeNodes(
  categories: CategoryTreeNode[],
  parentPath = "",
): TreeSelectNode[] {
  return categories.map((cat) => {
    const pathLabel = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
    return {
      key: cat.id,
      label: cat.name,
      pathLabel,
      children: convertToTreeNodes(cat.children, pathLabel),
    };
  });
}

export function flattenTreeNodes(nodes: TreeSelectNode[]): TreeSelectNode[] {
  return nodes.flatMap((node) => [node, ...flattenTreeNodes(node.children)]);
}

export function excludeTreeNodeKeys(
  nodes: TreeSelectNode[],
  excludedKeys: Set<string>,
): TreeSelectNode[] {
  return nodes.flatMap((node) => {
    if (excludedKeys.has(node.key)) return [];
    return [{ ...node, children: excludeTreeNodeKeys(node.children, excludedKeys) }];
  });
}
