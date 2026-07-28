import type { DomainTreeNodeView } from "./domain-tree";

export type DomainTreeSelectNode = {
  id: string;
  label: string;
  pathLabel: string;
  children: readonly DomainTreeSelectNode[];
};

export function toDomainTreeSelectNodes(
  domains: readonly DomainTreeNodeView[],
  parentPath = "",
): DomainTreeSelectNode[] {
  return domains.map((domain) => {
    const pathLabel = parentPath ? `${parentPath} > ${domain.name}` : domain.name;
    return {
      id: domain.id,
      label: domain.name,
      pathLabel,
      children: toDomainTreeSelectNodes(domain.children, pathLabel),
    };
  });
}

export function flattenDomainTreeSelectNodes(
  nodes: readonly DomainTreeSelectNode[],
): DomainTreeSelectNode[] {
  return nodes.flatMap((node) => [node, ...flattenDomainTreeSelectNodes(node.children)]);
}

export function excludeDomainTreeSelectNodes(
  nodes: readonly DomainTreeSelectNode[],
  excludedIds: ReadonlySet<string>,
): DomainTreeSelectNode[] {
  return nodes.flatMap((node) =>
    excludedIds.has(node.id)
      ? []
      : [{ ...node, children: excludeDomainTreeSelectNodes(node.children, excludedIds) }],
  );
}
